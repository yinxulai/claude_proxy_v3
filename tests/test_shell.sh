#export TEST_KEY="sk-d8d563***"
#export TEST_MODEL="minimax/minimax-m2.1"
FILES=$(ls | tail | jq -R -s '.')
#echo $FILES
curl -X POST "http://localhost:8787/https/api.qnaigc.com/v1/messages" \
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
