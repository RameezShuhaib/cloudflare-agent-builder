# Agent Builder

A powerful workflow automation system built on Cloudflare Workers with D1 database, featuring graph-based execution with support for cycles, conditional routing, and state management.

## Features

- **Graph-Based Workflows**: Define workflows as directed graphs with explicit edges
- **Conditional Routing**: Dynamic edge evaluation using rule engine for complex branching logic
- **Cyclic Workflows**: Support for loops and iterative processes with configurable iteration limits
- **State Management**: Workflow-scoped state with rule-based state updates
- **Built-in Node Executors**: LLM, Text Embedding, Vectorize, SQL, HTTP Request, Data Transformer, Workflow Executor
- **Sub-Workflows**: Execute workflows as nodes within other workflows
- **Template Parsing**: Dynamic template resolution using `{{parent.node.field}}`, `{{state.key}}`, `{{parameters.x}}`
- **Type Safety**: Full TypeScript support with Zod validation
- **AI Gateway Integration**: Built-in caching, analytics, and rate limiting

## Architecture Highlights

### Edge-Based Execution
Unlike traditional DAG-based systems, workflows are defined as graphs with explicit edges:
- **Static Edges**: Direct node-to-node connections
- **Dynamic Edges**: Conditional routing based on rules evaluated at runtime
- **Cycles Supported**: Enables retry logic, iterative processing, and state machines

### State Management
Powered by `@elite-libs/rules-machine`:
- Workflow-scoped state persists across all nodes
- Rules execute after node completion to update state
- State accessible in templates: `{{state.counter}}`
- Enables complex conditional logic and accumulation patterns

### Workflow as Code
Workflows are JSON/YAML definitions with:
- Nodes (processing units)
- Edges (static or dynamic connections)
- Start/End nodes
- Max iterations (safety limit)

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **Rules Engine**: @elite-libs/rules-machine
- **LLM Integration**: OpenAI SDK + Workers AI
- **Language**: TypeScript

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create D1 Database

```bash
npx wrangler d1 create agent-builder-db
```

Copy the output `database_id` and update `wrangler.jsonc`:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "agent-builder-db",
      "database_id": "YOUR_DATABASE_ID_HERE"
    }
  ]
}
```

### 3. Set Up AI Gateway (Optional)

1. Go to Cloudflare Dashboard → AI → AI Gateway
2. Create a new gateway
3. Copy your Account ID and Gateway ID
4. Update `wrangler.jsonc`:

```jsonc
{
  "vars": {
    "CLOUDFLARE_ACCOUNT_ID": "your-account-id",
    "AI_GATEWAY_ID": "your-gateway-id"
  }
}
```

5. Set your API token as a secret:

```bash
npx wrangler secret put CLOUDFLARE_API_TOKEN
```

### 4. Run Migrations

```bash
# Local
npm run db:migrate:local

# Remote
npm run db:migrate:remote
```

### 5. Development

```bash
npm run dev
```

API available at `http://localhost:8787`

### 6. Deploy

```bash
npm run deploy
```

## API Endpoints

### Workflows
- `POST /api/workflows` - Create workflow
- `GET /api/workflows` - List workflows
- `GET /api/workflows/:id` - Get workflow
- `PUT /api/workflows/:id` - Update workflow
- `DELETE /api/workflows/:id` - Delete workflow
- `POST /api/workflows/:id/execute` - Execute workflow
- `GET /api/workflows/:id/executions` - List all executions for a workflow with node results

### Executions
- `GET /api/executions/:id` - Get single execution details

### Configs
- `POST /api/configs` - Create config
- `GET /api/configs` - List configs
- `GET /api/configs/:id` - Get config with variables
- `PATCH /api/configs/:id` - Partial update
- `PUT /api/configs/:id` - Full replace
- `DELETE /api/configs/:id` - Delete config
- `GET /api/configs/:id/variables/:key` - Get specific config variable
- `PUT /api/configs/:id/variables/:key` - Update specific config variable
- `DELETE /api/configs/:id/variables/:key` - Delete specific config variable

## Workflow Structure

```json
{
  "name": "Workflow Name",
  "parameterSchema": {
    "type": "object",
    "properties": {
      "userId": { "type": "string" }
    },
    "required": ["userId"]
  },
  "nodes": [
    {
      "id": "node_1",
      "type": "http_request",
      "config": { /* executor config */ },
      "setState": [
        {
          "key": "attempt",
          "rule": [
            { "if": "state.attempt", "then": "return state.attempt + 1" },
            { "return": "1" }
          ]
        }
      ]
    }
  ],
  "edges": [
    { "id": "e1", "from": "node_1", "to": "node_2" },
    {
      "id": "e2",
      "from": "node_2",
      "rule": [
        { "if": "state.success === true", "then": "return 'end_node'" },
        { "if": "state.attempt < 3", "then": "return 'node_1'" },
        { "return": "'end_node'" }
      ]
    }
  ],
  "startNode": "node_1",
  "endNode": "end_node",
  "maxIterations": 100,
  "defaultConfigId": "prod-config"
}
```

### Nodes

Each node has:
- `id`: Unique identifier
- `type`: Executor type (builtin or `workflow_executor`)
- `config`: Executor-specific configuration (supports templates)
- `setState` (optional): Array of state updates with rules

### Edges

**Static Edge:**
```json
{
  "id": "edge_1",
  "from": "node_a",
  "to": "node_b"
}
```

**Dynamic Edge:**
```json
{
  "id": "edge_2",
  "from": "node_b",
  "rule": [
    { "if": "state.score > 50", "then": "return 'high_score_node'" },
    { "if": "state.score <= 50", "then": "return 'low_score_node'" },
    { "return": "'default_node'" }
  ]
}
```

## Built-in Executors

### 1. LLM (`llm`)

Execute LLM calls with structured output support.

```json
{
  "model": "@cf/meta/llama-3.1-8b-instruct",
  "provider": "openai-sdk",
  "messages": [
    {
      "role": "user",
      "content": "Analyze: {{parent.fetch_data.text}}"
    }
  ],
  "response_format": {
    "type": "object",
    "properties": {
      "sentiment": { "type": "string" },
      "score": { "type": "number" }
    }
  },
  "gateway": { "id": "my-gateway" },
  "max_tokens": 1000
}
```

### 2. Text Embedding (`text_embedding`)

Generate text embeddings using Cloudflare Workers AI.

```json
{
  "text": "{{parent.fetch_content.text}}",
  "model": "@cf/baai/bge-base-en-v1.5"
}
```

**Single text output:**
```json
{
  "embedding": [0.123, -0.456, ...],
  "dimensions": 768,
  "model": "@cf/baai/bge-base-en-v1.5"
}
```

**Multiple texts (array input):**
```json
{
  "text": ["text1", "text2"],
  "model": "@cf/baai/bge-base-en-v1.5"
}
```

**Output:**
```json
{
  "embeddings": [[0.123, ...], [0.456, ...]],
  "shape": [2, 768],
  "model": "@cf/baai/bge-base-en-v1.5",
  "count": 2
}
```

### 3. Vectorize (`vectorize`)

Perform vector database operations using Cloudflare Vectorize.

**Insert vectors:**
```json
{
  "operation": "insert",
  "indexBinding": "VECTORIZE_INDEX",
  "vectors": [
    {
      "id": "doc_1",
      "values": "{{parent.generate_embedding.embedding}}",
      "metadata": {
        "title": "{{parameters.title}}",
        "category": "docs"
      }
    }
  ],
  "namespace": "production"
}
```

**Query similar vectors:**
```json
{
  "operation": "query",
  "indexBinding": "VECTORIZE_INDEX",
  "queryVector": "{{parent.generate_query_embedding.embedding}}",
  "topK": 10,
  "returnValues": false,
  "returnMetadata": "all",
  "filter": {
    "category": { "$eq": "docs" }
  },
  "namespace": "production"
}
```

**Supported operations:**
- `insert`: Insert new vectors
- `upsert`: Insert or update vectors
- `query`: Similarity search with query vector
- `queryById`: Find similar vectors to an existing vector
- `getByIds`: Retrieve vectors by IDs
- `deleteByIds`: Delete vectors by IDs
- `describe`: Get index metadata

**Filter operators:**
- `$eq`, `$ne`: Equal, not equal
- `$in`, `$nin`: In array, not in array
- `$lt`, `$lte`, `$gt`, `$gte`: Comparison operators

### 4. Data Transformer (`data_transformer`)

Transform data using templates.

```json
{
  "template": {
    "userId": "{{parent.fetch_user.data.id}}",
    "fullName": "{{parent.fetch_user.data.firstName}} {{parent.fetch_user.data.lastName}}",
    "attempt": "{{state.attempt}}"
  }
}
```

### 5. SQL Query (`sql_query`)

Execute SQL queries on D1.

```json
{
  "query": "SELECT * FROM users WHERE id = {{parameters.userId}}"
}
```

### 6. HTTP Request (`http_request`)

Make HTTP requests.

```json
{
  "url": "{{config.apiBaseUrl}}/users/{{parameters.userId}}",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer {{config.apiKey}}"
  },
  "body": {
    "name": "{{parent.user_data.name}}"
  }
}
```

### 7. Workflow Executor (`workflow_executor`)

Execute another workflow as a sub-workflow.

```json
{
  "workflow_id": "workflow_abc123",
  "parameters": {
    "userId": "{{parameters.userId}}",
    "source": "parent_workflow"
  }
}
```

## Template System

Access data using `{{path}}`:

- **Parameters**: `{{parameters.userId}}`
- **Config**: `{{config.apiKey}}`
- **State**: `{{state.counter}}`
- **Parent Nodes**: `{{parent.node_id.field}}`
- **Nested**: `{{parent.fetch_data.result.user.email}}`
- **Arrays**: `{{parent.fetch_users.data[0].name}}`

## State Management

Update state after node execution:

```json
{
  "setState": [
    {
      "key": "total",
      "rule": [
        { "if": "state.total", "then": "return state.total + output.count" },
        { "return": "output.count" }
      ]
    },
    {
      "key": "max_value",
      "rule": [
        { "if": "output.value > state.max_value", "then": "return output.value" },
        { "return": "state.max_value || 0" }
      ]
    }
  ]
}
```

Rule context includes:
- `parameters`: Workflow input
- `config`: Config variables
- `state`: Current state
- `parent`: All node outputs
- `output`: Current node's output

## Example: Retry Logic

```json
{
  "nodes": [
    {
      "id": "api_call",
      "type": "http_request",
      "config": { "url": "{{parameters.url}}" },
      "setState": [
        {
          "key": "attempt",
          "rule": [
            { "if": "state.attempt", "then": "return state.attempt + 1" },
            { "return": "1" }
          ]
        },
        {
          "key": "success",
          "rule": [
            { "if": "output.status === 200", "then": "return true" },
            { "return": "false" }
          ]
        }
      ]
    },
    {
      "id": "check_retry",
      "type": "data_transformer",
      "config": { "template": { "status": "{{state.success}}" } }
    },
    {
      "id": "success",
      "type": "data_transformer",
      "config": { "template": { "result": "{{parent.api_call.data}}" } }
    }
  ],
  "edges": [
    { "id": "e1", "from": "api_call", "to": "check_retry" },
    {
      "id": "e2",
      "from": "check_retry",
      "rule": [
        { "if": "state.success === true", "then": "return 'success'" },
        { "if": "state.attempt < 3", "then": "return 'api_call'" },
        { "return": "'success'" }
      ]
    }
  ],
  "startNode": "api_call",
  "endNode": "success",
  "maxIterations": 10
}
```

## Quick Start: Simple Chat Workflow

Here's a complete example of creating and executing a chat workflow:

### 1. Create a Config with AI Gateway Credentials

```bash
curl -X POST http://localhost:8787/api/configs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AI Config",
    "description": "Configuration with AI Gateway credentials",
    "variables": {
      "CLOUDFLARE_ACCOUNT_ID": "your-account-id",
      "AI_GATEWAY_ID": "your-gateway-id",
      "ACCESS_TOKEN": "your-api-token"
    }
  }'
```

### 2. Create a Chat Workflow

```bash
curl -X POST http://localhost:8787/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Simple Chat Workflow",
    "description": "A basic chat workflow using LLM",
    "parameterSchema": {
      "type": "object",
      "properties": {
        "userMessage": {
          "type": "string",
          "description": "The message from the user"
        },
        "systemPrompt": {
          "type": "string",
          "description": "Optional system prompt"
        }
      },
      "required": ["userMessage"]
    },
    "nodes": [
      {
        "id": "chat_response",
        "type": "llm",
        "config": {
          "model": "@cf/meta/llama-3.1-8b-instruct",
          "provider": "openai-sdk",
          "messages": [
            {
              "role": "system",
              "content": "{{parameters.systemPrompt}}"
            },
            {
              "role": "user",
              "content": "{{parameters.userMessage}}"
            }
          ],
          "max_tokens": 500,
          "temperature": 0.7,
          "gateway": {
            "id": "{{config.AI_GATEWAY_ID}}"
          },
          "cloudflare": {
            "accountId": "{{config.CLOUDFLARE_ACCOUNT_ID}}",
            "apiToken": "{{config.ACCESS_TOKEN}}"
          }
        }
      },
      {
        "id": "format_response",
        "type": "data_transformer",
        "config": {
          "template": {
            "response": "{{parent.chat_response.text}}",
            "userMessage": "{{parameters.userMessage}}"
          }
        }
      },
      {
        "id": "end_node",
        "type": "data_transformer",
        "config": {
          "template": {
            "finalResponse": "{{parent.format_response.response}}",
            "userMessage": "{{parent.format_response.userMessage}}"
          }
        }
      }
    ],
    "edges": [
      {
        "id": "e1",
        "from": "chat_response",
        "to": "format_response"
      },
      {
        "id": "e2",
        "from": "format_response",
        "to": "end_node"
      }
    ],
    "startNode": "chat_response",
    "endNode": "end_node",
    "maxIterations": 10,
    "defaultConfigId": "<your-config-id>"
  }'
```

### 3. Execute the Workflow

```bash
curl -X POST http://localhost:8787/api/workflows/<workflow-id>/execute \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "userMessage": "What is the capital of France?",
      "systemPrompt": "You are a helpful geography assistant."
    }
  }'
```

### 4. View Execution Results with Node Details

```bash
curl -X GET http://localhost:8787/api/workflows/<workflow-id>/executions
```

This will return all executions with detailed node results, including the LLM response:

```json
[
  {
    "id": "execution-id",
    "status": "completed",
    "result": {
      "finalResponse": "The capital of France is Paris.",
      "userMessage": "What is the capital of France?"
    },
    "node_results": [
      {
        "nodeId": "chat_response",
        "status": "completed",
        "output": {
          "text": "The capital of France is Paris.",
          "usage": {
            "prompt_tokens": 50,
            "completion_tokens": 10,
            "total_tokens": 60
          }
        }
      }
    ]
  }
]
```

## Config Management

Store environment-specific variables in KV:

```json
{
  "name": "Production Config",
  "description": "Production environment",
  "variables": {
    "apiBaseUrl": "https://api.prod.example.com",
    "apiKey": "prod_key_xxx",
    "databaseUrl": "postgres://..."
  }
}
```

Use in workflows: `{{config.apiBaseUrl}}`

## Project Structure

```
src/
├── db/
│   └── schema.ts              # Drizzle schema
├── domain/
│   └── entities.ts            # Domain models & validation
├── repositories/              # Data access layer
├── services/                  # Business logic
├── orchestration/
│   ├── workflow-orchestrator.ts   # Graph traversal engine
│   └── node-executor.factory.ts   # Executor registry
├── executors/                 # Built-in executors
│   ├── base-node-executor.ts  # Base class with template parsing
│   ├── llm.executor.ts
│   ├── data-transformer.executor.ts
│   ├── sql.executor.ts
│   └── request.executor.ts
├── routes/                    # API routes
├── schemas/
│   └── dtos.ts                # API DTOs (extend domain models)
├── utils/
│   └── template-parser.ts     # Template resolver
└── index.ts                   # Entry point
```

## Key Design Decisions

1. **Graph-Based Execution**: Explicit edges enable cycles, retry logic, and complex workflows

2. **State Management**: Rule-based state updates using @elite-libs/rules-machine for declarative logic

3. **Template Parsing**: Centralized in BaseNodeExecutor - all executors get automatic template resolution

4. **Config Separation**: Parameters (workflow input) and Config (environment variables) stored separately

5. **Iteration Limits**: Safety mechanism to prevent infinite loops in cyclic workflows

6. **Sub-Workflows**: `workflow_executor` enables composition and reusability

## Development

```bash
# Generate migrations
npm run db:generate

# Type generation
npm run cf-typegen

# Tests
npm test
```

## License

MIT
