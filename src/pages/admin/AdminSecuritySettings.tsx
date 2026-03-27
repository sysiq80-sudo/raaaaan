import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Save,
  RefreshCw,
  MessageCircle,
  Car,
  Clock,
  Target,
  Info,
} from "lucide-react";

interface SecuritySettings {
  whatsapp_rate_limit_per_minute: number;
  whatsapp_voice_rate_limit_per_minute: number;
  max_active_rides_per_user: number;
  ride_creation_cooldown_seconds: number;
  max_failed_match_attempts: number;
}

const DEFAULTS: SecuritySettings = {
  whatsapp_rate_limit_per_minute: 10,
  whatsapp_voice_rate_limit_per_minute: 3,
  max_active_rides_per_user: 3,
  ride_creation_cooldown_seconds: 60,
  max_failed_match_attempts: 5,
};

export default function AdminSecuritySettings() {
  const { isAdmin } = useAdminAuth();
  const { toast } = useToast();

  const [settings, setSettings] = useState<SecuritySettings>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ═══════════════════════════════════
  // تحميل الإعدادات
  // ═══════════════════════════════════
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "security_settings")
        .maybeSingle();

      if (!error && data?.value) {
        setSettings({ ...DEFAULTS, ...(data.value as Partial<SecuritySettings>) });
      }
    } catch (e) {
      console.error("Failed to load security settings:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchSettings();
  }, [isAdmin]);

  // ═══════════════════════════════════
  // حفظ الإعدادات
  // ═══════════════════════════════════
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("app_settings")
        .upsert(
          {
            key: "security_settings",
            value: settings,
            description: "إعدادات الأمان والحدود — قابلة للتعديل من لوحة التحكم",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );

      if (error) throw error;

      toast({
        title: "تم الحفظ بنجاح ✓",
        description: "تم تحديث إعدادات الأمان والحدود. ستؤثر التغييرات خلال 5 دقائق.",
      });
    } catch (e: any) {
      console.error("Save failed:", e);
      toast({
        title: "فشل الحفظ",
        description: e.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // ═══════════════════════════════════
  // إعادة تعيين للقيم الافتراضية
  // ═══════════════════════════════════
  const handleReset = () => {
    setSettings({ ...DEFAULTS });
    toast({
      title: "تم إعادة التعيين",
      description: "تم الرجوع للقيم الافتراضية — اضغط حفظ لتطبيقها.",
    });
  };

  const updateField = (field: keyof SecuritySettings, value: number) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <AdminLayout
      title="الأمان والحدود"
      subtitle="إعدادات حماية النظام وحدود الاستخدام — قابلة للتعديل في أي وقت"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={saving}>
            <RefreshCw className="w-4 h-4 ml-2" />
            إعادة تعيين
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 ml-2" />
            )}
            حفظ الإعدادات
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* ═══════════════════════════════════ */}
          {/* حدود واتساب */}
          {/* ═══════════════════════════════════ */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">حدود واتساب</CardTitle>
                  <CardDescription>
                    تقييد عدد الرسائل لكل مستخدم
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="wa-text-limit" className="flex items-center gap-2">
                  الحد الأقصى للرسائل في الدقيقة
                  <Badge variant="outline" className="text-xs">
                    نصوص + مواقع
                  </Badge>
                </Label>
                <Input
                  id="wa-text-limit"
                  type="number"
                  min={1}
                  max={100}
                  value={settings.whatsapp_rate_limit_per_minute}
                  onChange={(e) =>
                    updateField("whatsapp_rate_limit_per_minute", parseInt(e.target.value) || 10)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  يشمل الرسائل النصية ومشاركة المواقع — الافتراضي: 10
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wa-voice-limit" className="flex items-center gap-2">
                  الحد الأقصى للرسائل الصوتية في الدقيقة
                  <Badge variant="outline" className="text-xs">
                    صوتيات
                  </Badge>
                </Label>
                <Input
                  id="wa-voice-limit"
                  type="number"
                  min={1}
                  max={30}
                  value={settings.whatsapp_voice_rate_limit_per_minute}
                  onChange={(e) =>
                    updateField("whatsapp_voice_rate_limit_per_minute", parseInt(e.target.value) || 3)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  الرسائل الصوتية تستهلك API أكثر (Whisper + GPT) — الافتراضي: 3
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ═══════════════════════════════════ */}
          {/* حدود الرحلات */}
          {/* ═══════════════════════════════════ */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Car className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">حدود الرحلات</CardTitle>
                  <CardDescription>
                    منع الإساءة في إنشاء الرحلات
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="max-active-rides">
                  الحد الأقصى للرحلات النشطة لكل مستخدم
                </Label>
                <Input
                  id="max-active-rides"
                  type="number"
                  min={1}
                  max={10}
                  value={settings.max_active_rides_per_user}
                  onChange={(e) =>
                    updateField("max_active_rides_per_user", parseInt(e.target.value) || 3)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  يشمل الرحلات المعلقة والمقبولة والجارية — الافتراضي: 3
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cooldown" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  فترة الانتظار بين الرحلات (ثانية)
                </Label>
                <Input
                  id="cooldown"
                  type="number"
                  min={0}
                  max={600}
                  value={settings.ride_creation_cooldown_seconds}
                  onChange={(e) =>
                    updateField("ride_creation_cooldown_seconds", parseInt(e.target.value) || 60)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  يمنع إنشاء رحلات متتالية بسرعة — الافتراضي: 60 ثانية
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ═══════════════════════════════════ */}
          {/* حدود المطابقة */}
          {/* ═══════════════════════════════════ */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Target className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">حدود المطابقة</CardTitle>
                  <CardDescription>
                    التحكم في عملية مطابقة السائقين
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="max-match-attempts">
                  الحد الأقصى لمحاولات المطابقة الفاشلة
                </Label>
                <Input
                  id="max-match-attempts"
                  type="number"
                  min={1}
                  max={20}
                  value={settings.max_failed_match_attempts}
                  onChange={(e) =>
                    updateField("max_failed_match_attempts", parseInt(e.target.value) || 5)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  بعد هذا العدد يتم إلغاء الرحلة تلقائياً — الافتراضي: 5
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ═══════════════════════════════════ */}
          {/* معلومات */}
          {/* ═══════════════════════════════════ */}
          <Card className="md:col-span-2 lg:col-span-3 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    <strong>ملاحظة:</strong> التغييرات تؤثر خلال <strong>5 دقائق</strong> كحد أقصى على Edge Functions (بسبب الكاش).
                  </p>
                  <p>
                    حدود واتساب تعمل على مستوى رقم الهاتف — إذا تجاوز المستخدم الحد، يتم تجاهل رسائله مؤقتاً مع إرجاع 200 لـ Meta.
                  </p>
                  <p>
                    حدود الرحلات تُفحص في الواجهة الأمامية <strong>و</strong> في الخادم (match-ride) — حماية مزدوجة.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}
