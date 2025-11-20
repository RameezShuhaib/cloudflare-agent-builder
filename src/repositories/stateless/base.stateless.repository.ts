import { Context } from 'hono';


export type BaseEntity = {
	id: string;
	createdAt: Date;
	updatedAt?: Date;
};

export class BaseStatelessRepository<T extends BaseEntity> {

	constructor(protected context: Context, protected prefix: string) {}

	protected getCtxKey(id: string) {
		return `${this.prefix}__${id}`
	}

	public async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
		const newEntity = {
			...entity,
			id: crypto.randomUUID(),
			createdAt: new Date(),
		} as T

		this.context.set(this.getCtxKey(newEntity.id), newEntity)

		return newEntity
	}

	public async findById(id: string): Promise<T> {
		return this.context.get(this.getCtxKey(id))
	}

	public async update(id: string, update: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
		const entity = this.context.get(this.getCtxKey(id)) as T
		const updateEntity: T = {
			...entity,
			...update,
		}

		this.context.set(this.getCtxKey(id), updateEntity)
	}
}
