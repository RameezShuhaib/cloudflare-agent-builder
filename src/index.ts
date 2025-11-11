import { Hono } from 'hono';
import { cors } from 'hono/cors';
import Env from './env';
import { WorkflowRepository } from './repositories/workflow.repository';
import { ExecutionRepository } from './repositories/execution.repository';
import { NodeExecutionRepository } from './repositories/node-execution.repository';
import { NodeExecutorRepository } from './repositories/node-executor.repository';
import { ConfigRepository } from './repositories/config.repository';
import { WorkflowService } from './services/workflow.service';
import { ExecutionService } from './services/execution.service';
import { NodeExecutorService } from './services/node-executor.service';
import { ConfigService } from './services/config.service';
import { WorkflowOrchestrator } from './orchestration/workflow-orchestrator';
import { NodeExecutorFactory } from './orchestration/node-executor.factory';
import { TemplateParser } from './utils/template-parser';
import { workflowRoutes } from './routes/workflows.routes';
import { executionRoutes } from './routes/executions.routes';
import { nodeExecutorRoutes } from './routes/node-executors.routes';
import { configRoutes } from './routes/configs.routes';


type Variables = {
  workflowService: WorkflowService;
  executionService: ExecutionService;
  nodeExecutorService: NodeExecutorService;
  configService: ConfigService;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORS middleware
app.use('/*', cors());

// Health check
app.get('/', (c) => {
  return c.json({ message: 'Agent Builder API', version: '1.0.0' });
});

// Initialize services and routes
app.use('*', async (c, next) => {
  const db = c.env.DB;
  const kv = c.env.CONFIGS;

  // Initialize repositories
  const workflowRepo = new WorkflowRepository(db);
  const executionRepo = new ExecutionRepository(db);
  const nodeExecRepo = new NodeExecutionRepository(db);
  const nodeExecutorRepo = new NodeExecutorRepository(db);
  const configRepo = new ConfigRepository(db);

  // Initialize services
  const configService = new ConfigService(configRepo, kv);

  // Initialize orchestration components
  const templateParser = new TemplateParser();
  const nodeExecutorFactory = new NodeExecutorFactory(
    nodeExecutorRepo,
    workflowRepo,
    nodeExecRepo,
    executionRepo,
		c.env
  );
  const orchestrator = new WorkflowOrchestrator(
    nodeExecRepo,
    executionRepo,
    nodeExecutorFactory,
  );

  const workflowService = new WorkflowService(workflowRepo);
  const executionService = new ExecutionService(
    executionRepo,
    nodeExecRepo,
    workflowRepo,
    orchestrator,
    configService
  );
  const nodeExecutorService = new NodeExecutorService(nodeExecutorRepo, workflowRepo);

  // Store services in context for routes
  c.set('workflowService', workflowService);
  c.set('executionService', executionService);
  c.set('nodeExecutorService', nodeExecutorService);
  c.set('configService', configService);

  await next();
});

// Mount routes
app.route('/api/workflows', workflowRoutes(app.get('workflowService') as any));
app.route('/api/executions', executionRoutes(app.get('executionService') as any));
app.route('/api/node-executors', nodeExecutorRoutes(app.get('nodeExecutorService') as any));
app.route('/api/configs', configRoutes(app.get('configService') as any));

// Workflow execution route (special case - under workflows)
app.post('/api/workflows/:id/execute', async (c) => {
  const executionService = c.get('executionService');
  const workflowId = c.req.param('id');
  const body = await c.req.json();

  try {
    const execution = await executionService.executeWorkflow(
      workflowId,
      body.parameters || {},
      body.config_id
    );
    return c.json(execution, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Workflow executions list route
app.get('/api/workflows/:id/executions', async (c) => {
  const executionService = c.get('executionService');
  const workflowId = c.req.param('id');

  try {
    const executions = await executionService.listExecutionsByWorkflow(workflowId);
    return c.json(executions);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: err.message || 'Internal server error' }, 500);
});

export default app;
