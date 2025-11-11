import Env from '../env';
import { NodeExecutorRepository } from '../repositories/node-executor.repository';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { NodeExecutor } from '../executors/node-executor.interface';
import { DataTransformerExecutor } from '../executors/data-transformer.executor';
import { SQLExecutor } from '../executors/sql.executor';
import { RequestExecutor } from '../executors/request.executor';
import { WorkflowExecutor } from './workflow.executor';
import { WorkflowOrchestrator } from './workflow-orchestrator';
import { NodeExecutionRepository } from '../repositories/node-execution.repository';
import { ExecutionRepository } from '../repositories/execution.repository';
import { TemplateParser } from '../utils/template-parser';


export class NodeExecutorFactory {
	private readonly env: Env;

  private builtinExecutors: Map<string, NodeExecutor>;
  private customExecutorCache: Map<string, NodeExecutor>;

  constructor(
    private nodeExecRepo: NodeExecutorRepository,
    private workflowRepo: WorkflowRepository,
    private nodeExecutionRepo: NodeExecutionRepository,
    private executionRepo: ExecutionRepository,
    env: Env
  ) {
    this.env = env;
    this.builtinExecutors = new Map();
    this.customExecutorCache = new Map();
    this.registerBuiltinExecutors();
  }

  async getExecutor(nodeType: string): Promise<NodeExecutor> {
    if (this.builtinExecutors.has(nodeType)) {
      return this.builtinExecutors.get(nodeType)!;
    }

    if (this.customExecutorCache.has(nodeType)) {
      return this.customExecutorCache.get(nodeType)!;
    }

    const customExecutor = await this.loadCustomExecutor(nodeType);

    this.customExecutorCache.set(nodeType, customExecutor);

    return customExecutor;
  }

  private async loadCustomExecutor(type: string): Promise<NodeExecutor> {
    const executorDef = await this.nodeExecRepo.findByType(type);

    if (!executorDef) {
      throw new Error(`Executor type '${type}' not found`);
    }

    if (!executorDef.sourceWorkflowId) {
      throw new Error(`Custom executor '${type}' has no source workflow`);
    }

    const workflow = await this.workflowRepo.findById(executorDef.sourceWorkflowId);

    if (!workflow) {
      throw new Error(
        `Source workflow '${executorDef.sourceWorkflowId}' not found for executor '${type}'`
      );
    }

    const orchestrator = new WorkflowOrchestrator(
      this.nodeExecutionRepo,
      this.executionRepo,
      this,
    );

    return new WorkflowExecutor(
      this.executionRepo,
      orchestrator,
      workflow,
      executorDef.configSchema as Record<string, any>,
			this.env,
    );
  }

  private registerBuiltinExecutors(): void {
		this.builtinExecutors.set('data_transformer', new DataTransformerExecutor(this.env));
    this.builtinExecutors.set('data_transformer', new DataTransformerExecutor(this.env));
    this.builtinExecutors.set('sql_query', new SQLExecutor(this.env));
    this.builtinExecutors.set('http_request', new RequestExecutor(this.env));
  }

  clearCache(type?: string): void {
    if (type) {
      this.customExecutorCache.delete(type);
    } else {
      this.customExecutorCache.clear();
    }
  }
}
