import { workflows } from '../db/schema';
import { WorkflowModel } from '../domain/entities';
import { BaseRepository } from './baase.repository';

export class WorkflowRepository extends BaseRepository<typeof workflows, WorkflowModel> {
	constructor(d1Database: D1Database) {
		super(d1Database, workflows);
	}
}
