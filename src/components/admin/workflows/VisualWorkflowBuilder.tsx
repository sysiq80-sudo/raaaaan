import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Connection, type Node, type Edge,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Save, Play, ArrowRight, Plus, List, ChevronLeft,
} from 'lucide-react';
import {
  useVisualWorkflows,
  createDefaultTriggerNode,
  createDefaultConditionNode,
  createDefaultActionNode,
  createDefaultDelayNode,
  type VisualWorkflowNodeData,
} from '@/hooks/useVisualWorkflows';
import { VisualTriggerNode } from './nodes/VisualTriggerNode';
import { VisualConditionNode } from './nodes/VisualConditionNode';
import { VisualActionNode } from './nodes/VisualActionNode';
import { WorkflowNodePalette, PALETTE_ACTION_MAP } from './WorkflowNodePalette';
import { WorkflowNodeEditor } from './WorkflowNodeEditor';
import { WorkflowExecutionLogs } from './WorkflowExecutionLogs';

const nodeTypes = {
  visualTrigger: VisualTriggerNode,
  visualCondition: VisualConditionNode,
  visualAction: VisualActionNode,
};

interface VisualWorkflowBuilderProps {
  workflowId?: string;
  onBack?: () => void;
}

export function VisualWorkflowBuilder({ workflowId, onBack }: VisualWorkflowBuilderProps) {
  const {
    workflows, fetchWorkflows,
    createWorkflow, updateWorkflow, saveGraphData,
    executions, executionsLoading, fetchExecutions, fetchStepLogs, testRunWorkflow,
    toggleWorkflow,
  } = useVisualWorkflows();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showPalette, setShowPalette] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [workflowName, setWorkflowName] = useState('تدفق جديد');
  const [isActive, setIsActive] = useState(false);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(workflowId || null);
  const [saving, setSaving] = useState(false);
  const [traceNodeIds, setTraceNodeIds] = useState<string[]>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Load existing workflow
  useEffect(() => {
    if (currentWorkflowId && workflows.length > 0) {
      const wf = workflows.find(w => w.id === currentWorkflowId);
      if (wf) {
        setWorkflowName(wf.name);
        setIsActive(wf.is_active);
        if (wf.graph_data?.nodes) setNodes(wf.graph_data.nodes);
        if (wf.graph_data?.edges) setEdges(wf.graph_data.edges);
      }
    }
  }, [currentWorkflowId, workflows, setNodes, setEdges]);

  // Apply trace highlights
  useEffect(() => {
    if (traceNodeIds.length === 0) return;
    setNodes(nds => nds.map(n => ({
      ...n,
      style: traceNodeIds.includes(n.id)
        ? { ...n.style, boxShadow: '0 0 0 3px rgba(59,130,246,0.5)', borderRadius: '12px' }
        : { ...n.style, boxShadow: undefined },
    })));
  }, [traceNodeIds, setNodes]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => addEdge({ ...connection, animated: true, style: { strokeWidth: 2 } }, eds));
  }, [setEdges]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Drop handler
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('application/reactflow-type');
    const subType = e.dataTransfer.getData('application/reactflow-subtype');
    if (!nodeType || !reactFlowInstance) return;

    const position = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const id = `node_${Date.now()}`;

    let newNodeData: Partial<Node>;
    if (nodeType === 'visualTrigger') {
      newNodeData = createDefaultTriggerNode();
    } else if (nodeType === 'visualCondition') {
      newNodeData = createDefaultConditionNode();
    } else if (subType === 'delay') {
      newNodeData = createDefaultDelayNode();
    } else {
      const actionType = PALETTE_ACTION_MAP[subType] || 'send_message';
      newNodeData = createDefaultActionNode(actionType);
    }

    const newNode: Node = {
      id,
      position,
      ...newNodeData,
    } as Node;

    setNodes(nds => [...nds, newNode]);
  }, [reactFlowInstance, setNodes]);

  // Update node data
  const handleNodeUpdate = useCallback((nodeId: string, data: Partial<VisualWorkflowNodeData>) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
    setSelectedNode(prev => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } as Node : prev);
  }, [setNodes]);

  const handleNodeDelete = useCallback((nodeId: string) => {
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  // Save
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (currentWorkflowId) {
        const { error: saveErr } = await saveGraphData(currentWorkflowId, nodes, edges);
        if (saveErr) {
          console.error('[handleSave] saveGraphData error:', saveErr);
          toast.error('فشل في حفظ البيانات: ' + (saveErr.message || 'خطأ غير معروف'));
          return;
        }
        const { error: nameErr } = await updateWorkflow(currentWorkflowId, { name: workflowName } as any);
        if (nameErr) {
          console.error('[handleSave] updateWorkflow error:', nameErr);
        }
        toast.success('تم الحفظ بنجاح ✅');
      } else {
        const { data, error } = await createWorkflow({
          name: workflowName,
          trigger_type: 'message_received',
          graph_data: { nodes, edges },
        });
        if (error) {
          console.error('[handleSave] createWorkflow error:', error);
          toast.error('فشل في إنشاء التدفق: ' + (error.message || 'خطأ غير معروف'));
          return;
        }
        if (data) {
          setCurrentWorkflowId(data.id);
          toast.success('تم إنشاء التدفق بنجاح ✅');
        }
      }
    } catch (err) {
      console.error('[handleSave] unexpected error:', err);
      toast.error('فشل في الحفظ: ' + String(err));
    } finally {
      setSaving(false);
    }
  }, [currentWorkflowId, nodes, edges, workflowName, saveGraphData, updateWorkflow, createWorkflow]);

  // Test run
  const handleTestRun = useCallback(async () => {
    if (!currentWorkflowId) {
      toast.error('احفظ التدفق أولاً');
      return;
    }
    toast.info('جارٍ التشغيل التجريبي...');
    const { data, error } = await testRunWorkflow(currentWorkflowId, {
      message_content: 'test message',
      phone: '07800000000',
    });
    if (error) toast.error('فشل التشغيل: ' + error.message);
    else toast.success(`تم التشغيل — ${data?.workflows?.[0]?.steps || 0} خطوات`);
    setShowLogs(true);
  }, [currentWorkflowId, testRunWorkflow]);

  // Toggle active
  const handleToggleActive = useCallback(async (active: boolean) => {
    if (!currentWorkflowId) return;
    await toggleWorkflow(currentWorkflowId, active);
    setIsActive(active);
    toast.success(active ? 'تم التفعيل' : 'تم الإيقاف');
  }, [currentWorkflowId, toggleWorkflow]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Toolbar */}
      <div className="h-14 border-b flex items-center gap-3 px-4 bg-card/80 backdrop-blur-sm shrink-0">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            العودة
          </Button>
        )}

        <Input
          className="w-48 h-8 text-sm font-bold"
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
        />

        <div className="flex items-center gap-2 ms-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{isActive ? 'مفعّل' : 'متوقف'}</span>
            <Switch checked={isActive} onCheckedChange={handleToggleActive} />
          </div>

          <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowLogs(!showLogs)}>
            <List className="h-3.5 w-3.5" />
            السجلات
          </Button>

          <Button variant="outline" size="sm" className="gap-1" onClick={handleTestRun}>
            <Play className="h-3.5 w-3.5" />
            تشغيل تجريبي
          </Button>

          <Button size="sm" className="gap-1" onClick={handleSave} disabled={saving}>
            <Save className="h-3.5 w-3.5" />
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Palette */}
        {showPalette && <WorkflowNodePalette />}

        {/* Canvas */}
        <div className="flex-1 flex flex-col" ref={reactFlowWrapper}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onInit={setReactFlowInstance}
              nodeTypes={nodeTypes}
              fitView
              className="bg-muted/30"
              defaultEdgeOptions={{ animated: true, style: { strokeWidth: 2 } }}
            >
              <Background gap={20} size={1} />
              <Controls position="bottom-left" />
              <MiniMap
                position="bottom-right"
                className="!bg-card !border !border-border !rounded-lg !shadow-lg"
                nodeStrokeWidth={3}
              />
            </ReactFlow>
          </ReactFlowProvider>

          {/* Execution Logs */}
          {showLogs && (
            <WorkflowExecutionLogs
              workflowId={currentWorkflowId}
              fetchExecutions={fetchExecutions}
              fetchStepLogs={fetchStepLogs}
              executions={executions}
              executionsLoading={executionsLoading}
              onLiveTrace={setTraceNodeIds}
            />
          )}
        </div>

        {/* Properties Panel */}
        {selectedNode && (
          <WorkflowNodeEditor
            node={selectedNode}
            onUpdate={handleNodeUpdate}
            onDelete={handleNodeDelete}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}
