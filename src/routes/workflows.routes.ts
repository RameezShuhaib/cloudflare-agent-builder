import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { WorkflowService } from '../services/workflow.service';
import { ExecutionService } from '../services/execution.service';
import {
	CreateWorkflowDTO,
	UpdateWorkflowDTO,
	ExecuteWorkflowDTO,
	ExecuteStatelessWorkflowDTO,
} from '../schemas/dtos';

type Variables = {
  workflowService: WorkflowService;
	workflowStatelessService: WorkflowService;
	executionService: ExecutionService;
	executionStatelessService: ExecutionService;
};

export function workflowRoutes() {
  const app = new Hono<{ Variables: Variables }>();

  app.post('/', zValidator('json', CreateWorkflowDTO), async (c) => {
    try {
      const workflowService = c.get('workflowService');
      const dto = c.req.valid('json');
      const workflow = await workflowService.createWorkflow(dto);
      return c.json(workflow, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  });

  app.get('/', async (c) => {
    try {
      const workflowService = c.get('workflowService');
      const workflows = await workflowService.listWorkflows();
      return c.json(workflows);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/:id', async (c) => {
    try {
      const workflowService = c.get('workflowService');
      const id = c.req.param('id');
      const workflow = await workflowService.getWorkflow(id);
      return c.json(workflow);
    } catch (error: any) {
      return c.json({ error: error.message }, 404);
    }
  });

  app.put('/:id', zValidator('json', UpdateWorkflowDTO), async (c) => {
    try {
      const workflowService = c.get('workflowService');
      const id = c.req.param('id');
      const dto = c.req.valid('json');
      const workflow = await workflowService.updateWorkflow(id, dto);
      return c.json(workflow);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  });

  app.delete('/:id', async (c) => {
    try {
      const workflowService = c.get('workflowService');
      const id = c.req.param('id');
      await workflowService.deleteWorkflow(id);
      return c.json({ message: 'Workflow deleted successfully' });
    } catch (error: any) {
      return c.json({ error: error.message }, 404);
    }
  });

	app.post('/dry-run', zValidator('json', ExecuteStatelessWorkflowDTO), async (c) => {
		try {
			const {workflow, request} = c.req.valid('json');

			const executionService = c.get('executionStatelessService');
			const workflowService = c.get('workflowStatelessService')
			const {id: workflowId} = await workflowService.createWorkflow(workflow)

			const execution = await executionService.executeWorkflow(
				workflowId,
				request.parameters,
				request.configId,
				true,
			);

			if (execution instanceof Response) {
				return execution;
			}
			return c.json(execution, 201);

		} catch (error: any) {
			return c.json({ error: error.message }, 400);
		}
	});

  app.post('/:id/execute', zValidator('json', ExecuteWorkflowDTO), async (c) => {
    try {
      const executionService = c.get('executionService');
      const workflowId = c.req.param('id');
      const dto = c.req.valid('json');

      const streamQuery = c.req.query('stream');
      const streamFromBody = dto.stream;
      const shouldStream = streamQuery === 'true' || streamFromBody === true;

			const execution = await executionService.executeWorkflow(
				workflowId,
				dto.parameters,
				dto.configId,
				shouldStream,
			);

      if (execution instanceof Response) {
				return execution;
			}
      return c.json(execution, 201);

    } catch (error: any) {
      return c.json({ error: error.message }, 400);
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

	app.get('/:id/executions/:execution_id', async (c) => {
		try {
			const executionService = c.get('executionService');

			const workflowId = c.req.param('id');
			const execution_id = c.req.param('execution_id');

			const executions = await executionService.getExecution(execution_id);
			if (executions.workflowId !== workflowId) {
				return c.json({ error: "Not Found" }, 404);
			}

			return c.json(executions);
		} catch (error: any) {
			return c.json({ error: error.message }, 500);
		}
	});

  return app;
}
