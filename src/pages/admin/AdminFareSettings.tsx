import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Calculator, Percent, Settings2, Save, Zap, Crown, TrendingUp, Banknote, CalendarDays } from 'lucide-react';
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
  min_driver_balance: number;
  min_commission_floor: number;
}

interface MonetizationSettings {
  mode: 'commission' | 'daily_subscription';
  daily_fee: number;
  debt_limit: number;
  daily_fee_new_driver_days: number;
  daily_fee_new_driver_amount: number;
  commission_enabled: boolean;
}

const AdminFareSettings = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [monetizationSettings, setMonetizationSettings] = useState<MonetizationSettings>({
    mode: 'daily_subscription',
    daily_fee: 3000,
    debt_limit: -15000,
    daily_fee_new_driver_days: 7,
    daily_fee_new_driver_amount: 0,
    commission_enabled: false,
  });
  
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
    min_driver_balance: -10000,
    min_commission_floor: 5,
  });

  const { data: settingsData, isLoading: loading } = useQuery({
    queryKey: ['fare-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['fare_calculation', 'commission', 'monetization']);
      if (error) throw error;
      return data;
    },
    select: (data) => {
      const result: { fare?: FareSettings; commission?: CommissionSettings; monetization?: MonetizationSettings } = {};
      data?.forEach((setting) => {
        if (setting.key === 'fare_calculation' && setting.value) {
          result.fare = setting.value as unknown as FareSettings;
        }
        if (setting.key === 'commission' && setting.value) {
          result.commission = setting.value as unknown as CommissionSettings;
        }
        if (setting.key === 'monetization' && setting.value) {
          result.monetization = setting.value as unknown as MonetizationSettings;
        }
      });
      return result;
    },
  });

  useEffect(() => {
    if (settingsData?.fare) {
      setFareSettings(prev => ({ ...prev, ...settingsData.fare }));
    }
    if (settingsData?.commission) {
      setCommissionSettings(prev => ({ ...prev, ...settingsData.commission }));
    }
    if (settingsData?.monetization) {
      setMonetizationSettings(prev => ({ ...prev, ...(settingsData.monetization as unknown as MonetizationSettings) }));
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error: fareError } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'fare_calculation', value: { ...fareSettings } },
          { onConflict: 'key' }
        );
      if (fareError) throw fareError;

      const { error: commissionError } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'commission', value: { ...commissionSettings } },
          { onConflict: 'key' }
        );
      if (commissionError) throw commissionError;

      const { error: monError } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'monetization', value: { ...monetizationSettings } },
          { onConflict: 'key' }
        );
      if (monError) throw monError;

      await supabase.from('wallet_settings')
        .update({ default_commission_rate: commissionSettings.rate })
        .not('id', 'is', null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fare-settings'] });
      toast.success('تم حفظ الإعدادات بنجاح');
    },
    onError: (error) => {
      console.error(error);
      toast.error('خطأ في حفظ الإعدادات');
    },
  });

  const handleSave = () => {
    if (fareSettings.max_surge_multiplier > 2.0) {
      toast.error('الحد الأقصى لمعامل الزيادة لا يمكن أن يتجاوز 2.0');
      return;
    }
    saveMutation.mutate();
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

        {/* 💰 Monetization Mode — النموذج المالي */}
        <Card className={`border-2 ${
          monetizationSettings.mode === 'daily_subscription'
            ? 'border-emerald-500/40 bg-emerald-500/5'
            : 'border-blue-500/40 bg-blue-500/5'
        }`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              النموذج المالي
            </CardTitle>
            <CardDescription>
              اختر كيف تربح الشركة — اشتراك يومي أو نسبة من كل رحلة
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Toggle بين الوضعين */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMonetizationSettings(p => ({ ...p, mode: 'daily_subscription', commission_enabled: false }))}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  monetizationSettings.mode === 'daily_subscription'
                    ? 'border-emerald-500 bg-emerald-500/10 shadow-lg'
                    : 'border-muted hover:border-muted-foreground/30'
                }`}
              >
                <CalendarDays className={`w-6 h-6 mx-auto mb-2 ${
                  monetizationSettings.mode === 'daily_subscription' ? 'text-emerald-600' : 'text-muted-foreground'
                }`} />
                <p className="font-bold text-sm">اشتراك يومي</p>
                <p className="text-xs text-muted-foreground mt-1">3,000 د.ع/يوم نشاط</p>
              </button>
              <button
                type="button"
                onClick={() => setMonetizationSettings(p => ({ ...p, mode: 'commission', commission_enabled: true }))}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  monetizationSettings.mode === 'commission'
                    ? 'border-blue-500 bg-blue-500/10 shadow-lg'
                    : 'border-muted hover:border-muted-foreground/30'
                }`}
              >
                <Percent className={`w-6 h-6 mx-auto mb-2 ${
                  monetizationSettings.mode === 'commission' ? 'text-blue-600' : 'text-muted-foreground'
                }`} />
                <p className="font-bold text-sm">نسبة عمولة</p>
                <p className="text-xs text-muted-foreground mt-1">% من كل رحلة</p>
              </button>
            </div>

            {/* إعدادات الاشتراك اليومي */}
            {monetizationSettings.mode === 'daily_subscription' && (
              <div className="space-y-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <h3 className="font-bold text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4" />
                  إعدادات الاشتراك اليومي
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الرسم اليومي (د.ع)</Label>
                    <Input
                      type="number"
                      step="500"
                      min="0"
                      value={monetizationSettings.daily_fee}
                      onChange={(e) => setMonetizationSettings(p => ({ ...p, daily_fee: parseInt(e.target.value) || 0 }))}
                    />
                    <p className="text-xs text-muted-foreground">يُخصم عند أول رحلة مكتملة في اليوم فقط.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>سقف الدين (د.ع)</Label>
                    <Input
                      type="number"
                      step="1000"
                      value={monetizationSettings.debt_limit}
                      onChange={(e) => setMonetizationSettings(p => ({ ...p, debt_limit: parseInt(e.target.value) || -15000 }))}
                    />
                    <p className="text-xs text-muted-foreground">أقل رصيد مسموح. مثال: -15,000 = 5 أيام سماح.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>أيام مجانية للسائق الجديد</Label>
                    <Input
                      type="number"
                      min="0"
                      max="30"
                      value={monetizationSettings.daily_fee_new_driver_days}
                      onChange={(e) => setMonetizationSettings(p => ({ ...p, daily_fee_new_driver_days: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>رسم الفترة المجانية (د.ع)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={monetizationSettings.daily_fee_new_driver_amount}
                      onChange={(e) => setMonetizationSettings(p => ({ ...p, daily_fee_new_driver_amount: parseInt(e.target.value) || 0 }))}
                    />
                    <p className="text-xs text-muted-foreground">0 = مجاني تماماً خلال الفترة التجريبية.</p>
                  </div>
                </div>
              </div>
            )}

            {monetizationSettings.mode === 'commission' && (
              <p className="text-sm text-muted-foreground p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                ℹ️ في وضع العمولة، يتم خصم نسبة من كل رحلة. اضبط النسبة والحد الأدنى من قسم "إعدادات العمولة" أدناه.
              </p>
            )}
          </CardContent>
        </Card>

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
              <div className="space-y-2">
                <Label>الحد الأدنى للرصيد للعمل (سقف الدين د.ع)</Label>
                <Input
                  type="number"
                  step="1000"
                  value={commissionSettings.min_driver_balance}
                  onChange={(e) => setCommissionSettings({ 
                    ...commissionSettings, 
                    min_driver_balance: parseInt(e.target.value) 
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  أقل رصيد مسموح للسائق لكي يتمكن من بدء العمل (يمكن وضع قيمة سالبة).
                </p>
              </div>
              <div className="space-y-2">
                <Label>الحد الأدنى لنسبة العمولة الفعلية (%)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="50"
                  value={commissionSettings.min_commission_floor}
                  onChange={(e) => setCommissionSettings({ 
                    ...commissionSettings, 
                    min_commission_floor: parseFloat(e.target.value) 
                  })}
                />
                <p className="text-xs text-muted-foreground text-amber-600">
                  ⚠️ أقل نسبة عمولة فعلية لا يمكن النزول تحتها حتى مع كل الخصومات (الاشتراك + المستوى).
                  مثال: 5% = حتى لو كان للسائق خصومات 12%، العمولة لا تقل عن 5%.
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
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminFareSettings;
