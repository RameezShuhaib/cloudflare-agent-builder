import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Workflows table
export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  parameterSchema: text('parameter_schema', { mode: 'json' }).notNull(),
  nodes: text('nodes', { mode: 'json' }).notNull(),
  outputNode: text('output_node').notNull(),
  defaultConfigId: text('default_config_id'), // Added: optional default config
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  createdAtIdx: index('idx_workflows_created_at').on(table.createdAt),
  defaultConfigIdx: index('idx_workflows_default_config').on(table.defaultConfigId),
}));

// Executions table
export const executions = sqliteTable('executions', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  parameters: text('parameters', { mode: 'json' }).notNull(),
  configId: text('config_id'), // Added: optional config override
  result: text('result', { mode: 'json' }),
  error: text('error'),
}, (table) => ({
  workflowIdIdx: index('idx_executions_workflow_id').on(table.workflowId),
  statusIdx: index('idx_executions_status').on(table.status),
  startedAtIdx: index('idx_executions_started_at').on(table.startedAt),
  configIdIdx: index('idx_executions_config_id').on(table.configId),
}));

// Node Executions table
export const nodeExecutions = sqliteTable('node_executions', {
  id: text('id').primaryKey(),
  executionId: text('execution_id').notNull().references(() => executions.id, { onDelete: 'cascade' }),
  nodeId: text('node_id').notNull(),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).notNull(),
  output: text('output', { mode: 'json' }),
  error: text('error'),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
  executionIdIdx: index('idx_node_executions_execution_id').on(table.executionId),
  statusIdx: index('idx_node_executions_status').on(table.status),
}));

// Node Executors table
export const nodeExecutors = sqliteTable('node_executors', {
  type: text('type').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category', { enum: ['builtin', 'custom'] }).notNull(),
  configSchema: text('config_schema', { mode: 'json' }).notNull(),
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
  sourceWorkflowId: text('source_workflow_id').references(() => workflows.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  categoryIdx: index('idx_node_executors_category').on(table.category),
  sourceWorkflowIdx: index('idx_node_executors_source_workflow').on(table.sourceWorkflowId),
}));

// Configs table (metadata only - variables stored in KV)
export const configs = sqliteTable('configs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  createdAtIdx: index('idx_configs_created_at').on(table.createdAt),
}));

export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;
export type NodeExecution = typeof nodeExecutions.$inferSelect;
export type NewNodeExecution = typeof nodeExecutions.$inferInsert;
export type NodeExecutor = typeof nodeExecutors.$inferSelect;
export type NewNodeExecutor = typeof nodeExecutors.$inferInsert;
export type Config = typeof configs.$inferSelect;
export type NewConfig = typeof configs.$inferInsert;
