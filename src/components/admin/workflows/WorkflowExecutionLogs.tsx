import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  CheckCircle2, XCircle, SkipForward, ChevronDown, ChevronRight,
  Clock, Loader2, RefreshCw, Zap, GitBranch, MessageSquare, Radio,
} from 'lucide-react';
import type { WorkflowExecution, WorkflowStepLog } from '@/hooks/useVisualWorkflows';

interface Props {
  workflowId: string | null;
  fetchExecutions: (workflowId?: string, limit?: number) => Promise<void>;
  fetchStepLogs: (executionId: string) => Promise<WorkflowStepLog[]>;
  executions: WorkflowExecution[];
  executionsLoading: boolean;
  onLiveTrace?: (nodeIds: string[]) => void;
}

const StatusBadge = ({ status }: { status: string }) => {
  const v: Record<string, { color: string; icon: any }> = {
    completed: { color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', icon: CheckCircle2 },
    running: { color: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: Loader2 },
    error: { color: 'bg-red-500/10 text-red-600 border-red-500/30', icon: XCircle },
    waiting: { color: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: Clock },
  };
  const s = v[status] || v.error;
  const Icon = s.icon;
  return (
    <Badge variant="outline" className={`text-[10px] gap-1 ${s.color}`}>
      <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {status}
    </Badge>
  );
};

export function WorkflowExecutionLogs({
  workflowId, fetchExecutions, fetchStepLogs,
  executions, executionsLoading, onLiveTrace,
}: Props) {
  const [expandedExec, setExpandedExec] = useState<string | null>(null);
  const [stepLogs, setStepLogs] = useState<Record<string, WorkflowStepLog[]>>({});
  const [loadingSteps, setLoadingSteps] = useState<string | null>(null);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);

  useEffect(() => {
    if (workflowId) fetchExecutions(workflowId, 20);
  }, [workflowId, fetchExecutions]);

  const handleExpand = useCallback(async (execId: string) => {
    if (expandedExec === execId) { setExpandedExec(null); return; }
    setExpandedExec(execId);
    if (!stepLogs[execId]) {
      setLoadingSteps(execId);
      const logs = await fetchStepLogs(execId);
      setStepLogs(prev => ({ ...prev, [execId]: logs }));
      setLoadingSteps(null);
    }
  }, [expandedExec, stepLogs, fetchStepLogs]);

  // Live Trace auto-refresh
  useEffect(() => {
    if (!activeTraceId || !onLiveTrace) return;
    const interval = setInterval(async () => {
      const logs = await fetchStepLogs(activeTraceId);
      setStepLogs(prev => ({ ...prev, [activeTraceId]: logs }));
      onLiveTrace(logs.map(l => l.node_id));
    }, 3000);
    return () => { clearInterval(interval); onLiveTrace([]); };
  }, [activeTraceId, fetchStepLogs, onLiveTrace]);

  const handleLiveTrace = useCallback((execId: string) => {
    if (activeTraceId === execId) setActiveTraceId(null);
    else { setActiveTraceId(execId); handleExpand(execId); }
  }, [activeTraceId, handleExpand]);

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="border-t bg-card/50">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="text-xs font-bold">سجلات التنفيذ</h3>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => workflowId && fetchExecutions(workflowId, 20)} disabled={executionsLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${executionsLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <ScrollArea className="max-h-[250px]">
        {executionsLoading && executions.length === 0 ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : executions.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">لا توجد سجلات تنفيذ</div>
        ) : (
          <div className="divide-y">
            {executions.map(exec => {
              const isExpanded = expandedExec === exec.id;
              const logs = stepLogs[exec.id] || [];
              const duration = exec.completed_at && exec.started_at
                ? new Date(exec.completed_at).getTime() - new Date(exec.started_at).getTime()
                : null;

              return (
                <Collapsible key={exec.id} open={isExpanded} onOpenChange={() => handleExpand(exec.id)}>
                  <CollapsibleTrigger className="w-full px-4 py-2 hover:bg-muted/50 transition-colors text-start">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={exec.status} />
                          <span className="text-[10px] text-muted-foreground font-mono">{exec.id.slice(0, 8)}</span>
                          {duration !== null && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{formatDuration(duration)}</span>}
                        </div>
                      </div>
                      {(exec.status === 'running' || exec.status === 'waiting') && onLiveTrace && (
                        <Button
                          variant={activeTraceId === exec.id ? 'default' : 'outline'}
                          size="sm"
                          className={`h-6 px-2 text-[10px] gap-1 shrink-0 ${activeTraceId === exec.id ? 'animate-pulse' : ''}`}
                          onClick={(e) => { e.stopPropagation(); handleLiveTrace(exec.id); }}
                        >
                          <Radio className="h-3 w-3" />
                          {activeTraceId === exec.id ? 'إيقاف' : 'تتبع مباشر'}
                        </Button>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-2">
                      {loadingSteps === exec.id ? (
                        <div className="flex items-center justify-center py-3"><Loader2 className="h-4 w-4 animate-spin" /></div>
                      ) : logs.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">لا توجد خطوات</p>
                      ) : (
                        <div className="space-y-1 ms-2 border-s-2 border-border ps-3">
                          {logs.map(step => (
                            <div key={step.id} className="py-1 flex items-center gap-2">
                              {step.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" /> : step.status === 'error' ? <XCircle className="h-3 w-3 text-red-500 shrink-0" /> : <SkipForward className="h-3 w-3 text-muted-foreground shrink-0" />}
                              <span className="text-xs font-medium flex-1 truncate">{step.node_type} <span className="text-muted-foreground text-[10px]">#{step.step_order}</span></span>
                              <span className="text-[10px] text-muted-foreground font-mono">{formatDuration(step.duration_ms)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
