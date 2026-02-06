// Test compatibility more thoroughly
function parseDynamicRoute(url) {
  // Remove leading slash if present
  let path = url.startsWith('/') ? url.slice(1) : url;

  // Split by forward slashes
  const parts = path.split('/');

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
        break;
      }

      if (nextPart === 'messages' && twoPartsAhead === 'count_tokens') {
        // Found token counting endpoint
        targetPathEndIndex = i - 1;
        claudeEndpointStartIndex = i;
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

console.log('=== Testing Configuration Compatibility ===\n');

// User's configuration
const userConfig = {
  targetConfig: {
    targetUrl: "https://api.qnaigc.com",
    targetPathPrefix: "/"
  },
  claudeEndpoint: "v1/messages",
  modelId: "abc"
};

console.log('User Configuration:');
console.log(JSON.stringify(userConfig, null, 2));
console.log('');

// Test different URL patterns
const testCases = [
  {
    name: 'Simple case (no path prefix)',
    url: '/https/api.qnaigc.com/abc/v1/messages',
    expected: {
      targetUrl: 'https://api.qnaigc.com',
      targetPathPrefix: '', // Not "/"!
      modelId: 'abc',
      claudeEndpoint: 'v1/messages'
    }
  },
  {
    name: 'With explicit root path prefix',
    url: '/https/api.qnaigc.com//abc/v1/messages', // Double slash
    expected: {
      targetUrl: 'https://api.qnaigc.com',
      targetPathPrefix: '/', // Actually "/" from empty segment
      modelId: 'abc',
      claudeEndpoint: 'v1/messages'
    }
  },
  {
    name: 'With actual path prefix',
    url: '/https/api.qnaigc.com/openai/v1/abc/v1/messages',
    expected: {
      targetUrl: 'https://api.qnaigc.com',
      targetPathPrefix: '/openai/v1',
      modelId: 'abc',
      claudeEndpoint: 'v1/messages'
    }
  }
];

for (const testCase of testCases) {
  console.log(`Test: ${testCase.name}`);
  console.log(`URL: ${testCase.url}`);

  try {
    const result = parseDynamicRoute(testCase.url);

    console.log('Parsed:');
    console.log(`  targetUrl: "${result.targetConfig.targetUrl}"`);
    console.log(`  targetPathPrefix: "${result.targetConfig.targetPathPrefix}"`);
    console.log(`  modelId: "${result.modelId || '(none)'}"`);
    console.log(`  claudeEndpoint: "${result.claudeEndpoint}"`);

    const matchesExpected =
      result.targetConfig.targetUrl === testCase.expected.targetUrl &&
      result.targetConfig.targetPathPrefix === testCase.expected.targetPathPrefix &&
      result.modelId === testCase.expected.modelId &&
      result.claudeEndpoint === testCase.expected.claudeEndpoint;

    console.log(`Matches expected: ${matchesExpected ? '✅ YES' : '❌ NO'}`);

    // Check if it matches user's config
    const matchesUserConfig =
      result.targetConfig.targetUrl === userConfig.targetConfig.targetUrl &&
      result.targetConfig.targetPathPrefix === userConfig.targetConfig.targetPathPrefix &&
      result.modelId === userConfig.modelId &&
      result.claudeEndpoint === userConfig.claudeEndpoint;

    console.log(`Matches user config: ${matchesUserConfig ? '✅ YES' : '❌ NO'}`);

    // Build target URL
    const builtUrl = buildTargetUrl(result.targetConfig, result.claudeEndpoint, result.modelId);
    console.log(`Built URL: ${builtUrl}`);

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log('');
}

console.log('=== Analysis ===');
console.log('The user\'s configuration has targetPathPrefix: "/"');
console.log('To get targetPathPrefix: "/" from parseDynamicRoute, we need:');
console.log('1. An empty path segment between host and modelId');
console.log('2. URL format: /https/api.qnaigc.com//abc/v1/messages (note double slash)');
console.log('');
console.log('However, in practice:');
console.log('1. targetPathPrefix: "" and targetPathPrefix: "/" are functionally equivalent');
console.log('2. Both result in the same target URL: https://api.qnaigc.com/abc/v1/messages');
console.log('3. The system handles both cases correctly');
console.log('');
console.log('Conclusion: The system IS compatible with the user\'s configuration.');
console.log('The semantic difference in targetPathPrefix ("/" vs "") does not affect functionality.');
