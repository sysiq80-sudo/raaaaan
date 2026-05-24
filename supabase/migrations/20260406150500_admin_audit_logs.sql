-- Migration: 20260406150500_admin_audit_logs
-- Description: Creates the admin_audit_logs table to track administration actions for security and compliance.

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL,
    action_type TEXT NOT NULL, -- e.g., 'update_surge', 'ban_driver', 'update_penalty'
    entity_id TEXT, -- The ID of the affected resource (if any)
    old_data JSONB, -- The state before the action
    new_data JSONB, -- The state after the action
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT fk_admin_audit_admin
        FOREIGN KEY (admin_id)
        REFERENCES public.profiles (id)
        ON DELETE SET NULL
);

-- Index for querying logs by admin or time
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action_type ON public.admin_audit_logs(action_type);

-- RLS Policies
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" 
    ON public.admin_audit_logs 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert audit logs" 
    ON public.admin_audit_logs 
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
        )
    );

-- Helper RPC to log actions easily
CREATE OR REPLACE FUNCTION public.log_admin_action(
    p_action_type TEXT,
    p_entity_id TEXT DEFAULT NULL,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id UUID;
    v_admin_id UUID;
BEGIN
    v_admin_id := auth.uid();
    
    -- Ensure call is from an admin
    IF NOT EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = v_admin_id 
          AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only active admins can log actions';
    END IF;

    INSERT INTO admin_audit_logs (
        admin_id, action_type, entity_id, old_data, new_data
    ) VALUES (
        v_admin_id, p_action_type, p_entity_id, p_old_data, p_new_data
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;
