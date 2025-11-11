import { z } from 'zod';
import { NodeExecutor } from './node-executor.interface';
import { TemplateParser } from '../utils/template-parser';


const httpRequestConfigSchema = z.object({
	url: z.string().describe('Request URL with {{variable}} placeholders'),
	method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
		.default('GET')
		.describe('HTTP method'),
	headers: z.record(z.string(), z.string()).optional().describe('Request headers with {{variable}} placeholders'),
	body: z.any().optional().describe('Request body (for POST, PUT, PATCH) with {{variable}} placeholders'),
});

export type HttpRequestConfig = z.infer<typeof httpRequestConfigSchema>;

export class RequestExecutor extends NodeExecutor {
  readonly type = 'http_request';
  readonly description = 'Make HTTP requests with template variable support';

  private parser: TemplateParser;

  constructor(env: Env) {
		super(env)
    this.parser = new TemplateParser();
  }

  getConfigSchema() {
    return httpRequestConfigSchema;
  }

  async execute(config: Record<string, any>, input: Record<string, any>): Promise<any> {
    const { url, method = 'GET', headers = {}, body } = config;

    if (!url) {
      throw new Error('RequestExecutor requires a url in config');
    }

    const parsedUrl = this.parser.parse(url, input) as string;
    const parsedHeaders = this.parser.parseObject(headers, input);
    const parsedBody = body ? this.parser.parse(body, input) : undefined;

    const requestInit: RequestInit = {
      method: method.toUpperCase(),
      headers: parsedHeaders,
    };

    if (parsedBody && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
      requestInit.body = typeof parsedBody === 'string'
        ? parsedBody
        : JSON.stringify(parsedBody);
    }

    const response = await fetch(parsedUrl, requestInit);

    const contentType = response.headers.get('content-type');
    let responseData;

    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
    };
  }
}
