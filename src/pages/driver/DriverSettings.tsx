import { useState, useEffect } from "react";
import SplashScreen from "@/components/common/SplashScreen";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import RadiusSlider from "@/components/driver/RadiusSlider";
import { toast } from "sonner";
import { isNativePlatform } from "@/lib/capacitorBridge";
import { registerFCMToken } from "@/services/driverNotificationService";
import ThemeToggle from "@/components/ThemeToggle";
import { NotificationMuteScheduler } from "@/components/driver/NotificationMuteScheduler";
import { useDriverSession } from "@/hooks/useDriverSession";
import DriverPageHeader from "@/components/driver/DriverPageHeader";
import { useNavigate } from "react-router-dom";
import {
  Car, 
  User as UserIcon,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Vibrate,
  LogOut,
  Save,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Shield
} from "lucide-react";

// Local storage keys for notification preferences
const NOTIFICATION_PREFS_KEY = 'driver_notification_prefs';

type DriverSettingsRecord = {
  email?: string | null;
  max_pickup_radius?: number | null;
  full_name?: string | null;
  phone?: string | null;
  vehicle_model?: string | null;
  vehicle_color?: string | null;
  vehicle_plate?: string | null;
  auto_accept?: boolean | null;
};

type DriversTable = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{ data: DriverSettingsRecord | null; error: unknown }>;
    };
  };
  update: (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => Promise<{ error: unknown }>;
  };
};

const getDriversTable = () => supabase.from("drivers") as unknown as DriversTable;

interface NotificationPreferences {
  pushEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  soundVolume: number;
  newRideAlerts: boolean;
  rideUpdateAlerts: boolean;
  earningsAlerts: boolean;
  promotionAlerts: boolean;
}

const defaultNotificationPrefs: NotificationPreferences = {
  pushEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  soundVolume: 80,
  newRideAlerts: true,
  rideUpdateAlerts: true,
  earningsAlerts: true,
  promotionAlerts: false,
};

const DriverSettings = () => {
  const navigate = useNavigate();
  const { driver: sessionDriver, loading: authLoading } = useDriverSession();
  const [saving, setSaving] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');
  
  const [driverProfile, setDriverProfile] = useState({
    full_name: "",
    phone: "",
    email: "",
    vehicle_model: "",
    vehicle_color: "",
    vehicle_plate: "",
    max_pickup_radius: 10,
  });

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(defaultNotificationPrefs);
  const [driverId, setDriverId] = useState<string | null>(sessionDriver?.driverId ?? null);

  const [autoAccept, setAutoAccept] = useState(false);

  // sync driverId من الـ hook
  useEffect(() => {
    if (sessionDriver) setDriverId(sessionDriver.driverId);
  }, [sessionDriver]);

  // إزالة driver-mode لتفعيل السكرول
  useEffect(() => {
    const had = document.body.classList.contains('driver-mode');
    document.body.classList.remove('driver-mode');
    document.body.style.overflow = 'auto';
    document.body.style.position = 'static';
    return () => {
      if (had) document.body.classList.add('driver-mode');
      document.body.style.overflow = '';
      document.body.style.position = '';
    };
  }, []);

  // Load notification preferences from localStorage
  useEffect(() => {
    const savedPrefs = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (savedPrefs) {
      try {
        setNotificationPrefs({ ...defaultNotificationPrefs, ...JSON.parse(savedPrefs) });
      } catch (e) {
        console.error('Error parsing notification prefs:', e);
      }
    }

    // Check notification permission
    if (isNativePlatform) {
      // في التطبيق الأصلي، الإشعارات تعمل عبر FCM
      const hasFcmToken = !!localStorage.getItem('raan_fcm_token');
      setNotificationPermission(hasFcmToken ? 'granted' : 'default');
    } else {
      try {
        if (typeof Notification !== 'undefined') {
          setNotificationPermission(Notification.permission);
        } else {
          setNotificationPermission('unsupported');
        }
      } catch {
        setNotificationPermission('unsupported');
      }
    }
  }, []);

  // Save notification preferences to localStorage
  const saveNotificationPrefs = (prefs: NotificationPreferences) => {
    setNotificationPrefs(prefs);
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
  };

  const requestNotificationPermission = async () => {
    try {
      if (typeof Notification === 'undefined') {
        toast.error('متصفحك لا يدعم الإشعارات');
        return;
      }

      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        toast.success('تم تفعيل الإشعارات بنجاح');
        saveNotificationPrefs({ ...notificationPrefs, pushEnabled: true });
        
        // Test notification
        new Notification('ران كابتن 🚗', {
          body: 'تم تفعيل الإشعارات! ستصلك تنبيهات الطلبات الجديدة.',
          icon: '/favicon.ico'
        });
      } else {
        toast.error('لم يتم منح الإذن للإشعارات');
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error('حدث خطأ أثناء طلب الإذن');
    }
  };

  // تفعيل إشعارات FCM للتطبيق الأصلي
  const handleEnableNativeNotifications = async () => {
    if (!driverId) {
      toast.error('لم يتم تحديد هوية السائق');
      return;
    }
    try {
      const success = await registerFCMToken(driverId);
      if (success) {
        setNotificationPermission('granted');
        saveNotificationPrefs({ ...notificationPrefs, pushEnabled: true });
        toast.success('تم تفعيل إشعارات التطبيق بنجاح');
      } else {
        toast.error('فشل تفعيل الإشعارات - تأكد من منح الإذن');
      }
    } catch (error) {
      console.error('FCM registration error:', error);
      toast.error('حدث خطأ أثناء تفعيل الإشعارات');
    }
  };

  // Test notification sound
  const testNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const volume = notificationPrefs.soundVolume / 100;
      
      const playTone = (frequency: number, duration: number, startTime: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume * 0.5, startTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = audioContext.currentTime;
      playTone(880, 0.12, now);
      playTone(1108.73, 0.12, now + 0.12);
      playTone(1318.51, 0.25, now + 0.24);
      
      toast.success('تم تشغيل صوت التنبيه');
    } catch (e) {
      toast.error('صوت التنبيه غير مدعوم');
    }
  };

  // Test vibration
  const testVibration = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
      toast.success('تم تشغيل الاهتزاز');
    } else {
      toast.error('الاهتزاز غير مدعوم على هذا الجهاز');
    }
  };

  // جلب بيانات إضافية من الـ driver مباشرة بعد توفر sessionDriver
  useEffect(() => {
    if (!sessionDriver) return;
    const load = async () => {
      const { data: dr, error } = await getDriversTable()
        .select("email, max_pickup_radius, full_name, phone, vehicle_model, vehicle_color, vehicle_plate, auto_accept")
        .eq("user_id", sessionDriver.userId)
        .maybeSingle();
      if (error) {
        console.error("Error loading driver settings:", error);
        return;
      }
      if (dr) {
        setDriverProfile({
          full_name: dr.full_name || "",
          phone: dr.phone || "",
          email: dr.email || "",
          vehicle_model: dr.vehicle_model || "",
          vehicle_color: dr.vehicle_color || "",
          vehicle_plate: dr.vehicle_plate || "",
          max_pickup_radius: dr.max_pickup_radius ?? 10,
        });
        setAutoAccept(dr.auto_accept ?? false);
      }
    };
    load();
  }, [sessionDriver]);

  const handleSaveProfile = async () => {
    if (!sessionDriver) return;
    setSaving(true);
    try {
      const { error } = await getDriversTable()
        .update({
          email: driverProfile.email,
          max_pickup_radius: driverProfile.max_pickup_radius,
          auto_accept: autoAccept,
        })
        .eq("user_id", sessionDriver.userId);

      if (error) throw error;
      
      localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(notificationPrefs));
      toast.success("تم حفظ التغييرات بنجاح");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("فشل في حفظ التغييرات");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (sessionDriver?.driverId) {
      await getDriversTable().update({ is_online: false, is_available: false }).eq("id", sessionDriver.driverId);
    }
    await supabase.auth.signOut();
    navigate("/driver/auth", { replace: true });
  };

  if (authLoading) {
    return <SplashScreen />;
  }

  if (!sessionDriver) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0b1326] overflow-y-auto" dir="rtl">
      <DriverPageHeader title="الإعدادات" />
      {/* Main Content */}
      <main className="pt-20 pb-8 px-4">
        <div className="container max-w-lg space-y-6">
          
          {/* Notification Settings Section */}
          <Card className="driver-geometric-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="w-5 h-5 text-primary" />
                إعدادات الإشعارات
              </CardTitle>
              <CardDescription>
                تحكم بأنواع التنبيهات التي تصلك
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Mute Scheduler — جدولة كتم الإشعارات */}
              {driverId && (
                <NotificationMuteScheduler driverId={driverId} />
              )}

              <Separator />
              
              {/* Push Notification Permission Status */}
              <div className="p-4 rounded-lg bg-secondary/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {notificationPermission === 'granted' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : notificationPermission === 'denied' ? (
                      <AlertCircle className="w-5 h-5 text-destructive" />
                    ) : (
                      <BellRing className="w-5 h-5 text-amber-500" />
                    )}
                    <div>
                      <p className="font-medium text-foreground">
                        {isNativePlatform ? 'إشعارات التطبيق' : 'إشعارات المتصفح'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {notificationPermission === 'granted' 
                          ? (isNativePlatform ? 'مفعّلة عبر FCM ✓' : 'مفعّلة ✓')
                          : notificationPermission === 'denied'
                          ? (isNativePlatform ? 'محظورة - فعّلها من إعدادات التطبيق' : 'محظورة - فعّلها من إعدادات المتصفح')
                          : notificationPermission === 'unsupported'
                          ? 'غير مدعومة'
                          : (isNativePlatform ? 'اضغط تفعيل لاستقبال الإشعارات' : 'غير مفعّلة')}
                      </p>
                    </div>
                  </div>
                  {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
                    <Button size="sm" onClick={isNativePlatform ? handleEnableNativeNotifications : requestNotificationPermission}>
                      تفعيل
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              {/* Sound Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {notificationPrefs.soundEnabled ? (
                      <Volume2 className="w-5 h-5 text-primary" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium text-foreground">صوت التنبيه</p>
                      <p className="text-sm text-muted-foreground">تشغيل صوت عند وصول طلب</p>
                    </div>
                  </div>
                  <Switch
                    checked={notificationPrefs.soundEnabled}
                    onCheckedChange={(checked) => saveNotificationPrefs({ ...notificationPrefs, soundEnabled: checked })}
                  />
                </div>

                {notificationPrefs.soundEnabled && (
                  <div className="pr-8 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">مستوى الصوت</span>
                      <span className="font-medium">{notificationPrefs.soundVolume}%</span>
                    </div>
                    <Slider
                      value={[notificationPrefs.soundVolume]}
                      onValueChange={(value) => saveNotificationPrefs({ ...notificationPrefs, soundVolume: value[0] })}
                      max={100}
                      step={10}
                      className="w-full"
                    />
                    <Button variant="outline" size="sm" onClick={testNotificationSound}>
                      تجربة الصوت
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* Vibration Settings */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Vibrate className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">الاهتزاز</p>
                    <p className="text-sm text-muted-foreground">اهتزاز الجهاز عند الإشعارات</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={testVibration}>
                    تجربة
                  </Button>
                  <Switch
                    checked={notificationPrefs.vibrationEnabled}
                    onCheckedChange={(checked) => saveNotificationPrefs({ ...notificationPrefs, vibrationEnabled: checked })}
                  />
                </div>
              </div>

              <Separator />

              {/* Alert Types */}
              <div className="space-y-4">
                <p className="font-medium text-foreground">أنواع التنبيهات</p>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">طلبات جديدة</p>
                    <p className="text-xs text-muted-foreground">إشعار عند وصول طلب رحلة</p>
                  </div>
                  <Switch
                    checked={notificationPrefs.newRideAlerts}
                    onCheckedChange={(checked) => saveNotificationPrefs({ ...notificationPrefs, newRideAlerts: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">تحديثات الرحلة</p>
                    <p className="text-xs text-muted-foreground">إشعارات إلغاء أو تغيير الرحلة</p>
                  </div>
                  <Switch
                    checked={notificationPrefs.rideUpdateAlerts}
                    onCheckedChange={(checked) => saveNotificationPrefs({ ...notificationPrefs, rideUpdateAlerts: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">تقارير الأرباح</p>
                    <p className="text-xs text-muted-foreground">ملخص الأرباح اليومية</p>
                  </div>
                  <Switch
                    checked={notificationPrefs.earningsAlerts}
                    onCheckedChange={(checked) => saveNotificationPrefs({ ...notificationPrefs, earningsAlerts: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">العروض والتحديثات</p>
                    <p className="text-xs text-muted-foreground">أخبار ران والعروض الخاصة</p>
                  </div>
                  <Switch
                    checked={notificationPrefs.promotionAlerts}
                    onCheckedChange={(checked) => saveNotificationPrefs({ ...notificationPrefs, promotionAlerts: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Section */}
          <Card className="driver-geometric-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserIcon className="w-5 h-5 text-primary" />
                معلومات الحساب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>الاسم الكامل</Label>
                <Input
                  value={driverProfile.full_name}
                  disabled
                  className="bg-muted/50 cursor-not-allowed"
                />
              </div>
              <div>
                <Label>رقم الهاتف</Label>
                <Input
                  value={driverProfile.phone}
                  disabled
                  dir="ltr"
                  className="bg-muted/50 cursor-not-allowed"
                />
              </div>
              <div>
                <Label>البريد الإلكتروني (اختياري)</Label>
                <Input
                  type="email"
                  value={driverProfile.email}
                  onChange={(e) => setDriverProfile({ ...driverProfile, email: e.target.value })}
                  placeholder="example@email.com"
                  dir="ltr"
                />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="w-3 h-3" />
                لتعديل الاسم أو الهاتف، أرسل طلب من صفحة الملف الشخصي
              </p>
            </CardContent>
          </Card>

          {/* Vehicle Section */}
          <Card className="driver-geometric-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Car className="w-5 h-5 text-primary" />
                معلومات السيارة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>موديل السيارة</Label>
                <Input
                  value={driverProfile.vehicle_model}
                  disabled
                  className="bg-muted/50 cursor-not-allowed"
                />
              </div>
              <div>
                <Label>لون السيارة</Label>
                <Input
                  value={driverProfile.vehicle_color}
                  disabled
                  className="bg-muted/50 cursor-not-allowed"
                />
              </div>
              <div>
                <Label>رقم اللوحة</Label>
                <Input
                  value={driverProfile.vehicle_plate}
                  disabled
                  dir="ltr"
                  className="bg-muted/50 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="w-3 h-3" />
                بيانات السيارة لا تُعدّل إلا من الإدارة. أرسل طلب من الملف الشخصي.
              </p>
            </CardContent>
          </Card>

          {/* Work Preferences */}
          <Card className="driver-geometric-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="w-5 h-5 text-primary" />
                تفضيلات العمل
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadiusSlider
                value={driverProfile.max_pickup_radius}
                onChange={(v) => setDriverProfile({ ...driverProfile, max_pickup_radius: v })}
                min={1}
                max={30}
                step={1}
                driverLocation={null}
                workingRegionId={null}
              />

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">القبول التلقائي</p>
                  <p className="text-sm text-muted-foreground">قبول الطلبات تلقائياً</p>
                </div>
                <Switch
                  checked={autoAccept}
                  onCheckedChange={setAutoAccept}
                />
              </div>
            </CardContent>
          </Card>

          {/* Theme Toggle */}
          <ThemeToggle />


          {/* Save Button */}
          <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
            <Save className="w-4 h-4 ml-2" />
            {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
          </Button>

          {/* Logout Button */}
          <Button variant="destructive" onClick={handleLogout} className="w-full">
            <LogOut className="w-4 h-4 ml-2" />
            تسجيل الخروج
          </Button>
        </div>
      </main>
    </div>
  );
};

export default DriverSettings;
