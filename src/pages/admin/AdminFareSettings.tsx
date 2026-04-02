import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Calculator, Percent, Settings2, Save, Zap, Crown, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FareSettings {
  service_fee_percentage: number;
  min_service_fee: number;
  surge_pricing_enabled: boolean;
  max_surge_multiplier: number;
  subscription_discounts_enabled: boolean;
  tier_discounts_enabled: boolean;
}

interface CommissionSettings {
  rate: number;
  min_amount: number;
}

const AdminFareSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [fareSettings, setFareSettings] = useState<FareSettings>({
    service_fee_percentage: 5,
    min_service_fee: 500,
    surge_pricing_enabled: true,
    max_surge_multiplier: 3.0,
    subscription_discounts_enabled: true,
    tier_discounts_enabled: true,
  });
  
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings>({
    rate: 15,
    min_amount: 500,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['fare_calculation', 'commission']);

    if (error) {
      toast.error('خطأ في جلب الإعدادات');
      console.error(error);
    } else if (data) {
      data.forEach((setting) => {
        if (setting.key === 'fare_calculation' && setting.value) {
          const val = setting.value as unknown as FareSettings;
          setFareSettings(prev => ({ ...prev, ...val }));
        }
        if (setting.key === 'commission' && setting.value) {
          const val = setting.value as unknown as CommissionSettings;
          setCommissionSettings(prev => ({ ...prev, ...val }));
        }
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (fareSettings.max_surge_multiplier > 2.0) {
      toast.error('الحد الأقصى لمعامل الزيادة لا يمكن أن يتجاوز 2.0');
      return;
    }

    setSaving(true);
    
    try {
      // Upsert fare_calculation settings (يُنشئ الصف إن لم يكن موجوداً)
      const { error: fareError } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'fare_calculation', value: { ...fareSettings } },
          { onConflict: 'key' }
        );

      if (fareError) throw fareError;

      // Upsert commission settings
      const { error: commissionError } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'commission', value: { ...commissionSettings } },
          { onConflict: 'key' }
        );

      if (commissionError) throw commissionError;

      // مزامنة معدل العمولة مع wallet_settings المستخدم من Edge Function
      await supabase.from('wallet_settings')
        .update({ default_commission_rate: commissionSettings.rate })
        .not('id', 'is', null);

      toast.success('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      console.error(error);
      toast.error('خطأ في حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="إعدادات الأجرة" subtitle="تحميل...">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="إعدادات الأجرة والعمولات" subtitle="تكوين حساب الأجرة والعمولات">
      <div className="space-y-6">
        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card 
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate('/admin/surge-pricing')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100">
                <Zap className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="font-medium">تسعير الذروة</p>
                <p className="text-sm text-muted-foreground">إدارة أوقات الذروة</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate('/admin/subscription-plans')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Crown className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">خطط الاشتراك</p>
                <p className="text-sm text-muted-foreground">خطط Premium للسائقين</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate('/admin/commission-tiers')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">مستويات العمولة</p>
                <p className="text-sm text-muted-foreground">العمولة المتدرجة</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Commission Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              إعدادات العمولة الأساسية
            </CardTitle>
            <CardDescription>
              تحديد نسبة العمولة الأساسية للشركة من كل رحلة
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>نسبة العمولة الأساسية (%)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="50"
                  value={commissionSettings.rate}
                  onChange={(e) => setCommissionSettings({ 
                    ...commissionSettings, 
                    rate: parseFloat(e.target.value) 
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  يتم خصم هذه النسبة من كل رحلة (قبل تطبيق خصومات الاشتراك والمستوى)
                </p>
              </div>
              <div className="space-y-2">
                <Label>الحد الأدنى للعمولة (د.ع)</Label>
                <Input
                  type="number"
                  step="100"
                  min="0"
                  value={commissionSettings.min_amount}
                  onChange={(e) => setCommissionSettings({ 
                    ...commissionSettings, 
                    min_amount: parseInt(e.target.value) 
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  أقل عمولة يتم خصمها حتى لو كانت النسبة أقل
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Fee Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              رسوم الخدمة
            </CardTitle>
            <CardDescription>
              رسوم الخدمة التي تضاف على الأجرة الإجمالية للراكب
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>نسبة رسوم الخدمة (%)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="30"
                  value={fareSettings.service_fee_percentage}
                  onChange={(e) => setFareSettings({ 
                    ...fareSettings, 
                    service_fee_percentage: parseFloat(e.target.value) 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>الحد الأدنى لرسوم الخدمة (د.ع)</Label>
                <Input
                  type="number"
                  step="100"
                  min="0"
                  value={fareSettings.min_service_fee}
                  onChange={(e) => setFareSettings({ 
                    ...fareSettings, 
                    min_service_fee: parseInt(e.target.value) 
                  })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Toggles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              خيارات التسعير المتقدمة
            </CardTitle>
            <CardDescription>
              تفعيل أو تعطيل ميزات التسعير المختلفة
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">تسعير ساعات الذروة</p>
                <p className="text-sm text-muted-foreground">
                  زيادة الأسعار تلقائياً في أوقات الطلب العالي
                </p>
              </div>
              <Switch
                checked={fareSettings.surge_pricing_enabled}
                onCheckedChange={(checked) => setFareSettings({ 
                  ...fareSettings, 
                  surge_pricing_enabled: checked 
                })}
              />
            </div>

            {fareSettings.surge_pricing_enabled && (
              <div className="space-y-2 mr-6">
                <Label>الحد الأقصى لمعامل الذروة</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={fareSettings.max_surge_multiplier}
                  onChange={(e) => setFareSettings({ 
                    ...fareSettings, 
                    max_surge_multiplier: parseFloat(e.target.value) 
                  })}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  مثال: 3.0 = أقصى زيادة 200%
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">خصومات اشتراك Premium</p>
                <p className="text-sm text-muted-foreground">
                  تطبيق خصومات العمولة للسائقين المشتركين
                </p>
              </div>
              <Switch
                checked={fareSettings.subscription_discounts_enabled}
                onCheckedChange={(checked) => setFareSettings({ 
                  ...fareSettings, 
                  subscription_discounts_enabled: checked 
                })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">خصومات المستويات المتدرجة</p>
                <p className="text-sm text-muted-foreground">
                  تطبيق خصومات العمولة حسب نشاط وتقييم السائق
                </p>
              </div>
              <Switch
                checked={fareSettings.tier_discounts_enabled}
                onCheckedChange={(checked) => setFareSettings({ 
                  ...fareSettings, 
                  tier_discounts_enabled: checked 
                })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminFareSettings;
