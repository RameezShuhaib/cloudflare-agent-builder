import { z } from 'zod';
import { WorkflowSchema, NodeSchema, ExecutionSchema, ConfigSchema } from '../domain/entities';

// ============================================
// Node DTOs
// ============================================

// Use domain NodeSchema directly for node structure
export const NodeDTO = NodeSchema;
export type NodeDTO = z.infer<typeof NodeDTO>;

// ============================================
// Workflow DTOs
// ============================================

// Create Workflow DTO - omit generated fields (id, timestamps)
export const CreateWorkflowDTO = WorkflowSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    // Enforce proper parameter schema structure for workflows
    parameterSchema: z.object({
      type: z.literal('object'),
      properties: z.record(z.string(), z.any()),
      required: z.array(z.string()).optional(),
    }),
  });
export type CreateWorkflowDTO = z.infer<typeof CreateWorkflowDTO>;

// Update Workflow DTO - all fields optional
export const UpdateWorkflowDTO = CreateWorkflowDTO.partial();
export type UpdateWorkflowDTO = z.infer<typeof UpdateWorkflowDTO>;

// ============================================
// Execution DTOs
// ============================================

// Execute Workflow DTO - input for triggering workflow execution
export const ExecuteWorkflowDTO = z.object({
  parameters: z.record(z.string(), z.any()),
  configId: z.string().optional(),
});
export type ExecuteWorkflowDTO = z.infer<typeof ExecuteWorkflowDTO>;

// Execution response includes the full execution model
export type ExecutionResponseDTO = z.infer<typeof ExecutionSchema>;

// ============================================
// Config DTOs
// ============================================

// Create Config DTO - omit id and timestamps, add variables
export const CreateConfigDTO = ConfigSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    variables: z.record(z.string(), z.any()).refine(
      (vars) => Object.keys(vars).length > 0,
      { message: 'Variables must contain at least one key-value pair' }
    ),
  });
export type CreateConfigDTO = z.infer<typeof CreateConfigDTO>;

// Patch Config DTO - partial update (merge variables)
export const PatchConfigDTO = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  variables: z.record(z.string(), z.any()).optional(),
});
export type PatchConfigDTO = z.infer<typeof PatchConfigDTO>;

// Replace Config DTO - full replacement
export const ReplaceConfigDTO = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  variables: z.record(z.string(), z.any()).refine(
    (vars) => Object.keys(vars).length > 0,
    { message: 'Variables must contain at least one key-value pair' }
  ),
});
export type ReplaceConfigDTO = z.infer<typeof ReplaceConfigDTO>;

// Update single config variable
export const UpdateConfigVariableDTO = z.object({
  value: z.any(),
});
export type UpdateConfigVariableDTO = z.infer<typeof UpdateConfigVariableDTO>;
