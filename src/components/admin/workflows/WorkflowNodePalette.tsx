import { useState } from 'react';
import {
  Zap, GitBranch, Play, Clock, GripVertical,
  Send, HelpCircle, MapPin, Calculator, Settings, MessageSquare, List,
  ChevronDown,
} from 'lucide-react';

interface PaletteItem {
  type: string;
  nodeType: string;
  label: string;
  description: string;
  icon: any;
  color: string;
  bgColor: string;
}

interface PaletteGroup {
  title: string;
  icon: any;
  items: PaletteItem[];
}

const PALETTE_GROUPS: PaletteGroup[] = [
  {
    title: 'أساسي',
    icon: Zap,
    items: [
      { type: 'trigger', nodeType: 'visualTrigger', label: 'مُشغِّل', description: 'بداية التدفق', icon: Zap, color: 'text-blue-500', bgColor: 'bg-blue-500/10 border-blue-500/30 hover:border-blue-500/60' },
      { type: 'condition', nodeType: 'visualCondition', label: 'شرط', description: 'تفريع بناءً على شرط', icon: GitBranch, color: 'text-amber-500', bgColor: 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60' },
      { type: 'delay', nodeType: 'visualAction', label: 'تأخير', description: 'انتظار مدة زمنية', icon: Clock, color: 'text-orange-500', bgColor: 'bg-orange-500/10 border-orange-500/30 hover:border-orange-500/60' },
    ],
  },
  {
    title: 'رسائل',
    icon: Send,
    items: [
      { type: 'send_message', nodeType: 'visualAction', label: 'إرسال رسالة', description: 'رسالة نصية واتساب', icon: Send, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60' },
      { type: 'ask_question', nodeType: 'visualAction', label: 'طرح سؤال', description: 'سؤال ينتظر إجابة', icon: HelpCircle, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60' },
      { type: 'ask_location', nodeType: 'visualAction', label: 'طلب موقع', description: 'طلب GPS', icon: MapPin, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60' },
      { type: 'ask_address', nodeType: 'visualAction', label: 'طلب عنوان', description: 'كتابة العنوان', icon: MapPin, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60' },
      { type: 'buttons', nodeType: 'visualAction', label: 'أزرار اختيار', description: 'أزرار سريعة', icon: MessageSquare, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60' },
      { type: 'list_message', nodeType: 'visualAction', label: 'قائمة اختيار', description: 'قائمة خيارات', icon: List, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60' },
    ],
  },
  {
    title: 'تكسي 🚕',
    icon: Calculator,
    items: [
      { type: 'calculate_ride_fare', nodeType: 'visualAction', label: 'حساب أجرة التكسي', description: 'حساب الأجرة بناءً على المسافة', icon: Calculator, color: 'text-yellow-600', bgColor: 'bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/60' },
    ],
  },
  {
    title: 'أدوات',
    icon: Settings,
    items: [
      { type: 'set_custom_field', nodeType: 'visualAction', label: 'تعيين حقل', description: 'حفظ قيمة مخصصة', icon: Settings, color: 'text-gray-500', bgColor: 'bg-gray-500/10 border-gray-500/30 hover:border-gray-500/60' },
    ],
  },
];

export const PALETTE_ACTION_MAP: Record<string, string> = {
  send_message: 'send_message',
  ask_question: 'ask_question',
  ask_location: 'ask_location',
  ask_address: 'ask_address',
  calculate_ride_fare: 'calculate_ride_fare',
  set_custom_field: 'set_custom_field',
  buttons: 'buttons',
  list_message: 'list_message',
};

interface WorkflowNodePaletteProps {
  onClose?: () => void;
}

export function WorkflowNodePalette({ onClose }: WorkflowNodePaletteProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(PALETTE_GROUPS.map(g => [g.title, true]))
  );

  const onDragStart = (e: React.DragEvent, item: PaletteItem) => {
    e.dataTransfer.setData('application/reactflow-type', item.nodeType);
    e.dataTransfer.setData('application/reactflow-subtype', item.type);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 border-e bg-card/50 backdrop-blur-sm overflow-y-auto p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">عناصر التدفق</h3>
      </div>

      {PALETTE_GROUPS.map((group) => (
        <div key={group.title}>
          <button
            className="flex items-center gap-2 w-full text-xs font-semibold text-muted-foreground hover:text-foreground py-1"
            onClick={() => setExpandedGroups(prev => ({ ...prev, [group.title]: !prev[group.title] }))}
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${expandedGroups[group.title] ? '' : '-rotate-90'}`} />
            <group.icon className="h-3.5 w-3.5" />
            {group.title}
          </button>

          {expandedGroups[group.title] && (
            <div className="space-y-1 mt-1">
              {group.items.map((item) => (
                <div
                  key={item.type}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-grab transition-all ${item.bgColor}`}
                  draggable
                  onDragStart={(e) => onDragStart(e, item)}
                >
                  <GripVertical className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  <item.icon className={`h-4 w-4 ${item.color} shrink-0`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{item.label}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
