import { NodeExecutorRepository } from '../repositories/node-executor.repository';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { generateId } from '../utils/helpers';
import type { CreateNodeExecutorDTO } from '../schemas/dtos';
import type { NodeExecutor as NodeExecutorDB } from '../db/schema';

// Import all builtin executors
import { LLMExecutor } from '../executors/llm.executor';
import { DataTransformerExecutor } from '../executors/data-transformer.executor';
import { SQLExecutor } from '../executors/sql.executor';
import { RequestExecutor } from '../executors/request.executor';
import type { NodeExecutor } from '../executors/node-executor.interface';

export class NodeExecutorService {
  private builtinExecutors: Map<string, NodeExecutor>;

  constructor(
    private nodeExecRepo: NodeExecutorRepository,
    private workflowRepo: WorkflowRepository
  ) {
    this.builtinExecutors = new Map();
    this.initializeBuiltinExecutors();
  }

  private initializeBuiltinExecutors(): void {
    // Create instances of builtin executors (without dependencies for schema only)
    const executors: NodeExecutor[] = [
      new LLMExecutor({}),
      new DataTransformerExecutor(),
      new SQLExecutor({} as any), // Dummy D1 for schema only
      new RequestExecutor(),
    ];

    // Register each executor
    for (const executor of executors) {
      const def = executor.getDefinition();
      this.builtinExecutors.set(def.type, executor);
    }
  }

  async listNodeExecutors(): Promise<Array<{
    type: string;
    name: string;
    description: string;
    category: 'builtin' | 'custom';
    configSchema: Record<string, any>;
    isBuiltin: boolean;
    sourceWorkflowId?: string | null;
    createdAt: Date;
  }>> {
    // Get custom executors from database
    const customExecutors = await this.nodeExecRepo.findAll();

    // Get builtin executors from memory
    const builtinExecutorsList = Array.from(this.builtinExecutors.values()).map((executor) => {
      const def = executor.getDefinition();
      return {
        type: def.type,
        name: def.name,
        description: def.description,
        category: 'builtin' as const,
        configSchema: def.configSchema,
        isBuiltin: true,
        sourceWorkflowId: null,
        createdAt: new Date(), // Not really relevant for builtin
      };
    });

    // Combine both lists
    return [...builtinExecutorsList, ...customExecutors];
  }

  async getNodeExecutor(type: string): Promise<{
    type: string;
    name: string;
    description: string;
    category: 'builtin' | 'custom';
    configSchema: Record<string, any>;
    isBuiltin: boolean;
    sourceWorkflowId?: string | null;
    createdAt: Date;
  }> {
    // Check if it's a builtin executor
    const builtinExecutor = this.builtinExecutors.get(type);
    if (builtinExecutor) {
      const def = builtinExecutor.getDefinition();
      return {
        type: def.type,
        name: def.name,
        description: def.description,
        category: 'builtin',
        configSchema: def.configSchema,
        isBuiltin: true,
        sourceWorkflowId: null,
        createdAt: new Date(),
      };
    }

    // Check custom executors in database
    const executor = await this.nodeExecRepo.findByType(type);
    if (!executor) {
      throw new Error('Node executor not found');
    }
    return executor;
  }

  async createFromWorkflow(dto: CreateNodeExecutorDTO): Promise<NodeExecutorDB> {
    // Check if type already exists (both builtin and custom)
    if (this.builtinExecutors.has(dto.type)) {
      throw new Error('Cannot create custom executor with same type as builtin executor');
    }

    const exists = await this.nodeExecRepo.exists(dto.type);
    if (exists) {
      throw new Error('Custom node executor type already exists');
    }

    // Verify source workflow exists
    const workflow = await this.workflowRepo.findById(dto.source_workflow_id);
    if (!workflow) {
      throw new Error('Source workflow not found');
    }

    // Validate config schema
    this.validateConfigSchema(dto.config_schema);

    // Create node executor
    const executor = await this.nodeExecRepo.create({
      type: dto.type,
      name: dto.name,
      description: dto.description || null,
      category: 'custom',
      configSchema: dto.config_schema,
      isBuiltin: false,
      sourceWorkflowId: dto.source_workflow_id,
      createdAt: new Date(),
    });

    return executor;
  }

  async deleteNodeExecutor(type: string): Promise<void> {
    // Prevent deletion of builtin executors
    if (this.builtinExecutors.has(type)) {
      throw new Error('Cannot delete builtin node executor');
    }

    const executor = await this.nodeExecRepo.findByType(type);
    if (!executor) {
      throw new Error('Node executor not found');
    }

    await this.nodeExecRepo.delete(type);
  }

  private validateConfigSchema(schema: Record<string, any>): void {
    // Basic validation for config schema
    if (!schema || typeof schema !== 'object') {
      throw new Error('Invalid config schema');
    }

    // Check if it's a valid JSON Schema structure
    if (schema.type && schema.type !== 'object') {
      throw new Error('Config schema must be of type object');
    }
  }
}
