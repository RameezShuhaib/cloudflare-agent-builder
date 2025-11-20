import { Context } from 'hono';
import type { WorkflowModel } from '../../domain/entities';
import { BaseStatelessRepository } from './base.stateless.repository';

export class WorkflowStatelessRepository extends BaseStatelessRepository<WorkflowModel> {
	constructor(context: Context) {
		super(context, 'workflow_stateless_repo')
	}
}
