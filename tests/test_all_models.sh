#!/bin/bash

# Test all models from API
# This script fetches available models and runs tests for each one

set -e  # Exit on error

echo "=== Claude Proxy v3 Model Test Runner ==="
echo

# Export test key
export TEST_KEY="sk-d8d563******"

# Fetch model list from API
echo "Fetching model list from API..."
MODELS=$(curl -sSL "https://api.qnaigc.com/v1/models" | jq | grep "id" | awk '{print $2}' | awk -F'"\|,' '{print $2}')

# Check if we got models
if [ -z "$MODELS" ]; then
    echo "❌ Failed to fetch models from API"
    exit 1
fi

# Count models
MODEL_COUNT=$(echo "$MODELS" | wc -l | tr -d ' ')
echo "Found $MODEL_COUNT models to test"
echo

test_http() {
    TEST_MODEL=$1
    curl -sSL --connect-timeout 10 --max-time 60 -w "%{http_code}" -o /dev/null \
    -X POST "http://localhost:8787/https/api.qnaigc.com/v1/messages" \
    -H "Authorization: Bearer ${TEST_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
    "model": "'"${TEST_MODEL}"'",
      "messages": [
        {"role": "user", "content": "Check file types here"},
        {
          "role": "assistant",
          "content": [
            {"type": "text", "text": "I'\''ll check file types for you."},
            {
              "type": "tool_use",
              "id": "tool_123",
              "name": "ls_file",
              "input": {"operation": "ls"}
            }
          ]
        },
        {
          "role": "user",
          "content": [
            {
              "type": "tool_result",
              "tool_use_id": "tool_123",
              "content": "a.md b.txt"
            }
          ]
        }
      ],
      "max_tokens": 1000
    }'
    return ${http_code}
}

test_http_sse() {
    TEST_MODEL=$1
    curl -sSL --connect-timeout 10 --max-time 60 -w "%{http_code}" -o /dev/null \
    -X POST "http://localhost:8787/https/api.qnaigc.com/v1/messages" \
    -H "Authorization: Bearer ${TEST_KEY}" \
    -H "Content-Type: application/json" \
    -H "Accept: text/event-stream" \
    -d '{
      "model": "'"${TEST_MODEL}"'",
      "messages": [
        {"role": "user", "content": "what is the weather like"}
      ],
      "max_tokens": 1000,
      "stream": true
    }'
    return ${http_code}
}

# Test each model
COUNTER=1
for TEST_MODEL in $MODELS; do
    echo "--- Testing model $COUNTER/$MODEL_COUNT: $TEST_MODEL"

    # Run test_http
    http_status=$(test_http ${TEST_MODEL})
    if [[ $http_status == "200" ]]; then
        echo "✅ test http passed for $TEST_MODEL"
    else
        echo "❌ test http failed for $TEST_MODEL"
    fi


    # Run test_http_sse
    http_status=$(test_http_sse ${TEST_MODEL})
    if [[ $http_status == "200" ]]; then
        echo "✅ test  sse passed for $TEST_MODEL"
    else
        echo "❌ test  sse failed for $TEST_MODEL"
    fi

    echo
    echo
    COUNTER=$((COUNTER + 1))
done

echo "=== All $COUNTER models tested ==="
