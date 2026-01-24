// Test the full flow without modelId
console.log('=== Testing Full Flow WITHOUT modelId ===\n');

// Simulate the actual flow from src/index.ts and src/handlers/messages.ts

// 1. parseDynamicRoute for URL without modelId
const urlWithoutModelId = '/https/api.qnaigc.com/v1/messages';
console.log(`1. URL: ${urlWithoutModelId}`);

// Simplified parseDynamicRoute logic
function parseDynamicRoute(url) {
  let path = url.startsWith('/') ? url.slice(1) : url;
  const parts = path.split('/');

  // For /https/api.qnaigc.com/v1/messages
  // parts = ["https", "api.qnaigc.com", "v1", "messages"]

  const protocol = parts[0];
  const host = parts[1];

  // Find Claude endpoint (simplified)
  // In real code, it looks for "v1" then checks next part
  const claudeEndpointStartIndex = 2; // "v1"
  const targetPathEndIndex = 1; // before "v1"

  const claudeEndpointPath = parts.slice(claudeEndpointStartIndex).join('/');
  const targetPathPrefix = parts.slice(2, targetPathEndIndex + 1).join('/');

  const targetConfig = {
    targetUrl: `${protocol}://${host}`,
    targetPathPrefix: targetPathPrefix ? `/${targetPathPrefix}` : '',
  };

  // No modelId in between, so modelId is undefined
  let modelId;
  const betweenParts = parts.slice(targetPathEndIndex + 1, claudeEndpointStartIndex);
  // betweenParts = [] (empty)

  return {
    targetConfig,
    claudeEndpoint: claudeEndpointPath,
    modelId, // undefined
  };
}

const parsedRoute = parseDynamicRoute(urlWithoutModelId);
console.log('Parsed route:');
console.log(`  targetUrl: "${parsedRoute.targetConfig.targetUrl}"`);
console.log(`  targetPathPrefix: "${parsedRoute.targetConfig.targetPathPrefix}"`);
console.log(`  modelId: ${parsedRoute.modelId === undefined ? 'undefined' : `"${parsedRoute.modelId}"`}`);
console.log(`  claudeEndpoint: "${parsedRoute.claudeEndpoint}"`);

// 2. buildTargetUrl
function buildTargetUrl(targetConfig, endpoint, modelId) {
  let url = `${targetConfig.targetUrl}${targetConfig.targetPathPrefix}`;

  if (modelId) {
    url += `/${modelId}`;
  }

  url += `/${endpoint}`;
  return url;
}

const targetUrl = buildTargetUrl(parsedRoute.targetConfig, parsedRoute.claudeEndpoint, parsedRoute.modelId);
console.log(`\n2. Built target URL: ${targetUrl}`);

// 3. Validation logic (from src/utils/validation.ts:39-41)
console.log('\n3. Validation logic check:');
console.log('   if (!modelId && !request.model) {');
console.log('     throw new ValidationError(\'Either model must be specified in URL or in request body\');');
console.log('   }');
console.log('');
console.log('   modelId is undefined, so validation PASSES if request.body has "model" field');
console.log('   validation FAILS if request.body does NOT have "model" field');

// 4. Handler logic (from src/handlers/messages.ts:34)
console.log('\n4. Handler logic:');
console.log('   const targetModelId = modelId || claudeRequest.model;');
console.log('   // modelId is undefined, so targetModelId = claudeRequest.model');

// 5. Converter call (from src/handlers/messages.ts:37-40)
console.log('\n5. Converter call:');
console.log('   convertClaudeToOpenAIRequest(claudeRequest, targetModelId)');
console.log('   // targetModelId comes from request.body "model" field');

// 6. What the target API expects
console.log('\n6. Target API expectations:');
console.log('   With modelId in URL: https://api.qnaigc.com/abc/v1/messages');
console.log('   Without modelId in URL: https://api.qnaigc.com/v1/messages');
console.log('');
console.log('   Question: Does the target API (api.qnaigc.com) support calls without');
console.log('   a model ID in the path, expecting the model in the request body instead?');

// Test with modelId for comparison
console.log('\n=== For comparison: WITH modelId ===');
const urlWithModelId = '/https/api.qnaigc.com/abc/v1/messages';
console.log(`URL: ${urlWithModelId}`);

// Simplified parse for this URL
function parseWithModelId(url) {
  let path = url.startsWith('/') ? url.slice(1) : url;
  const parts = path.split('/');
  // parts = ["https", "api.qnaigc.com", "abc", "v1", "messages"]

  const protocol = parts[0];
  const host = parts[1];

  // Find Claude endpoint
  const claudeEndpointStartIndex = 3; // "v1"
  const targetPathEndIndex = 1; // before "abc"

  const claudeEndpointPath = parts.slice(claudeEndpointStartIndex).join('/');
  const targetPathPrefix = parts.slice(2, targetPathEndIndex + 1).join('/');
  // Wait, targetPathPrefix should be empty since we have modelId "abc"
  // Actually in real code, modelId "abc" would be extracted

  // Simulating the real logic:
  // betweenParts = parts.slice(2, 3) = ["abc"] → modelId = "abc"
  // targetPathEndIndex adjusted to 1 (before "abc")
  // targetPathPrefix = parts.slice(2, 2) = ""

  const targetConfig = {
    targetUrl: `${protocol}://${host}`,
    targetPathPrefix: '', // empty
  };

  return {
    targetConfig,
    claudeEndpoint: claudeEndpointPath,
    modelId: 'abc',
  };
}

const parsedWithModelId = parseWithModelId(urlWithModelId);
console.log(`Parsed route:`);
console.log(`  targetUrl: "${parsedWithModelId.targetConfig.targetUrl}"`);
console.log(`  targetPathPrefix: "${parsedWithModelId.targetConfig.targetPathPrefix}"`);
console.log(`  modelId: "${parsedWithModelId.modelId}"`);
console.log(`  claudeEndpoint: "${parsedWithModelId.claudeEndpoint}"`);

const targetUrlWithModel = buildTargetUrl(parsedWithModelId.targetConfig, parsedWithModelId.claudeEndpoint, parsedWithModelId.modelId);
console.log(`Built target URL: ${targetUrlWithModel}`);