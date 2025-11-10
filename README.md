# Agent Builder

A powerful workflow automation system built on Cloudflare Workers with D1 database, Hono, Zod, and Drizzle ORM.

## Features

- **Workflow Management**: Create, update, and delete workflows with complex node dependencies
- **Built-in Node Executors**: LLM (with structured output), SQL, HTTP Request, Data Transformer
- **Custom Executors**: Turn any workflow into a reusable node executor
- **Execution Engine**: Topological sorting and orchestrated execution of workflow nodes
- **Template Parsing**: Dynamic template resolution using `{{parent.node.field}}` syntax
- **Type Safety**: Full TypeScript support with Zod validation
- **AI Gateway Integration**: Built-in caching, analytics, and rate limiting

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Validation**: Zod
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

### 3. Set Up AI Gateway

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

Execute the schema locally:

```bash
npm run db:migrate:local
```

Execute the schema remotely:

```bash
npm run db:migrate:remote
```

### 5. Development

Start local development server:

```bash
npm run dev
```

The API will be available at `http://localhost:8787`

### 6. Deploy

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

## API Endpoints

### Workflows

- `POST /api/workflows` - Create a new workflow
- `GET /api/workflows` - List all workflows
- `GET /api/workflows/:id` - Get workflow by ID
- `PUT /api/workflows/:id` - Update workflow
- `DELETE /api/workflows/:id` - Delete workflow

### Executions

- `POST /api/workflows/:id/execute` - Execute a workflow
- `GET /api/executions/:id` - Get execution details
- `GET /api/workflows/:id/executions` - List all executions for a workflow (includes node results)

### Node Executors

- `GET /api/node-executors` - List all node executors (builtin + custom)
- `GET /api/node-executors/:type` - Get node executor by type
- `POST /api/node-executors` - Create custom node executor from workflow
- `DELETE /api/node-executors/:type` - Delete custom node executor

## Built-in Node Executors

Built-in executors are defined in code and automatically available. Each executor defines its own configuration schema.

### 1. LLM Enhancement (`llm_enhancement`)

Execute LLM calls with structured output support using OpenAI SDK or Workers AI.

**Features:**
- OpenAI SDK integration with AI Gateway
- Structured output with Zod schemas or JSON Schema
- Template variable substitution
- Caching and analytics via AI Gateway

**Config:**
```json
{
  "model": "@cf/meta/llama-3.1-8b-instruct",
  "provider": "openai-sdk",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant"
    },
    {
      "role": "user",
      "content": "Analyze: {{parent.fetch_data.text}}"
    }
  ],
  "response_format": {
    "type": "object",
    "properties": {
      "sentiment": { "type": "string" },
      "score": { "type": "number" },
      "categories": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["sentiment", "score"]
  },
  "gateway": {
    "id": "my-gateway",
    "skipCache": false,
    "cacheTtl": 3600
  },
  "max_tokens": 1000,
  "temperature": 0.7
}
```

### 2. Data Transformer (`data_transformer`)

Transform data using templates.

**Config:**
```json
{
  "template": {
    "user_id": "{{parent.fetch_user.data.id}}",
    "full_name": "{{parent.fetch_user.data.firstName}} {{parent.fetch_user.data.lastName}}",
    "processed_at": "{{parameters.timestamp}}"
  }
}
```

### 3. SQL Query (`sql_query`)

Execute SQL queries on D1 database.

**Config:**
```json
{
  "query": "SELECT * FROM customers WHERE id = {{parameters.customer_id}} AND created_at > date('now', '-{{parameters.days_back}} days')"
}
```

### 4. HTTP Request (`http_request`)

Make HTTP requests.

**Config:**
```json
{
  "url": "https://api.example.com/users/{{parent.get_id.user_id}}",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer {{parameters.api_token}}",
    "Content-Type": "application/json"
  },
  "body": {
    "name": "{{parent.user_data.name}}",
    "email": "{{parent.user_data.email}}"
  }
}
```

## Template Syntax

Use `{{path.to.value}}` to reference values from:

- **Parameters**: `{{parameters.customer_id}}`
- **Parent Nodes**: `{{parent.node_id.field}}`
- **Nested Fields**: `{{parent.fetch_data.result.user.email}}`
- **Array Access**: `{{parent.fetch_users.data[0].name}}`

## Creating Custom Node Executors

Convert any workflow into a reusable node executor:

```bash
POST /api/node-executors
{
  "type": "sentiment_analyzer",
  "name": "Sentiment Analyzer",
  "description": "Analyzes sentiment of text",
  "config_schema": {
    "type": "object",
    "properties": {
      "parameter_mapping": {
        "type": "object",
        "properties": {
          "feedback_text": { "type": "string" }
        }
      }
    }
  },
  "source_workflow_id": "workflow-123"
}
```

## Environment Variables

Required in `wrangler.jsonc`:

```jsonc
{
  "ai": {
    "binding": "AI"  // Workers AI binding
  },
  "vars": {
    "CLOUDFLARE_ACCOUNT_ID": "your-account-id",
    "AI_GATEWAY_ID": "your-gateway-id"
  }
}
```

Required secrets (use `npx wrangler secret put`):

- `CLOUDFLARE_API_TOKEN` - API token with Workers AI access

## Project Structure

```
src/
├── db/
│   └── schema.ts          # Drizzle schema with indexes
├── repositories/          # Data access layer
├── services/              # Business logic
├── orchestration/         # Workflow execution engine
├── executors/             # Built-in node executors
│   ├── llm.executor.ts
│   ├── data-transformer.executor.ts
│   ├── sql.executor.ts
│   └── request.executor.ts
├── routes/                # API routes
├── schemas/               # Zod validation schemas
├── utils/                 # Template parser & helpers
└── index.ts              # Main entry point
```

## Key Design Decisions

1. **Builtin Executors in Code**: No database seeding needed. Each executor class defines its own schema via `getDefinition()`.

2. **OpenAI SDK for LLM**: Uses OpenAI SDK with AI Gateway for structured output, better type safety, and familiar API.

3. **No Streaming**: Workflow nodes need complete data for downstream nodes and database storage.

4. **Template Parser**: Powerful `{{variable}}` syntax for dynamic data access across workflow nodes.

5. **Topological Sort**: Automatic dependency resolution and execution ordering.

## Development

### Generate Migrations

After modifying the schema:

```bash
npm run db:generate
```

### Run Tests

```bash
npm test
```

### Type Generation

Generate TypeScript types for Wrangler:

```bash
npm run cf-typegen
```

## License

MIT
