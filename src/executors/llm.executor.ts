import { NodeExecutor } from './node-executor.interface';
import { TemplateParser } from '../utils/template-parser';
import OpenAI from 'openai';
import { z } from 'zod';
import Env from '../env';


const llmConfigSchema = z.object({
	model: z.string().min(1),
	provider: z.enum(['workers-ai', 'openai-sdk']).default('workers-ai'),
	prompt: z.string().optional(),
	messages: z.array(
		z.object({
			role: z.string(),
			content: z.string().min(1)
		})
	).optional(),
	response_format: z.any().optional(),
	max_tokens: z.number().positive().int().optional(),
	temperature: z.number().min(0).max(2).optional(),
	gateway: z.object({
		id: z.string().min(1),
		skipCache: z.boolean().optional(),
		cacheTtl: z.number().positive().optional()
	}).optional(),
	cloudflare: z.object({
		accountId: z.string(),
		apiToken: z.string(),
	})
});


type LLMConfig = z.infer<typeof llmConfigSchema>;


export class LLMExecutor extends NodeExecutor {
  readonly type = 'llm';
  readonly description = 'Execute LLM requests with support for multiple providers (Workers AI, OpenAI)';

  private parser: TemplateParser;
  private readonly ai?: Ai;

  constructor(env: Env) {
		super(env)

    this.parser = new TemplateParser();
    this.ai = env.AI;
  }

  getConfigSchema() {
    return llmConfigSchema;
  }

  async execute(config: Record<string, any>, input: Record<string, any>): Promise<any> {
    const llmConfig = config as LLMConfig;

    if (!llmConfig.model) {
      throw new Error('LLMExecutor requires a model in config');
    }

    const parsedMessages = this.buildMessages(llmConfig, input);

    const provider = llmConfig.provider || 'openai-sdk';

    if (provider === 'openai-sdk') {
      return await this.executeWithOpenAI(llmConfig, parsedMessages);
    } else if (provider === 'workers-ai' && this.ai) {
      return await this.executeWithWorkersAI(llmConfig, parsedMessages);
    } else {
      throw new Error('Invalid provider or Workers AI binding not available');
    }
  }

  private buildMessages(
    config: LLMConfig,
    input: Record<string, any>
  ): Array<{ role: string; content: string }> {
    if (config.messages && Array.isArray(config.messages)) {
      return config.messages.map((msg) => ({
        role: msg.role,
        content: this.parser.parse(msg.content, input) as string,
      }));
    }

    if (config.prompt) {
      const parsedPrompt = this.parser.parse(config.prompt, input) as string;
      return [{ role: 'user', content: parsedPrompt }];
    }

    throw new Error('LLMExecutor requires either prompt or messages in config');
  }

  private async executeWithOpenAI(
    config: LLMConfig,
    messages: Array<{ role: string; content: string }>
  ): Promise<any> {
    if (!config.cloudflare.accountId || !config.cloudflare.apiToken) {
      throw new Error('OpenAI SDK requires accountId and apiToken');
    }

    const gatewayId = config.gateway?.id;
    if (!gatewayId) {
      throw new Error('Gateway ID is required for OpenAI SDK mode');
    }

    const client = new OpenAI({
      apiKey: config.cloudflare.apiToken,
      baseURL: `https://gateway.ai.cloudflare.com/v1/${config.cloudflare.accountId}/${gatewayId}/compat`,
    });

    const modelName = config.model.startsWith('workers-ai/')
      ? config.model
      : `workers-ai/${config.model}`;

    if (config.response_format) {
      return await this.executeStructuredOutput(client, modelName, messages, config);
    }

    const completion = await client.chat.completions.create({
      model: modelName,
      messages: messages as any,
      max_tokens: config.max_tokens || 1000,
      temperature: config.temperature,
    });

    return {
      text: completion.choices[0].message.content,
      usage: completion.usage,
      model: completion.model,
      finish_reason: completion.choices[0].finish_reason,
    };
  }

  private async executeStructuredOutput(
    client: OpenAI,
    modelName: string,
    messages: Array<{ role: string; content: string }>,
    config: LLMConfig
  ): Promise<any> {
    const responseFormat = config.response_format;

		const completion = await client.chat.completions.create({
			model: modelName,
			messages: messages as any,
			response_format: {
				type: 'json_schema',
				json_schema: responseFormat,
			} as any,
			max_tokens: config.max_tokens || 1000,
			temperature: config.temperature,
		});

		const content = completion.choices[0].message.content;
		try {
			return JSON.parse(content || '{}');
		} catch (error) {
			throw new Error(`Failed to parse JSON response: ${error}`);
		}
  }

  private async executeWithWorkersAI(
    config: LLMConfig,
    messages: Array<{ role: string; content: string }>
  ): Promise<any> {
    if (!this.ai) {
      throw new Error('Workers AI binding not available');
    }

    // Prepare the request payload
    const payload: any = {
      messages: messages,
      max_tokens: config.max_tokens || 1000,
      temperature: config.temperature,
    };

    // Add response_format if provided (JSON Mode)
    if (config.response_format) {
      // Convert Zod schema to JSON schema if needed
      let jsonSchema = config.response_format;

      if (this.isZodSchema(jsonSchema)) {
        // For Zod schemas, we need to extract the JSON schema
        // This is a simplified version - in production, use zod-to-json-schema
        throw new Error('Zod schemas not yet supported with Workers AI binding. Use provider: "openai-sdk" instead.');
      }

      payload.response_format = {
        type: 'json_schema',
        json_schema: jsonSchema,
      };
    }

    const gatewayOptions = config.gateway
      ? {
          gateway: {
            id: config.gateway.id,
            skipCache: config.gateway.skipCache,
            cacheTtl: config.gateway.cacheTtl,
          },
        }
      : undefined;

    return await this.ai.run(config.model as any, payload, gatewayOptions);
  }

  private isZodSchema(value: any): boolean {
    return value && typeof value === 'object' && '_def' in value;
  }
}
