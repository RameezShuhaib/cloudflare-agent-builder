import { NodeExecutor } from './base-node-executor';
import { z } from 'zod';
import Env from '../env';

export class DataTransformerExecutor extends NodeExecutor {
  readonly type = 'data_transformer';
  readonly description = 'Transform data using templates with variable substitution';

  constructor(env: Env) {
		super(env)
  }

  getConfigSchema() {
    return z.object({
      template: z.record(z.any(), z.any()).describe('Template object with {{variable}} placeholders'),
    });
  }

  async execute(config: Record<string, any>, input: Record<string, any>): Promise<any> {
    const { template } = config;

    if (!template) {
      throw new Error('DataTransformer requires a template in config');
    }

    return template;
  }
}
