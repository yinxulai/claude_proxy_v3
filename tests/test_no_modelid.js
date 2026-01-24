// Test URLs without modelId
function parseDynamicRoute(url) {
  // Remove leading slash if present
  let path = url.startsWith('/') ? url.slice(1) : url;

  // Split by forward slashes
  const parts = path.split('/');

  console.log(`Parts: ${JSON.stringify(parts)}`);

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
        console.log(`Found Claude endpoint at index ${i}: ${parts[i]}/${nextPart}`);
        console.log(`targetPathEndIndex: ${targetPathEndIndex}, claudeEndpointStartIndex: ${claudeEndpointStartIndex}`);
        break;
      }

      if (nextPart === 'messages' && twoPartsAhead === 'count_tokens') {
        // Found token counting endpoint
        targetPathEndIndex = i - 1;
        claudeEndpointStartIndex = i;
        console.log(`Found token counting endpoint at index ${i}: ${parts[i]}/${nextPart}/${twoPartsAhead}`);
        console.log(`targetPathEndIndex: ${targetPathEndIndex}, claudeEndpointStartIndex: ${claudeEndpointStartIndex}`);
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
  let modelId;
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

  const targetConfig = {
    targetUrl: `${protocol}://${host}`,
    targetPathPrefix: targetPathPrefix ? `/${targetPathPrefix}` : '',
  };

  return {
    targetConfig,
    claudeEndpoint: claudeEndpointPath,
    modelId,
  };
}

function buildTargetUrl(targetConfig, endpoint, modelId) {
  let url = `${targetConfig.targetUrl}${targetConfig.targetPathPrefix}`;

  if (modelId) {
    url += `/${modelId}`;
  }

  url += `/${endpoint}`;
  return url;
}

console.log('=== Testing URLs WITHOUT modelId ===\n');

// Test cases without modelId
const testCases = [
  {
    name: 'URL without modelId (just endpoint)',
    url: '/https/api.qnaigc.com/v1/messages',
    description: 'Host directly followed by v1/messages'
  },
  {
    name: 'URL with path prefix but no modelId',
    url: '/https/api.qnaigc.com/openai/v1/v1/messages',
    description: 'Has path prefix /openai/v1, no modelId'
  },
  {
    name: 'URL with root path prefix and no modelId',
    url: '/https/api.qnaigc.com//v1/messages',
    description: 'Double slash for root path, no modelId'
  },
  {
    name: 'For comparison: URL with modelId',
    url: '/https/api.qnaigc.com/abc/v1/messages',
    description: 'Has modelId "abc"'
  }
];

for (const testCase of testCases) {
  console.log(`Test: ${testCase.name}`);
  console.log(`Description: ${testCase.description}`);
  console.log(`URL: ${testCase.url}`);

  try {
    const result = parseDynamicRoute(testCase.url);

    console.log('Parsed:');
    console.log(`  targetUrl: "${result.targetConfig.targetUrl}"`);
    console.log(`  targetPathPrefix: "${result.targetConfig.targetPathPrefix}"`);
    console.log(`  modelId: "${result.modelId || '(none/undefined)'}"`);
    console.log(`  claudeEndpoint: "${result.claudeEndpoint}"`);

    // Build target URL
    const builtUrl = buildTargetUrl(result.targetConfig, result.claudeEndpoint, result.modelId);
    console.log(`Built URL: ${builtUrl}`);

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log('');
}

console.log('=== Analysis ===');
console.log('The validation logic (src/utils/validation.ts:39-41) says:');
console.log('  if (!modelId && !request.model) {');
console.log('    throw new ValidationError(\'Either model must be specified in URL or in request body\');');
console.log('  }');
console.log('');
console.log('This means:');
console.log('1. If modelId is provided in URL → use it');
console.log('2. If modelId is NOT in URL → require request.model in request body');
console.log('3. If neither → validation error');
console.log('');
console.log('So the system CAN work without modelId in URL, BUT:');
console.log('- The request body MUST include a "model" field');
console.log('- The target URL will be built without /{modelId}/ segment');
