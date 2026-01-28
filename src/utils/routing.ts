/**
 * Dynamic routing utility for Claude Proxy v3
 *
 * Handles URL patterns like:
 * - /v1/models (Models API)
 * - /https/api.qnaigc.com/v1/models (Models API)
 * - /https/api.qnaigc.com/openai/v1/models/llama3-70b-8192/v1/messages/count_tokens (Token Counting API)
 * - /https/api.qnaigc.com/openai/v1/models/llama3-70b-8192/v1/messages (Messages API)
 */

import { validateBetaFeatures } from './beta-features';

import { validateBetaFeatures as validateBetaFeaturesUtil } from './beta-features';

export interface TargetConfig {
  targetUrl: string;
  targetPathPrefix: string;
}

export interface ParsedRoute {
  targetConfig: TargetConfig;
  claudeEndpoint: string;
  modelId?: string;
}

/**
 * Parse dynamic routing URL
 *
 * Expected format: /{claude_endpoint}
 * Expected format: /{protocol}{host}{path_prefix}/{model_id?}/{claude_endpoint}
 *
 * Examples:
 * - /v1/models
 * - /https/api.qnaigc.com/openai/v1/models
 * - /https/api.qnaigc.com/openai/v1/models/llama3-70b-8192/v1/messages
 * - /https/api.qnaigc.com/openai/v1/models/llama3-70b-8192/v1/messages/count_tokens
 */
export function parseDynamicRoute(url: string): ParsedRoute {
  // Remove leading slash if present
  let path = url.startsWith('/') ? url.slice(1) : url;

  // Split by forward slashes
  const parts = path.split('/');

  console.log(`[DEBUG] parseDynamicRoute called with url: ${url}`);
  console.log(`[DEBUG] Parts: ${JSON.stringify(parts)}`);

  if (parts.length < 4) {
    throw new Error(`Invalid URL format: ${url}. Expected format: /{protocol}{host}{path_prefix}/{model_id?}/{claude_endpoint}`);
  }

  // First part is the protocol (http or https)
  const protocol = parts[0];
  if (protocol !== 'http' && protocol !== 'https') {
    throw new Error(`Invalid protocol: ${protocol}. Must be 'http' or 'https'`);
  }

  // Second part is the host (e.g., api.qnaigc.com)
  let host = parts[1];

  // Find where the target API path ends and Claude endpoint begins
  // We look for known Claude endpoints: v1/models, v1/messages, v1/messages/count_tokens
  let targetPathEndIndex = -1;
  let claudeEndpointStartIndex = -1;

  // Look for Claude endpoint patterns from the end
  for (let i = parts.length - 1; i >= 2; i--) {
    if (parts[i] === 'v1') {
      // Check if this is a Claude endpoint
      const nextPart = i + 1 < parts.length ? parts[i + 1] : null;
      const twoPartsAhead = i + 2 < parts.length ? parts[i + 2] : null;

      if (nextPart === 'models' || nextPart === 'messages') {
        // Found a potential Claude endpoint
        targetPathEndIndex = i - 1;
        claudeEndpointStartIndex = i;
        console.log(`[DEBUG] Found Claude endpoint at index ${i}: ${parts[i]}/${nextPart}`);
        console.log(`[DEBUG] targetPathEndIndex: ${targetPathEndIndex}, claudeEndpointStartIndex: ${claudeEndpointStartIndex}`);
        break;
      }

      if (nextPart === 'messages' && twoPartsAhead === 'count_tokens') {
        // Found token counting endpoint
        targetPathEndIndex = i - 1;
        claudeEndpointStartIndex = i;
        console.log(`[DEBUG] Found token counting endpoint at index ${i}: ${parts[i]}/${nextPart}/${twoPartsAhead}`);
        console.log(`[DEBUG] targetPathEndIndex: ${targetPathEndIndex}, claudeEndpointStartIndex: ${claudeEndpointStartIndex}`);
        break;
      }
    }
  }

  if (targetPathEndIndex === -1 || claudeEndpointStartIndex === -1) {
    throw new Error(`Could not locate Claude endpoint in URL: ${url}`);
  }

  // Extract Claude endpoint path
  const claudeEndpointPath = parts.slice(claudeEndpointStartIndex).join('/');

  // Determine if there's a model ID between target path and Claude endpoint
  let modelId: string | undefined;
  const betweenParts = parts.slice(targetPathEndIndex + 1, claudeEndpointStartIndex);
  if (betweenParts.length === 1) {
    // Likely a model ID
    modelId = betweenParts[0];
  } else if (betweenParts.length > 1) {
    // This might be part of the target path, adjust accordingly
    targetPathEndIndex = claudeEndpointStartIndex - 1;
    modelId = undefined;

    // Recalculate
    const newTargetPathPrefix = parts.slice(2, targetPathEndIndex + 1).join('/');
    throw new Error(`Unclear URL structure. Between target path '${newTargetPathPrefix}' and Claude endpoint '${claudeEndpointPath}' found: ${betweenParts.join('/')}`);
  } else if (betweenParts.length === 0) {
    // Check if the last element of target path prefix might be a model ID
    // Model IDs typically don't contain slashes and aren't common API path segments
    const targetPathParts = parts.slice(2, targetPathEndIndex + 1);
    if (targetPathParts.length > 0) {
      const lastPart = targetPathParts[targetPathParts.length - 1];
      // Check if last part looks like a model ID (not a common API path segment)
      const commonPathSegments = ['v1', 'v2', 'models', 'messages', 'completions', 'chat', 'openai', 'api'];
      if (!commonPathSegments.includes(lastPart) &&
          !lastPart.includes('/') &&
          lastPart.length > 0) {
        // This might be a model ID, extract it
        modelId = lastPart;
        // Adjust target path prefix to exclude the model ID
        targetPathEndIndex = targetPathEndIndex - 1;
      }
    }
  }

  // Recalculate target path prefix in case we adjusted for model ID
  const targetPathPrefix = parts.slice(2, targetPathEndIndex + 1).join('/');

  const targetConfig: TargetConfig = {
    targetUrl: `${protocol}://${host}`,
    targetPathPrefix: targetPathPrefix ? `/${targetPathPrefix}` : '',
  };

  return {
    targetConfig,
    claudeEndpoint: claudeEndpointPath,
    modelId,
  };
}

/**
 * Build target URL for API request
 */
export function buildTargetUrl(targetConfig: TargetConfig, endpoint: string, modelId?: string): string {
  let url = `${targetConfig.targetUrl}${targetConfig.targetPathPrefix}`;

  if (modelId) {
    url += `/${modelId}`;
  }

  url += `/${endpoint}`;
  return url;
}

/**
 * Extract authentication headers from request
 *
 * Supports both Authorization and X-Api-Key headers.
 * If X-Api-Key is provided but Authorization is missing,
 * converts X-Api-Key to Authorization: Bearer format.
 */
export function extractAuthHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};

  // Extract Authorization header
  let authHeader = request.headers.get('Authorization');

  // Extract API key header
  const apiKeyHeader = request.headers.get('x-api-key');

  // If X-Api-Key is provided but Authorization is missing, convert it
  if (apiKeyHeader && !authHeader) {
    // Check if X-Api-Key already has Bearer prefix
    if (apiKeyHeader.startsWith('Bearer ')) {
      headers['Authorization'] = apiKeyHeader;
    } else {
      headers['Authorization'] = `Bearer ${apiKeyHeader}`;
    }
    console.log(`[DEBUG] Converted X-Api-Key to Authorization header`);
  } else if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  // Forward beta feature headers
  const betaVersionHeader = request.headers.get('anthropic-beta');
  if (betaVersionHeader) {
    // Validate beta features
    const validatedFeatures = validateBetaFeaturesUtil(betaVersionHeader);
    if (validatedFeatures) {
      headers['anthropic-beta'] = JSON.stringify(validatedFeatures);
    } else {
      // Forward as-is if validation fails (should still work)
      headers['anthropic-beta'] = betaVersionHeader;
    }
  }

  return headers;
}

/**
 * Determine handler type based on Claude endpoint
 */
export function getHandlerType(claudeEndpoint: string): 'models' | 'token-counting' | 'messages' {
  if (claudeEndpoint === 'v1/models') {
    return 'models';
  }

  if (claudeEndpoint === 'v1/messages/count_tokens') {
    return 'token-counting';
  }

  if (claudeEndpoint.startsWith('v1/messages')) {
    return 'messages';
  }

  throw new Error(`Unknown Claude endpoint: ${claudeEndpoint}`);
}
