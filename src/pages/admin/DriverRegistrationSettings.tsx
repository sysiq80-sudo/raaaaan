import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

interface DriverRegistrationSettings {
  id: string;
  // Page Title and Description
  page_title: string;
  page_subtitle: string;
  
  // Hero Section
  hero_title: string;
  hero_description: string;
  
  // Requirements Section
  requirements_title: string;
  min_age: number;
  min_age_text: string;
  license_requirement: string;
  vehicle_requirement: string;
  insurance_requirement: string;
  
  // Benefits Section
  benefits_title: string;
  benefit_1_title: string;
  benefit_1_description: string;
  benefit_2_title: string;
  benefit_2_description: string;
  benefit_3_title: string;
  benefit_3_description: string;
  benefit_4_title: string;
  benefit_4_description: string;
  
  // Commission and Earnings
  commission_rate: number;
  commission_text: string;
  estimated_earnings_min: number;
  estimated_earnings_max: number;
  earnings_text: string;
  
  // Form Section
  form_title: string;
  form_description: string;
  
  // Contact Section
  contact_title: string;
  contact_phone: string;
  contact_email: string;
  contact_hours: string;
  
  // Status
  is_active: boolean;
  registration_enabled: boolean;
  maintenance_message: string | null;
}

export default function DriverRegistrationSettings() {
  const [settings, setSettings] = useState<DriverRegistrationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

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
      toast({
        title: "خطأ",
        description: "فشل تحميل الإعدادات",
        variant: "destructive",
      });
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

      toast({
        title: "نجح",
        description: "تم حفظ الإعدادات بنجاح",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "خطأ",
        description: "فشل حفظ الإعدادات",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof DriverRegistrationSettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">لا توجد إعدادات متاحة</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">إعدادات صفحة تسجيل السائقين</h1>
        <p className="text-muted-foreground mt-2">
          إدارة جميع محتويات وإعدادات صفحة تسجيل السائقين
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="main" className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="main">الإعدادات الرئيسية</TabsTrigger>
              <TabsTrigger value="benefits">المزايا</TabsTrigger>
              <TabsTrigger value="requirements">المتطلبات</TabsTrigger>
              <TabsTrigger value="contact">معلومات الاتصال</TabsTrigger>
              <TabsTrigger value="status">الحالة</TabsTrigger>
            </TabsList>

            {/* Main Settings Tab */}
            <TabsContent value="main" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Page Title */}
                <div className="space-y-2">
                  <Label htmlFor="page_title">عنوان الصفحة</Label>
                  <Input
                    id="page_title"
                    value={settings.page_title}
                    onChange={(e) => updateField("page_title", e.target.value)}
                    className="text-right"
                  />
                </div>

                {/* Page Subtitle */}
                <div className="space-y-2">
                  <Label htmlFor="page_subtitle">عنوان فرعي للصفحة</Label>
                  <Input
                    id="page_subtitle"
                    value={settings.page_subtitle}
                    onChange={(e) => updateField("page_subtitle", e.target.value)}
                    className="text-right"
                  />
                </div>

                {/* Hero Title */}
                <div className="space-y-2">
                  <Label htmlFor="hero_title">عنوان البطل</Label>
                  <Input
                    id="hero_title"
                    value={settings.hero_title}
                    onChange={(e) => updateField("hero_title", e.target.value)}
                    className="text-right"
                  />
                </div>

                {/* Hero Description */}
                <div className="space-y-2">
                  <Label htmlFor="hero_description">وصف البطل</Label>
                  <Textarea
                    id="hero_description"
                    value={settings.hero_description}
                    onChange={(e) => updateField("hero_description", e.target.value)}
                    className="text-right"
                    rows={3}
                  />
                </div>

                {/* Form Title */}
                <div className="space-y-2">
                  <Label htmlFor="form_title">عنوان النموذج</Label>
                  <Input
                    id="form_title"
                    value={settings.form_title}
                    onChange={(e) => updateField("form_title", e.target.value)}
                    className="text-right"
                  />
                </div>

                {/* Form Description */}
                <div className="space-y-2">
                  <Label htmlFor="form_description">وصف النموذج</Label>
                  <Textarea
                    id="form_description"
                    value={settings.form_description}
                    onChange={(e) => updateField("form_description", e.target.value)}
                    className="text-right"
                    rows={3}
                  />
                </div>

                {/* Commission Rate */}
                <div className="space-y-2">
                  <Label htmlFor="commission_rate">معدل العمولة (%)</Label>
                  <Input
                    id="commission_rate"
                    type="number"
                    step="0.01"
                    value={settings.commission_rate}
                    onChange={(e) => updateField("commission_rate", parseFloat(e.target.value))}
                    className="text-right"
                  />
                </div>

                {/* Commission Text */}
                <div className="space-y-2">
                  <Label htmlFor="commission_text">نص العمولة</Label>
                  <Input
                    id="commission_text"
                    value={settings.commission_text}
                    onChange={(e) => updateField("commission_text", e.target.value)}
                    className="text-right"
                  />
                </div>

                {/* Estimated Earnings Min */}
                <div className="space-y-2">
                  <Label htmlFor="estimated_earnings_min">الحد الأدنى للدخل المتوقع (دينار)</Label>
                  <Input
                    id="estimated_earnings_min"
                    type="number"
                    value={settings.estimated_earnings_min}
                    onChange={(e) => updateField("estimated_earnings_min", parseInt(e.target.value))}
                    className="text-right"
                  />
                </div>

                {/* Estimated Earnings Max */}
                <div className="space-y-2">
                  <Label htmlFor="estimated_earnings_max">الحد الأقصى للدخل المتوقع (دينار)</Label>
                  <Input
                    id="estimated_earnings_max"
                    type="number"
                    value={settings.estimated_earnings_max}
                    onChange={(e) => updateField("estimated_earnings_max", parseInt(e.target.value))}
                    className="text-right"
                  />
                </div>

                {/* Earnings Text */}
                <div className="space-y-2">
                  <Label htmlFor="earnings_text">نص الدخل</Label>
                  <Input
                    id="earnings_text"
                    value={settings.earnings_text}
                    onChange={(e) => updateField("earnings_text", e.target.value)}
                    className="text-right"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Benefits Tab */}
            <TabsContent value="benefits" className="space-y-6">
              <div className="space-y-4">
                {/* Benefits Title */}
                <div className="space-y-2">
                  <Label htmlFor="benefits_title">عنوان المزايا</Label>
                  <Input
                    id="benefits_title"
                    value={settings.benefits_title}
                    onChange={(e) => updateField("benefits_title", e.target.value)}
                    className="text-right"
                  />
                </div>

                {/* Benefit 1 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">الميزة الأولى</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="benefit_1_title">العنوان</Label>
                      <Input
                        id="benefit_1_title"
                        value={settings.benefit_1_title}
                        onChange={(e) => updateField("benefit_1_title", e.target.value)}
                        className="text-right"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="benefit_1_description">الوصف</Label>
                      <Textarea
                        id="benefit_1_description"
                        value={settings.benefit_1_description}
                        onChange={(e) => updateField("benefit_1_description", e.target.value)}
                        className="text-right"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Benefit 2 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">الميزة الثانية</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="benefit_2_title">العنوان</Label>
                      <Input
                        id="benefit_2_title"
                        value={settings.benefit_2_title}
                        onChange={(e) => updateField("benefit_2_title", e.target.value)}
                        className="text-right"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="benefit_2_description">الوصف</Label>
                      <Textarea
                        id="benefit_2_description"
                        value={settings.benefit_2_description}
                        onChange={(e) => updateField("benefit_2_description", e.target.value)}
                        className="text-right"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Benefit 3 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">الميزة الثالثة</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="benefit_3_title">العنوان</Label>
                      <Input
                        id="benefit_3_title"
                        value={settings.benefit_3_title}
                        onChange={(e) => updateField("benefit_3_title", e.target.value)}
                        className="text-right"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="benefit_3_description">الوصف</Label>
                      <Textarea
                        id="benefit_3_description"
                        value={settings.benefit_3_description}
                        onChange={(e) => updateField("benefit_3_description", e.target.value)}
                        className="text-right"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Benefit 4 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">الميزة الرابعة</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="benefit_4_title">العنوان</Label>
                      <Input
                        id="benefit_4_title"
                        value={settings.benefit_4_title}
                        onChange={(e) => updateField("benefit_4_title", e.target.value)}
                        className="text-right"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="benefit_4_description">الوصف</Label>
                      <Textarea
                        id="benefit_4_description"
                        value={settings.benefit_4_description}
                        onChange={(e) => updateField("benefit_4_description", e.target.value)}
                        className="text-right"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Requirements Tab */}
            <TabsContent value="requirements" className="space-y-6">
              <div className="space-y-4">
                {/* Requirements Title */}
                <div className="space-y-2">
                  <Label htmlFor="requirements_title">عنوان المتطلبات</Label>
                  <Input
                    id="requirements_title"
                    value={settings.requirements_title}
                    onChange={(e) => updateField("requirements_title", e.target.value)}
                    className="text-right"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Min Age */}
                  <div className="space-y-2">
                    <Label htmlFor="min_age">العمر الأدنى</Label>
                    <Input
                      id="min_age"
                      type="number"
                      value={settings.min_age}
                      onChange={(e) => updateField("min_age", parseInt(e.target.value))}
                      className="text-right"
                    />
                  </div>

                  {/* Min Age Text */}
                  <div className="space-y-2">
                    <Label htmlFor="min_age_text">نص العمر الأدنى</Label>
                    <Input
                      id="min_age_text"
                      value={settings.min_age_text}
                      onChange={(e) => updateField("min_age_text", e.target.value)}
                      className="text-right"
                    />
                  </div>

                  {/* License Requirement */}
                  <div className="space-y-2">
                    <Label htmlFor="license_requirement">متطلبات الرخصة</Label>
                    <Input
                      id="license_requirement"
                      value={settings.license_requirement}
                      onChange={(e) => updateField("license_requirement", e.target.value)}
                      className="text-right"
                    />
                  </div>

                  {/* Vehicle Requirement */}
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_requirement">متطلبات السيارة</Label>
                    <Input
                      id="vehicle_requirement"
                      value={settings.vehicle_requirement}
                      onChange={(e) => updateField("vehicle_requirement", e.target.value)}
                      className="text-right"
                    />
                  </div>

                  {/* Insurance Requirement */}
                  <div className="space-y-2">
                    <Label htmlFor="insurance_requirement">متطلبات التأمين</Label>
                    <Input
                      id="insurance_requirement"
                      value={settings.insurance_requirement}
                      onChange={(e) => updateField("insurance_requirement", e.target.value)}
                      className="text-right"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Contact Tab */}
            <TabsContent value="contact" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Contact Title */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="contact_title">عنوان قسم التواصل</Label>
                  <Input
                    id="contact_title"
                    value={settings.contact_title}
                    onChange={(e) => updateField("contact_title", e.target.value)}
                    className="text-right"
                  />
                </div>

                {/* Contact Phone */}
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">رقم الهاتف</Label>
                  <Input
                    id="contact_phone"
                    value={settings.contact_phone}
                    onChange={(e) => updateField("contact_phone", e.target.value)}
                    className="text-right"
                    dir="ltr"
                  />
                </div>

                {/* Contact Email */}
                <div className="space-y-2">
                  <Label htmlFor="contact_email">البريد الإلكتروني</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={settings.contact_email}
                    onChange={(e) => updateField("contact_email", e.target.value)}
                    className="text-right"
                    dir="ltr"
                  />
                </div>

                {/* Contact Hours */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="contact_hours">ساعات العمل</Label>
                  <Input
                    id="contact_hours"
                    value={settings.contact_hours}
                    onChange={(e) => updateField("contact_hours", e.target.value)}
                    className="text-right"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Status Tab */}
            <TabsContent value="status" className="space-y-6">
              <div className="space-y-6">
                {/* Is Active */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_active" className="text-base">
                      تفعيل الإعدادات
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      تحديد ما إذا كانت هذه الإعدادات نشطة ومرئية للمستخدمين
                    </p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={settings.is_active}
                    onCheckedChange={(checked) => updateField("is_active", checked)}
                  />
                </div>

                {/* Registration Enabled */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="registration_enabled" className="text-base">
                      تفعيل التسجيل
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      السماح للسائقين الجدد بالتسجيل
                    </p>
                  </div>
                  <Switch
                    id="registration_enabled"
                    checked={settings.registration_enabled}
                    onCheckedChange={(checked) => updateField("registration_enabled", checked)}
                  />
                </div>

                {/* Maintenance Message */}
                <div className="space-y-2">
                  <Label htmlFor="maintenance_message">رسالة الصيانة (اختياري)</Label>
                  <Textarea
                    id="maintenance_message"
                    value={settings.maintenance_message || ""}
                    onChange={(e) => updateField("maintenance_message", e.target.value || null)}
                    className="text-right"
                    rows={3}
                    placeholder="رسالة تظهر عند تعطيل التسجيل"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Save Button */}
          <div className="mt-6 flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={loadSettings}
              disabled={saving}
            >
              إلغاء التغييرات
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="min-w-[120px]"
            >
              {saving ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="ml-2 h-4 w-4" />
                  حفظ الإعدادات
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
