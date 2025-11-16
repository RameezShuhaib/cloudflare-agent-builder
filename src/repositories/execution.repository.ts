import { eq } from 'drizzle-orm';
import { executions } from '../db/schema';
import { ExecutionModel } from '../domain/entities';
import { BaseRepository } from './baase.repository';

export class ExecutionRepository extends BaseRepository<typeof executions, ExecutionModel> {
	constructor(d1Database: D1Database) {
		super(d1Database, executions);
	}

	async findByWorkflowId(workflowId: string): Promise<ExecutionModel[]> {
		return this.db
			.select()
			.from(executions)
			.where(eq(executions.workflowId, workflowId)) as unknown as ExecutionModel[];
	}

	async updateStatus(id: string, status: 'pending' | 'running' | 'completed' | 'failed'): Promise<void> {
		await this.db
			.update(executions)
			.set({ status })
			.where(eq(executions.id, id));
	}
}
