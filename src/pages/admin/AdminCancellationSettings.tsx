import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Save, 
  DollarSign,
  Settings,
  Info,
  CheckCircle,
  XCircle
} from "lucide-react";

interface CancellationFeeSettings {
  amount: number;
  enabled: boolean;
  applies_after_acceptance: boolean;
}

export default function AdminCancellationSettings() {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [settings, setSettings] = useState<CancellationFeeSettings>({
    amount: 2000,
    enabled: true,
    applies_after_acceptance: true
  });
  const { toast } = useToast();

  const { isLoading: loading } = useQuery({
    queryKey: ['cancellation-fee-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'cancellation_fee')
        .maybeSingle();
      if (error) throw error;
      if (data?.value) {
        const val = data.value as unknown as CancellationFeeSettings;
        setSettings(val);
      }
      return data;
    },
    enabled: isAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'cancellation_fee',
          value: settings as unknown as Record<string, unknown>,
          description: 'غرامة إلغاء الرحلة بعد قبول السائق (بالدينار العراقي)',
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "تم الحفظ بنجاح",
        description: "تم تحديث إعدادات غرامة الإلغاء",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في الحفظ",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const handleSave = () => {
    if (settings.amount < 0) {
      toast({ title: "خطأ", description: "مبلغ الغرامة لا يمكن أن يكون سالباً", variant: "destructive" });
      return;
    }
    if (settings.amount > 50000) {
      toast({ title: "خطأ", description: "مبلغ الغرامة لا يمكن أن يتجاوز 50,000 د.ع", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  if (authLoading || loading) {
    return (
      <AdminLayout title="إعدادات غرامة الإلغاء">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="إعدادات غرامة الإلغاء" 
      subtitle="إدارة الغرامات المفروضة عند إلغاء الرحلة بعد قبول السائق"
      actions={
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ml-2" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 ml-2" />
              حفظ الإعدادات
            </>
          )}
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Main Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              إعدادات الغرامة
            </CardTitle>
            <CardDescription>
              تحديد مبلغ الغرامة وشروط تطبيقها
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border">
              <div className="flex items-center gap-3">
                {settings.enabled ? (
                  <CheckCircle className="w-6 h-6 text-success" />
                ) : (
                  <XCircle className="w-6 h-6 text-muted-foreground" />
                )}
                <div>
                  <Label className="text-base font-medium">تفعيل غرامة الإلغاء</Label>
                  <p className="text-sm text-muted-foreground">
                    عند التفعيل، سيتم تحصيل غرامة من العميل عند الإلغاء
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
              />
            </div>

            {/* Amount */}
            <div className="space-y-3">
              <Label className="text-base font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                مبلغ الغرامة (د.ع)
              </Label>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  value={settings.amount}
                  onChange={(e) => setSettings({ ...settings, amount: parseInt(e.target.value) || 0 })}
                  className="max-w-xs text-lg font-bold"
                  disabled={!settings.enabled}
                  min={0}
                  step={500}
                />
                <span className="text-muted-foreground">دينار عراقي</span>
              </div>
              <p className="text-sm text-muted-foreground">
                هذا المبلغ سيتم خصمه من العميل وإضافته لمحفظة السائق كتعويض
              </p>
            </div>

            {/* Apply After Acceptance */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border">
              <div>
                <Label className="text-base font-medium">تطبيق بعد قبول السائق فقط</Label>
                <p className="text-sm text-muted-foreground">
                  الغرامة تُطبق فقط إذا ألغى العميل بعد أن قبل السائق الطلب
                </p>
              </div>
              <Switch
                checked={settings.applies_after_acceptance}
                onCheckedChange={(checked) => setSettings({ ...settings, applies_after_acceptance: checked })}
                disabled={!settings.enabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-info/30 bg-info/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-info mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-foreground">كيف تعمل الغرامة؟</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>عندما يطلب العميل رحلة ويقبلها سائق، يصبح الإلغاء مُغرّماً</li>
                  <li>إذا ألغى العميل، يتم خصم مبلغ الغرامة تلقائياً</li>
                  <li>يتم إضافة المبلغ لمحفظة السائق كتعويض</li>
                  <li>يظهر للسائق إشعار بالتعويض المستلم</li>
                  <li>الإلغاء قبل قبول السائق يكون مجانياً دائماً</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Amount Presets */}
        {settings.enabled && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">اختيار سريع للمبلغ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {[1000, 1500, 2000, 2500, 3000, 5000].map((amount) => (
                  <Button
                    key={amount}
                    variant={settings.amount === amount ? "default" : "outline"}
                    onClick={() => setSettings({ ...settings, amount })}
                  >
                    {amount.toLocaleString()} د.ع
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
