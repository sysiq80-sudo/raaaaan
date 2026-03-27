-- ═══════════════════════════════════════════════════════
-- Visual Workflow System for RAAN Taxi
-- Tables: visual_workflows, workflow_executions, workflow_step_logs
-- ═══════════════════════════════════════════════════════
-- 1. Visual Workflows (graph definitions)
CREATE TABLE IF NOT EXISTS visual_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL DEFAULT 'message_received',
    trigger_config JSONB DEFAULT '{}',
    graph_data JSONB DEFAULT '{"nodes":[],"edges":[]}',
    version INT DEFAULT 1,
    is_active BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
-- 2. Workflow Executions (run instances)
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES visual_workflows(id) ON DELETE CASCADE,
    conversation_id TEXT,
    current_step_id TEXT,
    status TEXT NOT NULL DEFAULT 'running' CHECK (
        status IN ('running', 'waiting', 'completed', 'error')
    ),
    context_data JSONB DEFAULT '{}',
    error_message TEXT,
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
-- 3. Step Logs (per-node execution details)
CREATE TABLE IF NOT EXISTS workflow_step_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES workflow_executions(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    node_type TEXT NOT NULL,
    step_order INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'skipped')),
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    error_message TEXT,
    duration_ms INT,
    created_at TIMESTAMPTZ DEFAULT now()
);
-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_execution_id ON workflow_step_logs(execution_id);
-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_visual_workflow_timestamp() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_visual_workflow_updated ON visual_workflows;
CREATE TRIGGER trg_visual_workflow_updated BEFORE
UPDATE ON visual_workflows FOR EACH ROW EXECUTE FUNCTION update_visual_workflow_timestamp();
-- RLS
ALTER TABLE visual_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_step_logs ENABLE ROW LEVEL SECURITY;
-- Admins (authenticated) can manage workflows
CREATE POLICY "admin_manage_workflows" ON visual_workflows FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
-- Service role for backend execution
CREATE POLICY "service_manage_workflows" ON visual_workflows FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "admin_view_executions" ON workflow_executions FOR
SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "service_manage_executions" ON workflow_executions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "admin_view_step_logs" ON workflow_step_logs FOR
SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "service_manage_step_logs" ON workflow_step_logs FOR ALL USING (auth.role() = 'service_role');
-- Enable Realtime for executions (for Live Trace)
ALTER PUBLICATION supabase_realtime
ADD TABLE workflow_executions;