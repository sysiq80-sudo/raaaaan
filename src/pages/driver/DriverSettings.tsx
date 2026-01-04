import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { User, Session } from "@supabase/supabase-js";
import ThemeToggle from "@/components/ThemeToggle";
import { 
  Car, 
  ArrowRight,
  User as UserIcon,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Vibrate,
  Globe,
  LogOut,
  Save,
  MapPin,
  AlertCircle,
  CheckCircle2
} from "lucide-react";

// Local storage keys for notification preferences
const NOTIFICATION_PREFS_KEY = 'driver_notification_prefs';

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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
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

  const [generalPrefs, setGeneralPrefs] = useState({
    language: "ar",
    auto_accept: false,
  });

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
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission('unsupported');
    }
  }, []);

  // Save notification preferences to localStorage
  const saveNotificationPrefs = (prefs: NotificationPreferences) => {
    setNotificationPrefs(prefs);
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('متصفحك لا يدعم الإشعارات');
      return;
    }

    try {
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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchDriverProfile();
    }
  }, [user]);

  const fetchDriverProfile = async () => {
    try {
      const { data: driver } = await supabase
        .from("drivers")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (driver) {
        setDriverProfile({
          full_name: driver.full_name || "",
          phone: driver.phone || "",
          email: driver.email || "",
          vehicle_model: driver.vehicle_model || "",
          vehicle_color: driver.vehicle_color || "",
          vehicle_plate: driver.vehicle_plate || "",
          max_pickup_radius: driver.max_pickup_radius || 10,
        });
      }
    } catch (error) {
      console.error("Error fetching driver profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("drivers")
        .update({
          full_name: driverProfile.full_name,
          phone: driverProfile.phone,
          email: driverProfile.email,
          vehicle_model: driverProfile.vehicle_model,
          vehicle_color: driverProfile.vehicle_color,
          vehicle_plate: driverProfile.vehicle_plate,
          max_pickup_radius: driverProfile.max_pickup_radius,
        })
        .eq("user_id", user!.id);

      if (error) throw error;
      
      // Save notification prefs
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
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary flex items-center justify-center mb-4 animate-pulse">
            <Car className="w-10 h-10 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container flex items-center h-16">
          <Link to="/driver" className="p-2">
            <ArrowRight className="w-6 h-6" />
          </Link>
          <h1 className="flex-1 text-center font-bold text-lg">الإعدادات</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-8 px-4">
        <div className="container max-w-lg space-y-6">
          
          {/* Notification Settings Section */}
          <Card>
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
                      <p className="font-medium text-foreground">إشعارات المتصفح</p>
                      <p className="text-sm text-muted-foreground">
                        {notificationPermission === 'granted' 
                          ? 'مفعّلة ✓' 
                          : notificationPermission === 'denied'
                          ? 'محظورة - فعّلها من إعدادات المتصفح'
                          : notificationPermission === 'unsupported'
                          ? 'غير مدعومة'
                          : 'غير مفعّلة'}
                      </p>
                    </div>
                  </div>
                  {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
                    <Button size="sm" onClick={requestNotificationPermission}>
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
          <Card>
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
                  onChange={(e) => setDriverProfile({ ...driverProfile, full_name: e.target.value })}
                  placeholder="اسمك الكامل"
                />
              </div>
              <div>
                <Label>رقم الهاتف</Label>
                <Input
                  value={driverProfile.phone}
                  onChange={(e) => setDriverProfile({ ...driverProfile, phone: e.target.value })}
                  placeholder="07XXXXXXXXX"
                  dir="ltr"
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
            </CardContent>
          </Card>

          {/* Vehicle Section */}
          <Card>
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
                  onChange={(e) => setDriverProfile({ ...driverProfile, vehicle_model: e.target.value })}
                  placeholder="مثال: تويوتا كورولا 2020"
                />
              </div>
              <div>
                <Label>لون السيارة</Label>
                <Input
                  value={driverProfile.vehicle_color}
                  onChange={(e) => setDriverProfile({ ...driverProfile, vehicle_color: e.target.value })}
                  placeholder="مثال: أبيض"
                />
              </div>
              <div>
                <Label>رقم اللوحة</Label>
                <Input
                  value={driverProfile.vehicle_plate}
                  onChange={(e) => setDriverProfile({ ...driverProfile, vehicle_plate: e.target.value })}
                  placeholder="رقم لوحة السيارة"
                  dir="ltr"
                />
              </div>
            </CardContent>
          </Card>

          {/* Work Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="w-5 h-5 text-primary" />
                تفضيلات العمل
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>نطاق استقبال الطلبات</Label>
                  <span className="text-sm font-medium text-primary">{driverProfile.max_pickup_radius} كم</span>
                </div>
                <Slider
                  value={[driverProfile.max_pickup_radius]}
                  onValueChange={(value) => setDriverProfile({ ...driverProfile, max_pickup_radius: value[0] })}
                  min={1}
                  max={30}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  ستصلك طلبات من الركاب ضمن هذا النطاق فقط
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">القبول التلقائي</p>
                  <p className="text-sm text-muted-foreground">قبول الطلبات تلقائياً</p>
                </div>
                <Switch
                  checked={generalPrefs.auto_accept}
                  onCheckedChange={(checked) => setGeneralPrefs({ ...generalPrefs, auto_accept: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Language Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="w-5 h-5 text-primary" />
                اللغة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={generalPrefs.language}
                onValueChange={(value) => setGeneralPrefs({ ...generalPrefs, language: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر اللغة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="ku">الكردية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

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
