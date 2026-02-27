import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import { TRIGGER_LABELS } from '@/hooks/useVisualWorkflows';

export const VisualTriggerNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as any;
  const label = useMemo(() => TRIGGER_LABELS[d.triggerType] || d.label || 'مُشغِّل', [d.triggerType, d.label]);

  return (
    <div className={`
      rounded-xl border-2 px-4 py-3 min-w-[180px] shadow-lg
      bg-gradient-to-br from-blue-500/10 to-blue-600/5
      ${selected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-blue-500/50'}
    `}>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white" />

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shadow-md">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider">مُشغِّل</p>
          <p className="text-sm font-bold text-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
});

VisualTriggerNode.displayName = 'VisualTriggerNode';
