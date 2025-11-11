#!/usr/bin/env node

/**
 * Agent Builder Setup Script
 * 
 * This script automates the setup process for Agent Builder:
 * 1. Creates D1 database
 * 2. Creates KV namespace
 * 3. Creates AI Gateway
 * 4. Updates wrangler.jsonc with IDs
 * 5. Runs migrations
 * 6. Sets up secrets
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, description) {
  log(`\n${description}...`, 'cyan');
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    return output;
  } catch (error) {
    log(`Error: ${error.message}`, 'red');
    throw error;
  }
}

function question(query) {
  return new Promise((resolve) => rl.question(colors.yellow + query + colors.reset, resolve));
}

async function setup() {
  log('\n╔════════════════════════════════════════════╗', 'bright');
  log('║     Agent Builder Setup Script            ║', 'bright');
  log('╚════════════════════════════════════════════╝\n', 'bright');

  try {
    // Step 1: Check if wrangler is installed
    log('Step 1: Checking Wrangler installation...', 'blue');
    try {
      execSync('npx wrangler --version', { stdio: 'pipe' });
      log('✓ Wrangler is installed', 'green');
    } catch (error) {
      log('✗ Wrangler not found. Please install it first.', 'red');
      process.exit(1);
    }

    // Step 2: Get Account ID
    log('\nStep 2: Getting Cloudflare Account ID...', 'blue');
    const useExistingAccount = await question('Do you have your Account ID? (y/n): ');
    
    let accountId;
    if (useExistingAccount.toLowerCase() === 'y') {
      accountId = await question('Enter your Cloudflare Account ID: ');
    } else {
      log('You can find your Account ID at: https://dash.cloudflare.com/', 'cyan');
      accountId = await question('Enter your Cloudflare Account ID: ');
    }

    // Step 3: Create D1 Database
    log('\nStep 3: Creating D1 Database...', 'blue');
    const createDb = await question('Create new D1 database? (y/n): ');
    
    let databaseId;
    if (createDb.toLowerCase() === 'y') {
      const dbOutput = execCommand(
        'npx wrangler d1 create agent-builder-db',
        'Creating D1 database'
      );
      
      // Extract database_id from output
      const dbMatch = dbOutput.match(/database_id = "([^"]+)"/);
      if (dbMatch) {
        databaseId = dbMatch[1];
        log(`✓ Database created with ID: ${databaseId}`, 'green');
      } else {
        log('Could not extract database ID from output', 'yellow');
        databaseId = await question('Please enter the database_id from the output above: ');
      }
    } else {
      databaseId = await question('Enter existing D1 database ID: ');
    }

    // Step 4: Create KV Namespace
    log('\nStep 4: Creating KV Namespace...', 'blue');
    const createKV = await question('Create new KV namespace for configs? (y/n): ');
    
    let kvId;
    if (createKV.toLowerCase() === 'y') {
      const kvOutput = execCommand(
        'npx wrangler kv:namespace create CONFIGS',
        'Creating KV namespace'
      );
      
      // Extract KV ID from output
      const kvMatch = kvOutput.match(/id = "([^"]+)"/);
      if (kvMatch) {
        kvId = kvMatch[1];
        log(`✓ KV namespace created with ID: ${kvId}`, 'green');
      } else {
        log('Could not extract KV ID from output', 'yellow');
        kvId = await question('Please enter the KV namespace id from the output above: ');
      }
    } else {
      kvId = await question('Enter existing KV namespace ID: ');
    }

    // Step 5: AI Gateway Setup
    log('\nStep 5: AI Gateway Setup...', 'blue');
    log('Go to: https://dash.cloudflare.com/?to=/:account/ai/ai-gateway', 'cyan');
    log('Create a new AI Gateway if you haven\'t already', 'cyan');
    const gatewayId = await question('Enter your AI Gateway ID (name): ');

    // Step 6: API Token
    log('\nStep 6: API Token Setup...', 'blue');
    const hasToken = await question('Do you have a Cloudflare API Token with Workers AI access? (y/n): ');
    
    let apiToken;
    if (hasToken.toLowerCase() === 'y') {
      apiToken = await question('Enter your API Token (it will be stored as a secret): ');
    } else {
      log('Create an API token at: https://dash.cloudflare.com/profile/api-tokens', 'cyan');
      log('Required permissions: Workers AI - Read', 'cyan');
      apiToken = await question('Enter your API Token: ');
    }

    // Step 7: Update wrangler.jsonc
    log('\nStep 7: Updating wrangler.jsonc...', 'blue');
    const wranglerPath = path.join(__dirname, '..', 'wrangler.jsonc');
    
    const wranglerConfig = {
      "$schema": "node_modules/wrangler/config-schema.json",
      "name": "agent-builder",
      "main": "src/index.ts",
      "compatibility_date": "2025-11-09",
      "observability": {
        "enabled": true
      },
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "agent-builder-db",
          "database_id": databaseId
        }
      ],
      "kv_namespaces": [
        {
          "binding": "CONFIGS",
          "id": kvId
        }
      ],
      "ai": {
        "binding": "AI"
      },
      "vars": {
        "CLOUDFLARE_ACCOUNT_ID": accountId,
        "AI_GATEWAY_ID": gatewayId
      }
    };

    fs.writeFileSync(wranglerPath, JSON.stringify(wranglerConfig, null, '\t'));
    log('✓ wrangler.jsonc updated', 'green');

    // Step 8: Set API Token as Secret
    log('\nStep 8: Setting API Token as secret...', 'blue');
    const setSecret = await question('Set CLOUDFLARE_API_TOKEN as secret now? (y/n): ');
    
    if (setSecret.toLowerCase() === 'y') {
      log('Run this command to set the secret:', 'cyan');
      log(`echo "${apiToken}" | npx wrangler secret put CLOUDFLARE_API_TOKEN`, 'yellow');
      log('\nNote: Secrets need to be set separately. Running the command now...', 'cyan');
      
      try {
        execSync(`echo "${apiToken}" | npx wrangler secret put CLOUDFLARE_API_TOKEN`, { 
          stdio: 'inherit',
          encoding: 'utf-8'
        });
        log('✓ Secret set', 'green');
      } catch (error) {
        log('Note: You may need to set this secret manually after deployment', 'yellow');
      }
    } else {
      log('Remember to set the secret before deploying:', 'yellow');
      log('npx wrangler secret put CLOUDFLARE_API_TOKEN', 'cyan');
    }

    // Step 9: Run Migrations
    log('\nStep 9: Running database migrations...', 'blue');
    const runMigrations = await question('Run migrations now? (y/n): ');
    
    if (runMigrations.toLowerCase() === 'y') {
      // Local migration
      try {
        execCommand(
          'npx wrangler d1 execute agent-builder-db --local --file=./schema.sql',
          'Running local migration'
        );
        log('✓ Local migration completed', 'green');
      } catch (error) {
        log('Warning: Local migration failed. You may need to run it manually.', 'yellow');
      }

      // Remote migration
      const runRemote = await question('Run remote migration? (y/n): ');
      if (runRemote.toLowerCase() === 'y') {
        try {
          execCommand(
            'npx wrangler d1 execute agent-builder-db --remote --file=./schema.sql',
            'Running remote migration'
          );
          log('✓ Remote migration completed', 'green');
        } catch (error) {
          log('Warning: Remote migration failed. You may need to run it manually.', 'yellow');
        }
      }
    }

    // Step 10: Summary
    log('\n╔════════════════════════════════════════════╗', 'bright');
    log('║          Setup Complete! 🎉                ║', 'bright');
    log('╚════════════════════════════════════════════╝\n', 'bright');

    log('Configuration Summary:', 'green');
    log(`  Account ID: ${accountId}`, 'cyan');
    log(`  Database ID: ${databaseId}`, 'cyan');
    log(`  KV Namespace ID: ${kvId}`, 'cyan');
    log(`  AI Gateway ID: ${gatewayId}`, 'cyan');

    log('\nNext Steps:', 'yellow');
    log('  1. Run: npm run dev (for local development)', 'cyan');
    log('  2. Run: npm run deploy (to deploy to Cloudflare)', 'cyan');
    log('  3. Test API at: http://localhost:8787', 'cyan');

    log('\nAPI Documentation:', 'yellow');
    log('  - Workflows: /api/workflows', 'cyan');
    log('  - Executions: /api/executions', 'cyan');
    log('  - Node Executors: /api/node-executors', 'cyan');
    log('  - Configs: /api/configs', 'cyan');

    log('\nFor more information, see README.md\n', 'yellow');

  } catch (error) {
    log(`\n✗ Setup failed: ${error.message}`, 'red');
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run setup
setup();
