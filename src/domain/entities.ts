import { z } from "zod";
import { toOptional, withTimestamps } from "../utils/zod";


export const NodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  config: z.record(z.string(), z.any()),
  setState: z.array(
    z.object({
      key: z.string(),
      rule: z.array(z.any()),
    })
  ).optional(),
});


// Edge schemas - discriminated union for static vs dynamic edges
export const StaticEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
});

export const DynamicEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  rule: z.array(z.any()),
});

export const EdgeSchema = z.discriminatedUnion('type', [
  StaticEdgeSchema.extend({ type: z.literal('static') }),
  DynamicEdgeSchema.extend({ type: z.literal('dynamic') }),
]);

// For convenience, also allow edges without explicit type field
// The type will be inferred from presence of 'to' vs 'rule'
export const EdgeInputSchema = z.union([
  StaticEdgeSchema,
  DynamicEdgeSchema,
]);

export type StaticEdge = z.infer<typeof StaticEdgeSchema>;
export type DynamicEdge = z.infer<typeof DynamicEdgeSchema>;
export type Edge = StaticEdge | DynamicEdge;


export const WorkflowSchema = withTimestamps(
  z.object({
    id: z.string(),
    name: z.string(),
    parameterSchema: z.record(z.string(), z.any()),
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeInputSchema),
    startNode: z.string(),
    endNode: z.string(),
		state: z.record(z.string(), z.any()).default({}),
    maxIterations: z.number().int().positive(),
    defaultConfigId: z.string(),
  })
);
export type WorkflowModel = z.infer<typeof WorkflowSchema>;


export const ExecutionSchema = withTimestamps(
	z.object({
		id: z.string(),
		workflowId: z.string(),
		status: z.enum(['pending', 'running', 'completed', 'failed']),
		completedAt: toOptional(z.coerce.date()),
		parameters: z.record(z.string(), z.any()),
		config: toOptional(z.record(z.string(), z.any())),
		configId: toOptional(z.string()),
		result: toOptional(z.record(z.string(), z.any())),
		error: toOptional(z.string()),
	})
).omit({ updatedAt: true });
export type ExecutionModel = z.infer<typeof ExecutionSchema>


export const NodeExecutionSchema = withTimestamps(
	z.object({
		id: z.string(),
		executionId: z.string(),
		nodeId: z.string(),
		status: z.enum(['pending', 'running', 'completed', 'failed']),
		output: toOptional(z.record(z.string(), z.any())),
		error: toOptional(z.string()),
		completedAt: toOptional(z.coerce.date()),
	})
).omit({ updatedAt: true });
export type NodeExecutionModel = z.infer<typeof NodeExecutionSchema>


export const NodeExecutorSchema = withTimestamps(
  z.object({
		id: z.string(),
    type: z.string(),
    name: z.string(),
    description: toOptional(z.string()),
    category: z.enum(['builtin', 'custom']),
    isBuiltin: z.boolean(),
    sourceWorkflowId: toOptional(z.string()),
  })
);
export type NodeExecutorModel = z.infer<typeof NodeExecutorSchema>


export const ConfigSchema = withTimestamps(
  z.object({
    id: z.string(),
    name: z.string(),
    description: toOptional(z.string()),
  })
);

export type ConfigModel = z.infer<typeof ConfigSchema>
