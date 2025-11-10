import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { nodeExecutions, type NodeExecution, type NewNodeExecution } from '../db/schema';

export class NodeExecutionRepository {
  private db;

  constructor(d1Database: D1Database) {
    this.db = drizzle(d1Database);
  }

  async create(nodeExecution: NewNodeExecution): Promise<NodeExecution> {
    const result = await this.db.insert(nodeExecutions).values(nodeExecution).returning();
    return result[0];
  }

  async findById(id: string): Promise<NodeExecution | undefined> {
    const result = await this.db.select().from(nodeExecutions).where(eq(nodeExecutions.id, id)).limit(1);
    return result[0];
  }

  async findByExecutionId(executionId: string): Promise<NodeExecution[]> {
    return this.db.select().from(nodeExecutions).where(eq(nodeExecutions.executionId, executionId));
  }

  async update(id: string, data: Partial<NewNodeExecution>): Promise<NodeExecution | undefined> {
    const result = await this.db
      .update(nodeExecutions)
      .set(data)
      .where(eq(nodeExecutions.id, id))
      .returning();
    return result[0];
  }

  async bulkCreate(executions: NewNodeExecution[]): Promise<void> {
    if (executions.length === 0) return;
    await this.db.insert(nodeExecutions).values(executions);
  }
}
