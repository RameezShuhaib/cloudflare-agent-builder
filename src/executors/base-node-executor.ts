import { z } from 'zod';
import { TemplateParser } from '../utils/template-parser';
import { NodeModel } from '../domain/entities';

export abstract class NodeExecutor {
	protected readonly parser = new TemplateParser();

	abstract readonly type: string;
	abstract readonly description?: string;

	readonly supportsStreaming: boolean = false;

	protected constructor(protected env: Env, protected builtin: boolean = true) {}

	abstract getConfigSchema(): z.ZodObject<any>;

	abstract execute(config: Record<string, any>, input: Record<string, any>): Promise<any>;

	async executeStreaming?(
		config: Record<string, any>,
		input: Record<string, any>,
		onChunk: (chunk: any) => void
	): Promise<any> {
		throw new Error(`${this.type} executor doesn't support streaming`);
	}

	async run(node: NodeModel, input: Record<string, any>, onChunk?: (chunk: any) => void): Promise<any> {
		const parsedConfig = this.parser.parse(node.config, input) as Record<string, any>;

		if (node.streaming?.enabled === true) {
			if (!this.supportsStreaming || !this.executeStreaming) {
				throw new Error(`Node ${node.id} configured to stream but executor ${this.type} doesn't support it`);
			}
			return await this.executeStreaming(parsedConfig, input, onChunk!);
		} else {
			return await this.execute(parsedConfig, input);
		}
	}
}
