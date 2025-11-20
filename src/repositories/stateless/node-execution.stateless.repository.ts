import { Context } from 'hono';
import type { NodeExecutionModel } from '../../domain/entities';
import { BaseStatelessRepository } from './base.stateless.repository';

export class NodeExecutionStatelessRepository extends BaseStatelessRepository<NodeExecutionModel> {

	constructor(context: Context) {
		super(context, 'node_execution_stateless_repo')
	}

	async updateStatus(id: string, status: 'pending' | 'running' | 'completed' | 'failed'): Promise<void> {
		const entity = await this.findById(id)
		await this.update(id, { ...entity, status: status })
	}
}
