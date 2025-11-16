import { NodeExecutionRepository } from '../repositories/node-execution.repository';
import { ExecutionRepository } from '../repositories/execution.repository';
import { NodeExecutorFactory } from './node-executor.factory';
import type { ExecutionModel, WorkflowModel } from '../domain/entities';
import type { NodeDTO } from '../schemas/dtos';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { TemplateParser } from '../utils/template-parser';

export class WorkflowOrchestrator {
  private readonly parser = new TemplateParser();

  constructor(
    private nodeExecRepo: NodeExecutionRepository,
    private executionRepo: ExecutionRepository,
    private nodeFactory: NodeExecutorFactory,
    private workflowRepository: WorkflowRepository
  ) {}

  async execute(workflow: WorkflowModel, execution: ExecutionModel): Promise<any> {
    try {
      const finalOutput = await this.executeWorkflow(
        workflow,
        execution,
        execution.parameters as Record<string, any>,
        execution.config as Record<string, any> || {}
      );

      return finalOutput;
    } catch (error: any) {
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

    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    const visit = (nodeId: string) => {
      if (visiting.has(nodeId)) {
        throw new Error(`Circular dependency detected at node: ${nodeId}`);
      }

      if (visited.has(nodeId)) {
        return;
      }

      visiting.add(nodeId);

      const node = nodeMap.get(nodeId);
      if (!node) {
        throw new Error(`Node not found: ${nodeId}`);
      }

      for (const depId of node.dependencies) {
        visit(depId);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      sorted.push(node);
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        visit(node.id);
      }
    }

    return sorted;
  }

  private async executeNodesInOrder(
    sortedNodes: NodeDTO[],
    execution: ExecutionModel,
    workflowParameters: Record<string, any>,
    workflowConfig: Record<string, any>
  ): Promise<Map<string, any>> {
    const nodeOutputs = new Map<string, any>();

    for (const node of sortedNodes) {
      try {
        const output = await this.executeNode(
          node,
          execution,
          nodeOutputs,
          workflowParameters,
          workflowConfig
        );

        nodeOutputs.set(node.id, output);
      } catch (error: any) {
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
    execution: ExecutionModel,
    nodeOutputs: Map<string, any>,
    workflowParameters: Record<string, any>,
    workflowConfig: Record<string, any>
  ): Promise<any> {
    const nodeExecution = await this.nodeExecRepo.create({
      executionId: execution.id,
      nodeId: node.id,
      status: 'running',
      output: null,
      error: null,
      completedAt: null,
    });

    try {
      const dependencyData = this.resolveDependencies(node, nodeOutputs);

      // Create input context with separate parameters and config
      const input: Record<string, any> = {
        ...dependencyData,
        parameters: workflowParameters,
        config: workflowConfig,
      };

      let output: any;

      // Special case: workflow_executor - executes another workflow
      if (node.type === 'workflow_executor') {
        output = await this.executeWorkflowNode(node, input);
      } else {
        // Try to get builtin executor
        const executor = await this.nodeFactory.getExecutor(node.type);

        if (executor) {
          // Execute builtin node
          output = await this.executeBuiltinNode(executor, node, input);
        } else {
          throw new Error(`Executor not found for node type: ${node.type}`);
        }
      }

      await this.nodeExecRepo.update(nodeExecution.id, {
        status: 'completed',
        output: output,
        completedAt: new Date(),
      });

      return output;
    } catch (error: any) {
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

      dependencyData.parent[depId] = depOutput;
    }

    return dependencyData;
  }

  private validateDependencies(nodes: NodeDTO[]): void {
    const nodeIds = new Set(nodes.map((n) => n.id));

    for (const node of nodes) {
      for (const depId of node.dependencies) {
        if (!nodeIds.has(depId)) {
          throw new Error(`Node ${node.id} depends on non-existent node ${depId}`);
        }
      }
    }
  }

  /**
   * Execute a builtin node using its executor
   */
  private async executeBuiltinNode(
    executor: any,
    node: NodeDTO,
    input: Record<string, any>
  ): Promise<any> {
    return await executor.run(node.config, input);
  }

  /**
   * Execute a workflow_executor node
   * - Parses config to get workflow_id and parameters
   * - Fetches the target workflow
   * - Executes it as a sub-workflow
   * 
   * Expected config structure:
   * {
   *   workflow_id: string,
   *   parameters: Record<string, any>  // Can contain {{template}} variables
   * }
   */
  private async executeWorkflowNode(
    node: NodeDTO,
    input: Record<string, any>
  ): Promise<any> {
    // Parse the config (templates resolved here since workflow_executor is not a builtin executor)
    const parsedConfig = this.parser.parse(node.config, input) as Record<string, any>;

    const { workflow_id, parameters } = parsedConfig;

    if (!workflow_id) {
      throw new Error('workflow_executor node requires workflow_id in config');
    }

    if (!parameters || typeof parameters !== 'object') {
      throw new Error('workflow_executor node requires parameters object in config');
    }

    // Fetch the target workflow
    const workflow = await this.workflowRepository.findById(workflow_id);

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflow_id}`);
    }

    // Create execution record for the sub-workflow
    // Sub-workflows inherit the parent's config
    const subExecution = await this.executionRepo.create({
      workflowId: workflow.id,
      status: 'running',
      parameters: parameters,
      config: input.config || null, // Inherit parent config
      configId: null,
      result: null,
      error: null,
      completedAt: null,
    });

    try {
      // Execute the workflow with parsed parameters and inherited config
      const output = await this.executeWorkflow(
        workflow,
        subExecution,
        parameters,
        input.config || {}
      );

      return output;
    } catch (error: any) {
      // Error is already handled in executeWorkflow, just rethrow with context
      throw new Error(`Workflow execution failed for workflow_id '${workflow_id}': ${error.message}`);
    }
  }

  /**
   * Execute a workflow with given parameters and config
   * Extracted to support both main workflow execution and sub-workflow execution
   */
  private async executeWorkflow(
    workflow: WorkflowModel,
    execution: ExecutionModel,
    workflowParameters: Record<string, any>,
    workflowConfig: Record<string, any>
  ): Promise<any> {
    this.validateDependencies(workflow.nodes as NodeDTO[]);

    const sortedNodes = this.topologicalSort(workflow.nodes as NodeDTO[]);

    const nodeOutputs = await this.executeNodesInOrder(
      sortedNodes,
      execution,
      workflowParameters,
      workflowConfig
    );

    const finalOutput = nodeOutputs.get(workflow.outputNode);

    await this.executionRepo.update(execution.id, {
      status: 'completed',
      result: finalOutput,
      completedAt: new Date(),
    });

    return finalOutput;
  }
}
