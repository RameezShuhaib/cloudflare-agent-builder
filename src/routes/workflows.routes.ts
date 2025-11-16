import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { WorkflowService } from '../services/workflow.service';
import { CreateWorkflowDTO, UpdateWorkflowDTO } from '../schemas/dtos';

export function workflowRoutes(workflowService: WorkflowService) {
  const app = new Hono();

  // POST /api/workflows - Create workflow
  app.post('/', zValidator('json', CreateWorkflowDTO), async (c) => {
    try {
      const dto = c.req.valid('json');
      const workflow = await workflowService.createWorkflow(dto);
      return c.json(workflow, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  });

  // GET /api/workflows - List workflows
  app.get('/', async (c) => {
    try {
      const workflows = await workflowService.listWorkflows();
      return c.json(workflows);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  // GET /api/workflows/:id - Get workflow
  app.get('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const workflow = await workflowService.getWorkflow(id);
      return c.json(workflow);
    } catch (error: any) {
      return c.json({ error: error.message }, 404);
    }
  });

  // PUT /api/workflows/:id - Update workflow
  app.put('/:id', zValidator('json', UpdateWorkflowDTO), async (c) => {
    try {
      const id = c.req.param('id');
      const dto = c.req.valid('json');
      const workflow = await workflowService.updateWorkflow(id, dto);
      return c.json(workflow);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  });

  // DELETE /api/workflows/:id - Delete workflow
  app.delete('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      await workflowService.deleteWorkflow(id);
      return c.json({ message: 'Workflow deleted successfully' });
    } catch (error: any) {
      return c.json({ error: error.message }, 404);
    }
  });

  return app;
}
