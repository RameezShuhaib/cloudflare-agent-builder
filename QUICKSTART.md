# Agent Builder - Quick Start Guide

## Automated Setup (Recommended)

Run the interactive setup script:

```bash
npm run setup
```

The script will:
1. ✓ Check Wrangler installation
2. ✓ Prompt for your Cloudflare Account ID
3. ✓ Create D1 database
4. ✓ Create KV namespace
5. ✓ Prompt for AI Gateway ID
6. ✓ Prompt for API Token
7. ✓ Update wrangler.jsonc automatically
8. ✓ Set secrets
9. ✓ Run database migrations

## Manual Setup

If you prefer manual setup, follow these steps:

### 1. Install Dependencies
```bash
npm install
```

### 2. Create D1 Database
```bash
npx wrangler d1 create agent-builder-db
# Copy the database_id from output
```

### 3. Create KV Namespace
```bash
npx wrangler kv:namespace create CONFIGS
# Copy the id from output
```

### 4. Create AI Gateway
1. Go to Cloudflare Dashboard → AI → AI Gateway
2. Create a new gateway
3. Note the Gateway ID (name)

### 5. Update wrangler.jsonc
```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "agent-builder-db",
      "database_id": "YOUR_DATABASE_ID"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "CONFIGS",
      "id": "YOUR_KV_ID"
    }
  ],
  "vars": {
    "CLOUDFLARE_ACCOUNT_ID": "your-account-id",
    "AI_GATEWAY_ID": "your-gateway-id"
  }
}
```

### 6. Set API Token Secret
```bash
npx wrangler secret put CLOUDFLARE_API_TOKEN
# Enter your API token when prompted
```

### 7. Run Migrations
```bash
npm run db:migrate:local   # For local dev
npm run db:migrate:remote  # For production
```

## Start Development

```bash
npm run dev
```

Visit: http://localhost:8787

## Deploy to Production

```bash
npm run deploy
```

## Next Steps

1. Create a config for API keys: `POST /api/configs`
2. Create your first workflow: `POST /api/workflows`
3. Execute the workflow: `POST /api/workflows/:id/execute`

See full documentation in README.md
