import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Bug, 
  Database, 
  BarChart3, 
  Bell,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Zap
} from "lucide-react";

interface IntegrationConfig {
  sentry_dsn: string;
  upstash_redis_url: string;
  upstash_redis_token: string;
  posthog_key: string;
  posthog_host: string;
}

const defaultConfig: IntegrationConfig = {
  sentry_dsn: "",
  upstash_redis_url: "",
  upstash_redis_token: "",
  posthog_key: "",
  posthog_host: "https://app.posthog.com"
};

const IntegrationsSettingsTab = () => {
  const [config, setConfig] = useState<IntegrationConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'integrations')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data?.value) {
        const savedConfig = data.value as unknown as Partial<IntegrationConfig>;
        setConfig({ ...defaultConfig, ...savedConfig });
      }
    } catch (error) {
      console.error('Error fetching integrations config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Check if setting exists
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'integrations')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('app_settings')
          .update({ value: JSON.parse(JSON.stringify(config)), updated_at: new Date().toISOString() })
          .eq('key', 'integrations');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert({ 
            key: 'integrations', 
            value: JSON.parse(JSON.stringify(config)),
            description: 'إعدادات التكاملات الخارجية (Sentry, Upstash, PostHog)'
          });
        if (error) throw error;
      }

      toast.success("تم حفظ إعدادات التكاملات بنجاح");
    } catch (error) {
      console.error('Error saving integrations config:', error);
      toast.error("فشل في حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  };

  const toggleShowSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isConfigured = (value: string) => value && value.trim().length > 0;

  const IntegrationStatus = ({ configured }: { configured: boolean }) => (
    configured ? (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
        <CheckCircle2 className="w-3 h-3 ml-1" />
        مُفعّل
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
        <AlertCircle className="w-3 h-3 ml-1" />
        غير مُفعّل
      </Badge>
    )
  );

  const SecretInput = ({ 
    id, 
    value, 
    onChange, 
    placeholder 
  }: { 
    id: string; 
    value: string; 
    onChange: (value: string) => void;
    placeholder: string;
  }) => (
    <div className="relative">
      <Input
        id={id}
        type={showSecrets[id] ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10 font-mono text-sm"
        dir="ltr"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
        onClick={() => toggleShowSecret(id)}
      >
        {showSecrets[id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </Button>
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">التكاملات الخارجية</h3>
          <p className="text-sm text-muted-foreground">ربط أدوات المراقبة والتحليلات</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <RefreshCw className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
          حفظ التكاملات
        </Button>
      </div>

      {/* Sentry - Error Monitoring */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Bug className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-base">Sentry</CardTitle>
                <CardDescription>مراقبة الأخطاء والمشاكل التقنية</CardDescription>
              </div>
            </div>
            <IntegrationStatus configured={isConfigured(config.sentry_dsn)} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sentry يساعدك في اكتشاف الأخطاء البرمجية قبل أن يشتكي العملاء. يوفر تفاصيل كاملة عن كل خطأ مع تتبع رحلة المستخدم.
          </p>
          
          <div className="space-y-2">
            <Label htmlFor="sentry_dsn">Sentry DSN</Label>
            <SecretInput
              id="sentry_dsn"
              value={config.sentry_dsn}
              onChange={(value) => setConfig({ ...config, sentry_dsn: value })}
              placeholder="https://xxx@xxx.ingest.sentry.io/xxx"
            />
            <p className="text-xs text-muted-foreground">
              احصل على DSN من{" "}
              <a 
                href="https://sentry.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                sentry.io
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Upstash Redis - Real-time Driver Locations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Database className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-base">Upstash Redis</CardTitle>
                <CardDescription>تخزين مواقع السائقين اللحظية</CardDescription>
              </div>
            </div>
            <IntegrationStatus configured={isConfigured(config.upstash_redis_url) && isConfigured(config.upstash_redis_token)} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upstash Redis يسرّع البحث عن أقرب سائق بشكل مذهل (أقل من 1ms) ويقلل الضغط على قاعدة البيانات الرئيسية.
          </p>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="upstash_redis_url">Redis URL</Label>
              <SecretInput
                id="upstash_redis_url"
                value={config.upstash_redis_url}
                onChange={(value) => setConfig({ ...config, upstash_redis_url: value })}
                placeholder="https://xxx.upstash.io"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="upstash_redis_token">Redis Token</Label>
              <SecretInput
                id="upstash_redis_token"
                value={config.upstash_redis_token}
                onChange={(value) => setConfig({ ...config, upstash_redis_token: value })}
                placeholder="AXxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            
            <p className="text-xs text-muted-foreground">
              احصل على المفاتيح من{" "}
              <a 
                href="https://upstash.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                upstash.com
                <ExternalLink className="w-3 h-3" />
              </a>
              {" "}(مجاني حتى 10,000 طلب/يوم)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* PostHog - User Analytics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <BarChart3 className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base">PostHog</CardTitle>
                <CardDescription>تحليلات سلوك المستخدمين</CardDescription>
              </div>
            </div>
            <IntegrationStatus configured={isConfigured(config.posthog_key)} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            PostHog يساعدك في فهم سلوك المستخدمين: أين يتوقفون؟ ما الذي يجعلهم يلغون الرحلة؟ كيف تحسّن تجربتهم؟
          </p>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="posthog_key">PostHog API Key</Label>
              <SecretInput
                id="posthog_key"
                value={config.posthog_key}
                onChange={(value) => setConfig({ ...config, posthog_key: value })}
                placeholder="phc_xxxxxxxxxxxxxxxxxx"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="posthog_host">PostHog Host (اختياري)</Label>
              <Input
                id="posthog_host"
                value={config.posthog_host}
                onChange={(e) => setConfig({ ...config, posthog_host: e.target.value })}
                placeholder="https://app.posthog.com"
                dir="ltr"
                className="font-mono text-sm"
              />
            </div>
            
            <p className="text-xs text-muted-foreground">
              احصل على المفتاح من{" "}
              <a 
                href="https://posthog.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                posthog.com
                <ExternalLink className="w-3 h-3" />
              </a>
              {" "}(مجاني حتى 1 مليون حدث/شهر)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Summary Section */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-500 mt-0.5" />
            <div className="space-y-2">
              <p className="font-medium">ملاحظة مهمة</p>
              <p className="text-sm text-muted-foreground">
                بعد إضافة المفاتيح هنا، يجب أيضاً إضافتها كـ Secrets في Supabase Edge Functions 
                لتعمل الخدمات بشكل صحيح. اذهب إلى{" "}
                <a 
                  href="https://supabase.com/dashboard/project/wgolkcztdrwdphwjvqxt/settings/functions" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  إعدادات Edge Functions
                </a>
                {" "}لإضافة:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li><code className="bg-muted px-1 rounded">SENTRY_DSN</code></li>
                <li><code className="bg-muted px-1 rounded">UPSTASH_REDIS_URL</code></li>
                <li><code className="bg-muted px-1 rounded">UPSTASH_REDIS_TOKEN</code></li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationsSettingsTab;
