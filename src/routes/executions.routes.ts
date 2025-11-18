import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ExecutionService } from '../services/execution.service';
import { ExecuteWorkflowDTO } from '../schemas/dtos';

type Variables = {
  executionService: ExecutionService;
};

export function executionRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  app.post('/:id/execute', zValidator('json', ExecuteWorkflowDTO), async (c) => {
    try {
      const executionService = c.get('executionService');
      const workflowId = c.req.param('id');
      const dto = c.req.valid('json');
      const execution = await executionService.executeWorkflow(
        workflowId,
        dto.parameters,
        dto.configId
      );
      return c.json(execution, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  });

  app.get('/:id', async (c) => {
    try {
      const executionService = c.get('executionService');
      const id = c.req.param('id');
      const execution = await executionService.getExecution(id);
      return c.json(execution);
    } catch (error: any) {
      return c.json({ error: error.message }, 404);
    }
  });

  app.get('/:id/executions', async (c) => {
    try {
      const executionService = c.get('executionService');
      const workflowId = c.req.param('id');
      const executions = await executionService.listExecutionsByWorkflow(workflowId);
      return c.json(executions);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  return app;
}
