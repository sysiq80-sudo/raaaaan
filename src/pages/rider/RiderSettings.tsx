import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import ThemeToggle from "@/components/ThemeToggle";
import { 
  ArrowRight,
  User as UserIcon,
  Bell,
  Globe,
  Save,
  Loader2,
  MapPin,
  ChevronLeft
} from "lucide-react";

interface Profile {
  full_name: string | null;
  phone: string | null;
  email: string | null;
  preferred_language: string | null;
}

const RiderSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [profile, setProfile] = useState<Profile>({
    full_name: "",
    phone: "",
    email: "",
    preferred_language: "ar"
  });
  
  const [notifications, setNotifications] = useState({
    rideUpdates: true,
    promotions: false,
    sound: true
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await fetchProfile(session.user.id);
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, phone, email, preferred_language")
      .eq("user_id", userId)
      .single();

    if (!error && data) {
      setProfile({
        full_name: data.full_name || "",
        phone: data.phone || "",
        email: data.email || "",
        preferred_language: data.preferred_language || "ar"
      });
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    
    // Update profile in database
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
        email: profile.email,
        preferred_language: profile.preferred_language
      })
      .eq("user_id", user.id);

    if (profileError) {
      toast({
        title: "خطأ",
        description: "فشل حفظ الإعدادات",
        variant: "destructive"
      });
      setSaving(false);
      return;
    }

    toast({
      title: "تم الحفظ",
      description: "تم حفظ إعداداتك بنجاح"
    });
    setSaving(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container flex items-center justify-between h-16">
          <Button variant="ghost" size="icon" onClick={() => navigate("/rider")}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg">الإعدادات</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Content */}
      <main className="pt-20 pb-8 px-4">
        <div className="container max-w-lg space-y-6">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserIcon className="w-5 h-5 text-primary" />
                الملف الشخصي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">الاسم الكامل</Label>
                <Input
                  id="fullName"
                  value={profile.full_name || ""}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="أدخل اسمك الكامل"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input
                  id="phone"
                  value={profile.phone || ""}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="07XX XXX XXXX"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني (اختياري)</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email || ""}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="example@email.com"
                  dir="ltr"
                />
              </div>
            </CardContent>
          </Card>

          {/* Notifications Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="w-5 h-5 text-primary" />
                الإشعارات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">تحديثات الرحلة</p>
                  <p className="text-sm text-muted-foreground">إشعارات عن حالة رحلتك</p>
                </div>
                <Switch
                  checked={notifications.rideUpdates}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, rideUpdates: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">العروض والخصومات</p>
                  <p className="text-sm text-muted-foreground">إشعارات عن العروض الجديدة</p>
                </div>
                <Switch
                  checked={notifications.promotions}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, promotions: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">الأصوات</p>
                  <p className="text-sm text-muted-foreground">تفعيل صوت الإشعارات</p>
                </div>
                <Switch
                  checked={notifications.sound}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, sound: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Saved Places Card */}
          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => navigate("/rider/saved-places")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">الأماكن المحفوظة</p>
                    <p className="text-sm text-muted-foreground">المنزل، العمل، والأماكن المفضلة</p>
                  </div>
                </div>
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Language Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="w-5 h-5 text-primary" />
                اللغة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={profile.preferred_language || "ar"}
                onValueChange={(value) => setProfile({ ...profile, preferred_language: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر اللغة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="ku">کوردی</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-3">
            <Button 
              className="w-full h-12" 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin ml-2" />
              ) : (
                <Save className="w-5 h-5 ml-2" />
              )}
              حفظ التغييرات
            </Button>
            <Button 
              variant="outline" 
              className="w-full h-12 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleLogout}
            >
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RiderSettings;
