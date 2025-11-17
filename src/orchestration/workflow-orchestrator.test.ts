import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowOrchestrator } from './workflow-orchestrator';
import type { WorkflowModel, ExecutionModel } from '../domain/entities';

describe('WorkflowOrchestrator', () => {
  let orchestrator: WorkflowOrchestrator;
  let mockNodeExecRepo: any;
  let mockExecutionRepo: any;
  let mockNodeFactory: any;
  let mockWorkflowRepo: any;
  let mockExecution: ExecutionModel;

  beforeEach(() => {
    // Mock repositories and factory
    mockNodeExecRepo = {
      create: vi.fn().mockResolvedValue({ id: 'node-exec-1' }),
      update: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
    };

    mockExecutionRepo = {
      update: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue({ id: 'sub-exec-1' }),
    };

    mockNodeFactory = {
      getExecutor: vi.fn(),
    };

    mockWorkflowRepo = {
      findById: vi.fn(),
    };

    orchestrator = new WorkflowOrchestrator(
      mockNodeExecRepo,
      mockExecutionRepo,
      mockNodeFactory,
      mockWorkflowRepo
    );

    mockExecution = {
      id: 'exec-1',
      workflowId: 'workflow-1',
      status: 'running',
      parameters: { userId: '123' },
      config: { apiUrl: 'https://api.example.com' },
      configId: null,
      result: null,
      error: null,
      completedAt: null,
      createdAt: new Date(),
    };
  });

  describe('Linear Workflow (Static Edges)', () => {
    it('should execute nodes in order following static edges', async () => {
      const workflow: WorkflowModel = {
        id: 'workflow-1',
        name: 'Linear Workflow',
        parameterSchema: {},
        nodes: [
          { id: 'node1', type: 'data_transformer', config: { template: { value: 1 } } },
          { id: 'node2', type: 'data_transformer', config: { template: { value: 2 } } },
          { id: 'node3', type: 'data_transformer', config: { template: { value: 3 } } },
        ],
        edges: [
          { id: 'e1', from: 'node1', to: 'node2' },
          { id: 'e2', from: 'node2', to: 'node3' },
        ],
        startNode: 'node1',
        endNode: 'node3',
        maxIterations: 100,
        defaultConfigId: 'defaultConfigId',
				state: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockExecutor = {
        run: vi.fn()
          .mockResolvedValueOnce({ value: 1 })
          .mockResolvedValueOnce({ value: 2 })
          .mockResolvedValueOnce({ value: 3 }),
      };

      mockNodeFactory.getExecutor.mockResolvedValue(mockExecutor);

      const result = await orchestrator.execute(workflow, mockExecution);

      // Should execute all 3 nodes
      expect(mockExecutor.run).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ value: 3 });

      // Should update execution status
      expect(mockExecutionRepo.update).toHaveBeenCalledWith(
        'exec-1',
        expect.objectContaining({
          status: 'completed',
          result: { value: 3 },
        })
      );
    });
  });

  describe('Workflow with Cycle', () => {
    it('should handle cycles and stop at end node', async () => {
      const workflow: WorkflowModel = {
        id: 'workflow-2',
        name: 'Cycle Workflow',
        parameterSchema: {},
        nodes: [
          {
            id: 'counter',
            type: 'data_transformer',
            config: { template: { count: '{{state.count}}' } },
            setState: [
              {
                key: 'count',
                rule: [
                  { if: 'true', then: 'count = state.count + 1' },
                  { return: 'count' },
                ],
              },
            ],
          },
          {
            id: 'check',
            type: 'data_transformer',
            config: { template: { shouldContinue: true } }
          },
          {
            id: 'end',
            type: 'data_transformer',
            config: { template: { done: true } }
          },
        ],
        edges: [
          { id: 'e1', from: 'counter', to: 'check' },
          {
            id: 'e2',
            from: 'check',
            rule: [
              { if: 'state.count < 3', then: 'nextNode = "counter"', else: 'nextNode = "end"' },
              { return: 'nextNode' },
            ],
          },
        ],
        startNode: 'counter',
        endNode: 'end',
        maxIterations: 100,
				state: {
					count: 0
				},
        defaultConfigId: 'defaultConfigId',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockExecutor = {
        run: vi.fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ shouldContinue: true })
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ shouldContinue: true })
          .mockResolvedValueOnce({ count: 2 })
          .mockResolvedValueOnce({ shouldContinue: false })
          .mockResolvedValueOnce({ done: true }),
      };

      mockNodeFactory.getExecutor.mockResolvedValue(mockExecutor);

      const result = await orchestrator.execute(workflow, mockExecution);

      // Should execute counter 3 times, check 3 times, end 1 time = 7 total
      expect(mockExecutor.run).toHaveBeenCalledTimes(7);
      expect(result).toEqual({ done: true });
    });

    it('should throw error when maxIterations is exceeded', async () => {
      const workflow: WorkflowModel = {
        id: 'workflow-3',
        name: 'Infinite Loop',
        parameterSchema: {},
        nodes: [
          { id: 'loop', type: 'data_transformer', config: { template: { value: 1 } } },
          { id: 'end', type: 'data_transformer', config: { template: { value: 2 } } },
        ],
        edges: [
          { id: 'e1', from: 'loop', to: 'loop' }, // Self-loop
        ],
        startNode: 'loop',
        endNode: 'end',
				state: {},
				maxIterations: 5,
        defaultConfigId: 'defaultConfigId',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockExecutor = {
        run: vi.fn().mockResolvedValue({ value: 1 }),
      };

      mockNodeFactory.getExecutor.mockResolvedValue(mockExecutor);

      await expect(orchestrator.execute(workflow, mockExecution)).rejects.toThrow(
        'Workflow execution exceeded maximum iterations (5)'
      );

      expect(mockExecutionRepo.update).toHaveBeenCalledWith(
        'exec-1',
        expect.objectContaining({
          status: 'failed',
          error: expect.stringContaining('exceeded maximum iterations'),
        })
      );
    });
  });

  describe('Dynamic Edges', () => {
    it('should evaluate dynamic edge rules correctly', async () => {
      const workflow: WorkflowModel = {
        id: 'workflow-4',
        name: 'Conditional Workflow',
        parameterSchema: {},
        nodes: [
          {
            id: 'check_score',
            type: 'data_transformer',
            config: { template: { score: 75 } },
            setState: [{ key: 'score', rule: [{ if: 'true', then: 'score = 75' }, { return: 'score' }] }],
          },
          { id: 'high_score', type: 'data_transformer', config: { template: { result: 'high' } } },
          { id: 'low_score', type: 'data_transformer', config: { template: { result: 'low' } } },
        ],
        edges: [
          {
            id: 'e1',
            from: 'check_score',
            rule: [
              { if: 'state.score >= 70', then: 'nextNode = "high_score"' },
              { then: 'nextNode = "low_score"' },
              { return: 'nextNode' },
            ],
          },
        ],
        startNode: 'check_score',
        endNode: 'high_score',
        maxIterations: 100,
        defaultConfigId: 'defaultConfigId',
				state: {
					score: 75
				},
				createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockExecutor = {
        run: vi.fn()
          .mockResolvedValueOnce({ score: 75 })
          .mockResolvedValueOnce({ result: 'high' }),
      };

      mockNodeFactory.getExecutor.mockResolvedValue(mockExecutor);

      const result = await orchestrator.execute(workflow, mockExecution);

      expect(result).toEqual({ result: 'high' });
      expect(mockExecutor.run).toHaveBeenCalledTimes(2);
    });

    it('should throw error when dynamic edge returns invalid node ID', async () => {
      const workflow: WorkflowModel = {
        id: 'workflow-5',
        name: 'Invalid Dynamic Edge',
        parameterSchema: {},
        nodes: [
          { id: 'start', type: 'data_transformer', config: { template: { value: 1 } } },
          { id: 'end', type: 'data_transformer', config: { template: { value: 2 } } },
        ],
        edges: [
          {
            id: 'e1',
            from: 'start',
            rule: [{ if: 'true', then: 'nextNode = "non_existent_node"' }, { return: 'nextNode' }],
          },
        ],
        startNode: 'start',
        endNode: 'end',
				state: {},
        maxIterations: 100,
        defaultConfigId: 'defaultConfigId',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockExecutor = {
        run: vi.fn().mockResolvedValue({ value: 1 }),
      };

      mockNodeFactory.getExecutor.mockResolvedValue(mockExecutor);

      await expect(orchestrator.execute(workflow, mockExecution)).rejects.toThrow(
        "Dynamic edge 'e1' returned invalid node ID 'non_existent_node'"
      );
    });
  });

  describe('State Management', () => {
    it('should persist state across node executions', async () => {
      const workflow: WorkflowModel = {
        id: 'workflow-6',
        name: 'State Workflow',
        parameterSchema: {},
        nodes: [
          {
            id: 'set_state',
            type: 'data_transformer',
            config: { template: { initial: true } },
            setState: [
              { key: 'counter', rule: [{ if: 'true', then: 'counter = 1' }, { return: 'counter' }] },
              { key: 'name', rule: [{ if: 'true', then: 'name = "test"' }, { return: 'name' }] },
            ],
          },
          {
            id: 'use_state',
            type: 'data_transformer',
            config: {
              template: {
                counter: '{{state.counter}}',
                name: '{{state.name}}'
              }
            },
          },
        ],
        edges: [
          { id: 'e1', from: 'set_state', to: 'use_state' },
        ],
				state: {},
        startNode: 'set_state',
        endNode: 'use_state',
        maxIterations: 100,
        defaultConfigId: 'defaultConfigId',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockExecutor = {
        run: vi.fn()
          .mockResolvedValueOnce({ initial: true })
          .mockResolvedValueOnce({ counter: 1, name: 'test' }),
      };

      mockNodeFactory.getExecutor.mockResolvedValue(mockExecutor);

      const result = await orchestrator.execute(workflow, mockExecution);

      expect(result).toEqual({ counter: 1, name: 'test' });

      // Verify state was available in second node's input
      const secondCallInput = mockExecutor.run.mock.calls[1][1];
      expect(secondCallInput.state).toEqual({ counter: 1, name: 'test' });
    });
  });

  describe('Workflow Validation', () => {
    it('should throw error if startNode does not exist', async () => {
      const workflow: WorkflowModel = {
        id: 'workflow-7',
        name: 'Invalid Start',
        parameterSchema: {},
        nodes: [
          { id: 'node1', type: 'data_transformer', config: {} },
        ],
        edges: [],
        startNode: 'non_existent',
        endNode: 'node1',
				state: {},
        maxIterations: 100,
        defaultConfigId: 'defaultConfigId',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(orchestrator.execute(workflow, mockExecution)).rejects.toThrow(
        "Start node 'non_existent' does not exist in workflow"
      );
    });

    it('should throw error if endNode does not exist', async () => {
      const workflow: WorkflowModel = {
        id: 'workflow-8',
        name: 'Invalid End',
        parameterSchema: {},
        nodes: [
          { id: 'node1', type: 'data_transformer', config: {} },
        ],
        edges: [],
        startNode: 'node1',
        endNode: 'non_existent',
				state: {},
        maxIterations: 100,
        defaultConfigId: 'defaultConfigId',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(orchestrator.execute(workflow, mockExecution)).rejects.toThrow(
        "End node 'non_existent' does not exist in workflow"
      );
    });

    it('should throw error if edge references non-existent from node', async () => {
      const workflow: WorkflowModel = {
        id: 'workflow-9',
        name: 'Invalid Edge From',
        parameterSchema: {},
        nodes: [
          { id: 'node1', type: 'data_transformer', config: {} },
        ],
        edges: [
          { id: 'e1', from: 'non_existent', to: 'node1' },
        ],
        startNode: 'node1',
        endNode: 'node1',
				state: {},
        maxIterations: 100,
        defaultConfigId: 'defaultConfigId',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(orchestrator.execute(workflow, mockExecution)).rejects.toThrow(
        "Edge 'e1' references non-existent 'from' node: non_existent"
      );
    });

    it('should throw error if static edge references non-existent to node', async () => {
      const workflow: WorkflowModel = {
        id: 'workflow-10',
        name: 'Invalid Edge To',
        parameterSchema: {},
        nodes: [
          { id: 'node1', type: 'data_transformer', config: {} },
        ],
        edges: [
          { id: 'e1', from: 'node1', to: 'non_existent' },
        ],
        startNode: 'node1',
        endNode: 'node1',
				state: {},
        maxIterations: 100,
        defaultConfigId: 'defaultConfigId',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(orchestrator.execute(workflow, mockExecution)).rejects.toThrow(
        "Edge 'e1' references non-existent 'to' node: non_existent"
      );
    });

    it('should throw error if node has multiple outgoing edges', async () => {
      const workflow: WorkflowModel = {
        id: 'workflow-11',
        name: 'Multiple Edges',
        parameterSchema: {},
        nodes: [
          { id: 'node1', type: 'data_transformer', config: {} },
          { id: 'node2', type: 'data_transformer', config: {} },
          { id: 'node3', type: 'data_transformer', config: {} },
        ],
        edges: [
          { id: 'e1', from: 'node1', to: 'node2' },
          { id: 'e2', from: 'node1', to: 'node3' }, // Duplicate from same node
        ],
        startNode: 'node1',
        endNode: 'node2',
				state: {},
        maxIterations: 100,
        defaultConfigId: 'defaultConfigId',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(orchestrator.execute(workflow, mockExecution)).rejects.toThrow(
        "Node 'node1' has 2 outgoing edges. Each node can only have one outgoing edge."
      );
    });

    it('should throw error if node has no outgoing edge and is not end node', async () => {
      const workflow: WorkflowModel = {
        id: 'workflow-12',
        name: 'Missing Edge',
        parameterSchema: {},
        nodes: [
          { id: 'node1', type: 'data_transformer', config: {} },
          { id: 'node2', type: 'data_transformer', config: {} },
        ],
        edges: [
          // No edge from node1
        ],
        startNode: 'node1',
        endNode: 'node2',
				state: {},
        maxIterations: 100,
        defaultConfigId: 'defaultConfigId',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockExecutor = {
        run: vi.fn().mockResolvedValue({ value: 1 }),
      };

      mockNodeFactory.getExecutor.mockResolvedValue(mockExecutor);

      await expect(orchestrator.execute(workflow, mockExecution)).rejects.toThrow(
        "No outgoing edge found from node 'node1'"
      );
    });
  });

  describe('Parent Context', () => {
    it('should provide all previous node outputs in parent context', async () => {
      const workflow: WorkflowModel = {
        id: 'workflow-13',
        name: 'Parent Context',
        parameterSchema: {},
        nodes: [
          { id: 'node1', type: 'data_transformer', config: { template: { a: 1 } } },
          { id: 'node2', type: 'data_transformer', config: { template: { b: 2 } } },
          { id: 'node3', type: 'data_transformer', config: { template: {
            fromNode1: '{{parent.node1.a}}',
            fromNode2: '{{parent.node2.b}}'
          } } },
        ],
        edges: [
          { id: 'e1', from: 'node1', to: 'node2' },
          { id: 'e2', from: 'node2', to: 'node3' },
        ],
        startNode: 'node1',
        endNode: 'node3',
				state: {},
        maxIterations: 100,
        defaultConfigId: 'defaultConfigId',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockExecutor = {
        run: vi.fn()
          .mockResolvedValueOnce({ a: 1 })
          .mockResolvedValueOnce({ b: 2 })
          .mockResolvedValueOnce({ fromNode1: 1, fromNode2: 2 }),
      };

      mockNodeFactory.getExecutor.mockResolvedValue(mockExecutor);

      const result = await orchestrator.execute(workflow, mockExecution);

      expect(result).toEqual({ fromNode1: 1, fromNode2: 2 });

      // Verify third node had access to both previous outputs
      const thirdCallInput = mockExecutor.run.mock.calls[2][1];
      expect(thirdCallInput.parent).toEqual({
        node1: { a: 1 },
        node2: { b: 2 },
      });
    });
  });
});
