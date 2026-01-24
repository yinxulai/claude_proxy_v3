# Claude Proxy v3

A complete Claude API proxy new implementation that supports the full Claude API surface, including Models API, Token Counting API, and extended thinking support.

## ✨ Features

- **Complete Claude API Support**: Full implementation of Claude API endpoints:
  - `GET /v1/models` - List available models
  - `POST /v1/messages` - Send messages with extended thinking support
  - `POST /v1/messages/count_tokens` - Count tokens in messages

- **Extended Thinking Support**: Built-in support for Claude's thinking configuration with budget tokens

- **Dynamic Routing**: Route requests to any OpenAI-compatible API using URL patterns:
  - `/https/api.qnaigc.com/v1/models`
  - `/https/api.qnaigc.com/v1/messages`
  - `/https/api.qnaigc.com/openai/v1/models/llama3-70b/v1/messages`
  - `/https/api.qnaigc.com/v1/messages/count_tokens`
  - `/https/api.qnaigc.com/openai/v1/models/llama3-70b/v1/messages/count_tokens`


- **TypeScript First**: Full type safety with comprehensive Claude and OpenAI type definitions

- **Cloudflare Workers Ready**: Optimized for deployment on Cloudflare's global network

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd claude_proxy_v3
npm install
```

### 2. Configure

Edit `wrangler.toml` to set your environment variables:

```toml
[vars]
HAIKU_MODEL_NAME = "claude-3-haiku-20240307"
HAIKU_BASE_URL = "https://api.anthropic.com"
HAIKU_API_KEY = "your-api-key-here"
```

### 3. Develop Locally

```bash
npm run dev
```

### 4. Deploy

```bash
npm run deploy
```

### 5. Test One Model or Test All Models

```bash
bash tests/test_all_models.sh

bash tests/test_shell.sh

bash tests/test_shell_sse.sh
```

### 6. Docs
Designing, Implementation, Reviewing, Testing docs are all generated with `Claude Code` + `DeepSeek-V3.2`, these md files are listed in `docs`.

## 📚 API Reference

### Models API

**Endpoint**: `GET /v1/models`

List available models from the target API.

**Example URL**:
```
/GET /https/api.qnaigc.com/openai/v1/models/v1/models
/GET /https/api.qnaigc.com/v1/models
```

**Response**:
```json
{
  "data": [
    {
      "id": "llama3-70b-8192",
      "type": "model",
      "created_at": "2024-01-01T00:00:00Z",
      "display_name": "Llama 3 70B"
    }
  ],
  "first_id": "llama3-70b-8192",
  "has_more": false,
  "last_id": "llama3-70b-8192"
}
```

### Messages API

**Endpoint**: `POST /v1/messages`

Send messages with optional thinking configuration.

**Example URL**:
```
/POST /https/api.qnaigc.com/v1/messages
```

**Request with Thinking**:
```json
{
  "model": "llama3-70b-8192",
  "messages": [
    {
      "role": "user",
      "content": "What is the capital of France?"
    }
  ],
  "max_tokens": 1000,
  "thinking": {
    "type": "enabled",
    "budget_tokens": 10000
  }
}
```

**Response**:
```json
{
  "id": "msg_123456789",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "The capital of France is Paris."
    }
  ],
  "model": "llama3-70b-8192",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 10,
    "output_tokens": 5
  }
}
```

### Token Counting API

**Endpoint**: `POST /v1/messages/count_tokens`

Count tokens in messages, including thinking configuration.

**Example URL**:
```
/POST /https/api.qnaigc.com/v1/messages/count_tokens
```

**Request**:
```json
{
  "model": "llama3-70b-8192",
  "messages": [
    {
      "role": "user",
      "content": "What is the capital of France?"
    }
  ],
  "thinking": {
    "type": "enabled",
    "budget_tokens": 10000
  }
}
```

**Response**:
```json
{
  "type": "token_count",
  "input_tokens": 10,
  "cache_creation_input_tokens": 0,
  "cache_read_input_tokens": 0
}
```

## 🔧 Dynamic Routing

The proxy uses dynamic routing to forward requests to any OpenAI-compatible API:

### URL Format

```
/{protocol}/{host}/{path_prefix}/{model_id?}/{claude_endpoint}

/{protocol}/{host}/{claude_endpoint}
```

### Examples

1. **List models from Groq**:
   ```
   GET /https/api.qnaigc.com/v1/models
   ```

2. **Send message to Groq Llama 3**:
   ```
   POST /https/api.qnaigc.com/v1/messages
   ```

3. **Count tokens with Google Gemini**:
   ```
   POST /https/generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp/v1/messages/count_tokens
   ```

### Authentication

Forward authentication headers from the original request:
- `Authorization: Bearer <token>`
- `x-api-key: <key>`

## 🏗️ Architecture

### Project Structure

```
src/
├── index.ts                 # Main router and middleware
├── handlers/
│   ├── messages.ts         # Messages API handler
│   ├── models.ts           # Models API handler
│   └── token-counting.ts   # Token counting handler
├── converters/
│   ├── claude-to-openai.ts # Request conversion
│   ├── openai-to-claude.ts # Response conversion
│   └── streaming.ts        # Streaming response conversion
├── utils/
│   ├── routing.ts          # Dynamic routing logic
│   ├── validation.ts       # Request validation
│   ├── errors.ts           # Error handling
│   └── thinking.ts         # Thinking utilities
└── types/
    ├── claude.ts           # Claude API types
    ├── openai.ts           # OpenAI API types
    └── shared.ts           # Shared types
```

### Key Components

1. **Router Middleware**: Parses URLs, handles authentication, routes to handlers
2. **Converters**: Convert between Claude and OpenAI API formats
3. **Validation**: Comprehensive request validation with Claude API error formats
4. **Error Handling**: Claude API-compatible error responses

## 🧪 Other Testing

### Type Checking

```bash
npm run typecheck
```

### Local Development

```bash
npm run dev
```

### Example Requests

```bash
# List models
curl -X GET "http://localhost:8787/https/api.qnaigc.com/v1/models" \
  -H "Authorization: Bearer your-api-key"

# Send message
curl -X POST "http://localhost:8787/https/api.qnaigc.com/v1/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 1000
  }'
```

## 📄 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 🔗 Links

- [Claude API Documentation](https://docs.anthropic.com/claude/reference/)
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Claude Proxy (v0)](https://github.com/tingxifa/claude_proxy) and a [fork(v0.1)](https://github.com/qidu/claude_proxy)
