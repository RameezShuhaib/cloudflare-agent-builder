import { ExecutionRepository } from '../repositories/execution.repository';
import { NodeExecutionRepository } from '../repositories/node-execution.repository';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { WorkflowOrchestrator } from '../orchestration/workflow-orchestrator';
import { ConfigService } from './config.service';
import { generateId } from '../utils/helpers';
import type { Execution, NodeExecution } from '../db/schema';

export class ExecutionService {
  constructor(
    private executionRepo: ExecutionRepository,
    private nodeExecRepo: NodeExecutionRepository,
    private workflowRepo: WorkflowRepository,
    private orchestrator: WorkflowOrchestrator,
    private configService: ConfigService
  ) {}

  async executeWorkflow(
    workflowId: string,
    parameters: Record<string, any>,
    configId?: string
  ): Promise<Execution> {
    // Get workflow
    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Determine which config to use (priority: execution override > workflow default > none)
    const resolvedConfigId = configId || workflow.defaultConfigId || null;

    // Load config variables
    const configVariables = await this.configService.getConfigVariables(resolvedConfigId);

    // Merge parameters with config variables
    // Parameters take precedence over config variables
    const mergedContext = {
      parameters: parameters,
      config: configVariables,
    };

    // Create execution record
    const execution = await this.executionRepo.create({
      id: generateId(),
      workflowId: workflowId,
      status: 'pending',
      startedAt: new Date(),
      parameters: mergedContext, // Store merged context
      configId: resolvedConfigId,
      result: null,
      error: null,
      completedAt: null,
    });

    // Update status to running
    await this.executionRepo.updateStatus(execution.id, 'running');

    // Execute workflow asynchronously
    try {
      await this.orchestrator.execute(workflow, execution);
    } catch (error: any) {
      // Error handling is done in orchestrator
      console.error('Workflow execution failed:', error);
    }

    // Return the execution record
    return await this.executionRepo.findById(execution.id) || execution;
  }

  async getExecution(id: string): Promise<Execution> {
    const execution = await this.executionRepo.findById(id);
    if (!execution) {
      throw new Error('Execution not found');
    }
    return execution;
  }

  async listExecutionsByWorkflow(workflowId: string): Promise<Array<Execution & { node_results: NodeExecution[] }>> {
    const executions = await this.executionRepo.findByWorkflowId(workflowId);
    
    // Fetch node executions for each execution
    const results = await Promise.all(
      executions.map(async (execution) => {
        const nodeResults = await this.nodeExecRepo.findByExecutionId(execution.id);
        return {
          ...execution,
          node_results: nodeResults,
        };
      })
    );

    return results;
  }
}
