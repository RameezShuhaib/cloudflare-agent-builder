import { WorkflowRepository } from '../repositories/workflow.repository';
import { generateId } from '../utils/helpers';
import type { CreateWorkflowDTO, UpdateWorkflowDTO } from '../schemas/dtos';
import type { Workflow } from '../db/schema';

export class WorkflowService {
  constructor(private workflowRepo: WorkflowRepository) {}

  async createWorkflow(dto: CreateWorkflowDTO): Promise<Workflow> {
    // Validate workflow schema
    this.validateWorkflowSchema(dto);

    const now = new Date();
    const workflow = await this.workflowRepo.create({
      id: generateId(),
      name: dto.name,
      parameterSchema: dto.parameter_schema,
      nodes: dto.nodes,
      outputNode: dto.output_node,
      createdAt: now,
      updatedAt: now,
    });

    return workflow;
  }

  async getWorkflow(id: string): Promise<Workflow> {
    const workflow = await this.workflowRepo.findById(id);
    if (!workflow) {
      throw new Error('Workflow not found');
    }
    return workflow;
  }

  async listWorkflows(): Promise<Workflow[]> {
    return await this.workflowRepo.findAll();
  }

  async updateWorkflow(id: string, dto: UpdateWorkflowDTO): Promise<Workflow> {
    const existing = await this.workflowRepo.findById(id);
    if (!existing) {
      throw new Error('Workflow not found');
    }

    const updated = await this.workflowRepo.update(id, {
      name: dto.name,
      parameterSchema: dto.parameter_schema,
      nodes: dto.nodes,
      outputNode: dto.output_node,
    });

    if (!updated) {
      throw new Error('Failed to update workflow');
    }

    return updated;
  }

  async deleteWorkflow(id: string): Promise<void> {
    const existing = await this.workflowRepo.findById(id);
    if (!existing) {
      throw new Error('Workflow not found');
    }

    await this.workflowRepo.delete(id);
  }

  private validateWorkflowSchema(dto: CreateWorkflowDTO): void {
    // Validate that output_node exists in nodes
    const nodeIds = dto.nodes.map((n) => n.id);
    if (!nodeIds.includes(dto.output_node)) {
      throw new Error('output_node must reference an existing node');
    }

    // Validate that all node dependencies exist
    for (const node of dto.nodes) {
      for (const dep of node.dependencies) {
        if (!nodeIds.includes(dep)) {
          throw new Error(`Node ${node.id} has invalid dependency: ${dep}`);
        }
      }
    }

    // Check for circular dependencies (basic check)
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (visiting.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visiting.add(nodeId);
      const node = dto.nodes.find((n) => n.id === nodeId);
      if (node) {
        for (const dep of node.dependencies) {
          if (hasCycle(dep)) return true;
        }
      }
      visiting.delete(nodeId);
      visited.add(nodeId);
      return false;
    };

    for (const node of dto.nodes) {
      if (hasCycle(node.id)) {
        throw new Error('Circular dependency detected in workflow');
      }
    }
  }
}
