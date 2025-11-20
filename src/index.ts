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
import { configRoutes } from './routes/configs.routes';
import {
	ExecutionStatelessRepository,
	NodeExecutionStatelessRepository,
	WorkflowStatelessRepository,
} from './repositories/stateless';


type Variables = {
  workflowService: WorkflowService;
  executionService: ExecutionService;
  configService: ConfigService;
	executionStatelessService: ExecutionService;
	workflowStatelessService: WorkflowService;
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

	const executionStatelessRepo = new ExecutionStatelessRepository(c)
	const nodeExecutionStatelessRepo = new NodeExecutionStatelessRepository(c)
	const workflowStatelessRepo = new WorkflowStatelessRepository(c)

  const configService = new ConfigService(configRepo, kv);
	const workflowService = new WorkflowService(workflowRepo);
	const workflowStatelessService = new WorkflowService(workflowStatelessRepo as any);

  const nodeExecutorFactory = new NodeExecutorFactory(c.env);
  const orchestrator = new WorkflowOrchestrator(
		nodeExecRepo,
		executionRepo,
		nodeExecutorFactory,
		workflowService,
  );

	const statelessOrchestrator = new WorkflowOrchestrator(
		executionStatelessRepo as any,
		nodeExecutionStatelessRepo as any,
		nodeExecutorFactory,
		workflowStatelessService as any,
	);

  const executionService = new ExecutionService(
    executionRepo,
    nodeExecRepo,
    workflowRepo,
    orchestrator,
    configService
  );

	const executionStatelessService = new ExecutionService(
		executionStatelessRepo as any,
		nodeExecutionStatelessRepo as any,
		workflowStatelessRepo as any,
		statelessOrchestrator,
		configService
	);

  c.set('workflowService', workflowService);
  c.set('executionService', executionService);
  c.set('configService', configService);

	c.set('executionStatelessService', executionStatelessService)
	c.set('workflowStatelessService', workflowStatelessService)

  await next();
});


const workflowRouter = new Hono<{ Bindings: Env; Variables: Variables }>();
workflowRouter.use('*', (c, next) => next());
workflowRouter.route('/', workflowRoutes());

const configRouter = new Hono<{ Bindings: Env; Variables: Variables }>();
configRouter.use('*', (c, next) => next());
configRouter.route('/', configRoutes());

app.route('/api/workflows', workflowRouter);
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
