import { z } from 'zod';
import { TemplateParser } from '../utils/template-parser';
import { StreamEvent } from '../domain/streaming';

export abstract class NodeExecutor {
	protected readonly parser = new TemplateParser();

	abstract readonly type: string;
	abstract readonly description?: string;

	readonly supportsStreaming: boolean = false;

	protected constructor(protected env: Env, protected builtin: boolean = true) {}

	abstract execute(config: Record<string, any>, input: Record<string, any>): Promise<any>;

	async executeStreaming?(
		config: Record<string, any>,
		input: Record<string, any>,
		onChunk: (chunk: any) => void
	): Promise<any> {
		throw new Error(`${this.type} executor doesn't support streaming`);
	}

	abstract getConfigSchema(): z.ZodObject<any>;

	protected parseConfig(config: Record<string, any>, input: Record<string, any>): Record<string, any> {
		return this.parser.parse(config, input) as Record<string, any>;
	}

	async run(config: Record<string, any>, input: Record<string, any>): Promise<any> {
		const parsedConfig = this.parseConfig(config, input);

		return await this.execute(parsedConfig, input);
	}
}
