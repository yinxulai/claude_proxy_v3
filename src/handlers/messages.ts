/**
 * Messages API handler for Claude Proxy v3
 *
 * Handles POST /v1/messages endpoint with extended thinking support
 */

import { ClaudeMessagesRequest, ClaudeMessagesResponse } from '../types/claude';
import { OpenAIRequest, OpenAIResponse } from '../types/openai';
import { convertClaudeToOpenAIRequest } from '../converters/claude-to-openai';
import { convertOpenAIToClaudeResponse } from '../converters/openai-to-claude';
import { createStreamTransformer } from '../converters/streaming';
import { validateClaudeMessagesRequest, validateAuthHeaders } from '../utils/validation';
import { handleTargetApiError } from '../utils/errors';

/**
 * Handle messages API request
 */
export async function handleMessagesRequest(
  request: Request,
  targetUrl: string,
  authHeaders: Record<string, string>,
  requestId: string,
  modelId?: string
): Promise<Response> {
  // Parse request body
  const requestBody = await request.json() as ClaudeMessagesRequest;
  const claudeRequest = requestBody;

  // Validate request
  validateClaudeMessagesRequest(claudeRequest, modelId);
  validateAuthHeaders(authHeaders);

  // Use model from URL if provided, otherwise from request
  const targetModelId = modelId || claudeRequest.model;

  // Convert Claude request to OpenAI format
  const openaiRequest: OpenAIRequest = convertClaudeToOpenAIRequest(
    claudeRequest,
    targetModelId
  );
  if (targetUrl.includes('v1/messages')) {
    targetUrl = targetUrl.replace('v1/messages', 'v1/chat/completions')
  }

  // Check if streaming is requested
  const isStreaming = claudeRequest.stream === true;

  // Log upstream request headers
  console.log(`[${requestId}] [DEBUG] Upstream request headers:`, {
    'Content-Type': 'application/json',
    ...authHeaders,
  });
  console.log(`[${requestId}] [DEBUG] Upstream request body:`, openaiRequest);

  // Make request to target API
  console.log(`[${requestId}] [DEBUG] Upstream request url: ${targetUrl}`)
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(openaiRequest),
  });

  // Handle target API errors
  if (!response.ok) {
    handleTargetApiError(response, 'Messages API');
  }

  // Handle streaming response
  if (isStreaming) {
    return handleStreamingResponse(response, targetModelId, requestId);
  }

  // Handle non-streaming response
  return handleNonStreamingResponse(response, targetModelId, requestId);
}

/**
 * Handle non-streaming response
 */
async function handleNonStreamingResponse(
  response: Response,
  model: string,
  requestId: string
): Promise<Response> {
  try {
    // Parse target API response
    const responseText = await response.text();
    console.log(`[${requestId}] [DEBUG] Upstream response body:`, responseText);

    const openaiResponse: OpenAIResponse = JSON.parse(responseText);

    // Convert to Claude format
    const claudeResponse: ClaudeMessagesResponse = convertOpenAIToClaudeResponse(
      openaiResponse,
      model,
      requestId
    );

    // Return response with Claude headers
    return new Response(JSON.stringify(claudeResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': requestId,
      },
    });
  } catch (error) {
    console.error(`[${requestId}] Error converting response:`, error);
    throw new Error(`Failed to convert response: ${(error as Error).message}`);
  }
}

/**
 * Handle streaming response
 */
async function handleStreamingResponse(
  response: Response,
  model: string,
  requestId: string
): Promise<Response> {
  // Check if response body exists and is readable
  if (!response.body) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();

  try {
    // Log streaming response
    console.log(`[${requestId}] [DEBUG] Upstream streaming response started`);

    // Create streaming transformer
    const transformer = createStreamTransformer(model, requestId);

    // Create a tee to read the raw response while also transforming it
    const [stream1, stream2] = response.body.tee();

    // Read and log raw chunks from stream2
    const reader = stream2.getReader();
    const logRawChunks = async () => {
      try {
        let rawData = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          rawData += decoder.decode(value, { stream: true });
          // Log when we have complete lines
          const lines = rawData.split('\n');
          if (lines.length > 1) {
            for (const line of lines.slice(0, -1)) {
              if (line.startsWith('data: ')) {
                const data = line.substring(6);
                if (data.trim() !== '[DONE]') {
                  console.log(`[${requestId}] [DEBUG] Upstream SSE chunk:`, data);
                }
              }
            }
            rawData = lines[lines.length - 1] || '';
          }
        }
      } catch (e) {
        console.error(`[${requestId}] Error logging raw chunks:`, e);
      }
    };

    // Start logging in background
    logRawChunks();

    // Create transformed stream from stream1
    const transformedStream = stream1
      .pipeThrough(new TransformStream(transformer));

    // Return streaming response with proper headers
    return new Response(transformedStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'x-request-id': requestId,
      },
    });
  } catch (error) {
    console.error(`[${requestId}] Error creating streaming response:`, error);
    throw new Error(`Failed to create streaming response: ${(error as Error).message}`);
  }
}
