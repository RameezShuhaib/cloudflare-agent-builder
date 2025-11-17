# Agent Builder

A powerful workflow automation system built on Cloudflare Workers with D1 database, featuring graph-based execution with support for cycles, conditional routing, and state management.

## Features

- **Graph-Based Workflows**: Define workflows as directed graphs with explicit edges
- **Conditional Routing**: Dynamic edge evaluation using rule engine for complex branching logic
- **Cyclic Workflows**: Support for loops and iterative processes with configurable iteration limits
- **State Management**: Workflow-scoped state with rule-based state updates
- **Built-in Node Executors**: LLM, SQL, HTTP Request, Data Transformer, Workflow Executor
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

### Executions
- `POST /api/workflows/:id/execute` - Execute workflow
- `GET /api/executions/:id` - Get execution
- `GET /api/workflows/:id/executions` - List executions with node results

### Configs
- `POST /api/configs` - Create config
- `GET /api/configs` - List configs
- `GET /api/configs/:id` - Get config with variables
- `PATCH /api/configs/:id` - Partial update
- `PUT /api/configs/:id` - Full replace
- `DELETE /api/configs/:id` - Delete config

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

### 2. Data Transformer (`data_transformer`)

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

### 3. SQL Query (`sql_query`)

Execute SQL queries on D1.

```json
{
  "query": "SELECT * FROM users WHERE id = {{parameters.userId}}"
}
```

### 4. HTTP Request (`http_request`)

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

### 5. Workflow Executor (`workflow_executor`)

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
