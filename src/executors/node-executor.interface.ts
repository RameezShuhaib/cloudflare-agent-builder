export interface NodeExecutor {
  execute(config: Record<string, any>, input: Record<string, any>): Promise<any>;
  getDefinition(): {
    type: string;
    name: string;
    description: string;
    configSchema: Record<string, any>;
  };
}
