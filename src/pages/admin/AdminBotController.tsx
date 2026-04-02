import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bot, Code, GitBranch, CheckCircle2, AlertTriangle,
  RefreshCw, Settings, Zap, ArrowLeftRight,
} from 'lucide-react';

interface BotConfig {
  mode: 'hardcoded' | 'visual_workflow' | 'hybrid';
  active_workflow_id: string | null;
  fallback_to_hardcoded: boolean;
}

const AdminBotController: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [config, setConfig] = useState<BotConfig>({
    mode: 'hardcoded',
    active_workflow_id: null,
    fallback_to_hardcoded: true,
  });
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load config from system_configs table
  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('system_configs')
        .select('key_value')
        .eq('key_name', 'bot_controller_mode')
        .maybeSingle();

      if (error) {
        setLoadError(error.message || 'فشل تحميل الإعدادات');
        toast.error('فشل تحميل إعدادات البوت: ' + (error.message || 'تحقق من صلاحيات المدير'));
        setLoading(false);
        return;
      }

      if (data?.key_value) {
        try {
          setConfig(JSON.parse(data.key_value) as BotConfig);
        } catch {
          /* invalid JSON, keep defaults */
        }
      }

      const { data: wfData, error: wfError } = await supabase
        .from('visual_workflows')
        .select('id, name, is_active')
        .order('created_at', { ascending: false });

      if (wfError) {
        toast.error('فشل تحميل قائمة التدفقات: ' + wfError.message);
      }
      setWorkflows(wfData || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطأ غير متوقع';
      setLoadError(msg);
      toast.error('فشل تحميل إعدادات البوت: ' + msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const saveConfig = async (newConfig: BotConfig) => {
    setSaving(true);
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('system_configs')
        .select('id')
        .eq('key_name', 'bot_controller_mode')
        .maybeSingle();

      if (fetchError) throw fetchError;

      const jsonValue = JSON.stringify(newConfig);

      if (existing?.id) {
        const { error } = await supabase
          .from('system_configs')
          .update({ key_value: jsonValue })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('system_configs')
          .insert({
            key_name: 'bot_controller_mode',
            key_value: jsonValue,
            category: 'bot',
            description: 'وضع تشغيل البوت',
            is_secret: false,
          });
        if (error) throw error;
      }

      setConfig(newConfig);
      setLoadError(null);
      toast.success('تم حفظ إعدادات البوت ✅');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'خطأ غير معروف';
      toast.error('فشل في حفظ الإعدادات: ' + message);
    } finally {
      setSaving(false);
    }
  };

  const modeOptions = [
    {
      value: 'hardcoded',
      label: 'الوضع المبرمج',
      desc: 'البوت يعمل بالكود المبرمج مباشرة (whatsapp-webhook)',
      icon: Code,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10 border-blue-500/30',
    },
    {
      value: 'visual_workflow',
      label: 'التدفق المرئي',
      desc: 'البوت يعمل بالتدفقات المنشأة من Visual Workflow',
      icon: GitBranch,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10 border-emerald-500/30',
    },
    {
      value: 'hybrid',
      label: 'الوضع الهجين',
      desc: 'يجرب Visual Workflow أولاً، إن فشل يرجع للمبرمج',
      icon: ArrowLeftRight,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10 border-amber-500/30',
    },
  ];

  const activeMode = modeOptions.find(m => m.value === config.mode) || modeOptions[0];

  if (authLoading) return <AdminLayout title="البوت المتحكم"><div className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div></AdminLayout>;
  if (!isAdmin) return null;

  return (
    <AdminLayout title="البوت المتحكم" subtitle="التحكم بطريقة عمل بوت الواتساب">
      <div className="space-y-6 max-w-3xl">

        {loadError && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="py-3 flex items-center justify-between gap-3">
              <p className="text-sm text-destructive">{loadError}</p>
              <Button variant="outline" size="sm" onClick={loadConfig} disabled={loading}>
                إعادة المحاولة
              </Button>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="text-center py-4 text-muted-foreground text-sm">جارٍ التحميل...</div>
        )}

        {/* Current Status */}
        <Card className={`border-2 ${activeMode.bgColor}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl ${activeMode.bgColor} flex items-center justify-center`}>
                <activeMode.icon className={`h-7 w-7 ${activeMode.color}`} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">الوضع الحالي</p>
                <h2 className="text-xl font-bold">{activeMode.label}</h2>
                <p className="text-sm text-muted-foreground">{activeMode.desc}</p>
              </div>
              <Badge variant={config.mode === 'hardcoded' ? 'secondary' : 'default'} className="text-sm px-3 py-1">
                {config.mode === 'hardcoded' ? '🔧 مبرمج' : config.mode === 'visual_workflow' ? '🎨 مرئي' : '🔄 هجين'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Mode Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              اختيار وضع التشغيل
            </CardTitle>
            <CardDescription>حدد كيف سيستجيب البوت للعملاء عبر الواتساب</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {modeOptions.map((mode) => {
              const isSelected = config.mode === mode.value;
              return (
                <button
                  key={mode.value}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-right ${
                    isSelected
                      ? `${mode.bgColor} ring-2 ring-offset-2 ring-offset-background`
                      : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                  }`}
                  onClick={() => saveConfig({ ...config, mode: mode.value as BotConfig['mode'] })}
                  disabled={saving}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? mode.bgColor : 'bg-muted'}`}>
                    <mode.icon className={`h-5 w-5 ${isSelected ? mode.color : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm">{mode.label}</p>
                    <p className="text-xs text-muted-foreground">{mode.desc}</p>
                  </div>
                  {isSelected && <CheckCircle2 className={`h-5 w-5 ${mode.color} shrink-0`} />}
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Visual Workflow Config */}
        {(config.mode === 'visual_workflow' || config.mode === 'hybrid') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-emerald-500" />
                إعدادات التدفق المرئي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">التدفق النشط</Label>
                <Select
                  value={config.active_workflow_id || 'auto'}
                  onValueChange={(v) => saveConfig({ ...config, active_workflow_id: v === 'auto' ? null : v })}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">تلقائي (جميع التدفقات المفعّلة)</SelectItem>
                    {workflows.map((wf: any) => (
                      <SelectItem key={wf.id} value={wf.id}>
                        {wf.name} {wf.is_active ? '✅' : '⏸️'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  "تلقائي" = يشغّل كل التدفقات المفعّلة التي تطابق trigger_type
                </p>
              </div>

              {config.mode === 'hybrid' && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">الرجوع للمبرمج عند الفشل</Label>
                      <p className="text-[11px] text-muted-foreground">
                        إذا فشل التدفق المرئي، يرجع تلقائياً للوضع المبرمج
                      </p>
                    </div>
                    <Switch
                      checked={config.fallback_to_hardcoded}
                      onCheckedChange={(c) => saveConfig({ ...config, fallback_to_hardcoded: c })}
                    />
                  </div>
                </>
              )}

              {workflows.length === 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700">
                    لا توجد تدفقات مرئية بعد.{' '}
                    <button type="button" onClick={() => navigate('/admin/workflows')} className="underline font-medium">
                      أنشئ واحداً الآن
                    </button>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              إجراءات سريعة
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => navigate('/admin/workflows')}>
              <GitBranch className="h-4 w-4 me-2" />
              فتح محرر التدفقات
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/bot-customers')}>
              <Bot className="h-4 w-4 me-2" />
              عملاء البوت
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/documentation')}>
              <Code className="h-4 w-4 me-2" />
              التوثيق
            </Button>
            <Button variant="outline" onClick={loadConfig} disabled={loading}>
              <RefreshCw className={`h-4 w-4 me-2 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminBotController;
