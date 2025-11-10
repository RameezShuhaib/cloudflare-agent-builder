import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { configs, type Config, type NewConfig } from '../db/schema';

export class ConfigRepository {
  private db;

  constructor(d1Database: D1Database) {
    this.db = drizzle(d1Database);
  }

  async create(config: NewConfig): Promise<Config> {
    const result = await this.db.insert(configs).values(config).returning();
    return result[0];
  }

  async findById(id: string): Promise<Config | undefined> {
    const result = await this.db.select().from(configs).where(eq(configs.id, id)).limit(1);
    return result[0];
  }

  async findAll(): Promise<Config[]> {
    return this.db.select().from(configs);
  }

  async update(id: string, data: Partial<NewConfig>): Promise<Config | undefined> {
    const result = await this.db
      .update(configs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(configs.id, id))
      .returning();
    return result[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(configs).where(eq(configs.id, id));
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.findById(id);
    return !!result;
  }
}
