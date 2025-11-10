import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ExecutionService } from '../services/execution.service';
import { executeWorkflowSchema } from '../schemas/dtos';

export function executionRoutes(executionService: ExecutionService) {
  const app = new Hono();

  // POST /api/workflows/:id/execute - Execute workflow
  app.post('/:id/execute', zValidator('json', executeWorkflowSchema), async (c) => {
    try {
      const workflowId = c.req.param('id');
      const dto = c.req.valid('json');
      const execution = await executionService.executeWorkflow(workflowId, dto.parameters);
      return c.json(execution, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  });

  // GET /api/executions/:id - Get execution
  app.get('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const execution = await executionService.getExecution(id);
      return c.json(execution);
    } catch (error: any) {
      return c.json({ error: error.message }, 404);
    }
  });

  // GET /api/workflows/:id/executions - List executions for workflow
  app.get('/:id/executions', async (c) => {
    try {
      const workflowId = c.req.param('id');
      const executions = await executionService.listExecutionsByWorkflow(workflowId);
      return c.json(executions);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  return app;
}
