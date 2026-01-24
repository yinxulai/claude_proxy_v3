/**
 * Token Counting API handler for Claude Proxy v3
 *
 * Handles POST /v1/messages/count_tokens endpoint
 */

import { ClaudeTokenCountingRequest, ClaudeTokenCountingResponse } from '../types/claude';
import { OpenAITokenCountingRequest, OpenAITokenCountingResponse } from '../types/openai';
import { convertClaudeTokenCountingToOpenAI } from '../converters/claude-to-openai';
import { convertOpenAITokenCountingToClaude } from '../converters/openai-to-claude';
import { validateClaudeTokenCountingRequest, validateAuthHeaders } from '../utils/validation';
import { handleTargetApiError } from '../utils/errors';

/**
 * Handle token counting API request
 */
export async function handleTokenCountingRequest(
  request: Request,
  targetUrl: string,
  authHeaders: Record<string, string>,
  requestId: string
): Promise<Response> {
  // Parse request body
  const requestBody = await request.json() as ClaudeTokenCountingRequest;
  const claudeRequest = requestBody;

  // Validate request
  validateClaudeTokenCountingRequest(claudeRequest);
  validateAuthHeaders(authHeaders);

  // Convert Claude request to OpenAI format
  const openaiRequest: OpenAITokenCountingRequest = convertClaudeTokenCountingToOpenAI(
    claudeRequest,
    claudeRequest.model,
    requestId
  );

  // Log upstream request headers
  console.log(`[${requestId}] [DEBUG] Upstream request headers:`, {
    'Content-Type': 'application/json',
    ...authHeaders,
  });
  console.log(`[${requestId}] [DEBUG] Upstream request body:`, openaiRequest);

  // Make request to target API
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
    handleTargetApiError(response, 'Token Counting API');
  }

  // Parse target API response
  const responseText = await response.text();
  console.log(`[${requestId}] [DEBUG] Upstream response body:`, responseText);

  const openaiResponse: OpenAITokenCountingResponse = JSON.parse(responseText);

  // Convert to Claude format
  const claudeResponse: ClaudeTokenCountingResponse = convertOpenAITokenCountingToClaude(openaiResponse);

  // Return response with Claude headers
  return new Response(JSON.stringify(claudeResponse), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': requestId,
    },
  });
}