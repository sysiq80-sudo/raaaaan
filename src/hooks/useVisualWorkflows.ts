import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Node, Edge } from '@xyflow/react';

// =====================================================
// Types
// =====================================================

export interface VisualWorkflowNodeData {
  type: 'trigger' | 'condition' | 'action' | 'delay';
  label: string;
  config: Record<string, any>;
  triggerType?: string;
  conditionField?: string;
  conditionOperator?: string;
  conditionValue?: string;
  actionType?: string;
  delayAmount?: number;
  delayUnit?: 'minutes' | 'hours' | 'days';
}

export interface VisualWorkflow {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, any>;
  graph_data: { nodes: Node[]; edges: Edge[] };
  version: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  conversation_id: string | null;
  current_step_id: string | null;
  status: 'running' | 'waiting' | 'completed' | 'error';
  context_data: Record<string, any>;
  error_message: string | null;
  scheduled_at: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface WorkflowStepLog {
  id: string;
  execution_id: string;
  node_id: string;
  node_type: string;
  step_order: number;
  status: 'success' | 'error' | 'skipped';
  input_data: Record<string, any>;
  output_data: Record<string, any>;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

// =====================================================
// Constants
// =====================================================

export const VISUAL_TRIGGER_TYPES = [
  'message_received',
  'location_received',
  'booking_created',
  'ride_completed',
  'scheduled',
] as const;

export const VISUAL_ACTION_TYPES = [
  'send_message',
  'ask_question',
  'ask_location',
  'ask_address',
  'calculate_ride_fare',
  'set_custom_field',
  'buttons',
  'list_message',
] as const;

export const TRIGGER_LABELS: Record<string, string> = {
  message_received: 'استلام رسالة',
  location_received: 'استلام موقع',
  booking_created: 'إنشاء حجز',
  ride_completed: 'اكتمال رحلة',
  scheduled: 'مجدول',
};

export const VISUAL_ACTION_LABELS: Record<string, string> = {
  send_message: 'إرسال رسالة',
  ask_question: 'طرح سؤال',
  ask_location: 'طلب موقع',
  ask_address: 'طلب عنوان',
  calculate_ride_fare: 'حساب أجرة التكسي',
  set_custom_field: 'تعيين حقل مخصص',
  buttons: 'أزرار اختيار',
  list_message: 'قائمة اختيار',
};

export const CONDITION_FIELDS = [
  'message_contains',
  'current_hour',
  'day_of_week',
  'source',
] as const;

export const CONDITION_FIELD_LABELS: Record<string, string> = {
  message_contains: 'محتوى الرسالة',
  current_hour: 'الساعة الحالية',
  day_of_week: 'يوم الأسبوع',
  source: 'المصدر',
};

export const CONDITION_OPERATORS = [
  'equals', 'not_equals', 'contains', 'starts_with', 'exists', 'gt', 'lt', 'is_between',
] as const;

export const CONDITION_OPERATOR_LABELS: Record<string, string> = {
  equals: 'يساوي',
  not_equals: 'لا يساوي',
  contains: 'يحتوي على',
  starts_with: 'يبدأ بـ',
  exists: 'موجود',
  gt: 'أكبر من',
  lt: 'أصغر من',
  is_between: 'بين',
};

// =====================================================
// Default Node Creators
// =====================================================

export function createDefaultTriggerNode(triggerType = 'message_received'): Partial<Node> {
  return {
    type: 'visualTrigger',
    data: {
      type: 'trigger',
      label: TRIGGER_LABELS[triggerType] || triggerType,
      triggerType,
      config: {},
    } satisfies VisualWorkflowNodeData,
  };
}

export function createDefaultConditionNode(): Partial<Node> {
  return {
    type: 'visualCondition',
    data: {
      type: 'condition',
      label: 'شرط',
      conditionField: 'message_contains',
      conditionOperator: 'contains',
      conditionValue: '',
      config: {},
    } satisfies VisualWorkflowNodeData,
  };
}

export function createDefaultActionNode(actionType = 'send_message'): Partial<Node> {
  return {
    type: 'visualAction',
    data: {
      type: 'action',
      label: VISUAL_ACTION_LABELS[actionType] || actionType,
      actionType,
      config: {},
    } satisfies VisualWorkflowNodeData,
  };
}

export function createDefaultDelayNode(): Partial<Node> {
  return {
    type: 'visualAction',
    data: {
      type: 'delay',
      label: 'تأخير',
      delayAmount: 5,
      delayUnit: 'minutes',
      config: {},
    } satisfies VisualWorkflowNodeData,
  };
}

// =====================================================
// Hook
// =====================================================

export function useVisualWorkflows() {
  const [workflows, setWorkflows] = useState<VisualWorkflow[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [executionsLoading, setExecutionsLoading] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('visual_workflows' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('[useVisualWorkflows] fetchWorkflows error:', error);
    setWorkflows((data as any as VisualWorkflow[]) || []);
    setLoading(false);
  }, []);

  const fetchExecutions = useCallback(async (workflowId?: string, limit = 50) => {
    setExecutionsLoading(true);
    let query = supabase
      .from('workflow_executions' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (workflowId) query = query.eq('workflow_id', workflowId);
    const { data } = await query;
    setExecutions((data as any as WorkflowExecution[]) || []);
    setExecutionsLoading(false);
  }, []);

  useEffect(() => { fetchWorkflows(); }, [fetchWorkflows]);

  const createWorkflow = useCallback(async (workflow: {
    name: string;
    description?: string;
    trigger_type: string;
    graph_data: { nodes: Node[]; edges: Edge[] };
  }) => {
    console.log('[useVisualWorkflows] Creating workflow:', workflow.name);
    const { data, error } = await supabase
      .from('visual_workflows' as any)
      .insert({ ...workflow, is_active: false } as any)
      .select()
      .single();
    if (error) {
      console.error('[useVisualWorkflows] createWorkflow error:', error);
    } else {
      console.log('[useVisualWorkflows] Workflow created:', data);
      await fetchWorkflows();
    }
    return { data: data as any as VisualWorkflow | null, error };
  }, [fetchWorkflows]);

  const updateWorkflow = useCallback(async (id: string, updates: Partial<VisualWorkflow>) => {
    console.log('[useVisualWorkflows] Updating workflow:', id, updates);
    const { error } = await supabase
      .from('visual_workflows' as any)
      .update(updates as any)
      .eq('id', id);
    if (error) {
      console.error('[useVisualWorkflows] updateWorkflow error:', error);
    } else {
      await fetchWorkflows();
    }
    return { error };
  }, [fetchWorkflows]);

  const deleteWorkflow = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('visual_workflows' as any)
      .delete()
      .eq('id', id);
    if (!error) await fetchWorkflows();
    return { error };
  }, [fetchWorkflows]);

  const toggleWorkflow = useCallback(async (id: string, is_active: boolean) => {
    return updateWorkflow(id, { is_active } as any);
  }, [updateWorkflow]);

  const saveGraphData = useCallback(async (id: string, nodes: Node[], edges: Edge[]) => {
    return updateWorkflow(id, { graph_data: { nodes, edges } } as any);
  }, [updateWorkflow]);

  const fetchStepLogs = useCallback(async (executionId: string) => {
    const { data } = await supabase
      .from('workflow_step_logs' as any)
      .select('*')
      .eq('execution_id', executionId)
      .order('step_order', { ascending: true });
    return (data as any as WorkflowStepLog[]) || [];
  }, []);

  const testRunWorkflow = useCallback(async (workflowId: string, mockData?: Record<string, any>) => {
    const { data, error } = await supabase.functions.invoke('run-visual-workflow', {
      body: {
        workflow_id: workflowId,
        phone: mockData?.phone || '07800000000',
        trigger_type: mockData?.trigger_type || 'message_received',
        metadata: {
          message_content: mockData?.message_content || 'test',
          source: 'whatsapp',
          is_test: true,
          ...(mockData?.metadata || {}),
        },
      },
    });
    return { data, error };
  }, []);

  return {
    workflows, executions, loading, executionsLoading,
    fetchWorkflows, fetchExecutions,
    createWorkflow, updateWorkflow, deleteWorkflow,
    toggleWorkflow, saveGraphData,
    fetchStepLogs, testRunWorkflow,
  };
}
