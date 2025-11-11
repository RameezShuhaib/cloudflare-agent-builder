import { z } from 'zod';

export abstract class NodeExecutor {
	abstract readonly type: string;
	abstract readonly description: string;

	protected constructor(protected env: Env) {}

	abstract execute(config: Record<string, any>, input: Record<string, any>): Promise<any>;

	abstract getConfigSchema(): z.ZodObject<any>;
}

