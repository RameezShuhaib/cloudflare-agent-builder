-- Configs table (metadata only - variables in KV)
CREATE TABLE IF NOT EXISTS configs (
	id text PRIMARY KEY NOT NULL,
	name text NOT NULL,
	description text,
	created_at integer NOT NULL,
	updated_at integer NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_configs_created_at ON configs(created_at);

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
	id text PRIMARY KEY NOT NULL,
	name text NOT NULL,
	parameter_schema text NOT NULL,
	nodes text NOT NULL,
	output_node text NOT NULL,
	default_config_id text,
	created_at integer NOT NULL,
	updated_at integer NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at);
CREATE INDEX IF NOT EXISTS idx_workflows_default_config ON workflows(default_config_id);

-- Executions table
CREATE TABLE IF NOT EXISTS executions (
	id text PRIMARY KEY NOT NULL,
	workflow_id text NOT NULL,
	status text NOT NULL,
	started_at integer NOT NULL,
	completed_at integer,
	parameters text NOT NULL,
	config_id text,
	result text,
	error text,
	FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_started_at ON executions(started_at);
CREATE INDEX IF NOT EXISTS idx_executions_config_id ON executions(config_id);

-- Node Executions table
CREATE TABLE IF NOT EXISTS node_executions (
	id text PRIMARY KEY NOT NULL,
	execution_id text NOT NULL,
	node_id text NOT NULL,
	status text NOT NULL,
	output text,
	error text,
	started_at integer NOT NULL,
	completed_at integer,
	FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_node_executions_execution_id ON node_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_node_executions_status ON node_executions(status);

-- Node Executors table
CREATE TABLE IF NOT EXISTS node_executors (
	type text PRIMARY KEY NOT NULL,
	name text NOT NULL,
	description text,
	category text NOT NULL,
	config_schema text NOT NULL,
	is_builtin integer DEFAULT 0 NOT NULL,
	source_workflow_id text,
	created_at integer NOT NULL,
	FOREIGN KEY (source_workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_node_executors_category ON node_executors(category);
CREATE INDEX IF NOT EXISTS idx_node_executors_source_workflow ON node_executors(source_workflow_id);
