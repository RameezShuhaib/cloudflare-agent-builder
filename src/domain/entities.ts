import { z } from "zod";
import { toOptional, withTimestamps } from "../utils/zod";


export const NodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  config: z.record(z.string(), z.any()),
  dependencies: z.array(z.string()),
});


export const WorkflowSchema = withTimestamps(
  z.object({
    id: z.string(),
    name: z.string(),
    parameterSchema: z.record(z.string(), z.any()),
    nodes: z.array(NodeSchema),
    outputNode: z.string(),
    defaultConfigId: toOptional(z.string()),
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
