import { configs } from '../db/schema';
import { ConfigModel } from '../domain/entities';
import { BaseRepository } from './baase.repository';

export class ConfigRepository extends BaseRepository<typeof configs, ConfigModel> {
	constructor(d1Database: D1Database) {
		super(d1Database, configs);
	}
}
