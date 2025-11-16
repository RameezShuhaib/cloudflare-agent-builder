import { drizzle } from 'drizzle-orm/d1';
import { eq, Table, InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { generateId } from '../utils/helpers';

export type BaseEntity = {
	id: string;
	createdAt: Date;
	updatedAt?: Date;
};

export abstract class BaseRepository<
	TTable extends Table,
	TSelect extends BaseEntity = InferSelectModel<TTable> & BaseEntity,
	TInsert = InferInsertModel<TTable>
> {
	protected db;

	constructor(
		d1Database: D1Database,
		protected table: TTable
	) {
		this.db = drizzle(d1Database);
	}

	async create(entity: Omit<TSelect, 'id' | 'createdAt' | 'updatedAt'>): Promise<TSelect> {
		const dbEntity = {
			id: generateId(),
			createdAt: new Date(),
			...('updatedAt' in this.table && { updatedAt: new Date() }),
			...entity
		} as TInsert;

		const result = await this.db
			.insert(this.table)
			.values(dbEntity as any)
			.returning();

		return result[0] as TSelect;
	}

	async findById(id: string): Promise<TSelect | null> {
		const result = await this.db
			.select()
			.from(this.table)
			.where(eq((this.table as any).id, id))
			.limit(1);

		return result[0] as TSelect || null;
	}

	async findAll(): Promise<TSelect[]> {
		const results = await this.db
			.select()
			.from(this.table);

		return results as TSelect[];
	}

	async update(id: string, data: Partial<Omit<TSelect, 'id' | 'createdAt'>>): Promise<TSelect | null> {
		const updateData = {
			...data,
			...('updatedAt' in this.table && { updatedAt: new Date() }),
		};

		const result = await this.db
			.update(this.table)
			.set(updateData)
			.where(eq((this.table as any).id, id))
			.returning();

		return result[0] as TSelect || null;
	}

	async delete(id: string): Promise<void> {
		await this.db
			.delete(this.table)
			.where(eq((this.table as any).id, id));
	}

	async exists(id: string): Promise<boolean> {
		const result = await this.findById(id);
		return !!result;
	}

	// Additional common methods you might need
	async count(): Promise<number> {
		const result = await this.db
			.select({ count: (this.table as any).id })
			.from(this.table);

		return result.length;
	}

	async deleteAll(): Promise<void> {
		await this.db.delete(this.table);
	}
}
