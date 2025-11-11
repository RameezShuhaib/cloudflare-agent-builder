import { NodeExecutor } from './node-executor.interface';
import { TemplateParser } from '../utils/template-parser';
import { z } from 'zod';
import Env from '../env';

export class DataTransformerExecutor extends NodeExecutor {
  readonly type = 'data_transformer';
  readonly description = 'Transform data using templates with variable substitution';

  private parser: TemplateParser;

  constructor(env: Env) {
		super(env)
    this.parser = new TemplateParser();
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

    return  this.parser.parseObject(template, input);
  }
}
