#TEST_MODEL=""
#TEST_KEY=""
echo $TEST_MODEL
curl -X POST "http://localhost:8787/https/api.qnaigc.com/v1/messages" \
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
