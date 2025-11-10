import { NodeExecutor } from './node-executor.interface';
import { TemplateParser } from '../utils/template-parser';

export class DataTransformerExecutor implements NodeExecutor {
  private parser: TemplateParser;

  constructor() {
    this.parser = new TemplateParser();
  }

  getDefinition() {
    return {
      type: 'data_transformer',
      name: 'Data Transformer',
      description: 'Transform data using templates with variable substitution',
      configSchema: {
        type: 'object',
        properties: {
          template: {
            type: 'object',
            description: 'Template object with {{variable}} placeholders',
          },
        },
        required: ['template'],
      },
    };
  }

  async execute(config: Record<string, any>, input: Record<string, any>): Promise<any> {
    const { template } = config;

    if (!template) {
      throw new Error('DataTransformer requires a template in config');
    }

    // Parse the template with input data
    const result = this.parser.parseObject(template, input);

    return result;
  }
}
