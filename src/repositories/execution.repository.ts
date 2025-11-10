import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { executions, type Execution, type NewExecution } from '../db/schema';

export class ExecutionRepository {
  private db;

  constructor(d1Database: D1Database) {
    this.db = drizzle(d1Database);
  }

  async create(execution: NewExecution): Promise<Execution> {
    const result = await this.db.insert(executions).values(execution).returning();
    return result[0];
  }

  async findById(id: string): Promise<Execution | undefined> {
    const result = await this.db.select().from(executions).where(eq(executions.id, id)).limit(1);
    return result[0];
  }

  async findByWorkflowId(workflowId: string): Promise<Execution[]> {
    return await this.db.select().from(executions).where(eq(executions.workflowId, workflowId));
  }

  async update(id: string, data: Partial<NewExecution>): Promise<Execution | undefined> {
    const result = await this.db
      .update(executions)
      .set(data)
      .where(eq(executions.id, id))
      .returning();
    return result[0];
  }

  async updateStatus(id: string, status: 'pending' | 'running' | 'completed' | 'failed'): Promise<void> {
    await this.db
      .update(executions)
      .set({ status })
      .where(eq(executions.id, id));
  }
}
