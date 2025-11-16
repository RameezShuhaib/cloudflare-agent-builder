import { z } from 'zod';
import { NodeExecutor } from './base-node-executor';


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

  constructor(env: Env) {
		super(env)
  }

  getConfigSchema() {
    return httpRequestConfigSchema;
  }

  async execute(config: Record<string, any>, input: Record<string, any>): Promise<any> {
    const { url, method = 'GET', headers = {}, body } = config as HttpRequestConfig;

    if (!url) {
      throw new Error('RequestExecutor requires a url in config');
    }

    // Config is already parsed by BaseNodeExecutor.run()
    // url, headers, and body are already resolved
    const requestInit: RequestInit = {
      method: method.toUpperCase(),
      headers: headers,
    };

    if (body && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
      requestInit.body = typeof body === 'string'
        ? body
        : JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);

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
