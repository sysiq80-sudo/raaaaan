/**
 * ران — محرك Visual Workflow للتكسي
 * RAAN Visual Workflow Engine for Taxi Booking
 *
 * يتعامل مع:
 * - graph traversal (trigger → condition → action → delay)
 * - variable resolution ({{trigger.message_content}}, {{fare_result.estimated_fare}})
 * - calculate_ride_fare عبر calculate-fare Edge Function
 * - AI Fallback عبر ai-assistant Edge Function
 * - خطوة بخطوة logging
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_DEPTH = 50;

// =====================================================
// Types
// =====================================================
interface GraphNode {
  id: string;
  data: {
    type: 'trigger' | 'condition' | 'action' | 'delay' | 'ai';
    label: string;
    config: Record<string, any>;
    triggerType?: string;
    conditionField?: string;
    conditionOperator?: string;
    conditionValue?: string;
    actionType?: string;
    delayAmount?: number;
    delayUnit?: string;
  };
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

interface StepCounter { value: number; }

// =====================================================
// Variable Resolution
// =====================================================
function resolveVariables(template: string, context: Record<string, any>): string {
  if (!template || typeof template !== 'string') return template || '';
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const parts = path.trim().split('.');
    let value: any = context;
    for (const part of parts) {
      if (value == null) return '';
      value = value[part];
    }
    return value != null ? String(value) : '';
  });
}

function resolveConfigVariables(config: Record<string, any>, context: Record<string, any>): Record<string, any> {
  const resolved: Record<string, any> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string') {
      resolved[key] = resolveVariables(value, context);
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

// =====================================================
// Condition Evaluation
// =====================================================
function evaluateCondition(
  node: GraphNode,
  metadata: Record<string, any>,
  context: Record<string, any>
): boolean {
  const field = node.data.conditionField || '';
  const operator = node.data.conditionOperator || 'contains';
  const expected = resolveVariables(node.data.conditionValue || '', context);

  let actual = '';
  if (field === 'message_contains') {
    actual = metadata.message_content || metadata.message_body || '';
  } else if (field === 'current_hour') {
    const now = new Date();
    actual = String((now.getUTCHours() + 3) % 24); // Iraq UTC+3
  } else if (field === 'day_of_week') {
    actual = String(new Date().getUTCDay());
  } else if (field === 'source' || field === 'channel') {
    actual = metadata.source || metadata.channel || '';
  } else {
    // check context
    const parts = field.split('.');
    let val: any = context;
    for (const p of parts) { val = val?.[p]; }
    actual = val != null ? String(val) : '';
  }

  switch (operator) {
    case 'equals': return actual === expected;
    case 'not_equals': return actual !== expected;
    case 'contains': return actual.toLowerCase().includes(expected.toLowerCase());
    case 'starts_with': return actual.toLowerCase().startsWith(expected.toLowerCase());
    case 'exists': return actual !== '';
    case 'gt': return Number(actual) > Number(expected);
    case 'lt': return Number(actual) < Number(expected);
    case 'is_between': {
      const [min, max] = expected.split(',').map(Number);
      const val = Number(actual);
      return val >= min && val <= max;
    }
    default: return actual === expected;
  }
}

// =====================================================
// WhatsApp Messaging (lightweight — via webhook's API)
// =====================================================
async function sendWhatsAppMessage(
  supabase: any,
  phone: string,
  text: string,
  waAccountId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get WhatsApp credentials
    let query = supabase.from('whatsapp_accounts').select('*').eq('is_active', true);
    if (waAccountId) query = query.eq('id', waAccountId);
    const { data: account } = await query.limit(1).maybeSingle();

    if (!account) return { success: false, error: 'No active WhatsApp account' };

    const apiVersion = 'v21.0';
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${account.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: text },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `WA API ${res.status}: ${err.substring(0, 200)}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// =====================================================
// Action Execution
// =====================================================
async function executeAction(
  supabase: any,
  node: GraphNode,
  phone: string,
  context: Record<string, any>
): Promise<{ success: boolean; output?: any; error?: string }> {
  const actionType = node.data.actionType || '';
  const rawConfig = node.data.config || {};
  const config = resolveConfigVariables(rawConfig, context);

  switch (actionType) {
    case 'send_message': {
      const msg = config.message || '';
      if (!msg) return { success: false, error: 'No message configured' };
      const result = await sendWhatsAppMessage(supabase, phone, msg);
      return { success: result.success, output: { message: msg }, error: result.error };
    }

    case 'ask_question':
    case 'ask_location':
    case 'ask_address': {
      const prompts: Record<string, string> = {
        ask_question: config.question || config.message || '',
        ask_location: config.message || '📍 شاركني موقعك الحالي',
        ask_address: config.message || '🏠 اكتب عنوان الوجهة',
      };
      const prompt = prompts[actionType] || '';
      const result = await sendWhatsAppMessage(supabase, phone, prompt);
      return { success: result.success, output: { prompt, type: actionType }, error: result.error };
    }

    case 'calculate_ride_fare': {
      try {
        const cf = context.custom_fields || {};
        const pickupLat = Number(config.pickup_lat || cf.pickup_lat || 0);
        const pickupLng = Number(config.pickup_lng || cf.pickup_lng || 0);
        const dropoffLat = Number(config.dropoff_lat || cf.dropoff_lat || 0);
        const dropoffLng = Number(config.dropoff_lng || cf.dropoff_lng || 0);
        const vehicleType = config.vehicle_type || cf.vehicle_type || 'economy';

        if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
          return { success: false, error: 'Missing pickup/dropoff coordinates' };
        }

        const { data: fareData, error: fareError } = await supabase.functions.invoke('calculate-fare', {
          body: {
            pickup_lat: pickupLat,
            pickup_lng: pickupLng,
            dropoff_lat: dropoffLat,
            dropoff_lng: dropoffLng,
            vehicle_type: vehicleType,
          },
        });

        if (fareError) {
          return { success: false, error: `Fare calculation failed: ${fareError.message}` };
        }

        const fareResult = {
          estimated_fare: fareData?.fare ?? fareData?.estimated_fare ?? fareData?.price ?? 0,
          distance_km: fareData?.distance_km ?? fareData?.distance ?? 0,
          vehicle_type: vehicleType,
          currency: 'IQD',
        };

        const saveField = config.save_to_field || 'fare_result';
        context[saveField] = fareResult;

        console.log(`[calculate_ride_fare] ${fareResult.estimated_fare} IQD, ${fareResult.distance_km} km`);
        return { success: true, output: fareResult };
      } catch (err) {
        return { success: false, error: `Fare error: ${String(err)}` };
      }
    }

    case 'set_custom_field': {
      if (!config.field_name) return { success: false, error: 'No field name' };
      if (!context.custom_fields) context.custom_fields = {};
      context.custom_fields[config.field_name] = config.field_value || '';
      return { success: true, output: { field: config.field_name, value: config.field_value } };
    }

    case 'buttons': {
      try {
        const buttons = (config.buttons || []).slice(0, 3).map((b: any) => ({
          type: 'reply', reply: { id: b.id || b.value, title: b.label || b.title },
        }));
        const body = config.message || config.body || 'اختر خيار';

        let query = supabase.from('whatsapp_accounts').select('*').eq('is_active', true);
        const { data: account } = await query.limit(1).maybeSingle();
        if (!account) return { success: false, error: 'No WA account' };

        const res = await fetch(
          `https://graph.facebook.com/v21.0/${account.phone_number_id}/messages`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${account.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: phone,
              type: 'interactive',
              interactive: { type: 'button', body: { text: body }, action: { buttons } },
            }),
          }
        );
        return { success: res.ok, output: { buttons: buttons.length } };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }

    case 'list_message': {
      try {
        const sections = config.sections || [{ title: 'خيارات', rows: config.items || [] }];
        const body = config.message || config.body || 'اختر من القائمة';

        let query = supabase.from('whatsapp_accounts').select('*').eq('is_active', true);
        const { data: account } = await query.limit(1).maybeSingle();
        if (!account) return { success: false, error: 'No WA account' };

        const res = await fetch(
          `https://graph.facebook.com/v21.0/${account.phone_number_id}/messages`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${account.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: phone,
              type: 'interactive',
              interactive: { type: 'list', body: { text: body }, action: { button: config.button_text || 'خيارات', sections } },
            }),
          }
        );
        return { success: res.ok, output: { sections: sections.length } };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }

    default:
      return { success: false, error: `Unknown action: ${actionType}` };
  }
}

// =====================================================
// Step Logging
// =====================================================
async function logStep(
  supabase: any,
  executionId: string,
  nodeId: string,
  nodeType: string,
  status: 'success' | 'error' | 'skipped',
  inputData: any,
  outputData: any,
  errorMessage: string | null,
  durationMs: number,
  counter: StepCounter
) {
  counter.value++;
  await supabase.from('workflow_step_logs').insert({
    execution_id: executionId,
    node_id: nodeId,
    node_type: nodeType,
    step_order: counter.value,
    status,
    input_data: inputData,
    output_data: outputData,
    error_message: errorMessage,
    duration_ms: durationMs,
  });
}

// =====================================================
// Graph Traversal Engine
// =====================================================
async function traverseGraph(
  supabase: any,
  nodes: GraphNode[],
  edges: GraphEdge[],
  currentNodeId: string,
  phone: string,
  metadata: Record<string, any>,
  executionId: string,
  depth: number,
  results: any[],
  context: Record<string, any>,
  counter: StepCounter
): Promise<void> {
  if (depth >= MAX_DEPTH) {
    console.warn(`[workflow] Max depth reached at ${currentNodeId}`);
    return;
  }

  const node = nodes.find((n) => n.id === currentNodeId);
  if (!node) return;

  const stepStart = Date.now();

  await supabase.from('workflow_executions')
    .update({ current_step_id: node.id })
    .eq('id', executionId);

  switch (node.data.type) {
    case 'trigger': {
      const now = new Date();
      const h3 = (now.getUTCHours() + 3) % 24;

      context['system'] = {
        current_hour: h3,
        current_minute: now.getUTCMinutes(),
        day_of_week: now.getUTCDay(),
        timestamp: now.toISOString(),
      };
      context['trigger'] = {
        message_content: metadata.message_content || '',
        message_body: metadata.message_content || '',
        contact_name: metadata.contact_name || '',
        contact_phone: phone,
        source: metadata.source || 'whatsapp',
        trigger_type: metadata.trigger_type || node.data.triggerType || '',
      };

      await logStep(supabase, executionId, node.id, 'trigger', 'success',
        { trigger_type: node.data.triggerType }, { context_keys: Object.keys(context) }, null, Date.now() - stepStart, counter);

      const nextEdges = edges.filter((e) => e.source === node.id);
      for (const edge of nextEdges) {
        await traverseGraph(supabase, nodes, edges, edge.target, phone, metadata, executionId, depth + 1, results, context, counter);
      }
      break;
    }

    case 'condition': {
      try {
        const result = evaluateCondition(node, metadata, context);
        const handleId = result ? 'true' : 'false';

        let edgesToFollow = edges.filter((e) => e.source === node.id && e.sourceHandle === handleId);
        if (edgesToFollow.length === 0) {
          const labelMap: Record<string, string[]> = {
            'true': ['true', 'True', 'نعم', 'yes'],
            'false': ['false', 'False', 'لا', 'no'],
          };
          edgesToFollow = edges.filter((e) => e.source === node.id && labelMap[handleId]?.includes(String(e.label || '')));
        }
        if (edgesToFollow.length === 0) {
          edgesToFollow = edges.filter((e) => e.source === node.id && !e.sourceHandle && !e.label);
        }

        context[node.id] = { result };
        results.push({ node_id: node.id, type: 'condition', result });

        await logStep(supabase, executionId, node.id, 'condition', 'success',
          { field: node.data.conditionField, operator: node.data.conditionOperator },
          { result, edges_followed: edgesToFollow.length }, null, Date.now() - stepStart, counter);

        // ═══ AI Fallback ═══
        if (edgesToFollow.length === 0 && node.data.config?.ai_fallback) {
          console.log(`[workflow] AI Fallback for node ${node.id}`);
          const fbStart = Date.now();
          try {
            const { data: aiReply, error: aiErr } = await supabase.functions.invoke('ai-assistant', {
              body: {
                message: metadata.message_content || '',
                system_prompt: node.data.config.ai_fallback_prompt || 'أنت مساعد ذكي لتطبيق تاكسي',
              },
            });
            if (!aiErr && aiReply?.reply) {
              await sendWhatsAppMessage(supabase, phone, aiReply.reply);
              await logStep(supabase, executionId, node.id, 'ai_fallback', 'success',
                { prompt: node.data.config.ai_fallback_prompt || '(default)' },
                { reply: aiReply.reply?.substring(0, 200) }, null, Date.now() - fbStart, counter);
            }
          } catch (fbErr) {
            await logStep(supabase, executionId, node.id, 'ai_fallback', 'error',
              {}, {}, String(fbErr), Date.now() - fbStart, counter);
          }
          break;
        }

        for (const edge of edgesToFollow) {
          await traverseGraph(supabase, nodes, edges, edge.target, phone, metadata, executionId, depth + 1, results, context, counter);
        }
      } catch (err) {
        await logStep(supabase, executionId, node.id, 'condition', 'error',
          {}, {}, String(err), Date.now() - stepStart, counter);
      }
      break;
    }

    case 'action': {
      try {
        const result = await executeAction(supabase, node, phone, context);
        context[node.id] = { output: result.output };
        results.push({ node_id: node.id, type: 'action', actionType: node.data.actionType, ...result });

        await logStep(supabase, executionId, node.id, 'action', result.success ? 'success' : 'error',
          { actionType: node.data.actionType, config: node.data.config },
          result.output || {}, result.error || null, Date.now() - stepStart, counter);

        if (node.data.actionType === 'wait_input') break; // pause here

        const nextEdges = edges.filter((e) => e.source === node.id);
        for (const edge of nextEdges) {
          await traverseGraph(supabase, nodes, edges, edge.target, phone, metadata, executionId, depth + 1, results, context, counter);
        }
      } catch (err) {
        await logStep(supabase, executionId, node.id, 'action', 'error',
          { actionType: node.data.actionType }, {}, String(err), Date.now() - stepStart, counter);
      }
      break;
    }

    case 'delay': {
      const delayMs = (node.data.delayAmount || 1) *
        ({ minutes: 60000, hours: 3600000, days: 86400000 }[node.data.delayUnit || 'minutes'] || 60000);

      await logStep(supabase, executionId, node.id, 'delay', 'success',
        { amount: node.data.delayAmount, unit: node.data.delayUnit },
        { delay_ms: delayMs }, null, Date.now() - stepStart, counter);

      // For short delays (< 30s), actually wait; otherwise schedule
      if (delayMs < 30000) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        const nextEdges = edges.filter((e) => e.source === node.id);
        for (const edge of nextEdges) {
          await traverseGraph(supabase, nodes, edges, edge.target, phone, metadata, executionId, depth + 1, results, context, counter);
        }
      } else {
        // Mark execution as waiting with scheduled_at
        await supabase.from('workflow_executions').update({
          status: 'waiting',
          scheduled_at: new Date(Date.now() + delayMs).toISOString(),
          context_data: context,
        }).eq('id', executionId);
      }
      break;
    }

    default: {
      await logStep(supabase, executionId, node.id, node.data.type, 'skipped',
        {}, {}, `Unknown node type: ${node.data.type}`, Date.now() - stepStart, counter);
      break;
    }
  }
}

// =====================================================
// Main Handler
// =====================================================
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();
    const {
      workflow_id,
      phone,
      trigger_type = 'message_received',
      metadata = {},
    } = body;

    // If no workflow_id, find active workflows matching the trigger
    let workflowIds: string[] = [];
    if (workflow_id) {
      workflowIds = [workflow_id];
    } else {
      const { data: activeWorkflows } = await supabase
        .from('visual_workflows')
        .select('id')
        .eq('is_active', true)
        .eq('trigger_type', trigger_type);
      workflowIds = (activeWorkflows || []).map((w: any) => w.id);
    }

    if (workflowIds.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'No matching workflows' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const allResults: any[] = [];

    for (const wfId of workflowIds) {
      const { data: workflow } = await supabase
        .from('visual_workflows')
        .select('*')
        .eq('id', wfId)
        .single();

      if (!workflow?.graph_data) continue;

      const { nodes, edges } = workflow.graph_data as { nodes: GraphNode[]; edges: GraphEdge[] };
      const triggerNode = nodes.find((n) => n.data.type === 'trigger');
      if (!triggerNode) continue;

      // Create execution record
      const { data: execution } = await supabase
        .from('workflow_executions')
        .insert({
          workflow_id: wfId,
          conversation_id: metadata.conversation_id || null,
          status: 'running',
          context_data: {},
        })
        .select('id')
        .single();

      if (!execution) continue;

      const context: Record<string, any> = {};
      const results: any[] = [];
      const counter: StepCounter = { value: 0 };

      try {
        await traverseGraph(
          supabase, nodes, edges, triggerNode.id,
          phone || metadata.contact_phone || '',
          { ...metadata, trigger_type },
          execution.id, 0, results, context, counter
        );

        // Mark complete
        await supabase.from('workflow_executions').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          context_data: context,
        }).eq('id', execution.id);

        allResults.push({ workflow_id: wfId, execution_id: execution.id, steps: counter.value, results });
      } catch (err) {
        await supabase.from('workflow_executions').update({
          status: 'error',
          error_message: String(err),
          completed_at: new Date().toISOString(),
        }).eq('id', execution.id);

        allResults.push({ workflow_id: wfId, execution_id: execution.id, error: String(err) });
      }
    }

    return new Response(JSON.stringify({ ok: true, workflows: allResults }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[run-visual-workflow] Error:', String(err));
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
