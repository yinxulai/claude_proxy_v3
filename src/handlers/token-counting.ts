/**
 * Token Counting API handler for Claude Proxy v3
 *
 * Handles POST /v1/messages/count_tokens endpoint
 *
 * Features:
 * - Supports both API-based and local token counting
 * - Local counting is enabled via LOCAL_TOKEN_COUNTING=true environment variable
 * - Falls back to API-based counting if local counting is disabled or fails
 */

import { Env } from '../types/shared';
import { Logger, createLogger } from '../utils/logger';
import { ClaudeTokenCountingRequest, ClaudeTokenCountingResponse } from '../types/claude';
import { OpenAIResponse, OpenAITokenCountingRequest } from '../types/openai';
import { convertClaudeTokenCountingToOpenAI } from '../converters/claude-to-openai';
import { validateClaudeTokenCountingRequest, validateAuthHeaders } from '../utils/validation';
import { handleTargetApiError } from '../utils/errors';
import {
  countClaudeRequestTokens,
  getLocalTokenCountingConfig,
  TokenCountingOptions
} from '../utils/token-counting';

/**
 * Handle token counting API request
 *
 * @param request - Incoming request
 * @param targetUrl - Target API URL
 * @param authHeaders - Authentication headers
 * @param requestId - Request ID for logging
 * @param env - Environment variables (Cloudflare Workers)
 * @param logger - Logger instance
 * @returns Response with token count
 */
export async function handleTokenCountingRequest(
  request: Request,
  targetUrl: string,
  authHeaders: Record<string, string>,
  requestId: string,
  env?: Env,
  logger?: Logger
): Promise<Response> {
  const activeLogger = logger ?? createLogger((env ?? {}) as Record<string, unknown>);
  // Parse request body
  const requestBody = await request.json() as ClaudeTokenCountingRequest;
  const claudeRequest = requestBody;

  // Calculate max image data size from environment or use default
  const maxImageDataSize = env?.IMAGE_BLOCK_DATA_MAX_SIZE
    ? parseInt(env.IMAGE_BLOCK_DATA_MAX_SIZE, 10)
    : 1 * 1024 * 1024; // Default 1MB

  // Validate request
  validateClaudeTokenCountingRequest(claudeRequest, maxImageDataSize);
  validateAuthHeaders(authHeaders);

  // Use env for local config (cast to Record<string, string> for compatibility)
  const localConfig = getLocalTokenCountingConfig(env as unknown as Record<string, string> | undefined);

  if (localConfig.enabled) {
    activeLogger.info(requestId, `Using local token counting (factor: ${localConfig.factor})`);
    return handleLocalTokenCounting(claudeRequest, requestId, localConfig, activeLogger);
  }

  // Fall back to API-based token counting
  return handleApiBasedTokenCounting(claudeRequest, targetUrl, authHeaders, requestId, activeLogger);
}

/**
 * Handle token counting using local estimation
 *
 * This uses a character-based approximation for token counting.
 * No API call is made, making it free and fast.
 */
function handleLocalTokenCounting(
  claudeRequest: ClaudeTokenCountingRequest,
  requestId: string,
  localConfig: { enabled: boolean; factor: number },
  logger: Logger
): Response {
  const options: TokenCountingOptions = {
    useLocalCounting: true,
    charactersPerToken: localConfig.factor,
    countWhitespace: true,
  };

  // Count tokens using local estimation
  const inputTokens = countClaudeRequestTokens(claudeRequest, options);

  logger.debug(requestId, `Local token count: ${inputTokens}`);

  const response: ClaudeTokenCountingResponse = {
    type: "token_count",
    input_tokens: inputTokens,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': requestId,
      'x-token-counting': 'local',
    },
  });
}

/**
 * Handle token counting using API-based approach
 *
 * This sends a request to the target API's chat completions endpoint
 * and extracts the usage information from the response.
 *
 * Note: This may incur API costs and make an actual API call.
 */
async function handleApiBasedTokenCounting(
  claudeRequest: ClaudeTokenCountingRequest,
  targetUrl: string,
  authHeaders: Record<string, string>,
  requestId: string,
  logger: Logger
): Promise<Response> {
  // Convert Claude request to OpenAI format
  const openaiRequest: OpenAITokenCountingRequest = convertClaudeTokenCountingToOpenAI(
    claudeRequest,
    claudeRequest.model,
    requestId
  );

  // Convert endpoint from Claude format to OpenAI format
  // /v1/messages/count_tokens -> /v1/chat/completions
  if (targetUrl.includes('v1/messages/count_tokens')) {
    targetUrl = targetUrl.replace('v1/messages/count_tokens', 'v1/chat/completions');
  }

  // Log request info (without auth keys for security)
  logger.debug(requestId, `Upstream request url: ${targetUrl}`);
  logger.debug(requestId, `Has auth headers: ${!!authHeaders['Authorization'] || !!authHeaders['x-api-key']}`);
  logger.info(requestId, 'Using API-based token counting (may incur costs)');

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

  const openaiResponse: OpenAIResponse = JSON.parse(responseText);

  // Extract input tokens from usage
  const inputTokens = openaiResponse.usage?.prompt_tokens ?? 0;
  logger.debug(requestId, `Token count: ${inputTokens}`);

  // Build Claude format response
  const claudeResponse: ClaudeTokenCountingResponse = {
    type: "token_count",
    input_tokens: inputTokens,
  };

  // Return response with Claude headers
  return new Response(JSON.stringify(claudeResponse), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': requestId,
      'x-token-counting': 'api',
    },
  });
}
