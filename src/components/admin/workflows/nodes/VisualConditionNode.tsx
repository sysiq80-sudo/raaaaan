import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

export const VisualConditionNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as any;
  const fieldLabel = d.conditionField === 'message_contains' ? 'محتوى الرسالة'
    : d.conditionField === 'current_hour' ? 'الساعة'
    : d.conditionField || 'شرط';

  const detail = useMemo(() => {
    if (d.conditionValue) return `${fieldLabel} ${d.conditionOperator || '='} "${d.conditionValue}"`;
    return fieldLabel;
  }, [d.conditionField, d.conditionOperator, d.conditionValue, fieldLabel]);

  return (
    <div className={`
      rounded-xl border-2 px-4 py-3 min-w-[180px] shadow-lg
      bg-gradient-to-br from-amber-500/10 to-amber-600/5
      ${selected ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-amber-500/50'}
    `}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%' }} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%' }} className="!w-3 !h-3 !bg-red-500 !border-2 !border-white" />

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shadow-md">
          <GitBranch className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">شرط</p>
          <p className="text-sm font-bold text-foreground">{d.label || 'شرط'}</p>
        </div>
      </div>
      {detail && (
        <p className="text-[10px] text-muted-foreground mt-1.5 truncate max-w-[200px]">{detail}</p>
      )}
      <div className="flex justify-between mt-2 text-[9px]">
        <span className="text-emerald-600 font-semibold">✓ نعم</span>
        <span className="text-red-500 font-semibold">✗ لا</span>
      </div>

      {d.config?.ai_fallback && (
        <div className="mt-1.5 px-1.5 py-0.5 rounded bg-purple-500/10 text-[9px] text-purple-600 font-medium text-center">
          🤖 بديل AI مفعّل
        </div>
      )}
    </div>
  );
});

VisualConditionNode.displayName = 'VisualConditionNode';
