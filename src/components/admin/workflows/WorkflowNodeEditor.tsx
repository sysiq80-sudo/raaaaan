import { useEffect, useState } from 'react';
import type { Node } from '@xyflow/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { X, Zap, GitBranch, Play, Clock, Trash2, Info } from 'lucide-react';
import {
  VISUAL_TRIGGER_TYPES, TRIGGER_LABELS,
  VISUAL_ACTION_TYPES, VISUAL_ACTION_LABELS,
  CONDITION_FIELDS, CONDITION_FIELD_LABELS,
  CONDITION_OPERATORS, CONDITION_OPERATOR_LABELS,
  type VisualWorkflowNodeData,
} from '@/hooks/useVisualWorkflows';

interface Props {
  node: Node | null;
  onUpdate: (nodeId: string, data: Partial<VisualWorkflowNodeData>) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

export function WorkflowNodeEditor({ node, onUpdate, onDelete, onClose }: Props) {
  const [localData, setLocalData] = useState<VisualWorkflowNodeData | null>(null);

  useEffect(() => {
    if (node) setLocalData(node.data as unknown as VisualWorkflowNodeData);
    else setLocalData(null);
  }, [node]);

  if (!node || !localData) return null;

  const updateConfig = (key: string, value: any) => {
    const newConfig = { ...(localData.config || {}), [key]: value };
    const updated = { ...localData, config: newConfig };
    setLocalData(updated);
    onUpdate(node.id, updated);
  };

  const updateField = (key: string, value: any) => {
    const updated = { ...localData, [key]: value };
    setLocalData(updated);
    onUpdate(node.id, updated);
  };

  const nodeType = localData.type;
  const iconMap: Record<string, any> = { trigger: Zap, condition: GitBranch, action: Play, delay: Clock };
  const Icon = iconMap[nodeType] || Zap;
  const titleMap: Record<string, string> = {
    trigger: 'إعدادات المُشغِّل',
    condition: 'إعدادات الشرط',
    action: 'إعدادات الإجراء',
    delay: 'إعدادات التأخير',
  };

  return (
    <div className="w-72 border-s bg-card/50 backdrop-blur-sm overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold">{titleMap[nodeType] || 'إعدادات'}</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      {/* Trigger */}
      {nodeType === 'trigger' && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">نوع الحدث</Label>
            <Select value={localData.triggerType || 'message_received'} onValueChange={(v) => updateField('triggerType', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISUAL_TRIGGER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{TRIGGER_LABELS[t] || t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Condition */}
      {nodeType === 'condition' && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">الحقل</Label>
            <Select value={localData.conditionField || 'message_contains'} onValueChange={(v) => updateField('conditionField', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONDITION_FIELDS.map((f) => (
                  <SelectItem key={f} value={f}>{CONDITION_FIELD_LABELS[f] || f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">المُعامِل</Label>
            <Select value={localData.conditionOperator || 'contains'} onValueChange={(v) => updateField('conditionOperator', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONDITION_OPERATORS.map((o) => (
                  <SelectItem key={o} value={o}>{CONDITION_OPERATOR_LABELS[o] || o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">القيمة</Label>
            <Input className="mt-1" value={localData.conditionValue || ''} onChange={(e) => updateField('conditionValue', e.target.value)} placeholder="القيمة..." />
          </div>

          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">بديل AI</Label>
              <p className="text-[10px] text-muted-foreground">إذا لم يتطابق شرط، أرسل للـ AI</p>
            </div>
            <Switch checked={localData.config?.ai_fallback || false} onCheckedChange={(c) => updateConfig('ai_fallback', c)} />
          </div>
          {localData.config?.ai_fallback && (
            <div>
              <Label className="text-[10px]">رسالة AI الافتراضية</Label>
              <Textarea className="mt-1 min-h-[60px] text-xs" value={localData.config?.ai_fallback_prompt || ''} onChange={(e) => updateConfig('ai_fallback_prompt', e.target.value)} placeholder="أنت مساعد تكسي ذكي..." />
            </div>
          )}
        </div>
      )}

      {/* Action  */}
      {nodeType === 'action' && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">نوع الإجراء</Label>
            <Select value={localData.actionType || 'send_message'} onValueChange={(v) => updateField('actionType', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISUAL_ACTION_TYPES.map((a) => (
                  <SelectItem key={a} value={a}>{VISUAL_ACTION_LABELS[a] || a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* send_message */}
          {localData.actionType === 'send_message' && (
            <div>
              <Label className="text-xs">نص الرسالة</Label>
              <Textarea className="mt-1 min-h-[80px]" value={localData.config?.message || ''} onChange={(e) => updateConfig('message', e.target.value)} placeholder="اكتب الرسالة..." />
              <div className="mt-2 p-2 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/20">
                <div className="flex items-center gap-1 mb-1">
                  <Info className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] font-medium text-muted-foreground">متغيرات متاحة</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['{{trigger.contact_name}}', '{{trigger.contact_phone}}', '{{trigger.message_content}}', '{{fare_result.estimated_fare}}', '{{fare_result.distance_km}}'].map((v) => (
                    <button key={v} type="button" className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-mono hover:bg-primary/20 transition-colors"
                      onClick={() => updateConfig('message', (localData.config?.message || '') + v)}>{v}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ask_question / ask_location / ask_address */}
          {['ask_question', 'ask_location', 'ask_address'].includes(localData.actionType || '') && (
            <div>
              <Label className="text-xs">نص السؤال</Label>
              <Textarea className="mt-1 min-h-[60px]" value={localData.config?.message || ''} onChange={(e) => updateConfig('message', e.target.value)} placeholder="اكتب السؤال..." />
            </div>
          )}

          {/* calculate_ride_fare */}
          {localData.actionType === 'calculate_ride_fare' && (
            <div className="space-y-3">
              <p className="text-[10px] text-muted-foreground">🚕 يحسب الأجرة بناءً على الإحداثيات</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Pickup Lat</Label>
                  <Input className="mt-0.5 h-8 text-xs font-mono" value={localData.config?.pickup_lat || ''} onChange={(e) => updateConfig('pickup_lat', e.target.value)} placeholder="{{custom_fields.pickup_lat}}" dir="ltr" />
                </div>
                <div>
                  <Label className="text-[10px]">Pickup Lng</Label>
                  <Input className="mt-0.5 h-8 text-xs font-mono" value={localData.config?.pickup_lng || ''} onChange={(e) => updateConfig('pickup_lng', e.target.value)} placeholder="{{custom_fields.pickup_lng}}" dir="ltr" />
                </div>
                <div>
                  <Label className="text-[10px]">Dropoff Lat</Label>
                  <Input className="mt-0.5 h-8 text-xs font-mono" value={localData.config?.dropoff_lat || ''} onChange={(e) => updateConfig('dropoff_lat', e.target.value)} placeholder="{{custom_fields.dropoff_lat}}" dir="ltr" />
                </div>
                <div>
                  <Label className="text-[10px]">Dropoff Lng</Label>
                  <Input className="mt-0.5 h-8 text-xs font-mono" value={localData.config?.dropoff_lng || ''} onChange={(e) => updateConfig('dropoff_lng', e.target.value)} placeholder="{{custom_fields.dropoff_lng}}" dir="ltr" />
                </div>
              </div>
              <div>
                <Label className="text-xs">نوع المركبة</Label>
                <Select value={localData.config?.vehicle_type || 'economy'} onValueChange={(v) => updateConfig('vehicle_type', v)}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="economy">اقتصادي</SelectItem>
                    <SelectItem value="comfort">مريح</SelectItem>
                    <SelectItem value="premium">مميز</SelectItem>
                    <SelectItem value="women_only">نسائي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">حفظ النتيجة في</Label>
                <Input className="mt-1 h-8 text-xs font-mono" value={localData.config?.save_to_field || 'fare_result'} onChange={(e) => updateConfig('save_to_field', e.target.value)} dir="ltr" />
                <p className="text-[9px] text-muted-foreground mt-1">{'استخدم {{fare_result.estimated_fare}} في الرسائل'}</p>
              </div>
            </div>
          )}

          {/* buttons */}
          {localData.actionType === 'buttons' && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">نص الرسالة</Label>
                <Input className="mt-1" value={localData.config?.message || ''} onChange={(e) => updateConfig('message', e.target.value)} placeholder="اختر خيار..." />
              </div>
              <p className="text-[9px] text-muted-foreground">الأزرار تُضبط في config.buttons (حد أقصى 3)</p>
            </div>
          )}
        </div>
      )}

      {/* Delay */}
      {nodeType === 'delay' && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">المدة</Label>
            <Input className="mt-1" type="number" min={1} value={localData.delayAmount || 5} onChange={(e) => updateField('delayAmount', parseInt(e.target.value) || 1)} />
          </div>
          <div>
            <Label className="text-xs">الوحدة</Label>
            <Select value={localData.delayUnit || 'minutes'} onValueChange={(v) => updateField('delayUnit', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">دقائق</SelectItem>
                <SelectItem value="hours">ساعات</SelectItem>
                <SelectItem value="days">أيام</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <Separator />

      {nodeType !== 'trigger' && (
        <Button variant="destructive" size="sm" className="w-full" onClick={() => onDelete(node.id)}>
          <Trash2 className="h-4 w-4 me-1" />
          حذف العنصر
        </Button>
      )}
    </div>
  );
}
