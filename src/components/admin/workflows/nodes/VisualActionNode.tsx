import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Send, HelpCircle, MapPin, Calculator, Settings, MessageSquare, List, Clock,
} from 'lucide-react';
import { VISUAL_ACTION_LABELS } from '@/hooks/useVisualWorkflows';

const actionIcons: Record<string, any> = {
  send_message: Send,
  ask_question: HelpCircle,
  ask_location: MapPin,
  ask_address: MapPin,
  calculate_ride_fare: Calculator,
  set_custom_field: Settings,
  buttons: MessageSquare,
  list_message: List,
};

export const VisualActionNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as any;
  const Icon = actionIcons[d.actionType] || Send;
  const label = VISUAL_ACTION_LABELS[d.actionType] || d.label || 'إجراء';
  const isDelay = d.type === 'delay';

  const detail = useMemo(() => {
    const cfg = d.config || {};
    if (d.actionType === 'send_message') return cfg.message?.substring(0, 40);
    if (d.actionType === 'calculate_ride_fare') {
      return `🚕 ${cfg.vehicle_type || 'economy'}`;
    }
    if (d.actionType === 'buttons') return `${(cfg.buttons || []).length} أزرار`;
    if (isDelay) return `${d.delayAmount || 5} ${d.delayUnit === 'hours' ? 'ساعات' : d.delayUnit === 'days' ? 'أيام' : 'دقائق'}`;
    return null;
  }, [d.actionType, d.config, d.delayAmount, d.delayUnit, isDelay]);

  const bgColor = isDelay ? 'from-orange-500/10 to-orange-600/5' : 'from-emerald-500/10 to-emerald-600/5';
  const borderColor = isDelay
    ? (selected ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-orange-500/50')
    : (selected ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-emerald-500/50');
  const iconBg = isDelay ? 'bg-orange-500' : 'bg-emerald-500';
  const labelColor = isDelay ? 'text-orange-600' : 'text-emerald-600';
  const FinalIcon = isDelay ? Clock : Icon;

  return (
    <div className={`rounded-xl border-2 px-4 py-3 min-w-[180px] shadow-lg bg-gradient-to-br ${bgColor} ${borderColor}`}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white" />

      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shadow-md`}>
          <FinalIcon className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className={`text-[10px] ${labelColor} font-semibold uppercase tracking-wider`}>
            {isDelay ? 'تأخير' : 'إجراء'}
          </p>
          <p className="text-sm font-bold text-foreground">{isDelay ? 'تأخير' : label}</p>
        </div>
      </div>
      {detail && (
        <p className="text-[10px] text-muted-foreground mt-1.5 truncate max-w-[200px]">{detail}</p>
      )}
    </div>
  );
});

VisualActionNode.displayName = 'VisualActionNode';
