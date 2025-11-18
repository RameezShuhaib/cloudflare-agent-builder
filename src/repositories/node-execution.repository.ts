import { eq } from 'drizzle-orm';
import { nodeExecutions } from '../db/schema';
import { NodeExecutionModel } from '../domain/entities';
import { BaseRepository } from './baase.repository';

export class NodeExecutionRepository extends BaseRepository<typeof nodeExecutions, NodeExecutionModel> {
	constructor(d1Database: D1Database) {
		super(d1Database, nodeExecutions);
	}

	async findByExecutionId(executionId: string): Promise<NodeExecutionModel[]> {
		return this.db
			.select()
			.from(nodeExecutions)
			.where(eq(nodeExecutions.executionId, executionId)) as unknown as NodeExecutionModel[];
	}

	async updateStatus(id: string, status: 'pending' | 'running' | 'completed' | 'failed'): Promise<void> {
		await this.db
			.update(nodeExecutions)
			.set({ status })
			.where(eq(nodeExecutions.id, id));
	}
}
