import { NodeExecutor } from './node-executor.interface';
import { TemplateParser } from '../utils/template-parser';

export class SQLExecutor implements NodeExecutor {
  private db: D1Database;
  private parser: TemplateParser;

  constructor(db: D1Database) {
    this.db = db;
    this.parser = new TemplateParser();
  }

  getDefinition() {
    return {
      type: 'sql_query',
      name: 'SQL Query',
      description: 'Execute SQL queries on D1 database with template variable support',
      configSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'SQL query with {{variable}} placeholders',
          },
        },
        required: ['query'],
      },
    };
  }

  async execute(config: Record<string, any>, input: Record<string, any>): Promise<any> {
    const { query } = config;

    if (!query) {
      throw new Error('SQLExecutor requires a query in config');
    }

    // Validate query (basic check for destructive operations)
    this.validateQuery(query);

    // Parse the query template with input data
    const parsedQuery = this.parser.parse(query, input) as string;

    // Execute the query
    const result = await this.db.prepare(parsedQuery).all();

    return result.results;
  }

  private validateQuery(query: string): void {
    const destructiveKeywords = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE'];
    const upperQuery = query.toUpperCase();

    for (const keyword of destructiveKeywords) {
      if (upperQuery.includes(keyword)) {
        throw new Error(`Destructive SQL operation not allowed: ${keyword}`);
      }
    }
  }
}
