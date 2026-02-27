import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Connection, type Node,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Save, Play, List, ChevronLeft, Plus, Trash2,
  GitBranch, Clock,
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
  const navigate = useNavigate();
  const {
    workflows, loading: workflowsLoading, fetchWorkflows,
    createWorkflow, updateWorkflow, deleteWorkflow, saveGraphData,
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
  const [viewMode, setViewMode] = useState<'list' | 'builder'>(() => workflowId ? 'builder' : 'list');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Load existing workflow when ID changes
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Save — serializes clean node/edge data
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Clean node data: remove runtime-only properties from React Flow
      const cleanNodes = nodes.map(n => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      }));
      const cleanEdges = edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        animated: e.animated,
      }));

      // Detect trigger_type from the trigger node
      const triggerNode = cleanNodes.find((n: any) => n.data?.type === 'trigger');
      const detectedTriggerType = (triggerNode as any)?.data?.triggerType || 'message_received';

      if (currentWorkflowId) {
        const { error: saveErr } = await saveGraphData(currentWorkflowId, cleanNodes as Node[], cleanEdges);
        if (saveErr) {
          console.error('[handleSave] saveGraphData error:', saveErr);
          toast.error('فشل في حفظ البيانات: ' + (saveErr.message || 'خطأ غير معروف'));
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: nameErr } = await updateWorkflow(currentWorkflowId, { name: workflowName, trigger_type: detectedTriggerType } as any);
        if (nameErr) {
          console.error('[handleSave] updateWorkflow error:', nameErr);
        }
        toast.success('تم الحفظ بنجاح ✅');
      } else {
        const { data, error } = await createWorkflow({
          name: workflowName,
          trigger_type: detectedTriggerType,
          graph_data: { nodes: cleanNodes, edges: cleanEdges },
        });
        if (error) {
          console.error('[handleSave] createWorkflow error:', error);
          toast.error('فشل في إنشاء التدفق: ' + (error.message || 'خطأ غير معروف'));
          return;
        }
        if (data) {
          setCurrentWorkflowId(data.id);
          navigate(`/admin/workflows/${data.id}`, { replace: true });
          toast.success('تم إنشاء التدفق بنجاح ✅');
        }
      }
    } catch (err) {
      console.error('[handleSave] unexpected error:', err);
      toast.error('فشل في الحفظ: ' + String(err));
    } finally {
      setSaving(false);
    }
  }, [currentWorkflowId, nodes, edges, workflowName, saveGraphData, updateWorkflow, createWorkflow, navigate]);

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

  // Back to list (from toolbar)
  const handleBackToList = useCallback(() => {
    setCurrentWorkflowId(null);
    setNodes([]);
    setEdges([]);
    setWorkflowName('تدفق جديد');
    setIsActive(false);
    setSelectedNode(null);
    setViewMode('list');
    navigate('/admin/workflows', { replace: true });
  }, [setNodes, setEdges, navigate]);

  // New workflow — opens empty builder canvas
  const handleNewWorkflow = useCallback(() => {
    setCurrentWorkflowId(null);
    setNodes([]);
    setEdges([]);
    setWorkflowName('تدفق جديد');
    setIsActive(false);
    setSelectedNode(null);
    setViewMode('builder');
    navigate('/admin/workflows', { replace: true });
  }, [setNodes, setEdges, navigate]);

  // Select existing workflow
  const handleSelectWorkflow = useCallback((id: string) => {
    setCurrentWorkflowId(id);
    setViewMode('builder');
    navigate(`/admin/workflows/${id}`, { replace: true });
  }, [navigate]);

  // Delete workflow
  const handleDeleteWorkflow = useCallback(async (id: string) => {
    if (!confirm('هل تريد حذف هذا التدفق نهائياً؟')) return;
    const { error } = await deleteWorkflow(id);
    if (error) {
      toast.error('فشل في الحذف');
    } else {
      toast.success('تم الحذف');
      if (currentWorkflowId === id) handleBackToList();
    }
  }, [deleteWorkflow, currentWorkflowId, handleBackToList]);

  // ═══════ Workflow List View (when no workflow selected) ═══════
  if (viewMode === 'list') {
    return (
      <div className="min-h-screen bg-background p-8" dir="rtl">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">التدفقات المرئية</h1>
              <p className="text-sm text-muted-foreground">إدارة تدفقات واتساب بالسحب والإفلات</p>
            </div>
            <Button onClick={handleNewWorkflow} className="gap-2">
              <Plus className="h-4 w-4" />
              تدفق جديد
            </Button>
          </div>

          {workflowsLoading ? (
            <div className="text-center py-20 text-muted-foreground">جارٍ التحميل...</div>
          ) : workflows.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-lg font-medium mb-2">لا توجد تدفقات بعد</p>
                <p className="text-sm text-muted-foreground mb-4">أنشئ أول تدفق مرئي لبوت الواتساب</p>
                <Button onClick={handleNewWorkflow} className="gap-2">
                  <Plus className="h-4 w-4" />
                  إنشاء تدفق
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {workflows.map((wf) => (
                <Card
                  key={wf.id}
                  className="cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => handleSelectWorkflow(wf.id)}
                >
                  <CardContent className="py-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${wf.is_active ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                      <GitBranch className={`h-5 w-5 ${wf.is_active ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm truncate">{wf.name}</p>
                        <Badge variant={wf.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {wf.is_active ? 'مفعّل' : 'متوقف'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(wf.updated_at).toLocaleDateString('ar-IQ')}
                        </span>
                        <span>{wf.graph_data?.nodes?.length || 0} عقدة</span>
                        <span>v{wf.version}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={(e) => { e.stopPropagation(); handleDeleteWorkflow(wf.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════ Builder View ═══════
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Toolbar */}
      <div className="h-14 border-b flex items-center gap-3 px-4 bg-card/80 backdrop-blur-sm shrink-0">
        <Button variant="ghost" size="sm" onClick={handleBackToList} className="gap-1">
          <ChevronLeft className="h-4 w-4" />
          القائمة
        </Button>

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
