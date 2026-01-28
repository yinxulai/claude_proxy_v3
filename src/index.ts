/**
 * Main router and middleware for Claude Proxy v3
 *
 * Handles dynamic routing to target APIs and converts between Claude and OpenAI formats.
 */

import { Env } from './types/shared';
import { parseDynamicRoute, getHandlerType, buildTargetUrl, extractAuthHeaders } from './utils/routing';
import { createErrorResponse } from './utils/errors';
import { handleModelsRequest } from './handlers/models';
import { handleTokenCountingRequest } from './handlers/token-counting';
import { handleMessagesRequest } from './handlers/messages';

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Apply CORS headers to response
 */
function applyCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);

  // Allow all origins for development
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-beta');
  newHeaders.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
function handleOptionsRequest(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, anthropic-beta',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = generateRequestId();

    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return handleOptionsRequest();
      }

      const url = new URL(request.url);
      const path = url.pathname;

      // Skip favicon requests
      if (path === '/favicon.ico') {
        return new Response(null, { status: 204 });
      }

      // Parse dynamic routing from URL
      const parsedRoute = parseDynamicRoute(path);
      const { targetConfig, claudeEndpoint, modelId } = parsedRoute;

      // Determine handler type based on Claude endpoint
      const handlerType = getHandlerType(claudeEndpoint);

      // Build target URL
      const targetUrl = buildTargetUrl(targetConfig, claudeEndpoint, modelId);

      // Extract authentication headers
      const authHeaders = extractAuthHeaders(request);

      // Route to appropriate handler
      let response: Response;
      switch (handlerType) {
        case 'models':
          response = await handleModelsRequest(request, targetUrl, authHeaders, requestId);
          break;

        case 'token-counting':
          response = await handleTokenCountingRequest(request, targetUrl, authHeaders, requestId, env);
          break;

        case 'messages':
          response = await handleMessagesRequest(request, targetUrl, authHeaders, requestId, modelId);
          break;

        default:
          throw new Error(`Unsupported handler type: ${handlerType}`);
      }

      // Apply CORS headers
      return applyCorsHeaders(response);

    } catch (error) {
      // Handle errors with Claude API format
      console.error(`[${requestId}] Error processing request:`, error);
      return createErrorResponse(error as Error, requestId);
    }
  },
};