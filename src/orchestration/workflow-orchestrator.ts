import { NodeExecutionRepository } from '../repositories/node-execution.repository';
import { ExecutionRepository } from '../repositories/execution.repository';
import { NodeExecutorFactory } from './node-executor.factory';
import type { ExecutionModel, WorkflowModel, DynamicEdge, Edge } from '../domain/entities';
import type { NodeDTO } from '../schemas/dtos';
import { TemplateParser } from '../utils/template-parser';
import { ruleFactory } from '@elite-libs/rules-machine';
import { WorkflowService } from '../services/workflow.service';

export class WorkflowOrchestrator {
  private readonly parser = new TemplateParser();

  constructor(
    private nodeExecRepo: NodeExecutionRepository,
    private executionRepo: ExecutionRepository,
    private nodeFactory: NodeExecutorFactory,
    private workflowService: WorkflowService
  ) {}

  async execute(workflow: WorkflowModel, execution: ExecutionModel): Promise<any> {
    try {
      return await this.executeWorkflow(
        workflow,
        execution,
        execution.parameters as Record<string, any>,
        execution.config as Record<string, any> || {}
      );
    } catch (error: any) {
      await this.executionRepo.update(execution.id, {
        status: 'failed',
        error: error.message,
        completedAt: new Date(),
      });
      throw error;
    }
  }

  private async executeWorkflowTraversal(
    workflow: WorkflowModel,
    execution: ExecutionModel,
    workflowParameters: Record<string, any>,
    workflowConfig: Record<string, any>
  ): Promise<any> {
    const nodes = workflow.nodes as NodeDTO[];
    const edges = workflow.edges as Edge[];
    const nodeMap = new Map<string, NodeDTO>();
    const nodeOutputs = new Map<string, any>();
    const state: Record<string, any> = workflow.state || {};

    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    const edgeMap = new Map<string, Edge>();
    for (const edge of edges) {
      edgeMap.set(edge.from, edge);
    }

    let currentNodeId = workflow.startNode;
    let iterations = 0;
    const maxIterations = workflow.maxIterations || 100;

    while (currentNodeId !== workflow.endNode && iterations < maxIterations) {
      iterations++;

      const currentNode = nodeMap.get(currentNodeId);
      if (!currentNode) {
        throw new Error(`Node '${currentNodeId}' not found during execution`);
      }

      const output = await this.executeNode(
        currentNode,
        execution,
        nodeOutputs,
        workflowParameters,
        workflowConfig,
        state
      );

      nodeOutputs.set(currentNodeId, output);

      if (currentNodeId === workflow.endNode) {
        break;
      }

      const edge = edgeMap.get(currentNodeId);
      if (!edge) {
        throw new Error(
          `No outgoing edge found from node '${currentNodeId}'. ` +
          `Workflow cannot continue. Did you forget to add an edge?`
        );
      }

      if ('to' in edge) {
        currentNodeId = edge.to;
      } else {
        const nextNodeId = await this.evaluateDynamicEdge(
          edge,
          nodeOutputs,
          workflowParameters,
          workflowConfig,
          state
        );

        if (!nodeMap.has(nextNodeId)) {
          throw new Error(
            `Dynamic edge '${edge.id}' returned invalid node ID '${nextNodeId}'. ` +
            `Node does not exist in workflow.`
          );
        }

        currentNodeId = nextNodeId;
      }
    }

    if (iterations >= maxIterations) {
      throw new Error(
        `Workflow execution exceeded maximum iterations (${maxIterations}). ` +
        `This might indicate an infinite loop in your workflow.`
      );
    }

    if (currentNodeId === workflow.endNode && !nodeOutputs.has(currentNodeId)) {
      const endNode = nodeMap.get(currentNodeId);
      if (endNode) {
        const output = await this.executeNode(
          endNode,
          execution,
          nodeOutputs,
          workflowParameters,
          workflowConfig,
          state
        );
        nodeOutputs.set(currentNodeId, output);
      }
    }

    return nodeOutputs.get(workflow.endNode);
  }

  private async executeNode(
    node: NodeDTO,
    execution: ExecutionModel,
    nodeOutputs: Map<string, any>,
    workflowParameters: Record<string, any>,
    workflowConfig: Record<string, any>,
    state: Record<string, any>
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
      const dependencyData = { parent: {} };

      for (const [nodeId, output] of nodeOutputs.entries()) {
        (dependencyData.parent as Record<string, any>)[nodeId] = output;
      }

      const input: Record<string, any> = {
        ...dependencyData,
        parameters: workflowParameters,
        config: workflowConfig,
        state: state,
      };

      let output: any;

      if (node.type === 'workflow_executor') {
        output = await this.executeWorkflowNode(node, input);
      } else {
        const executor = await this.nodeFactory.getExecutor(node.type);

        if (executor) {
          output = await this.executeBuiltinNode(executor, node, input);
        } else {
          throw new Error(`Executor not found for node type: ${node.type}`);
        }
      }

      if (node.setState && Array.isArray(node.setState)) {
        await this.executeSetState(node.setState, input, output, state);
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

  private async evaluateDynamicEdge(
    edge: DynamicEdge,
    nodeOutputs: Map<string, any>,
    workflowParameters: Record<string, any>,
    workflowConfig: Record<string, any>,
    state: Record<string, any>
  ): Promise<string> {
    try {
      const parent: Record<string, any> = {};
      for (const [nodeId, output] of nodeOutputs.entries()) {
        parent[nodeId] = output;
      }

      const ruleContext = {
        parameters: workflowParameters,
        config: workflowConfig,
        state: state,
        parent: parent,
      };

      const ruleFunction = ruleFactory(edge.rule);
      const result = ruleFunction(ruleContext);

      if (typeof result !== 'string') {
        throw new Error(
          `Dynamic edge rule must return a string (node ID), but got: ${typeof result}`
        );
      }

      return result;
    } catch (error: any) {
      throw new Error(`Failed to evaluate dynamic edge '${edge.id}': ${error.message}`);
    }
  }

  private async executeBuiltinNode(
    executor: any,
    node: NodeDTO,
    input: Record<string, any>
  ): Promise<any> {
    return await executor.run(node.config, input);
  }

  private async executeWorkflowNode(
    node: NodeDTO,
    input: Record<string, any>
  ): Promise<any> {
    const parsedConfig = this.parser.parse(node.config, input) as Record<string, any>;

    const { workflow_id, parameters } = parsedConfig;

    if (!workflow_id) {
      throw new Error('workflow_executor node requires workflow_id in config');
    }

    if (!parameters || typeof parameters !== 'object') {
      throw new Error('workflow_executor node requires parameters object in config');
    }

    const workflow = await this.workflowService.getWorkflow(workflow_id);

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflow_id}`);
    }

    const subExecution = await this.executionRepo.create({
      workflowId: workflow.id,
      status: 'running',
      parameters: parameters,
      config: input.config || null,
      configId: null,
      result: null,
      error: null,
      completedAt: null,
    });

    try {
      return await this.executeWorkflow(
				workflow,
				subExecution,
				parameters,
				input.config || {}
			);
    } catch (error: any) {
      throw new Error(`Workflow execution failed for workflow_id '${workflow_id}': ${error.message}`);
    }
  }

  private async executeWorkflow(
    workflow: WorkflowModel,
    execution: ExecutionModel,
    workflowParameters: Record<string, any>,
    workflowConfig: Record<string, any>
  ): Promise<any> {
    this.workflowService.validateWorkflow(workflow);

    const finalOutput = await this.executeWorkflowTraversal(
      workflow,
      execution,
      workflowParameters,
      workflowConfig
    );

    await this.executionRepo.update(execution.id, {
      status: 'completed',
      result: finalOutput,
      completedAt: new Date(),
    });

    return finalOutput;
  }

  private async executeSetState(
    setStateRules: Array<{ key: string; rule: any[] }>,
    input: Record<string, any>,
    output: any,
    state: Record<string, any>
  ): Promise<void> {
    for (const { key, rule } of setStateRules) {
      try {
        const ruleContext = {
					parameters: input.parameters,
					config: input.config,
					parent: input.parent,
          state,
          output: output,
        };

        const ruleFunction = ruleFactory(rule);

				state[key] = ruleFunction(ruleContext);
      } catch (error: any) {
        throw new Error(`Failed to execute setState for key '${key}': ${error.message}`);
      }
    }
  }
}
