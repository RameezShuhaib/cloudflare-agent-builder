import { Context } from 'hono';
import type { ExecutionModel } from '../../domain/entities';
import { BaseStatelessRepository } from './base.stateless.repository';

export class ExecutionStatelessRepository extends BaseStatelessRepository<ExecutionModel> {

	constructor(context: Context) {
		super(context, 'execution_stateless_repo')
	}

	async updateStatus(id: string, status: 'pending' | 'running' | 'completed' | 'failed'): Promise<void> {
		const entity = await this.findById(id)
		await this.update(id, { ...entity, status: status })
	}
}
