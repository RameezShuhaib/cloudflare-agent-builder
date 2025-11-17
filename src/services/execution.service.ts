import { ExecutionRepository } from '../repositories/execution.repository';
import { NodeExecutionRepository } from '../repositories/node-execution.repository';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { WorkflowOrchestrator } from '../orchestration/workflow-orchestrator';
import { ConfigService } from './config.service';
import type { ExecutionModel, NodeExecutionModel } from '../domain/entities';

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
  ): Promise<ExecutionModel> {
    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const resolvedConfigId = configId || workflow.defaultConfigId || null;

    const configVariables = await this.configService.getConfigVariables(resolvedConfigId);

    const execution = await this.executionRepo.create({
      workflowId: workflowId,
      status: 'pending',
      parameters: parameters,
      config: configVariables,
      configId: resolvedConfigId,
      result: null,
      error: null,
      completedAt: null,
    });

    await this.executionRepo.updateStatus(execution.id, 'running');

    try {
      await this.orchestrator.execute(workflow, execution);
    } catch (error: any) {
      console.error('Workflow execution failed:', error);
    }

    return await this.executionRepo.findById(execution.id) || execution;
  }

  async getExecution(id: string): Promise<ExecutionModel> {
    const execution = await this.executionRepo.findById(id);
    if (!execution) {
      throw new Error('Execution not found');
    }
    return execution;
  }

  async listExecutionsByWorkflow(workflowId: string): Promise<Array<ExecutionModel & { node_results: NodeExecutionModel[] }>> {
    const executions = await this.executionRepo.findByWorkflowId(workflowId);

    return await Promise.all(
      executions.map(async (execution) => {
        const nodeResults = await this.nodeExecRepo.findByExecutionId(execution.id);
        return {
          ...execution,
          node_results: nodeResults,
        };
      })
    );
  }
}
