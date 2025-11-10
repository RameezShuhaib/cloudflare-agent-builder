import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { workflows, type Workflow, type NewWorkflow } from '../db/schema';

export class WorkflowRepository {
  private db;

  constructor(d1Database: D1Database) {
    this.db = drizzle(d1Database);
  }

  async create(workflow: NewWorkflow): Promise<Workflow> {
    const result = await this.db.insert(workflows).values(workflow).returning();
    return result[0];
  }

  async findById(id: string): Promise<Workflow | undefined> {
    const result = await this.db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
    return result[0];
  }

  async findAll(): Promise<Workflow[]> {
    return this.db.select().from(workflows);
  }

  async update(id: string, data: Partial<NewWorkflow>): Promise<Workflow | undefined> {
    const result = await this.db
      .update(workflows)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workflows.id, id))
      .returning();
    return result[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(workflows).where(eq(workflows.id, id));
  }
}
