import { NodeExecutor } from './node-executor.interface';
import { TemplateParser } from '../utils/template-parser';

export class RequestExecutor implements NodeExecutor {
  private parser: TemplateParser;

  constructor() {
    this.parser = new TemplateParser();
  }

  getDefinition() {
    return {
      type: 'http_request',
      name: 'HTTP Request',
      description: 'Make HTTP requests with template variable support',
      configSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'Request URL with {{variable}} placeholders',
          },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
            default: 'GET',
            description: 'HTTP method',
          },
          headers: {
            type: 'object',
            description: 'Request headers with {{variable}} placeholders',
          },
          body: {
            description: 'Request body (for POST, PUT, PATCH) with {{variable}} placeholders',
          },
        },
        required: ['url'],
      },
    };
  }

  async execute(config: Record<string, any>, input: Record<string, any>): Promise<any> {
    const { url, method = 'GET', headers = {}, body } = config;

    if (!url) {
      throw new Error('RequestExecutor requires a url in config');
    }

    // Parse URL, headers, and body with input data
    const parsedUrl = this.parser.parse(url, input) as string;
    const parsedHeaders = this.parser.parseObject(headers, input);
    const parsedBody = body ? this.parser.parse(body, input) : undefined;

    // Build request
    const requestInit: RequestInit = {
      method: method.toUpperCase(),
      headers: parsedHeaders,
    };

    if (parsedBody && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
      requestInit.body = typeof parsedBody === 'string' 
        ? parsedBody 
        : JSON.stringify(parsedBody);
    }

    // Execute request
    const response = await fetch(parsedUrl, requestInit);

    // Parse response
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
