import { WorkflowRepository } from '../repositories/workflow.repository';
import type { CreateWorkflowDTO, NodeDTO, UpdateWorkflowDTO } from '../schemas/dtos';
import type { Edge, WorkflowModel } from '../domain/entities';

export class WorkflowService {
  constructor(private workflowRepo: WorkflowRepository) {}

  async createWorkflow(dto: CreateWorkflowDTO): Promise<WorkflowModel> {
    this.validateWorkflow(dto);

    return await this.workflowRepo.create({ ...dto, state: {}, maxIterations: 50 });
  }

  async getWorkflow(id: string): Promise<WorkflowModel> {
    const workflow = await this.workflowRepo.findById(id);
    if (!workflow) {
      throw new Error('Workflow not found');
    }
    return workflow;
  }

  async listWorkflows(): Promise<WorkflowModel[]> {
    return await this.workflowRepo.findAll();
  }

  async updateWorkflow(id: string, dto: UpdateWorkflowDTO): Promise<WorkflowModel> {
    const existing = await this.workflowRepo.findById(id);
    if (!existing) {
      throw new Error('Workflow not found');
    }

    const updated = await this.workflowRepo.update(id, dto);

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

	public validateWorkflow(workflow: CreateWorkflowDTO): void {
		const nodeIds = new Set((workflow.nodes as NodeDTO[]).map((n) => n.id));
		const edges = workflow.edges as Edge[];

		if (!nodeIds.has(workflow.startNode)) {
			throw new Error(`Start node '${workflow.startNode}' does not exist in workflow`);
		}

		if (!nodeIds.has(workflow.endNode)) {
			throw new Error(`End node '${workflow.endNode}' does not exist in workflow`);
		}

		for (const edge of edges) {
			if (!nodeIds.has(edge.from)) {
				throw new Error(`Edge '${edge.id}' references non-existent 'from' node: ${edge.from}`);
			}

			if ('to' in edge && !nodeIds.has(edge.to)) {
				throw new Error(`Edge '${edge.id}' references non-existent 'to' node: ${edge.to}`);
			}
		}

		const outgoingEdgesCount = new Map<string, number>();
		for (const edge of edges) {
			const count = outgoingEdgesCount.get(edge.from) || 0;
			outgoingEdgesCount.set(edge.from, count + 1);
		}

		for (const [nodeId, count] of outgoingEdgesCount.entries()) {
			if (count > 1) {
				throw new Error(`Node '${nodeId}' has ${count} outgoing edges. Each node can only have one outgoing edge.`);
			}
		}
	}
}
