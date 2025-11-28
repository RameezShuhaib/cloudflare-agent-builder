import { NodeExecutionRepository } from '../repositories/node-execution.repository';
import { ExecutionRepository } from '../repositories/execution.repository';
import { NodeExecutorFactory } from './node-executor.factory';
import type { ExecutionModel, WorkflowModel, NodeModel, DynamicEdge, Edge } from '../domain/entities';
import { TemplateParser } from '../utils/template-parser';
import { WorkflowService } from '../services/workflow.service';

interface StreamingContext {
	executionId: string;
	depth: number;
	parentExecutionId?: string;
	path: string[];
	onEvent?: (event: any) => void;
}

interface TraversalContext {
	workflow: WorkflowModel;
	execution: ExecutionModel;
	workflowParameters: Record<string, any>;
	workflowConfig: Record<string, any>;
	streaming?: {
		sendEvent: (event: any) => void;
		context: StreamingContext;
	};
}

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

	async executeWithStreaming(
		workflow: WorkflowModel,
		execution: ExecutionModel,
		streamingContext?: StreamingContext
	): Promise<Response | any> {
		const { readable, writable } = new TransformStream();
		const writer = writable.getWriter();
		const encoder = new TextEncoder();

		const sendEvent = (event: any) => {
			if (streamingContext?.onEvent) {
				streamingContext.onEvent(event);
			} else {
				const data = `data: ${JSON.stringify(event)}\n\n`;
				writer.write(encoder.encode(data));
			}
		};

		const context: StreamingContext = {
			executionId: execution.id,
			depth: streamingContext?.depth || 0,
			parentExecutionId: streamingContext?.parentExecutionId,
			path: streamingContext?.path || []
		};

		this.runStreamingWorkflow(
			workflow,
			execution,
			sendEvent,
			context,
			execution.parameters as Record<string, any>,
			execution.config as Record<string, any> || {}
		)
			.catch((error) => {
				sendEvent({
					type: 'error',
					executionId: context.executionId,
					depth: context.depth,
					path: context.path,
					data: { message: error.message },
					timestamp: new Date().toISOString()
				});
			})
			.finally(() => {
				if (!streamingContext?.onEvent) {
					writer.close();
				}
			});

		if (!streamingContext?.onEvent) {
			return new Response(readable, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					'Connection': 'keep-alive'
				}
			});
		}

		return await this.waitForCompletion(execution.id);
	}

	private async executeWorkflow(
		workflow: WorkflowModel,
		execution: ExecutionModel,
		workflowParameters: Record<string, any>,
		workflowConfig: Record<string, any>
	): Promise<any> {
		this.workflowService.validateWorkflow(workflow);

		const context: TraversalContext = {
			workflow,
			execution,
			workflowParameters,
			workflowConfig
		};

		const finalOutput = await this.executeWorkflowTraversal(context);

		await this.executionRepo.update(execution.id, {
			status: 'completed',
			result: finalOutput,
			completedAt: new Date(),
		});

		return finalOutput;
	}

	private async runStreamingWorkflow(
		workflow: WorkflowModel,
		execution: ExecutionModel,
		sendEvent: (event: any) => void,
		context: StreamingContext,
		workflowParameters: Record<string, any>,
		workflowConfig: Record<string, any>
	): Promise<void> {
		try {
			sendEvent({
				type: 'workflow_start',
				workflowId: workflow.id,
				executionId: context.executionId,
				depth: context.depth,
				path: context.path,
				data: { parameters: workflowParameters },
				timestamp: new Date().toISOString()
			});

			await this.executionRepo.updateStatus(execution.id, 'running');

			const traversalContext: TraversalContext = {
				workflow,
				execution,
				workflowParameters,
				workflowConfig,
				streaming: {
					sendEvent,
					context
				}
			};

			const finalOutput = await this.executeWorkflowTraversal(traversalContext);

			await this.executionRepo.update(execution.id, {
				status: 'completed',
				result: finalOutput,
				completedAt: new Date(),
			});

			sendEvent({
				type: 'workflow_complete',
				workflowId: workflow.id,
				executionId: context.executionId,
				depth: context.depth,
				path: context.path,
				data: { result: finalOutput },
				timestamp: new Date().toISOString()
			});
		} catch (error: any) {
			await this.executionRepo.update(execution.id, {
				status: 'failed',
				error: error.message,
				completedAt: new Date(),
			});
			throw error;
		}
	}

	private async executeWorkflowTraversal(context: TraversalContext): Promise<any> {
		const { workflow } = context;
		const nodes = workflow.nodes as NodeModel[];
		const edges = workflow.edges as Edge[];
		const nodeMap = new Map<string, NodeModel>();
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
				context,
				nodeOutputs,
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
					context.workflowParameters,
					context.workflowConfig,
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
					context,
					nodeOutputs,
					state
				);
				nodeOutputs.set(currentNodeId, output);
			}
		}

		return nodeOutputs.get(workflow.endNode);
	}

	private async executeNode(
		node: NodeModel,
		context: TraversalContext,
		nodeOutputs: Map<string, any>,
		state: Record<string, any>
	): Promise<any> {
		const isStreaming = !!context.streaming;
		const nodePath = isStreaming
			? [...context.streaming!.context.path, node.id]
			: [];
		const startTime = Date.now();

		// Send node start event if streaming
		if (isStreaming) {
			context.streaming!.sendEvent({
				type: 'node_start',
				nodeId: node.id,
				nodeType: node.type,
				depth: context.streaming!.context.depth,
				path: nodePath,
				timestamp: new Date().toISOString()
			});
		}

		const nodeExecution = await this.nodeExecRepo.create({
			executionId: context.execution.id,
			nodeId: node.id,
			status: 'running',
			output: null,
			error: null,
			completedAt: null,
		});

		try {
			const input = this.buildNodeInput(
				nodeOutputs,
				context.workflowParameters,
				context.workflowConfig,
				state,
				isStreaming ? context.streaming!.context : undefined
			);

			let output: any;

			if (node.type === 'workflow_executor') {
				output = await this.executeWorkflowNode(node, input, context.streaming);
			} else {
				const executor = await this.nodeFactory.getExecutor(node.type);

				if (!executor) {
					throw new Error(`Executor not found for node type: ${node.type}`);
				}

				const onChunk = isStreaming ? (chunk: any) => {
					context.streaming!.sendEvent({
						type: 'node_chunk',
						nodeId: node.id,
						nodeType: node.type,
						depth: context.streaming!.context.depth,
						path: nodePath,
						data: chunk,
						timestamp: new Date().toISOString()
					});
				} : undefined;

				output = await executor.run(node, input, onChunk);
			}

			// Execute setState if defined
			if (node.setState && Array.isArray(node.setState)) {
				await this.executeSetState(node.setState, input, output, state);

				// Send setState event if streaming
				if (isStreaming) {
					context.streaming!.sendEvent({
						type: 'state_updated',
						nodeId: node.id,
						depth: context.streaming!.context.depth,
						path: nodePath,
						data: { state },
						timestamp: new Date().toISOString()
					});
				}
			}

			await this.nodeExecRepo.update(nodeExecution.id, {
				status: 'completed',
				output: output,
				completedAt: new Date(),
			});

			// Send node complete event if streaming
			if (isStreaming) {
				const duration = Date.now() - startTime;
				if (node.streaming?.sendOnComplete !== false) {
					context.streaming!.sendEvent({
						type: 'node_complete',
						nodeId: node.id,
						nodeType: node.type,
						depth: context.streaming!.context.depth,
						path: nodePath,
						data: output,
						metadata: { duration },
						timestamp: new Date().toISOString()
					});
				}
			}

			return output;
		} catch (error: any) {
			await this.nodeExecRepo.update(nodeExecution.id, {
				status: 'failed',
				error: error.message,
				completedAt: new Date(),
			});

			if (isStreaming) {
				context.streaming!.sendEvent({
					type: 'error',
					nodeId: node.id,
					nodeType: node.type,
					depth: context.streaming!.context.depth,
					path: nodePath,
					data: { message: error.message },
					timestamp: new Date().toISOString()
				});
			}

			throw error;
		}
	}

	private async executeWorkflowNode(
		node: NodeModel,
		input: Record<string, any>,
		streaming?: TraversalContext['streaming']
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
			if (streaming) {
				const subContext: StreamingContext = {
					executionId: subExecution.id,
					depth: streaming.context.depth + 1,
					parentExecutionId: streaming.context.executionId,
					path: [...streaming.context.path, node.id],
					onEvent: streaming.sendEvent
				};

				return await this.executeWithStreaming(workflow, subExecution, subContext);
			} else {
				return await this.executeWorkflow(
					workflow,
					subExecution,
					parameters,
					input.config || {}
				);
			}
		} catch (error: any) {
			throw new Error(`Workflow execution failed for workflow_id '${workflow_id}': ${error.message}`);
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

			const context = {
				parameters: workflowParameters,
				config: workflowConfig,
				state: state,
				parent: parent,
			};

			const condition = edge.conditions.find(
				({node: _, condition}) => !!this.parser.eval(condition, context)
			)

			if (!condition) {
				throw new Error(
					`Not even a single condition passed in Dynamic edge`
				);
			}

			return condition.node;
		} catch (error: any) {
			throw new Error(`Failed to evaluate dynamic edge '${edge.id}': ${error.message}`);
		}
	}

	private async executeSetState(
		setStateRules: Array<{ key: string; template?: any }>,
		input: Record<string, any>,
		output: any,
		state: Record<string, any>
	): Promise<void> {
		for (const { key, template } of setStateRules) {
			try {
				const context = {
					parameters: input.parameters,
					config: input.config,
					parent: input.parent,
					state,
					output: output,
				};
				state[key] = this.parser.parse(template, context)
			} catch (error: any) {
				throw new Error(`Failed to execute setState for key '${key}': ${error.message}`);
			}
		}
	}

	private buildNodeInput(
		nodeOutputs: Map<string, any>,
		workflowParameters: Record<string, any>,
		workflowConfig: Record<string, any>,
		state: Record<string, any>,
		context?: StreamingContext
	): Record<string, any> {
		const parentOutputs: Record<string, any> = {};
		for (const [nodeId, output] of nodeOutputs.entries()) {
			parentOutputs[nodeId] = output;
		}

		const input: Record<string, any> = {
			parameters: workflowParameters,
			config: workflowConfig,
			parent: parentOutputs,
			state: state,
		};

		if (context) {
			input.context = {
				executionId: context.executionId,
				depth: context.depth,
				path: context.path
			};
		}

		return input;
	}

	private async waitForCompletion(executionId: string): Promise<any> {
		let attempts = 0;
		const maxAttempts = 100;

		while (attempts < maxAttempts) {
			const execution = await this.executionRepo.findById(executionId);
			if (execution && (execution.status === 'completed' || execution.status === 'failed')) {
				return execution.result;
			}
			await new Promise(resolve => setTimeout(resolve, 100));
			attempts++;
		}

		throw new Error('Execution timeout');
	}
}
