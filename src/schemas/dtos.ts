import { z } from 'zod';

// Node schema
export const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  config: z.record(z.string(), z.any()),
  dependencies: z.array(z.string()),
});

// Parameter schema validation (JSON Schema structure)
export const parameterSchemaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(z.string(), z.any()),
  required: z.array(z.string()).optional(),
});

// Create Workflow DTO
export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  parameter_schema: parameterSchemaSchema,
  nodes: z.array(nodeSchema).min(1),
  output_node: z.string().min(1),
  default_config_id: z.string().optional(),
});

// Update Workflow DTO
export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  parameter_schema: parameterSchemaSchema.optional(),
  nodes: z.array(nodeSchema).min(1).optional(),
  output_node: z.string().min(1).optional(),
  default_config_id: z.string().optional(),
});

// Execute Workflow DTO
export const executeWorkflowSchema = z.object({
  parameters: z.record(z.string(), z.any()),
  config_id: z.string().optional(), // Optional config override
});

// Create Node Executor DTO
export const createNodeExecutorSchema = z.object({
  type: z.string().min(1).regex(/^[a-z_]+$/, 'Type must be lowercase with underscores'),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  config_schema: z.record(z.string(), z.any()),
  source_workflow_id: z.string().min(1),
});

// Create Config DTO
export const createConfigSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-z0-9-_]+$/, 'ID must be lowercase alphanumeric with dashes/underscores'),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  variables: z.record(z.string(), z.any()).refine((vars) => Object.keys(vars).length > 0, {
    message: 'Variables must contain at least one key-value pair',
  }),
});

// Update Config DTO (PATCH - partial)
export const patchConfigSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  variables: z.record(z.string(), z.any()).optional(),
});

// Replace Config DTO (PUT - full replace)
export const replaceConfigSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  variables: z.record(z.string(), z.any()).refine((vars) => Object.keys(vars).length > 0, {
    message: 'Variables must contain at least one key-value pair',
  }),
});

// Update Config Variable DTO
export const updateConfigVariableSchema = z.object({
  value: z.any(),
});

export type CreateWorkflowDTO = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowDTO = z.infer<typeof updateWorkflowSchema>;
export type ExecuteWorkflowDTO = z.infer<typeof executeWorkflowSchema>;
export type CreateNodeExecutorDTO = z.infer<typeof createNodeExecutorSchema>;
export type NodeDTO = z.infer<typeof nodeSchema>;
export type CreateConfigDTO = z.infer<typeof createConfigSchema>;
export type PatchConfigDTO = z.infer<typeof patchConfigSchema>;
export type ReplaceConfigDTO = z.infer<typeof replaceConfigSchema>;
export type UpdateConfigVariableDTO = z.infer<typeof updateConfigVariableSchema>;
