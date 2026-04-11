import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  User,
  Phone,
  Mail,
  Bell,
  LogOut,
  Trash2,
  Loader2,
  Save,
  Palette,
  Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";
import ThemeToggle from "@/components/ThemeToggle";
import RiderPageHeader from "@/components/rider/RiderPageHeader";
import {
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  isPushNotificationEnabled,
  registerServiceWorker,
} from "@/utils/serviceWorker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ReferralCard, ReferralInput } from "@/components/rider/ReferralCard";

interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
}

const RiderSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isDark } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  // Check actual push notification status
  useEffect(() => {
    const checkNotifStatus = async () => {
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const subscribed = await isPushNotificationEnabled();
          setNotificationsEnabled(subscribed);
        }
      } catch {
        // Notification API not available (Android WebView)
      }
    };
    checkNotifStatus();
  }, []);

  const handleToggleNotifications = async () => {
    if (!userId) return;
    setNotifLoading(true);
    try {
      if (notificationsEnabled) {
        await unsubscribeFromPushNotifications(userId, 'rider');
        setNotificationsEnabled(false);
        toast({ title: "تم إيقاف الإشعارات", description: "لن تصلك تنبيهات تحديثات الرحلات" });
      } else {
        await registerServiceWorker();
        const perm = await requestNotificationPermission();
        if (perm === 'granted') {
          const sub = await subscribeToPushNotifications(userId, 'rider');
          if (sub) {
            setNotificationsEnabled(true);
            toast({ title: "تم تفعيل الإشعارات ✅", description: "ستصلك تنبيهات تحديثات رحلاتك" });
          } else {
            toast({ title: "خطأ", description: "فشل تفعيل الإشعارات، حاول مرة أخرى", variant: "destructive" });
          }
        } else if (perm === 'denied') {
          toast({ title: "الإشعارات محظورة", description: "افتح إعدادات المتصفح وامنح الصلاحية لهذا الموقع", variant: "destructive" });
        }
      }
    } catch (err) {
      console.error('Notification toggle error:', err);
      toast({ title: "خطأ", description: "حدث خطأ غير متوقع", variant: "destructive" });
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate("/auth?redirect=/rider/settings");
        return;
      }
      setUserId(data.user.id);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  const fetchProfile = async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (!error && data) {
      setProfile(data);
      setFullName(data.full_name || "");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!userId || !fullName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() })
      .eq("user_id", userId);
    if (error) {
      toast({ title: "خطأ", description: "فشل في حفظ التغييرات", variant: "destructive" });
    } else {
      toast({ title: "تم حفظ التغييرات بنجاح ✅" });
      fetchProfile();
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const getInitials = (name: string | null) => {
    if (!name) return "؟";
    const parts = name.split(" ");
    return parts.length > 1 ? parts[0][0] + parts[1][0] : name.substring(0, 2);
  };

  /* ── مكون عنصر إعداد ── */
  const SettingRow = ({
    icon: Icon,
    iconColor,
    title,
    subtitle,
    trailing,
  }: {
    icon: React.ElementType;
    iconColor: string;
    title: string;
    subtitle: string;
    trailing: React.ReactNode;
  }) => (
    <div
      className="flex items-center justify-between p-3.5 rounded-xl"
      style={{ background: 'var(--raan-surface-alt)', border: '1px solid var(--raan-border)' }}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
        <div>
          <p className="text-[13px] font-semibold" style={{ color: 'var(--raan-text)' }}>{title}</p>
          <p className="text-[11px]" style={{ color: 'var(--raan-text-sub)' }}>{subtitle}</p>
        </div>
      </div>
      {trailing}
    </div>
  );

  /* ── مكون Toggle ── */
  const Toggle = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: () => void;
  }) => (
    <button
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors duration-300 flex-shrink-0 ${
        checked ? "bg-emerald-500" : "bg-slate-700"
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${
          checked ? "right-0.5" : "left-0.5"
        }`}
      />
    </button>
  );

  return (
    <div
      className="flex flex-col min-h-full transition-colors duration-300"
      style={{ background: 'var(--raan-bg)' }}
      dir="rtl"
    >
      <RiderPageHeader title="الإعدادات" />

      <div className="pt-16 p-4 pb-8 space-y-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" />
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <User className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            <p className="text-sm text-slate-400">جاري تحميل الإعدادات...</p>
          </div>
        ) : (
          <>
            {/* ── معلومات الحساب ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-[#171f33] rounded-2xl border border-slate-700/40 overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-700/30">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-[15px] font-bold text-white">معلومات الحساب</h3>
                </div>
              </div>
              <div className="p-5 space-y-5">
                {/* الصورة الشخصية */}
                <div className="flex justify-center">
                  <div className="relative">
                    <Avatar className="w-20 h-20 border-2 border-emerald-500/30">
                      <AvatarImage src={profile?.avatar_url || ""} />
                      <AvatarFallback className="text-xl bg-emerald-500/15 text-emerald-400 font-bold">
                        {getInitials(profile?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-[#151f30]">
                      <User className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>

                {/* الاسم */}
                <div className="space-y-2">
                  <label className="text-slate-300 text-[13px] font-medium">الاسم الكامل</label>
                  <div className="relative">
                    <div className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none">
                      <User className="w-[18px] h-[18px] text-emerald-400" />
                    </div>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="أدخل اسمك"
                      className="h-12 bg-[#0f1726] border border-slate-700/40 text-white placeholder:text-slate-500 rounded-xl pr-11 text-[14px] focus:border-[#5bdda6]/50 focus:ring-1 focus:ring-[#5bdda6]/20"
                    />
                  </div>
                </div>

                {/* الهاتف */}
                <div className="space-y-2">
                  <label className="text-slate-300 text-[13px] font-medium flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-400" />
                    رقم الهاتف
                  </label>
                  <div className="h-12 bg-[#1a2536] border border-slate-700/30 rounded-xl flex items-center px-4 text-[14px] text-slate-400" dir="ltr">
                    {profile?.phone || "—"}
                  </div>
                </div>

                {/* البريد */}
                {profile?.email && (
                  <div className="space-y-2">
                    <label className="text-slate-300 text-[13px] font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      البريد الإلكتروني
                    </label>
                    <div className="h-12 bg-[#1a2536] border border-slate-700/30 rounded-xl flex items-center px-4 text-[14px] text-slate-400" dir="ltr">
                      {profile.email}
                    </div>
                  </div>
                )}

                {/* زر الحفظ */}
                <button
                  onClick={handleSave}
                  disabled={saving || !fullName.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#5bdda6] hover:bg-[#4ecf99] text-[#0b1326] font-bold text-[14px] shadow-lg shadow-[#5bdda6]/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  حفظ التغييرات
                </button>
              </div>
            </motion.div>

            {/* ── المظهر ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--raan-surface)', border: '1px solid var(--raan-border)' }}
            >
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--raan-divider)' }}>
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5" style={{ color: 'var(--raan-accent)' }} />
                  <h3 className="text-[15px] font-bold" style={{ color: 'var(--raan-text)' }}>مظهر التطبيق</h3>
                </div>
              </div>
              <div className="p-4">
                <ThemeToggle />
              </div>
            </motion.div>

            {/* ── الإعدادات العامة ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--raan-surface)', border: '1px solid var(--raan-border)' }}
            >
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--raan-divider)' }}>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5" style={{ color: 'var(--raan-accent)' }} />
                  <h3 className="text-[15px] font-bold" style={{ color: 'var(--raan-text)' }}>الإعدادات العامة</h3>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <SettingRow
                  icon={Bell}
                  iconColor="bg-emerald-500/15 text-emerald-400"
                  title="الإشعارات"
                  subtitle={notificationsEnabled ? "الإشعارات مفعّلة" : "فعّل لاستلام تحديثات الرحلات"}
                  trailing={
                    notifLoading
                      ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--raan-text-sub)' }} />
                      : <Toggle checked={notificationsEnabled} onChange={handleToggleNotifications} />
                  }
                />
              </div>
            </motion.div>

            {/* ── نظام الإحالات ── */}
            {userId && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="space-y-3"
              >
                <ReferralCard userId={userId} variant="compact" />
                <ReferralInput userId={userId} />
              </motion.div>
            )}

            {/* ── تسجيل الخروج وحذف الحساب ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="space-y-3"
            >
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 font-semibold text-[14px] hover:bg-red-500/20 active:bg-red-500/30 transition-all"
              >
                <LogOut className="w-4 h-4" />
                تسجيل الخروج
              </button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-slate-500 hover:text-red-400 text-[13px] transition-colors">
                    <Trash2 className="w-4 h-4" />
                    حذف الحساب
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-[#151f30] border-slate-700/50">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">هل أنت متأكد؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-400">
                      سيتم حذف حسابك وجميع بياناتك بشكل نهائي. هذا الإجراء لا يمكن التراجع عنه.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-[#1a2536] border-slate-700/50 text-white hover:bg-[#1f2d44]">إلغاء</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-500 hover:bg-red-600 text-white"
                      onClick={async () => {
                        if (!userId) return;
                        try {
                          const { data, error } = await supabase.functions.invoke("delete-user-account", {
                            body: { user_id: userId },
                          });
                          if (error) throw error;
                          toast({
                            title: "تم حذف الحساب",
                            description: "تم حذف حسابك وجميع بياناتك بنجاح",
                          });
                          await supabase.auth.signOut();
                          navigate("/auth", { replace: true });
                        } catch (err: any) {
                          toast({
                            title: "خطأ",
                            description: err.message || "حدث خطأ أثناء حذف الحساب",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      حذف الحساب
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default RiderSettingsPage;
