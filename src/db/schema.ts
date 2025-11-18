import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  parameterSchema: text('parameter_schema', { mode: 'json' }).notNull(),
  nodes: text('nodes', { mode: 'json' }).notNull(),
  edges: text('edges', { mode: 'json' }).notNull(),
  startNode: text('start_node').notNull(),
  endNode: text('end_node').notNull(),
  maxIterations: integer('max_iterations').notNull().default(100),
	state: text('state', { mode: 'json' }),
	defaultConfigId: text('default_config_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  createdAtIdx: index('idx_workflows_created_at').on(table.createdAt),
  defaultConfigIdx: index('idx_workflows_default_config').on(table.defaultConfigId),
}));

export const executions = sqliteTable('executions', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  parameters: text('parameters', { mode: 'json' }).notNull(),
  config: text('config', { mode: 'json' }),
  configId: text('config_id'),
  result: text('result', { mode: 'json' }),
  error: text('error'),
}, (table) => ({
  workflowIdIdx: index('idx_executions_workflow_id').on(table.workflowId),
  statusIdx: index('idx_executions_status').on(table.status),
	createdAtIdx: index('idx_executions_created_at').on(table.createdAt),
  configIdIdx: index('idx_executions_config_id').on(table.configId),
}));

export const nodeExecutions = sqliteTable('node_executions', {
  id: text('id').primaryKey(),
  executionId: text('execution_id').notNull().references(() => executions.id, { onDelete: 'cascade' }),
  nodeId: text('node_id').notNull(),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).notNull(),
  output: text('output', { mode: 'json' }),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
  executionIdIdx: index('idx_node_executions_execution_id').on(table.executionId),
  statusIdx: index('idx_node_executions_status').on(table.status),
}));


export const configs = sqliteTable('configs', {
  id: text('id').primaryKey(),
  name: text('name').unique().notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  createdAtIdx: index('idx_configs_created_at').on(table.createdAt),
}));
