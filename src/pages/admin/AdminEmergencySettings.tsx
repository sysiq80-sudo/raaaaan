/**
 * صفحة إعدادات نظام الطوارئ - Admin Emergency Settings
 * إدارة إعدادات الكشف عن التوقف والحدود الزمنية
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, RotateCcw, AlertTriangle } from "lucide-react";

interface SystemSetting {
  key: string;
  value: string | number | boolean | null;
  description: string;
}

const AdminEmergencySettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // الإعدادات
  const [detectionInterval, setDetectionInterval] = useState("3");
  const [warningThreshold, setWarningThreshold] = useState("5");
  const [criticalThreshold, setCriticalThreshold] = useState("10");
  const [distanceThreshold, setDistanceThreshold] = useState("50");
  const [abuseLimit, setAbuseLimit] = useState("3");

  useAdminAuth();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .in('key', [
          'dual_stop_detection_interval',
          'dual_stop_warning_threshold',
          'dual_stop_critical_threshold',
          'dual_stop_distance_threshold',
          'emergency_abuse_limit'
        ]);

      if (error) throw error;

      if (data) {
        data.forEach((setting) => {
          const val = String(setting.value);
          switch (setting.key) {
            case 'dual_stop_detection_interval':
              setDetectionInterval(val);
              break;
            case 'dual_stop_warning_threshold':
              setWarningThreshold(val);
              break;
            case 'dual_stop_critical_threshold':
              setCriticalThreshold(val);
              break;
            case 'dual_stop_distance_threshold':
              setDistanceThreshold(val);
              break;
            case 'emergency_abuse_limit':
              setAbuseLimit(val);
              break;
          }
        });
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast({
        title: "خطأ في التحميل",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // التحقق من القيم
    if (parseInt(warningThreshold) >= parseInt(criticalThreshold)) {
      toast({
        title: "قيم غير صحيحة",
        description: "يجب أن يكون الحد الحرج أكبر من حد التحذير",
        variant: "destructive",
      });
      return;
    }

    if (parseInt(detectionInterval) < 1 || parseInt(detectionInterval) > 10) {
      toast({
        title: "قيم غير صحيحة",
        description: "فترة الكشف يجب أن تكون بين 1 و 10 دقائق",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const updates = [
        { key: 'dual_stop_detection_interval', value: detectionInterval },
        { key: 'dual_stop_warning_threshold', value: warningThreshold },
        { key: 'dual_stop_critical_threshold', value: criticalThreshold },
        { key: 'dual_stop_distance_threshold', value: distanceThreshold },
        { key: 'emergency_abuse_limit', value: abuseLimit },
      ];

      const results = await Promise.all(
        updates.map(u =>
          supabase.from('app_settings').update({ value: u.value }).eq('key', u.key)
        )
      );
      const failed = results.find(r => r.error);
      if (failed?.error) throw failed.error;

      toast({
        title: "✅ تم الحفظ",
        description: "تم تحديث الإعدادات بنجاح",
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: "خطأ في الحفظ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDetectionInterval("3");
    setWarningThreshold("5");
    setCriticalThreshold("10");
    setDistanceThreshold("50");
    setAbuseLimit("3");
    
    toast({
      title: "تمت الاستعادة محلياً",
      description: "تمت استعادة القيم الافتراضية — اضغط حفظ لتطبيقها على قاعدة البيانات",
    });
  };

  if (loading) {
    return (
      <AdminLayout title="إعدادات نظام الطوارئ" subtitle="تخصيص معايير الكشف عن التوقف">
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="إعدادات نظام الطوارئ" subtitle="تخصيص معايير الكشف عن التوقف">
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold">إعدادات نظام الطوارئ</h1>
          <p className="text-muted-foreground">
            تخصيص معايير الكشف عن التوقف والحدود الزمنية
          </p>
        </div>

        {/* تحذير */}
        <Card className="border-yellow-500">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">تحذير هام</p>
              <p className="text-sm text-muted-foreground mt-1">
                تغيير هذه الإعدادات سيؤثر على نظام الكشف عن الرحلات المتوقفة.
                الرجاء التأكد من القيم قبل الحفظ.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* إعدادات الكشف */}
        <Card>
          <CardHeader>
            <CardTitle>إعدادات الكشف عن التوقف</CardTitle>
            <CardDescription>
              معايير الكشف عن الرحلات التي توقفت لفترة طويلة
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="detection-interval">
                فترة الكشف (دقائق)
              </Label>
              <Input
                id="detection-interval"
                type="number"
                min="1"
                max="10"
                value={detectionInterval}
                onChange={(e) => setDetectionInterval(e.target.value)}
                placeholder="3"
              />
              <p className="text-xs text-muted-foreground">
                كل كم دقيقة يتم البحث عن رحلات متوقفة (افتراضي: 3)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="warning-threshold">
                  حد التحذير (دقائق)
                </Label>
                <Input
                  id="warning-threshold"
                  type="number"
                  min="1"
                  max="30"
                  value={warningThreshold}
                  onChange={(e) => setWarningThreshold(e.target.value)}
                  placeholder="5"
                />
                <p className="text-xs text-muted-foreground">
                  مدة التوقف لإصدار تحذير (افتراضي: 5)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="critical-threshold">
                  الحد الحرج (دقائق)
                </Label>
                <Input
                  id="critical-threshold"
                  type="number"
                  min="5"
                  max="60"
                  value={criticalThreshold}
                  onChange={(e) => setCriticalThreshold(e.target.value)}
                  placeholder="10"
                />
                <p className="text-xs text-muted-foreground">
                  مدة التوقف لإصدار تنبيه حرج (افتراضي: 10)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="distance-threshold">
                حد المسافة (متر)
              </Label>
              <Input
                id="distance-threshold"
                type="number"
                min="10"
                max="200"
                value={distanceThreshold}
                onChange={(e) => setDistanceThreshold(e.target.value)}
                placeholder="50"
              />
              <p className="text-xs text-muted-foreground">
                المسافة القصوى بين السائق والراكب لاعتبارهما متوقفين معاً (افتراضي: 50)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* إعدادات الإساءة */}
        <Card>
          <CardHeader>
            <CardTitle>حماية من إساءة الاستخدام</CardTitle>
            <CardDescription>
              الحدود لمنع استخدام زر الطوارئ بشكل عشوائي
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="abuse-limit">
                الحد الأسبوعي للاستخدام
              </Label>
              <Input
                id="abuse-limit"
                type="number"
                min="1"
                max="10"
                value={abuseLimit}
                onChange={(e) => setAbuseLimit(e.target.value)}
                placeholder="3"
              />
              <p className="text-xs text-muted-foreground">
                عدد مرات استخدام زر الطوارئ المسموح بها خلال 7 أيام (افتراضي: 3)
              </p>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">كيف يعمل هذا؟</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>يتم حساب عدد الاستخدامات خلال آخر 7 أيام</li>
                <li>عند تجاوز الحد، يتم منع المستخدم مؤقتاً</li>
                <li>يتلقى المستخدم رسالة توضيحية</li>
                <li>يمكن للمدير مراجعة الحالات الخاصة يدوياً</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* الأزرار */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 ml-2" />
            )}
            حفظ التغييرات
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            disabled={saving}
          >
            <RotateCcw className="w-4 h-4 ml-2" />
            استعادة الافتراضي
          </Button>
        </div>

        {/* معاينة الإعدادات */}
        <Card>
          <CardHeader>
            <CardTitle>معاينة الإعدادات الحالية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">فترة الكشف:</p>
                <p className="font-medium">كل {detectionInterval} دقيقة</p>
              </div>
              <div>
                <p className="text-muted-foreground">حد التحذير:</p>
                <p className="font-medium">{warningThreshold} دقيقة</p>
              </div>
              <div>
                <p className="text-muted-foreground">الحد الحرج:</p>
                <p className="font-medium">{criticalThreshold} دقيقة</p>
              </div>
              <div>
                <p className="text-muted-foreground">حد المسافة:</p>
                <p className="font-medium">{distanceThreshold} متر</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">الحد الأسبوعي:</p>
                <p className="font-medium">{abuseLimit} استخدامات في 7 أيام</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminEmergencySettings;
