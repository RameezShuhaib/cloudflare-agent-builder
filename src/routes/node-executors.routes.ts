import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { NodeExecutorService } from '../services/node-executor.service';
import { createNodeExecutorSchema } from '../schemas/dtos';

export function nodeExecutorRoutes(nodeExecutorService: NodeExecutorService) {
  const app = new Hono();

  // GET /api/node-executors - List all node executors
  app.get('/', async (c) => {
    try {
      const executors = await nodeExecutorService.listNodeExecutors();
      return c.json(executors);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  // GET /api/node-executors/:type - Get node executor
  app.get('/:type', async (c) => {
    try {
      const type = c.req.param('type');
      const executor = await nodeExecutorService.getNodeExecutor(type);
      return c.json(executor);
    } catch (error: any) {
      return c.json({ error: error.message }, 404);
    }
  });

  // POST /api/node-executors - Create custom node executor from workflow
  app.post('/', zValidator('json', createNodeExecutorSchema), async (c) => {
    try {
      const dto = c.req.valid('json');
      const executor = await nodeExecutorService.createFromWorkflow(dto);
      return c.json(executor, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  });
z
  // DELETE /api/node-executors/:type - Delete custom node executor
  app.delete('/:type', async (c) => {
    try {
      const type = c.req.param('type');
      await nodeExecutorService.deleteNodeExecutor(type);
      return c.json({ message: 'Node executor deleted successfully' });
    } catch (error: any) {
      return c.json({ error: error.message }, 404);
    }
  });

  return app;
}
