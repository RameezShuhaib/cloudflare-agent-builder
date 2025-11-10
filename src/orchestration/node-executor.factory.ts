import { NodeExecutorRepository } from '../repositories/node-executor.repository';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { NodeExecutor } from '../executors/node-executor.interface';
import { LLMExecutor } from '../executors/llm.executor';
import { DataTransformerExecutor } from '../executors/data-transformer.executor';
import { SQLExecutor } from '../executors/sql.executor';
import { RequestExecutor } from '../executors/request.executor';
import { WorkflowExecutor } from './workflow.executor';
import { WorkflowOrchestrator } from './workflow-orchestrator';
import { NodeExecutionRepository } from '../repositories/node-execution.repository';
import { ExecutionRepository } from '../repositories/execution.repository';
import { TemplateParser } from '../utils/template-parser';

interface NodeExecutorFactoryOptions {
  ai?: Ai;
  db: D1Database;
  accountId?: string;
  apiToken?: string;
  defaultGatewayId?: string;
}

export class NodeExecutorFactory {
  private builtinExecutors: Map<string, NodeExecutor>;
  private customExecutorCache: Map<string, NodeExecutor>;
  private options: NodeExecutorFactoryOptions;

  constructor(
    private nodeExecRepo: NodeExecutorRepository,
    private workflowRepo: WorkflowRepository,
    private nodeExecutionRepo: NodeExecutionRepository,
    private executionRepo: ExecutionRepository,
    options: NodeExecutorFactoryOptions
  ) {
    this.options = options;
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

    if (executorDef.isBuiltin) {
      throw new Error(`Executor '${type}' is builtin, should not load as custom`);
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
      new TemplateParser()
    );

    return new WorkflowExecutor(
      this.workflowRepo,
      this.executionRepo,
      orchestrator,
      new TemplateParser(),
      workflow,
      executorDef.configSchema as Record<string, any>
    );
  }

  private registerBuiltinExecutors(): void {
    this.builtinExecutors.set(
      'llm_enhancement',
      new LLMExecutor({
        ai: this.options.ai,
        accountId: this.options.accountId,
        apiToken: this.options.apiToken,
        defaultGatewayId: this.options.defaultGatewayId,
      })
    );

    this.builtinExecutors.set('data_transformer', new DataTransformerExecutor());
    this.builtinExecutors.set('sql_query', new SQLExecutor(this.options.db));
    this.builtinExecutors.set('http_request', new RequestExecutor());
  }

  clearCache(type?: string): void {
    if (type) {
      this.customExecutorCache.delete(type);
    } else {
      this.customExecutorCache.clear();
    }
  }
}
