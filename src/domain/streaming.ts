export interface StreamEvent {
  type: 'workflow_start' | 'node_start' | 'node_chunk' | 'node_complete' | 'workflow_complete' | 'error';
  timestamp: string;
  workflowId: string;
  executionId: string;

  // Nested workflow tracking
  depth: number;              // 0 = root, 1 = first level child, etc.
  parentExecutionId?: string; // Link to parent execution
  path: string[];             // ['parent_node_id', 'child_node_id']

  nodeId?: string;
  nodeType?: string;
  data: any;
  metadata?: {
    progress?: number;
    tokensUsed?: number;
    duration?: number;
  };
}

export interface StreamingContext {
  executionId: string;
  depth: number;
  parentExecutionId?: string;
  path: string[];
  onEvent?: (event: StreamEvent) => void;
}

export interface WorkflowStreamingConfig {
  enabled: boolean;
  includeNodeMetadata?: boolean;
}

export interface NodeStreamingConfig {
  enabled?: boolean;
  sendOnComplete?: boolean;
}

export interface WorkflowExecutorStreamingConfig {
  inherit?: boolean;
  enabled?: boolean;
  passthrough?: boolean;
  prefix?: string;
}
