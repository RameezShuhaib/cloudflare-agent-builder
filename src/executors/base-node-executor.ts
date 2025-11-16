import { z } from 'zod';
import { TemplateParser } from '../utils/template-parser';

export abstract class NodeExecutor {
	protected readonly parser = new TemplateParser();

	abstract readonly type: string;
	abstract readonly description?: string;

	protected constructor(protected env: Env, protected builtin: boolean = true) {}

	abstract execute(config: Record<string, any>, input: Record<string, any>): Promise<any>;

	abstract getConfigSchema(): z.ZodObject<any>;

	protected parseConfig(config: Record<string, any>, input: Record<string, any>): Record<string, any> {
		return this.parser.parse(config, input) as Record<string, any>;
	}

	async run(config: Record<string, any>, input: Record<string, any>): Promise<any> {
		const parsedConfig = this.parseConfig(config, input);

		return await this.execute(parsedConfig, input);
	}
}
