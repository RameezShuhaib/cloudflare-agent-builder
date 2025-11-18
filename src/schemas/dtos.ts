import { z } from 'zod';
import { WorkflowSchema, NodeSchema, ExecutionSchema, ConfigSchema, EdgeInputSchema } from '../domain/entities';

export const NodeDTO = NodeSchema;
export type NodeDTO = z.infer<typeof NodeDTO>;


export const CreateWorkflowDTO = WorkflowSchema
  .omit({ id: true, createdAt: true, updatedAt: true })

export type CreateWorkflowDTO = z.input<typeof CreateWorkflowDTO>;

export const UpdateWorkflowDTO = CreateWorkflowDTO.partial();
export type UpdateWorkflowDTO = z.input<typeof UpdateWorkflowDTO>;

export const ExecuteWorkflowDTO = z.object({
  parameters: z.record(z.string(), z.any()),
  configId: z.string().optional(),
  stream: z.boolean().optional(),
});
export type ExecuteWorkflowDTO = z.input<typeof ExecuteWorkflowDTO>;


export const CreateConfigDTO = ConfigSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    variables: z.record(z.string(), z.any()).refine(
      (vars) => Object.keys(vars).length > 0,
      { message: 'Variables must contain at least one key-value pair' }
    ),
  });
export type CreateConfigDTO = z.input<typeof CreateConfigDTO>;

export const PatchConfigDTO = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  variables: z.record(z.string(), z.any()).optional(),
});
export type PatchConfigDTO = z.input<typeof PatchConfigDTO>;

export const ReplaceConfigDTO = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  variables: z.record(z.string(), z.any()).refine(
    (vars) => Object.keys(vars).length > 0,
    { message: 'Variables must contain at least one key-value pair' }
  ),
});
export type ReplaceConfigDTO = z.input<typeof ReplaceConfigDTO>;

export const UpdateConfigVariableDTO = z.object({
  value: z.any(),
});
export type UpdateConfigVariableDTO = z.input<typeof UpdateConfigVariableDTO>;
