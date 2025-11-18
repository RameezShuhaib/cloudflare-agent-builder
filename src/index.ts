import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { WorkflowRepository } from './repositories/workflow.repository';
import { ExecutionRepository } from './repositories/execution.repository';
import { NodeExecutionRepository } from './repositories/node-execution.repository';
import { ConfigRepository } from './repositories/config.repository';
import { WorkflowService } from './services/workflow.service';
import { ExecutionService } from './services/execution.service';
import { ConfigService } from './services/config.service';
import { WorkflowOrchestrator } from './orchestration/workflow-orchestrator';
import { NodeExecutorFactory } from './orchestration/node-executor.factory';
import { workflowRoutes } from './routes/workflows.routes';
import { executionRoutes } from './routes/executions.routes';
import { configRoutes } from './routes/configs.routes';


type Variables = {
  workflowService: WorkflowService;
  executionService: ExecutionService;
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
  const configRepo = new ConfigRepository(db);

  const configService = new ConfigService(configRepo, kv);
	const workflowService = new WorkflowService(workflowRepo);

  const nodeExecutorFactory = new NodeExecutorFactory(c.env);
  const orchestrator = new WorkflowOrchestrator(
		nodeExecRepo,
		executionRepo,
		nodeExecutorFactory,
		workflowService,
  );

  const executionService = new ExecutionService(
    executionRepo,
    nodeExecRepo,
    workflowRepo,
    orchestrator,
    configService
  );

  c.set('workflowService', workflowService);
  c.set('executionService', executionService);
  c.set('configService', configService);

  await next();
});

// Mount routes - pass services via context
const workflowRouter = new Hono<{ Bindings: Env; Variables: Variables }>();
workflowRouter.use('*', (c, next) => next());
workflowRouter.route('/', workflowRoutes());

const executionRouter = new Hono<{ Bindings: Env; Variables: Variables }>();
executionRouter.use('*', (c, next) => next());
executionRouter.route('/', executionRoutes());

const configRouter = new Hono<{ Bindings: Env; Variables: Variables }>();
configRouter.use('*', (c, next) => next());
configRouter.route('/', configRoutes());

app.route('/api/workflows', workflowRouter);
app.route('/api/executions', executionRouter);
app.route('/api/configs', configRouter);

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
