import { NodeExecutor } from './base-node-executor';
import { z } from 'zod';


const EmbeddingConfigSchema = z.object({
	text: z.union([
		z.string(),
		z.array(z.string())
	]).describe('Text or array of texts to generate embeddings for. Supports {{template}} variables.'),
	model: z.string()
		.default('@cf/baai/bge-base-en-v1.5')
		.describe('Embedding model to use. Default: @cf/baai/bge-base-en-v1.5'),
});

type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>;

export class EmbeddingExecutor extends NodeExecutor {
	readonly type = 'text_embedding';
	readonly description = 'Generate text embeddings using Cloudflare Workers AI';

	private readonly ai: Ai;

	constructor(env: Env) {
		super(env);

		if (!env.AI) {
			throw new Error('AI binding not available. Make sure Workers AI is configured in wrangler.toml');
		}

		this.ai = env.AI;
	}

	getConfigSchema() {
		return EmbeddingConfigSchema;
	}

	async execute(config: Record<string, any>, input: Record<string, any>): Promise<any> {
		const { text, model } = config as EmbeddingConfig;

		if (!text) {
			throw new Error('EmbeddingExecutor requires text in config');
		}

		const isArray = Array.isArray(text);
		const texts = isArray ? text : [text];

		const response = await this.ai.run(model as any, {
			text: texts,
		});

		if (!response || !response.data) {
			throw new Error('Failed to generate embeddings: Invalid response from AI model');
		}

		if (isArray) {
			return {
				embeddings: response.data,
				shape: response.shape,
				model: model,
				count: response.data.length,
			};
		} else {
			return {
				embedding: response.data[0],
				dimensions: response.shape ? response.shape[1] : response.data[0].length,
				model: model,
			};
		}
	}
}
