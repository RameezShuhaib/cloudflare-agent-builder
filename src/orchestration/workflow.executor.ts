import { NodeExecutor } from '../executors/node-executor.interface';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { ExecutionRepository } from '../repositories/execution.repository';
import { WorkflowOrchestrator } from './workflow-orchestrator';
import { TemplateParser } from '../utils/template-parser';
import { generateId } from '../utils/helpers';
import { z } from 'zod';
import type { Workflow } from '../db/schema';
import Env from '../env';

export class WorkflowExecutor extends NodeExecutor {
	readonly type: string;
	readonly description: string;
	
	private readonly parser: TemplateParser;
	private readonly configSchemaZod: z.ZodObject<any>;

	constructor(
    private executionRepo: ExecutionRepository,
    private orchestrator: WorkflowOrchestrator,
    private workflow: Workflow,
    configSchema: z.ZodObject<any>,
		env: Env
  ) {
		super(env)

		this.type = `workflow_${this.workflow.id}`;
		this.description = `Workflow executor for ${this.workflow.name}`;
		this.configSchemaZod = configSchema;
		this.parser = new TemplateParser();
	}

  getConfigSchema() {
    return this.configSchemaZod;
  }

  async execute(config: Record<string, any>, input: Record<string, any>): Promise<any> {
    this.validateConfig(config);

    const workflowParameters = this.mapInputToParameters(config, input);

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

    return await this.orchestrator.execute(this.workflow, execution);
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

    return this.parser.parseObject(mapping, context);
  }

  private validateConfig(config: Record<string, any>): void {
    try {
      this.configSchemaZod.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid configuration for workflow executor: ${error.message}`);
      }
      throw error;
    }
  }
}
