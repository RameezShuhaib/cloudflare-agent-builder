import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { nodeExecutors, type NodeExecutor, type NewNodeExecutor } from '../db/schema';

export class NodeExecutorRepository {
  private db;

  constructor(d1Database: D1Database) {
    this.db = drizzle(d1Database);
  }

  async create(executor: NewNodeExecutor): Promise<NodeExecutor> {
    const result = await this.db.insert(nodeExecutors).values(executor).returning();
    return result[0];
  }

  async findByType(type: string): Promise<NodeExecutor | undefined> {
    const result = await this.db.select().from(nodeExecutors).where(eq(nodeExecutors.type, type)).limit(1);
    return result[0];
  }

  async findAll(): Promise<NodeExecutor[]> {
    return this.db.select().from(nodeExecutors);
  }

  async findByCategory(category: 'builtin' | 'custom'): Promise<NodeExecutor[]> {
    return this.db.select().from(nodeExecutors).where(eq(nodeExecutors.category, category));
  }

  async delete(type: string): Promise<void> {
    await this.db.delete(nodeExecutors).where(eq(nodeExecutors.type, type));
  }

  async exists(type: string): Promise<boolean> {
    const result = await this.findByType(type);
    return !!result;
  }
}
