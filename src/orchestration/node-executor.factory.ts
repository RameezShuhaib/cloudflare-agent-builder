import Env from '../env';
import { NodeExecutor } from '../executors/base-node-executor';
import { DataTransformerExecutor } from '../executors/data-transformer.executor';
import { SQLExecutor } from '../executors/sql.executor';
import { RequestExecutor } from '../executors/request.executor';
import { LLMExecutor } from '../executors/llm.executor';


export class NodeExecutorFactory {
	private readonly env: Env;

  private executors: Map<string, NodeExecutor>;

  constructor(env: Env) {
    this.env = env;
    this.executors = new Map();

    this.registerBuiltinExecutors();
  }

  async getExecutor(nodeType: string): Promise<NodeExecutor | null> {
    if (!this.executors.has(nodeType)) {
			return null; // More likely a custom executor
    }
		return this.executors.get(nodeType)!;
  }

  private registerBuiltinExecutors(): void {
    this.executors.set('data_transformer', new DataTransformerExecutor(this.env));
    this.executors.set('sql_query', new SQLExecutor(this.env));
    this.executors.set('http_request', new RequestExecutor(this.env));
    this.executors.set('llm', new LLMExecutor(this.env));
  }
}
