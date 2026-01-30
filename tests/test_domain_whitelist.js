/**
 * Test domain whitelist validation
 * 
 * This script tests that only qiniu.com, sufy.com, and qnaigc.com domains are allowed
 */

// Simulate the whitelist validation function
const WHITELISTED_DOMAINS = ['qiniu.com', 'sufy.com', 'qnaigc.com'];

function isWhitelistedDomain(host) {
  const normalizedHost = host.toLowerCase();
  const hostWithoutPort = normalizedHost.split(':')[0];
  
  return WHITELISTED_DOMAINS.some(domain => {
    return hostWithoutPort === domain || hostWithoutPort.endsWith('.' + domain);
  });
}

// Test cases
const testCases = [
  // Valid domains
  { host: 'api.qiniu.com', expected: true, description: 'Subdomain of qiniu.com' },
  { host: 'qiniu.com', expected: true, description: 'Exact match qiniu.com' },
  { host: 'api.sufy.com', expected: true, description: 'Subdomain of sufy.com' },
  { host: 'sufy.com', expected: true, description: 'Exact match sufy.com' },
  { host: 'api.qnaigc.com', expected: true, description: 'Subdomain of qnaigc.com' },
  { host: 'qnaigc.com', expected: true, description: 'Exact match qnaigc.com' },
  { host: 'test.api.qiniu.com', expected: true, description: 'Deep subdomain of qiniu.com' },
  { host: 'api.qiniu.com:8080', expected: true, description: 'With port number' },
  
  // Invalid domains
  { host: 'google.com', expected: false, description: 'Different domain' },
  { host: 'api.openai.com', expected: false, description: 'OpenAI domain' },
  { host: 'malicious-qiniu.com', expected: false, description: 'Prefix attack (not subdomain)' },
  { host: 'qiniu.com.evil.com', expected: false, description: 'Suffix attack' },
  { host: 'localhost', expected: false, description: 'Localhost' },
  { host: '127.0.0.1', expected: false, description: 'IP address' },
];

console.log('Testing domain whitelist validation...\n');
let passed = 0;
let failed = 0;

testCases.forEach(({ host, expected, description }) => {
  const result = isWhitelistedDomain(host);
  const status = result === expected ? '✓ PASS' : '✗ FAIL';
  
  if (result === expected) {
    passed++;
  } else {
    failed++;
  }
  
  console.log(`${status}: ${description}`);
  console.log(`  Host: ${host}`);
  console.log(`  Expected: ${expected}, Got: ${result}`);
  console.log();
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
