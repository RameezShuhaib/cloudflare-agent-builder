import { NodeExecutor } from './node-executor.interface';
import { TemplateParser } from '../utils/template-parser';
import { z } from 'zod';
import Env from '../env';

export class SQLExecutor extends NodeExecutor {
  readonly type = 'sql_query';
  readonly description = 'Execute SQL queries on D1 database with template variable support';
  
  private db: D1Database;
  private parser: TemplateParser;

  constructor(env: Env) {
		super(env)
    this.db = env.DB;
    this.parser = new TemplateParser();
  }

  getConfigSchema() {
    return z.object({
      query: z.string().describe('SQL query with {{variable}} placeholders'),
    });
  }

  async execute(config: Record<string, any>, input: Record<string, any>): Promise<any> {
    const { query } = config;

    if (!query) {
      throw new Error('SQLExecutor requires a query in config');
    }

    this.validateQuery(query);

    const parsedQuery = this.parser.parse(query, input) as string;

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
