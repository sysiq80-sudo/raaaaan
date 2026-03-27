import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { DriverRegistrationSettings as SettingsType } from "@/hooks/useDriverRegSettings";
import AdminLayout from "@/components/admin/AdminLayout";

export default function DriverRegistrationSettings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("driver_registration_settings")
        .select("*")
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("فشل تحميل الإعدادات");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from("driver_registration_settings")
        .update(settings)
        .eq("id", settings.id);

      if (error) throw error;
      
      toast.success("تم حفظ الإعدادات بنجاح");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("فشل حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof SettingsType, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">لا توجد إعدادات</p>
      </div>
    );
  }

  return (
    <AdminLayout title="إعدادات تسجيل السائقين">
    <div className="container mx-auto p-6 max-w-5xl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">إعدادات تسجيل السائقين</h1>
          <p className="text-muted-foreground mt-1">تحكم في كل نصوص وأرقام صفحة التسجيل</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Save className="ml-2 h-4 w-4" />
              حفظ التغييرات
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">الإعدادات العامة</TabsTrigger>
          <TabsTrigger value="promo">العرض الترويجي</TabsTrigger>
          <TabsTrigger value="paid">التسجيل المدفوع</TabsTrigger>
        </TabsList>

        {/* General Settings Tab */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>الإعدادات العامة</CardTitle>
              <CardDescription>تفعيل/تعطيل العروض وتواريخها</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enable_promo">تفعيل العرض الترويجي</Label>
                <Switch
                  id="enable_promo"
                  checked={settings.enable_promo}
                  onCheckedChange={(checked) => updateField('enable_promo', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="promo_end_date">تاريخ انتهاء العرض</Label>
                <Input
                  id="promo_end_date"
                  type="datetime-local"
                  value={settings.promo_end_date?.slice(0, 16) || ''}
                  onChange={(e) => updateField('promo_end_date', new Date(e.target.value).toISOString())}
                />
                <p className="text-xs text-muted-foreground">
                  التاريخ الحالي: {new Date(settings.promo_end_date).toLocaleString('ar-IQ')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="terms_text">نص الشروط والأحكام</Label>
                <Input
                  id="terms_text"
                  value={settings.terms_text}
                  onChange={(e) => updateField('terms_text', e.target.value)}
                  dir="rtl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="countdown_text">نص العد التنازلي</Label>
                  <Input
                    id="countdown_text"
                    value={settings.countdown_text}
                    onChange={(e) => updateField('countdown_text', e.target.value)}
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="days_text">نص "يوم"</Label>
                  <Input
                    id="days_text"
                    value={settings.days_text}
                    onChange={(e) => updateField('days_text', e.target.value)}
                    dir="rtl"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Promo Settings Tab */}
        <TabsContent value="promo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات العرض الترويجي</CardTitle>
              <CardDescription>نصوص وأرقام التسجيل المجاني</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="promo_title">العنوان الرئيسي</Label>
                <Input
                  id="promo_title"
                  value={settings.promo_title}
                  onChange={(e) => updateField('promo_title', e.target.value)}
                  dir="rtl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="promo_subtitle">العنوان الفرعي</Label>
                <Input
                  id="promo_subtitle"
                  value={settings.promo_subtitle}
                  onChange={(e) => updateField('promo_subtitle', e.target.value)}
                  dir="rtl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="promo_activation_fee">رسوم التفعيل (دينار)</Label>
                  <Input
                    id="promo_activation_fee"
                    type="number"
                    value={settings.promo_activation_fee}
                    onChange={(e) => updateField('promo_activation_fee', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promo_bonus_amount">مبلغ المكافأة (دينار)</Label>
                  <Input
                    id="promo_bonus_amount"
                    type="number"
                    value={settings.promo_bonus_amount}
                    onChange={(e) => updateField('promo_bonus_amount', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="promo_activation_fee_text">نص رسوم التفعيل</Label>
                <Input
                  id="promo_activation_fee_text"
                  value={settings.promo_activation_fee_text}
                  onChange={(e) => updateField('promo_activation_fee_text', e.target.value)}
                  dir="rtl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="promo_bonus_text">نص المكافأة</Label>
                <Input
                  id="promo_bonus_text"
                  value={settings.promo_bonus_text}
                  onChange={(e) => updateField('promo_bonus_text', e.target.value)}
                  dir="rtl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="promo_urgency_text">نص الإلحاح</Label>
                <Textarea
                  id="promo_urgency_text"
                  value={settings.promo_urgency_text}
                  onChange={(e) => updateField('promo_urgency_text', e.target.value)}
                  dir="rtl"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="promo_button_text">نص الزر</Label>
                <Input
                  id="promo_button_text"
                  value={settings.promo_button_text}
                  onChange={(e) => updateField('promo_button_text', e.target.value)}
                  dir="rtl"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Paid Settings Tab */}
        <TabsContent value="paid" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات التسجيل المدفوع</CardTitle>
              <CardDescription>نصوص وأرقام التسجيل بعد انتهاء العرض</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paid_title">العنوان الرئيسي</Label>
                <Input
                  id="paid_title"
                  value={settings.paid_title}
                  onChange={(e) => updateField('paid_title', e.target.value)}
                  dir="rtl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paid_subtitle">العنوان الفرعي</Label>
                <Input
                  id="paid_subtitle"
                  value={settings.paid_subtitle}
                  onChange={(e) => updateField('paid_subtitle', e.target.value)}
                  dir="rtl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paid_activation_fee">رسوم التفعيل (دينار)</Label>
                  <Input
                    id="paid_activation_fee"
                    type="number"
                    value={settings.paid_activation_fee}
                    onChange={(e) => updateField('paid_activation_fee', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paid_wallet_bonus">مكافأة المحفظة (دينار)</Label>
                  <Input
                    id="paid_wallet_bonus"
                    type="number"
                    value={settings.paid_wallet_bonus}
                    onChange={(e) => updateField('paid_wallet_bonus', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paid_wallet_bonus_text">نص مكافأة المحفظة</Label>
                <Input
                  id="paid_wallet_bonus_text"
                  value={settings.paid_wallet_bonus_text}
                  onChange={(e) => updateField('paid_wallet_bonus_text', e.target.value)}
                  dir="rtl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paid_challenge_rides">عدد رحلات التحدي</Label>
                  <Input
                    id="paid_challenge_rides"
                    type="number"
                    value={settings.paid_challenge_rides}
                    onChange={(e) => updateField('paid_challenge_rides', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paid_challenge_bonus">مكافأة التحدي (دينار)</Label>
                  <Input
                    id="paid_challenge_bonus"
                    type="number"
                    value={settings.paid_challenge_bonus}
                    onChange={(e) => updateField('paid_challenge_bonus', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paid_challenge_text">نص التحدي</Label>
                <Textarea
                  id="paid_challenge_text"
                  value={settings.paid_challenge_text}
                  onChange={(e) => updateField('paid_challenge_text', e.target.value)}
                  dir="rtl"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paid_summary_text">نص الملخص</Label>
                <Input
                  id="paid_summary_text"
                  value={settings.paid_summary_text}
                  onChange={(e) => updateField('paid_summary_text', e.target.value)}
                  dir="rtl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paid_warning_text">نص التحذير</Label>
                <Input
                  id="paid_warning_text"
                  value={settings.paid_warning_text}
                  onChange={(e) => updateField('paid_warning_text', e.target.value)}
                  dir="rtl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paid_button_text">نص الزر</Label>
                <Input
                  id="paid_button_text"
                  value={settings.paid_button_text}
                  onChange={(e) => updateField('paid_button_text', e.target.value)}
                  dir="rtl"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sticky Save Button */}
      <div className="fixed bottom-6 left-6">
        <Button onClick={handleSave} disabled={saving} size="lg" className="shadow-lg">
          {saving ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Save className="ml-2 h-4 w-4" />
              حفظ التغييرات
            </>
          )}
        </Button>
      </div>
    </div>
    </AdminLayout>
  );
}
