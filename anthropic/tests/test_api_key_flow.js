// Test API key forwarding to upstream API
console.log('=== Testing API Key Forwarding Flow ===\n');

// Simulate the actual flow from the codebase

// 1. extractAuthHeaders function (from src/utils/routing.ts:162-191)
function extractAuthHeaders(request) {
  const headers = {};

  // Extract common authentication headers
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  // Extract API key headers
  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader) {
    headers['x-api-key'] = apiKeyHeader;
  }

  // Forward beta feature headers
  const betaVersionHeader = request.headers.get('anthropic-beta');
  if (betaVersionHeader) {
    // Simplified - in real code it validates beta features
    headers['anthropic-beta'] = betaVersionHeader;
  }

  return headers;
}

// 2. validateAuthHeaders function (from src/utils/validation.ts:386-390)
function validateAuthHeaders(headers) {
  if (!headers['Authorization'] && !headers['x-api-key']) {
    throw new Error('Either Authorization header or x-api-key header is required');
  }
}

// 3. Simulate a Request with headers
console.log('1. Creating a request with authentication headers...\n');

// Create a mock Request object
const mockRequest = {
  headers: new Map([
    ['Authorization', 'Bearer sk-test-1234567890'],
    ['Content-Type', 'application/json'],
    ['anthropic-beta', 'max-tokens-2025-02-01']
  ]),
  get: function(key) {
    return this.headers.get(key);
  }
};

// Alternative: Using x-api-key instead of Authorization
const mockRequestWithApiKey = {
  headers: new Map([
    ['x-api-key', 'sk-test-api-key-987654321'],
    ['Content-Type', 'application/json']
  ]),
  get: function(key) {
    return this.headers.get(key);
  }
};

// 4. Test extractAuthHeaders
console.log('2. Testing extractAuthHeaders()...\n');

console.log('Test Case A: With Authorization header');
const authHeaders1 = extractAuthHeaders(mockRequest);
console.log('Extracted headers:', JSON.stringify(authHeaders1, null, 2));
console.log('');

console.log('Test Case B: With x-api-key header');
const authHeaders2 = extractAuthHeaders(mockRequestWithApiKey);
console.log('Extracted headers:', JSON.stringify(authHeaders2, null, 2));
console.log('');

// 5. Test validateAuthHeaders
console.log('3. Testing validateAuthHeaders()...\n');

try {
  validateAuthHeaders(authHeaders1);
  console.log('✅ Validation passed for Authorization header');
} catch (error) {
  console.log('❌ Validation failed:', error.message);
}

try {
  validateAuthHeaders(authHeaders2);
  console.log('✅ Validation passed for x-api-key header');
} catch (error) {
  console.log('❌ Validation failed:', error.message);
}

// Test with empty headers
try {
  validateAuthHeaders({});
  console.log('✅ Validation passed for empty headers (UNEXPECTED)');
} catch (error) {
  console.log('❌ Validation failed (EXPECTED):', error.message);
}

console.log('\n4. Full Flow Simulation\n');

// Simulate the flow from src/index.ts
console.log('Step 1: Client sends request to proxy with headers:');
console.log('  - URL: POST /https/api.qnaigc.com/v1/messages');
console.log('  - Headers: Authorization: Bearer sk-test-1234567890');
console.log('  - Body: { "model": "abc", "messages": [...] }');
console.log('');

console.log('Step 2: Proxy extracts authentication headers:');
console.log('  extractAuthHeaders(request) →');
console.log('  { "Authorization": "Bearer sk-test-1234567890" }');
console.log('');

console.log('Step 3: Proxy validates headers:');
console.log('  validateAuthHeaders(authHeaders) → OK');
console.log('');

console.log('Step 4: Proxy forwards to upstream API:');
console.log('  fetch("https://api.qnaigc.com/v1/messages", {');
console.log('    method: "POST",');
console.log('    headers: {');
console.log('      "Content-Type": "application/json",');
console.log('      "Authorization": "Bearer sk-test-1234567890"');
console.log('    },');
console.log('    body: JSON.stringify(openaiRequest)');
console.log('  })');
console.log('');

console.log('5. Supported Authentication Methods\n');

console.log('Method 1: Authorization header (Bearer token)');
console.log('  Client sends: Authorization: Bearer sk-xxx');
console.log('  Proxy forwards: Authorization: Bearer sk-xxx');
console.log('');

console.log('Method 2: x-api-key header');
console.log('  Client sends: x-api-key: sk-xxx');
console.log('  Proxy forwards: x-api-key: sk-xxx');
console.log('');

console.log('Method 3: Both headers (if target API accepts)');
console.log('  Client sends: Authorization: Bearer sk-xxx AND x-api-key: sk-yyy');
console.log('  Proxy forwards: Both headers');
console.log('');

console.log('6. Important Notes\n');

console.log('• The proxy does NOT modify authentication headers');
console.log('• Headers are forwarded exactly as received');
console.log('• Client must include valid auth headers for target API');
console.log('• Target API (api.qnaigc.com) must accept the provided auth method');
console.log('• If both Authorization and x-api-key are sent, both are forwarded');
console.log('• The proxy validates that at least ONE auth header is present');