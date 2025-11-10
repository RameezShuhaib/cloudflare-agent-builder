import { NodeExecutor } from '../executors/node-executor.interface';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { ExecutionRepository } from '../repositories/execution.repository';
import { WorkflowOrchestrator } from './workflow-orchestrator';
import { TemplateParser } from '../utils/template-parser';
import { validateJsonSchema, generateId } from '../utils/helpers';
import type { Workflow } from '../db/schema';

export class WorkflowExecutor implements NodeExecutor {
  constructor(
    private workflowRepo: WorkflowRepository,
    private executionRepo: ExecutionRepository,
    private orchestrator: WorkflowOrchestrator,
    private parser: TemplateParser,
    private workflow: Workflow,
    private configSchema: Record<string, any>
  ) {}

  getDefinition() {
    return {
      type: `workflow_${this.workflow.id}`,
      name: this.workflow.name,
      description: `Workflow executor for ${this.workflow.name}`,
      configSchema: this.configSchema,
    };
  }

  async execute(config: Record<string, any>, input: Record<string, any>): Promise<any> {
    // Step 1: Validate config against schema
    this.validateConfig(config);

    // Step 2: Map input data to workflow parameters
    const workflowParameters = this.mapInputToParameters(config, input);

    // Step 3: Create a temporary execution record
    const execution = await this.executionRepo.create({
      id: generateId(),
      workflowId: this.workflow.id,
      status: 'running',
      startedAt: new Date(),
      parameters: workflowParameters,
      configId: null,
      result: null,
      error: null,
      completedAt: null,
    });

    // Step 4: Execute the workflow
    const result = await this.orchestrator.execute(this.workflow, execution);

    // Step 5: Return the output
    return result;
  }

  private mapInputToParameters(
    config: Record<string, any>,
    input: Record<string, any>
  ): Record<string, any> {
    const mapping = config['parameter_mapping'] || {};

    const context = {
      input: input,
      config: config,
    };

    // Parse the mapping template with input data
    return this.parser.parseObject(mapping, context);
  }

  private validateConfig(config: Record<string, any>): void {
    // Validate config against configSchema
    const isValid = validateJsonSchema(config, this.configSchema);

    if (!isValid) {
      throw new Error('Invalid configuration for custom executor');
    }
  }
}
