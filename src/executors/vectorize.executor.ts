import { NodeExecutor } from './base-node-executor';
import { z } from 'zod';


const VectorizeOperationSchema = z.enum([
  'insert',
  'upsert',
  'query',
  'queryById',
  'getByIds',
  'deleteByIds',
  'describe',
]);

const VectorizeConfigSchema = z.object({
  operation: VectorizeOperationSchema.describe('Operation to perform: insert, upsert, query, queryById, getByIds, deleteByIds, describe'),
  indexBinding: z.string().default('DEFAULT_VECTORIZE_INDEX').describe('Name of the Vectorize binding (e.g., VECTORIZE_INDEX)'),

  vectors: z.array(z.object({
    id: z.string(),
    values: z.union([z.array(z.number()), z.any()]), // Float32Array/Float64Array at runtime
    namespace: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })).optional().describe('Vectors to insert/upsert. Supports {{template}} variables.'),

  queryVector: z.union([z.array(z.number()), z.any()]).optional()
    .describe('Query vector for similarity search. Supports {{template}} variables.'),
  topK: z.number().int().positive().max(100).optional().default(5)
    .describe('Number of results to return (max 100, or 20 with returnValues/returnMetadata=all)'),
  returnValues: z.boolean().optional().default(false)
    .describe('Return vector values in results'),
  returnMetadata: z.enum(['none', 'indexed', 'all']).optional().default('none')
    .describe('Return metadata: none (no metadata), indexed (only indexed fields), all (all metadata)'),
  filter: z.record(z.string(), z.any()).optional()
    .describe('Metadata filter for query operations. Supports $eq, $ne, $in, $nin, $lt, $lte, $gt, $gte operators'),
  namespace: z.string().optional()
    .describe('Namespace to query within or assign to vectors'),

  vectorId: z.string().optional()
    .describe('Vector ID for queryById operation. Supports {{template}} variables.'),

  ids: z.array(z.string()).optional()
    .describe('Array of vector IDs for getByIds/deleteByIds operations. Supports {{template}} variables.'),
});

type VectorizeConfig = z.infer<typeof VectorizeConfigSchema>;

export class VectorizeExecutor extends NodeExecutor {
  readonly type = 'vectorize';
  readonly description = 'Perform vector database operations using Cloudflare Vectorize';

  constructor(env: Env) {
    super(env);
  }

  getConfigSchema() {
    return VectorizeConfigSchema;
  }

  async execute(config: Record<string, any>, input: Record<string, any>): Promise<any> {
    const {
      operation,
      indexBinding,
      vectors,
      queryVector,
      topK,
      returnValues,
      returnMetadata,
      filter,
      namespace,
      vectorId,
      ids,
    } = config as VectorizeConfig;

    const index = (this.env as any)[indexBinding];
    if (!index) {
      throw new Error(
        `Vectorize binding '${indexBinding}' not found. ` +
        `Make sure the binding is configured in your wrangler.toml`
      );
    }

    switch (operation) {
      case 'insert':
        return await this.handleInsert(index, vectors, namespace);

      case 'upsert':
        return await this.handleUpsert(index, vectors, namespace);

      case 'query':
        return await this.handleQuery(
          index,
          queryVector,
          topK,
          returnValues,
          returnMetadata,
          filter,
          namespace
        );

      case 'queryById':
        return await this.handleQueryById(
          index,
          vectorId,
          topK,
          returnValues,
          returnMetadata
        );

      case 'getByIds':
        return await this.handleGetByIds(index, ids);

      case 'deleteByIds':
        return await this.handleDeleteByIds(index, ids);

      case 'describe':
        return await this.handleDescribe(index);

      default:
        throw new Error(`Unknown Vectorize operation: ${operation}`);
    }
  }

  private async handleInsert(
    index: any,
    vectors: any[] | undefined,
    namespace: string | undefined
  ): Promise<any> {
    if (!vectors || vectors.length === 0) {
      throw new Error('Insert operation requires vectors array');
    }

    const vectorsWithNamespace = namespace
      ? vectors.map(v => ({ ...v, namespace }))
      : vectors;

    const result = await index.insert(vectorsWithNamespace);
    return {
      operation: 'insert',
      count: result.count || vectors.length,
      mutationId: result.mutationId,
      ids: result.ids || vectors.map((v: any) => v.id),
    };
  }

  private async handleUpsert(
    index: any,
    vectors: any[] | undefined,
    namespace: string | undefined
  ): Promise<any> {
    if (!vectors || vectors.length === 0) {
      throw new Error('Upsert operation requires vectors array');
    }

    const vectorsWithNamespace = namespace
      ? vectors.map(v => ({ ...v, namespace }))
      : vectors;

    const result = await index.upsert(vectorsWithNamespace);
    return {
      operation: 'upsert',
      count: result.count || vectors.length,
      mutationId: result.mutationId,
      ids: result.ids || vectors.map((v: any) => v.id),
    };
  }

  private async handleQuery(
    index: any,
    queryVector: number[] | Float32Array | Float64Array | undefined,
    topK: number = 5,
    returnValues: boolean = false,
    returnMetadata: 'none' | 'indexed' | 'all' = 'none',
    filter: Record<string, any> | undefined,
    namespace: string | undefined
  ): Promise<any> {
    if (!queryVector) {
      throw new Error('Query operation requires queryVector');
    }

    const queryOptions: any = {
      topK,
      returnValues,
      returnMetadata,
    };

    if (filter) {
      queryOptions.filter = filter;
    }

    if (namespace) {
      queryOptions.namespace = namespace;
    }

    const result = await index.query(queryVector, queryOptions);
    return {
      operation: 'query',
      count: result.count,
      matches: result.matches,
    };
  }

  private async handleQueryById(
    index: any,
    vectorId: string | undefined,
    topK: number = 5,
    returnValues: boolean = false,
    returnMetadata: 'none' | 'indexed' | 'all' = 'none'
  ): Promise<any> {
    if (!vectorId) {
      throw new Error('QueryById operation requires vectorId');
    }

    const queryOptions: any = {
      topK,
      returnValues,
      returnMetadata,
    };

    const result = await index.queryById(vectorId, queryOptions);
    return {
      operation: 'queryById',
      count: result.count,
      matches: result.matches,
    };
  }

  private async handleGetByIds(
    index: any,
    ids: string[] | undefined
  ): Promise<any> {
    if (!ids || ids.length === 0) {
      throw new Error('GetByIds operation requires ids array');
    }

    const vectors = await index.getByIds(ids);
    return {
      operation: 'getByIds',
      count: vectors.length,
      vectors,
    };
  }

  private async handleDeleteByIds(
    index: any,
    ids: string[] | undefined
  ): Promise<any> {
    if (!ids || ids.length === 0) {
      throw new Error('DeleteByIds operation requires ids array');
    }

    const result = await index.deleteByIds(ids);
    return {
      operation: 'deleteByIds',
      count: ids.length,
      mutationId: result.mutationId,
      ids: result.ids || ids,
    };
  }

  private async handleDescribe(index: any): Promise<any> {
    const details = await index.describe();
    return {
      operation: 'describe',
      details,
    };
  }
}
