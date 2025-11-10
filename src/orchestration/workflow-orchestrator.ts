import { NodeExecutionRepository } from '../repositories/node-execution.repository';
import { ExecutionRepository } from '../repositories/execution.repository';
import { NodeExecutorFactory } from './node-executor.factory';
import { TemplateParser } from '../utils/template-parser';
import { generateId } from '../utils/helpers';
import type { Workflow, Execution } from '../db/schema';
import type { NodeDTO } from '../schemas/dtos';

export class WorkflowOrchestrator {
  constructor(
    private nodeExecRepo: NodeExecutionRepository,
    private executionRepo: ExecutionRepository,
    private nodeFactory: NodeExecutorFactory,
    private parser: TemplateParser
  ) {}

  async execute(workflow: Workflow, execution: Execution): Promise<any> {
    try {
      // Step 1: Validate dependencies
      this.validateDependencies(workflow.nodes as NodeDTO[]);

      // Step 2: Sort nodes in execution order
      const sortedNodes = this.topologicalSort(workflow.nodes as NodeDTO[]);

      // Step 3: Execute nodes in order
      const nodeOutputs = await this.executeNodesInOrder(
        sortedNodes,
        execution,
        execution.parameters as Record<string, any>
      );

      // Step 4: Get output from the final output node
      const finalOutput = nodeOutputs.get(workflow.outputNode);

      // Step 5: Update execution with result
      await this.executionRepo.update(execution.id, {
        status: 'completed',
        result: finalOutput,
        completedAt: new Date(),
      });

      return finalOutput;
    } catch (error: any) {
      // Handle failure
      await this.executionRepo.update(execution.id, {
        status: 'failed',
        error: error.message,
        completedAt: new Date(),
      });
      throw error;
    }
  }

  private topologicalSort(nodes: NodeDTO[]): NodeDTO[] {
    const sorted: NodeDTO[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const nodeMap = new Map<string, NodeDTO>();

    // Build node map for quick lookup
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    const visit = (nodeId: string) => {
      // Cycle detection
      if (visiting.has(nodeId)) {
        throw new Error(`Circular dependency detected at node: ${nodeId}`);
      }

      // Already processed
      if (visited.has(nodeId)) {
        return;
      }

      visiting.add(nodeId);

      const node = nodeMap.get(nodeId);
      if (!node) {
        throw new Error(`Node not found: ${nodeId}`);
      }

      // Visit dependencies first (DFS)
      for (const depId of node.dependencies) {
        visit(depId);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      sorted.push(node);
    };

    // Visit all nodes
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        visit(node.id);
      }
    }

    return sorted;
  }

  private async executeNodesInOrder(
    sortedNodes: NodeDTO[],
    execution: Execution,
    workflowParameters: Record<string, any>
  ): Promise<Map<string, any>> {
    const nodeOutputs = new Map<string, any>();

    for (const node of sortedNodes) {
      try {
        // Execute the node
        const output = await this.executeNode(node, execution, nodeOutputs, workflowParameters);

        // Store output for dependent nodes
        nodeOutputs.set(node.id, output);
      } catch (error: any) {
        // Mark node as failed
        const nodeExec = await this.nodeExecRepo.findById(node.id);
        if (nodeExec) {
          await this.nodeExecRepo.update(nodeExec.id, {
            status: 'failed',
            error: error.message,
            completedAt: new Date(),
          });
        }
        throw error;
      }
    }

    return nodeOutputs;
  }

  private async executeNode(
    node: NodeDTO,
    execution: Execution,
    nodeOutputs: Map<string, any>,
    workflowParameters: Record<string, any>
  ): Promise<any> {
    // Create node execution record
    const nodeExecution = await this.nodeExecRepo.create({
      id: generateId(),
      executionId: execution.id,
      nodeId: node.id,
      status: 'running',
      startedAt: new Date(),
      output: null,
      error: null,
      completedAt: null,
    });

    try {
      // Resolve dependencies - get outputs from parent nodes
      const dependencyData = this.resolveDependencies(node, nodeOutputs);

      // Prepare input for node execution
      const input: Record<string, any> = {
        ...dependencyData,
        parameters: workflowParameters,
      };

      // Get the appropriate executor for this node type
      const executor = await this.nodeFactory.getExecutor(node.type);

      // Execute the node
      const output = await executor.execute(node.config, input);

      // Mark as completed
      await this.nodeExecRepo.update(nodeExecution.id, {
        status: 'completed',
        output: output,
        completedAt: new Date(),
      });

      return output;
    } catch (error: any) {
      // Mark as failed
      await this.nodeExecRepo.update(nodeExecution.id, {
        status: 'failed',
        error: error.message,
        completedAt: new Date(),
      });
      throw error;
    }
  }

  private resolveDependencies(node: NodeDTO, nodeOutputs: Map<string, any>): Record<string, any> {
    const dependencyData: Record<string, any> = { parent: {} };

    for (const depId of node.dependencies) {
      const depOutput = nodeOutputs.get(depId);

      if (depOutput === undefined) {
        throw new Error(`Dependency ${depId} not found for node ${node.id}`);
      }

      // Store with key "parent.{nodeId}"
      dependencyData.parent[depId] = depOutput;
    }

    return dependencyData;
  }

  private validateDependencies(nodes: NodeDTO[]): void {
    const nodeIds = new Set(nodes.map((n) => n.id));

    for (const node of nodes) {
      // Check all dependencies exist
      for (const depId of node.dependencies) {
        if (!nodeIds.has(depId)) {
          throw new Error(`Node ${node.id} depends on non-existent node ${depId}`);
        }
      }
    }
  }
}
