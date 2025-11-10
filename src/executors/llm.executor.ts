import { NodeExecutor } from './node-executor.interface';
import { TemplateParser } from '../utils/template-parser';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

interface LLMConfig {
  model: string;
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  response_format?: any;
  max_tokens?: number;
  temperature?: number;
  gateway?: {
    id: string;
    skipCache?: boolean;
    cacheTtl?: number;
  };
  provider?: 'workers-ai' | 'openai-sdk';
}

interface LLMExecutorOptions {
  ai?: Ai; // Workers AI binding
  accountId?: string;
  apiToken?: string;
  defaultGatewayId?: string;
}

export class LLMExecutor implements NodeExecutor {
  private parser: TemplateParser;
  private ai?: Ai;
  private accountId?: string;
  private apiToken?: string;
  private defaultGatewayId?: string;

  constructor(options: LLMExecutorOptions = {}) {
    this.parser = new TemplateParser();
    this.ai = options.ai;
    this.accountId = options.accountId;
    this.apiToken = options.apiToken;
    this.defaultGatewayId = options.defaultGatewayId;
  }

  getDefinition() {
    return {
      type: 'llm_enhancement',
      name: 'LLM Enhancement',
      description: 'Execute LLM calls with structured output support using OpenAI SDK or Workers AI',
      configSchema: {
        type: 'object',
        properties: {
          model: {
            type: 'string',
            description: 'Model ID (e.g., @cf/meta/llama-3.1-8b-instruct)',
          },
          prompt: {
            type: 'string',
            description: 'Simple prompt string (alternative to messages)',
          },
          messages: {
            type: 'array',
            description: 'Array of message objects with role and content',
            items: {
              type: 'object',
              properties: {
                role: { type: 'string' },
                content: { type: 'string' },
              },
            },
          },
          response_format: {
            description: 'Zod schema or JSON schema for structured output',
          },
          max_tokens: {
            type: 'number',
            default: 1000,
          },
          temperature: {
            type: 'number',
            minimum: 0,
            maximum: 2,
          },
          gateway: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              skipCache: { type: 'boolean' },
              cacheTtl: { type: 'number' },
            },
          },
          provider: {
            type: 'string',
            enum: ['workers-ai', 'openai-sdk'],
            default: 'openai-sdk',
            description: 'Provider to use (openai-sdk recommended for structured output)',
          },
        },
        required: ['model'],
      },
    };
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
    if (!this.accountId || !this.apiToken) {
      throw new Error('OpenAI SDK requires accountId and apiToken');
    }

    const gatewayId = config.gateway?.id || this.defaultGatewayId;
    if (!gatewayId) {
      throw new Error('Gateway ID is required for OpenAI SDK mode');
    }

    const client = new OpenAI({
      apiKey: this.apiToken,
      baseURL: `https://gateway.ai.cloudflare.com/v1/${this.accountId}/${gatewayId}/compat`,
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

    // Check if response_format is a Zod schema
    if (this.isZodSchema(responseFormat)) {
      // Use OpenAI's structured output with Zod
      const completion = await (client.beta as any).chat.completions.parse({
        model: modelName,
        messages: messages as any,
        response_format: zodResponseFormat(responseFormat, 'output'),
        max_tokens: config.max_tokens || 1000,
        temperature: config.temperature,
      });

      return completion.choices[0].message.parsed;
    }

    // If it's a JSON schema object (not Zod), convert to JSON mode format
    if (typeof responseFormat === 'object' && responseFormat.type) {
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

      // Parse the JSON response
      const content = completion.choices[0].message.content;
      try {
        return JSON.parse(content || '{}');
      } catch (error) {
        throw new Error(`Failed to parse JSON response: ${error}`);
      }
    }

    throw new Error('Invalid response_format: must be a Zod schema or JSON schema object');
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
