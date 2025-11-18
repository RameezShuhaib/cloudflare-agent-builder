import { NodeExecutor } from './base-node-executor';
import OpenAI from 'openai';
import { z } from 'zod';


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
  readonly supportsStreaming = true;

  private readonly ai?: Ai;

  constructor(env: Env) {
		super(env)

    this.ai = env.AI;
  }

  getConfigSchema() {
    return llmConfigSchema;
  }

  async executeStreaming(
    config: Record<string, any>,
    input: Record<string, any>,
    onChunk: (chunk: any) => void
  ): Promise<any> {
    const llmConfig = config as LLMConfig;

    if (!llmConfig.model) {
      throw new Error('LLMExecutor requires a model in config');
    }

    const parsedMessages = this.buildMessages(llmConfig, input);
    const provider = llmConfig.provider || 'openai-sdk';

    if (provider === 'openai-sdk') {
      return await this.executeWithOpenAIStreaming(llmConfig, parsedMessages, onChunk);
    } else if (provider === 'workers-ai' && this.ai) {
      return await this.executeWithWorkersAIStreaming(llmConfig, parsedMessages, onChunk);
    } else {
      throw new Error('Invalid provider or Workers AI binding not available');
    }
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
        content: msg.content,
      }));
    }

    if (config.prompt) {
      return [{ role: 'user', content: config.prompt }];
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

    const payload: any = {
      messages: messages,
      max_tokens: config.max_tokens || 1000,
      temperature: config.temperature,
    };

    if (config.response_format) {
      let jsonSchema = config.response_format;

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

  private async executeWithOpenAIStreaming(
    config: LLMConfig,
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: any) => void
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

    const stream = await client.chat.completions.create({
      model: modelName,
      messages: messages as any,
      max_tokens: config.max_tokens || 1000,
      temperature: config.temperature,
      stream: true,
    });

    let fullText = '';
    let usage: any = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        fullText += delta.content;
        onChunk({ chunk: delta.content });
      }
      // Capture usage from the last chunk if available
      if (chunk.usage) {
        usage = chunk.usage;
      }
    }

    return {
      text: fullText,
      usage: usage,
      model: modelName,
      finish_reason: 'stop',
    };
  }

  private async executeWithWorkersAIStreaming(
    config: LLMConfig,
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: any) => void
  ): Promise<any> {
    if (!this.ai) {
      throw new Error('Workers AI binding not available');
    }

    const payload: any = {
      messages: messages,
      max_tokens: config.max_tokens || 1000,
      temperature: config.temperature,
      stream: true,
    };

    const gatewayOptions = config.gateway
      ? {
          gateway: {
            id: config.gateway.id,
            skipCache: config.gateway.skipCache,
            cacheTtl: config.gateway.cacheTtl,
          },
        }
      : undefined;

    const stream = await this.ai.run(config.model as any, payload, gatewayOptions) as ReadableStream;

    let fullText = '';
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.response) {
                fullText += parsed.response;
                onChunk({ chunk: parsed.response });
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      text: fullText,
      model: config.model,
      finish_reason: 'stop',
    };
  }
}
