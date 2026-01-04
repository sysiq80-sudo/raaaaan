import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import MapSettingsTab from "@/components/admin/MapSettingsTab";
import DatabaseSettingsTab from "@/components/admin/DatabaseSettingsTab";
import BackupSettingsTab from "@/components/admin/BackupSettingsTab";
import IntegrationsSettingsTab from "@/components/admin/IntegrationsSettingsTab";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Globe, 
  Bell, 
  Shield, 
  MessageSquare, 
  CreditCard,
  Save,
  RefreshCw,
  Map,
  Database,
  HardDrive,
  Plug,
  Pencil,
  Smartphone,
  Building2,
  Banknote,
  Wallet,
  Plus,
  Zap,
  Settings2,
  Key,
  Trash2
} from "lucide-react";

interface PaymentAccount {
  id: string;
  payment_method: string;
  account_name: string;
  account_number: string;
  account_holder: string | null;
  instructions: string | null;
  is_active: boolean;
  api_enabled?: boolean;
  api_provider?: string | null;
  api_config?: unknown;
}

interface NewPaymentAccount {
  payment_method: string;
  account_name: string;
  account_number: string;
  account_holder: string;
  instructions: string;
  is_api: boolean;
  api_provider: string;
  api_config: Record<string, string>;
}

const apiProviders = [
  { 
    id: 'zaincash', 
    name: 'ZainCash API', 
    fields: ['merchant_id', 'secret_key', 'msisdn'],
    labels: { merchant_id: 'Merchant ID', secret_key: 'Secret Key', msisdn: 'رقم MSISDN' },
    description: 'الدفع الإلكتروني عبر زين كاش'
  },
  { 
    id: 'paytabs', 
    name: 'PayTabs', 
    fields: ['profile_id', 'server_key'],
    labels: { profile_id: 'Profile ID', server_key: 'Server Key' },
    description: 'بوابة دفع متعددة البطاقات'
  },
  { 
    id: 'qi_card', 
    name: 'Qi Card API', 
    fields: ['merchant_code', 'api_key'],
    labels: { merchant_code: 'Merchant Code', api_key: 'API Key' },
    description: 'بطاقات كي كارد'
  },
  { 
    id: 'custom', 
    name: 'مخصص', 
    fields: ['endpoint_url', 'api_key', 'secret'],
    labels: { endpoint_url: 'Endpoint URL', api_key: 'API Key', secret: 'Secret' },
    description: 'ربط API مخصص'
  }
];

const defaultNewAccount: NewPaymentAccount = {
  payment_method: '',
  account_name: '',
  account_number: '',
  account_holder: '',
  instructions: '',
  is_api: false,
  api_provider: 'zaincash',
  api_config: {}
};

interface GeneralSettings {
  app_name: string;
  default_language: string;
  maintenance_mode: boolean;
}

interface NotificationSettings {
  email: boolean;
  sms: boolean;
  push: boolean;
}

interface RideSettings {
  max_search_radius: number;
  ride_timeout: number;
  cancellation_fee: number;
  region_filtering_enabled: boolean;
}

interface CommissionSettings {
  rate: number;
  min_amount: number;
}

interface PaymentSettings {
  cash: boolean;
}

interface SupportSettings {
  email: string;
  phone: string;
  terms: string;
  privacy: string;
}

interface MapSettings {
  provider: 'mapbox' | 'google';
  google_maps_configured: boolean;
}

const AdminSettings = () => {
  const { loading: authLoading, isAdmin } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings states
  const [general, setGeneral] = useState<GeneralSettings>({
    app_name: "ران RAAN",
    default_language: "ar",
    maintenance_mode: false
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    email: true,
    sms: true,
    push: true
  });

  const [rides, setRides] = useState<RideSettings>({
    max_search_radius: 10,
    ride_timeout: 60,
    cancellation_fee: 1000,
    region_filtering_enabled: true
  });

  const [payments, setPayments] = useState<PaymentSettings>({
    cash: true
  });

  // Payment accounts from database
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [editingAccount, setEditingAccount] = useState<PaymentAccount | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  
  // Add new account states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newAccount, setNewAccount] = useState<NewPaymentAccount>({ ...defaultNewAccount });
  const [addingAccount, setAddingAccount] = useState(false);
  
  

  const [support, setSupport] = useState<SupportSettings>({
    email: "support@ride.iq",
    phone: "+964 770 123 4567",
    terms: "",
    privacy: ""
  });

  const [maps, setMaps] = useState<MapSettings>({
    provider: 'mapbox',
    google_maps_configured: false
  });

  const [commission, setCommission] = useState<CommissionSettings>({
    rate: 15,
    min_amount: 500
  });

  // Fetch payment accounts
  const fetchPaymentAccounts = async () => {
    const { data, error } = await supabase
      .from('payment_accounts')
      .select('*')
      .order('display_order', { ascending: true });

    if (!error && data) {
      setPaymentAccounts(data);
    }
  };

  // Load settings from database
  useEffect(() => {
    if (!isAdmin) return;
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('key, value');

        if (error) throw error;

        data?.forEach((setting) => {
          const value = setting.value as Record<string, unknown>;
          switch (setting.key) {
            case 'general':
              setGeneral(value as unknown as GeneralSettings);
              break;
            case 'notifications':
              setNotifications(value as unknown as NotificationSettings);
              break;
            case 'rides':
              setRides(value as unknown as RideSettings);
              break;
            case 'payments':
              if (value && typeof value === 'object' && 'cash' in value) {
                setPayments({ cash: Boolean(value.cash) });
              }
              break;
            case 'support':
              setSupport(value as unknown as SupportSettings);
              break;
            case 'maps':
              setMaps(value as unknown as MapSettings);
              break;
            case 'commission':
              setCommission(value as unknown as CommissionSettings);
              break;
          }
        });

        // Fetch payment accounts from payment_accounts table
        await fetchPaymentAccounts();
      } catch (error) {
        console.error('Error fetching settings:', error);
        toast.error("حدث خطأ أثناء تحميل الإعدادات");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [isAdmin]);

  const updateSetting = async (key: string, value: object) => {
    const { error } = await supabase
      .from('app_settings')
      .update({ value: JSON.parse(JSON.stringify(value)) })
      .eq('key', key);

    if (error) throw error;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateSetting('general', general),
        updateSetting('notifications', notifications),
        updateSetting('rides', rides),
        updateSetting('payments', payments),
        updateSetting('support', support),
        updateSetting('maps', maps),
        updateSetting('commission', commission),
      ]);
      toast.success("تم حفظ الإعدادات بنجاح");
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error("حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AdminLayout title="الإعدادات" subtitle="إدارة إعدادات التطبيق العامة">
        <div className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="الإعدادات" 
      subtitle="إدارة إعدادات التطبيق العامة"
      actions={
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <RefreshCw className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
          حفظ الإعدادات
        </Button>
      }
    >
      <Tabs defaultValue="general" className="space-y-6" dir="rtl">
        <TabsList className="grid w-full grid-cols-9 lg:w-auto lg:inline-flex">
          <TabsTrigger value="general" className="gap-2">
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">عام</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Plug className="w-4 h-4" />
            <span className="hidden sm:inline">التكاملات</span>
          </TabsTrigger>
          <TabsTrigger value="database" className="gap-2">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">قاعدة البيانات</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-2">
            <HardDrive className="w-4 h-4" />
            <span className="hidden sm:inline">النسخ الاحتياطي</span>
          </TabsTrigger>
          <TabsTrigger value="maps" className="gap-2">
            <Map className="w-4 h-4" />
            <span className="hidden sm:inline">الخرائط</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">الإشعارات</span>
          </TabsTrigger>
          <TabsTrigger value="rides" className="gap-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">الرحلات</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">الدفع</span>
          </TabsTrigger>
          <TabsTrigger value="support" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">الدعم</span>
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                الإعدادات العامة
              </CardTitle>
              <CardDescription>إعدادات التطبيق الأساسية</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="appName">اسم التطبيق</Label>
                  <Input 
                    id="appName" 
                    value={general.app_name} 
                    onChange={(e) => setGeneral({ ...general, app_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">اللغة الافتراضية</Label>
                  <Select 
                    value={general.default_language} 
                    onValueChange={(value) => setGeneral({ ...general, default_language: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ar">العربية</SelectItem>
                      <SelectItem value="ku">الكردية</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                <div className="space-y-1">
                  <Label htmlFor="maintenance" className="text-destructive">وضع الصيانة</Label>
                  <p className="text-sm text-muted-foreground">
                    تفعيل وضع الصيانة سيمنع المستخدمين من استخدام التطبيق
                  </p>
                </div>
                <Switch 
                  id="maintenance"
                  checked={general.maintenance_mode} 
                  onCheckedChange={(checked) => setGeneral({ ...general, maintenance_mode: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Database Settings */}
        <TabsContent value="database">
          <DatabaseSettingsTab />
        </TabsContent>

        {/* Backup Settings */}
        <TabsContent value="backup">
          <BackupSettingsTab />
        </TabsContent>

        {/* Integrations Settings */}
        <TabsContent value="integrations">
          <IntegrationsSettingsTab />
        </TabsContent>

        {/* Map Settings */}
        <TabsContent value="maps">
          <MapSettingsTab onSettingsChange={setMaps} />
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                إعدادات الإشعارات
              </CardTitle>
              <CardDescription>التحكم بإشعارات التطبيق</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <Label>إشعارات البريد الإلكتروني</Label>
                  <p className="text-sm text-muted-foreground">إرسال إشعارات عبر البريد الإلكتروني</p>
                </div>
                <Switch 
                  checked={notifications.email} 
                  onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })} 
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <Label>إشعارات الرسائل القصيرة</Label>
                  <p className="text-sm text-muted-foreground">إرسال رسائل SMS للمستخدمين</p>
                </div>
                <Switch 
                  checked={notifications.sms} 
                  onCheckedChange={(checked) => setNotifications({ ...notifications, sms: checked })} 
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <Label>الإشعارات الفورية</Label>
                  <p className="text-sm text-muted-foreground">إشعارات Push للتطبيق</p>
                </div>
                <Switch 
                  checked={notifications.push} 
                  onCheckedChange={(checked) => setNotifications({ ...notifications, push: checked })} 
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ride Settings */}
        <TabsContent value="rides">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                إعدادات الرحلات
              </CardTitle>
              <CardDescription>التحكم بإعدادات الرحلات والفلترة الجغرافية</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="radius">نطاق البحث عن الطلبات (كم)</Label>
                  <Input 
                    id="radius"
                    type="number" 
                    min={1}
                    max={50}
                    value={rides.max_search_radius} 
                    onChange={(e) => setRides({ ...rides, max_search_radius: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">أقصى مسافة لظهور الطلبات للسائق</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeout">مهلة قبول الرحلة (ثانية)</Label>
                  <Input 
                    id="timeout"
                    type="number" 
                    value={rides.ride_timeout} 
                    onChange={(e) => setRides({ ...rides, ride_timeout: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cancellation">رسوم الإلغاء (د.ع)</Label>
                  <Input 
                    id="cancellation"
                    type="number" 
                    value={rides.cancellation_fee} 
                    onChange={(e) => setRides({ ...rides, cancellation_fee: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-primary/20 bg-primary/5">
                <div className="space-y-1">
                  <Label htmlFor="regionFilter" className="text-primary">الفلترة الجغرافية للطلبات</Label>
                  <p className="text-sm text-muted-foreground">
                    تظهر الطلبات للسائقين حسب موقعهم ونطاق البحث المحدد
                  </p>
                </div>
                <Switch 
                  id="regionFilter"
                  checked={rides.region_filtering_enabled} 
                  onCheckedChange={(checked) => setRides({ ...rides, region_filtering_enabled: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Commission Settings */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                إعدادات العمولة
              </CardTitle>
              <CardDescription>تحديد نسبة عمولة الشركة من كل رحلة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="commissionRate">نسبة العمولة (%)</Label>
                  <Input 
                    id="commissionRate"
                    type="number" 
                    min={0}
                    max={50}
                    value={commission.rate} 
                    onChange={(e) => setCommission({ ...commission, rate: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    النسبة المئوية التي تحصل عليها الشركة من كل رحلة
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minCommission">الحد الأدنى للعمولة (د.ع)</Label>
                  <Input 
                    id="minCommission"
                    type="number" 
                    min={0}
                    value={commission.min_amount} 
                    onChange={(e) => setCommission({ ...commission, min_amount: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    أقل مبلغ عمولة للرحلة الواحدة
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  <span className="font-medium text-primary">مثال على الحساب</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  لرحلة بقيمة 10,000 د.ع مع نسبة عمولة {commission.rate}%:
                </p>
                <ul className="text-sm mt-2 space-y-1">
                  <li>• عمولة الشركة: <span className="font-semibold text-primary">{(10000 * commission.rate / 100).toLocaleString('ar-IQ')} د.ع</span></li>
                  <li>• حصة السائق: <span className="font-semibold">{(10000 - (10000 * commission.rate / 100)).toLocaleString('ar-IQ')} د.ع</span></li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                طرق الدفع
              </CardTitle>
              <CardDescription>تفعيل وتعطيل طرق الدفع وتعديل تفاصيل الحسابات</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cash Payment - from app_settings */}
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="space-y-1">
                    <Label>الدفع النقدي</Label>
                    <p className="text-sm text-muted-foreground">السماح بالدفع نقداً للسائق</p>
                  </div>
                </div>
                <Switch 
                  checked={payments.cash} 
                  onCheckedChange={(checked) => setPayments({ ...payments, cash: checked })} 
                />
              </div>

              {/* Payment Accounts from payment_accounts table */}
              {paymentAccounts.map((account) => {
                const getIcon = (method: string) => {
                  switch (method.toLowerCase()) {
                    case 'zain_cash':
                    case 'zaincash':
                      return <Smartphone className="w-5 h-5 text-purple-500" />;
                    case 'asia_hawala':
                    case 'asiahawala':
                      return <Building2 className="w-5 h-5 text-blue-500" />;
                    case 'wallet':
                      return <Wallet className="w-5 h-5 text-primary" />;
                    default:
                      return <CreditCard className="w-5 h-5 text-muted-foreground" />;
                  }
                };

                return (
                  <div key={account.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                        {getIcon(account.payment_method)}
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Label>{account.account_name}</Label>
                          {account.api_enabled && (
                            <span className="text-xs text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              API
                            </span>
                          )}
                          {account.account_holder && (
                            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                              المستلم: {account.account_holder}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{account.account_number}</p>
                        {account.instructions && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">{account.instructions}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingAccount(account);
                          setEditDialogOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                          if (!confirm(`هل أنت متأكد من حذف "${account.account_name}"؟`)) return;
                          
                          const { error } = await supabase
                            .from('payment_accounts')
                            .delete()
                            .eq('id', account.id);
                          
                          if (error) {
                            toast.error("حدث خطأ أثناء حذف طريقة الدفع");
                          } else {
                            setPaymentAccounts(prev => prev.filter(a => a.id !== account.id));
                            toast.success("تم حذف طريقة الدفع بنجاح");
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Switch 
                        checked={account.is_active} 
                        onCheckedChange={async (checked) => {
                          const { error } = await supabase
                            .from('payment_accounts')
                            .update({ is_active: checked })
                            .eq('id', account.id);
                          
                          if (error) {
                            toast.error("حدث خطأ أثناء تحديث الحالة");
                          } else {
                            setPaymentAccounts(prev => 
                              prev.map(a => a.id === account.id ? { ...a, is_active: checked } : a)
                            );
                            toast.success(checked ? "تم تفعيل طريقة الدفع" : "تم تعطيل طريقة الدفع");
                          }
                        }} 
                      />
                    </div>
                  </div>
                );
              })}

              {/* Add new payment method button */}
              <div className="flex flex-wrap justify-center gap-3 pt-4 border-t">
                <Button 
                  variant="default"
                  onClick={() => {
                    setNewAccount({ ...defaultNewAccount });
                    setAddDialogOpen(true);
                  }}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  إضافة طريقة دفع
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Edit Account Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="sm:max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>تعديل حساب الدفع</DialogTitle>
                <DialogDescription>
                  تعديل تفاصيل الحساب والتوضيحات
                </DialogDescription>
              </DialogHeader>
              {editingAccount && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>رقم الحساب</Label>
                    <Input
                      value={editingAccount.account_number}
                      onChange={(e) => setEditingAccount({
                        ...editingAccount,
                        account_number: e.target.value
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>اسم المستلم</Label>
                    <Input
                      value={editingAccount.account_holder || ''}
                      onChange={(e) => setEditingAccount({
                        ...editingAccount,
                        account_holder: e.target.value
                      })}
                      placeholder="مثال: AHMED"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>توضيحات للمستخدم</Label>
                    <Textarea
                      value={editingAccount.instructions || ''}
                      onChange={(e) => setEditingAccount({
                        ...editingAccount,
                        instructions: e.target.value
                      })}
                      placeholder="مثال: يجب إرسال المبلغ باسم AHMED فقط"
                      rows={3}
                    />
                  </div>
                </div>
              )}
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setEditingAccount(null);
                  }}
                >
                  إلغاء
                </Button>
                <Button
                  onClick={async () => {
                    if (!editingAccount) return;
                    setSavingAccount(true);
                    
                    const { error } = await supabase
                      .from('payment_accounts')
                      .update({
                        account_number: editingAccount.account_number,
                        account_holder: editingAccount.account_holder,
                        instructions: editingAccount.instructions
                      })
                      .eq('id', editingAccount.id);
                    
                    if (error) {
                      toast.error("حدث خطأ أثناء حفظ التغييرات");
                    } else {
                      setPaymentAccounts(prev =>
                        prev.map(a => a.id === editingAccount.id ? editingAccount : a)
                      );
                      toast.success("تم حفظ التغييرات بنجاح");
                      setEditDialogOpen(false);
                      setEditingAccount(null);
                    }
                    setSavingAccount(false);
                  }}
                  disabled={savingAccount}
                >
                  {savingAccount ? <RefreshCw className="w-4 h-4 animate-spin ml-2" /> : null}
                  حفظ التغييرات
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add New Payment Method Dialog */}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogContent className="sm:max-w-lg" dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  إضافة طريقة دفع جديدة
                </DialogTitle>
                <DialogDescription>
                  أضف طريقة دفع يدوية أو اربط بوابة دفع عبر API
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Mode Toggle */}
                <div className="flex gap-2 p-1 bg-muted rounded-lg">
                  <Button
                    type="button"
                    variant={!newAccount.is_api ? "default" : "ghost"}
                    className="flex-1 gap-2"
                    onClick={() => setNewAccount({ ...newAccount, is_api: false })}
                  >
                    <Settings2 className="w-4 h-4" />
                    يدوي
                  </Button>
                  <Button
                    type="button"
                    variant={newAccount.is_api ? "default" : "ghost"}
                    className="flex-1 gap-2"
                    onClick={() => setNewAccount({ ...newAccount, is_api: true })}
                  >
                    <Zap className="w-4 h-4" />
                    API متقدم
                  </Button>
                </div>

                {/* Common Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>اسم طريقة الدفع *</Label>
                    <Input
                      value={newAccount.account_name}
                      onChange={(e) => setNewAccount({ ...newAccount, account_name: e.target.value })}
                      placeholder="مثال: زين كاش"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>معرف الطريقة *</Label>
                    <Input
                      value={newAccount.payment_method}
                      onChange={(e) => setNewAccount({ ...newAccount, payment_method: e.target.value })}
                      placeholder="مثال: zain_cash"
                    />
                  </div>
                </div>

                {/* Manual Mode Fields */}
                {!newAccount.is_api && (
                  <>
                    <div className="space-y-2">
                      <Label>رقم الحساب *</Label>
                      <Input
                        value={newAccount.account_number}
                        onChange={(e) => setNewAccount({ ...newAccount, account_number: e.target.value })}
                        placeholder="مثال: 07801234567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>اسم المستلم</Label>
                      <Input
                        value={newAccount.account_holder}
                        onChange={(e) => setNewAccount({ ...newAccount, account_holder: e.target.value })}
                        placeholder="مثال: AHMED"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>توضيحات للمستخدم</Label>
                      <Textarea
                        value={newAccount.instructions}
                        onChange={(e) => setNewAccount({ ...newAccount, instructions: e.target.value })}
                        placeholder="مثال: يجب إرسال المبلغ باسم AHMED فقط"
                        rows={2}
                      />
                    </div>
                  </>
                )}

                {/* API Mode Fields */}
                {newAccount.is_api && (
                  <>
                    <div className="space-y-2">
                      <Label>مزود الخدمة</Label>
                      <Select
                        value={newAccount.api_provider}
                        onValueChange={(value) => setNewAccount({ 
                          ...newAccount, 
                          api_provider: value,
                          api_config: {} 
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {apiProviders.map(provider => (
                            <SelectItem key={provider.id} value={provider.id}>
                              <div className="flex flex-col">
                                <span>{provider.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {apiProviders.find(p => p.id === newAccount.api_provider)?.description}
                      </p>
                    </div>

                    {/* API Config Fields */}
                    {(() => {
                      const provider = apiProviders.find(p => p.id === newAccount.api_provider);
                      if (!provider) return null;
                      
                      return (
                        <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Key className="w-4 h-4" />
                            إعدادات API
                          </div>
                          {provider.fields.map(field => (
                            <div key={field} className="space-y-1">
                              <Label className="text-sm">{provider.labels[field as keyof typeof provider.labels] || field}</Label>
                              <Input
                                type={field.includes('secret') || field.includes('key') ? 'password' : 'text'}
                                value={newAccount.api_config[field] || ''}
                                onChange={(e) => setNewAccount({
                                  ...newAccount,
                                  api_config: { ...newAccount.api_config, [field]: e.target.value }
                                })}
                                placeholder={`أدخل ${provider.labels[field as keyof typeof provider.labels] || field}`}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        ملاحظة: ربط API يتطلب إعداد Edge Function للمعالجة
                      </p>
                    </div>
                  </>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddDialogOpen(false);
                    setNewAccount({ ...defaultNewAccount });
                  }}
                >
                  إلغاء
                </Button>
                <Button
                  onClick={async () => {
                    if (!newAccount.account_name || !newAccount.payment_method) {
                      toast.error("يرجى ملء الحقول المطلوبة");
                      return;
                    }
                    
                    if (!newAccount.is_api && !newAccount.account_number) {
                      toast.error("يرجى إدخال رقم الحساب");
                      return;
                    }
                    
                    setAddingAccount(true);
                    
                    const accountData = {
                      payment_method: newAccount.payment_method,
                      account_name: newAccount.account_name,
                      account_number: newAccount.is_api ? 'API' : newAccount.account_number,
                      account_holder: newAccount.account_holder || null,
                      instructions: newAccount.instructions || null,
                      is_active: true,
                      api_enabled: newAccount.is_api,
                      api_provider: newAccount.is_api ? newAccount.api_provider : null,
                      api_config: newAccount.is_api ? newAccount.api_config : {},
                      display_order: paymentAccounts.length
                    };
                    
                    const { error } = await supabase
                      .from('payment_accounts')
                      .insert(accountData);
                    
                    if (error) {
                      console.error('Error adding payment account:', error);
                      toast.error("حدث خطأ أثناء إضافة طريقة الدفع");
                    } else {
                      await fetchPaymentAccounts();
                      toast.success("تم إضافة طريقة الدفع بنجاح");
                      setAddDialogOpen(false);
                      setNewAccount({ ...defaultNewAccount });
                    }
                    setAddingAccount(false);
                  }}
                  disabled={addingAccount}
                >
                  {addingAccount ? <RefreshCw className="w-4 h-4 animate-spin ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
                  إضافة
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Support Settings */}
        <TabsContent value="support">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                إعدادات الدعم
              </CardTitle>
              <CardDescription>معلومات التواصل والدعم الفني</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="supportEmail">بريد الدعم</Label>
                  <Input 
                    id="supportEmail"
                    type="email" 
                    value={support.email} 
                    onChange={(e) => setSupport({ ...support, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supportPhone">رقم هاتف الدعم</Label>
                  <Input 
                    id="supportPhone"
                    value={support.phone} 
                    onChange={(e) => setSupport({ ...support, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="terms">شروط الخدمة</Label>
                <Textarea 
                  id="terms"
                  placeholder="أدخل شروط الخدمة..."
                  value={support.terms}
                  onChange={(e) => setSupport({ ...support, terms: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="privacy">سياسة الخصوصية</Label>
                <Textarea 
                  id="privacy"
                  placeholder="أدخل سياسة الخصوصية..."
                  value={support.privacy}
                  onChange={(e) => setSupport({ ...support, privacy: e.target.value })}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default AdminSettings;
