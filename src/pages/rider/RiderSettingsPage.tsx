import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Banknote,
  Bell,
  ChevronLeft,
  CreditCard,
  FileText,
  HelpCircle,
  Languages,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Palette,
  Phone,
  Save,
  Shield,
  Trash2,
  User,
  Volume2,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RiderAvatarUpload } from "@/components/rider/RiderAvatarUpload";
import RiderPageHeader from "@/components/rider/RiderPageHeader";
import ThemeToggle from "@/components/ThemeToggle";
import { ReferralCard, ReferralInput } from "@/components/rider/ReferralCard";
import { useAuth } from "@/contexts/AuthContext";
import { useSupportSettings } from "@/hooks/useSupportSettings";
import { useToast } from "@/hooks/use-toast";
import i18n from "@/lib/i18nConfig";
import useRiderStore from "@/stores/riderStore";
import type { PaymentMethod } from "@/types/savedCards";
import { supabase } from "@/integrations/supabase/client";
import {
  isPushNotificationEnabled,
  registerServiceWorker,
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from "@/utils/serviceWorker";
import { setSoundEnabled } from "@/utils/sounds";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  preferred_language: string | null;
}

type LanguageCode = "ar" | "ku" | "en";

const languageOptions: Array<{ value: LanguageCode; label: string; hint: string }> = [
  { value: "ar", label: "العربية", hint: "واجهة عربية واتجاه من اليمين" },
  { value: "ku", label: "کوردی", hint: "واجهة كردية عند توفر الترجمات" },
  { value: "en", label: "English", hint: "English interface where available" },
];

const paymentOptions: Array<{
  value: Extract<PaymentMethod, "cash" | "wallet">;
  label: string;
  hint: string;
  icon: React.ElementType;
}> = [
  { value: "cash", label: "نقداً", hint: "الدفع للسائق عند نهاية الرحلة", icon: Banknote },
  { value: "wallet", label: "المحفظة", hint: "استخدام رصيد المحفظة عند توفره", icon: Wallet },
];

const DELETE_CONFIRM_PHRASE = "حذف حسابي";

const getUserPhone = (user: ReturnType<typeof useAuth>["user"]) => {
  if (!user) return "";
  return user.phone || (user.user_metadata?.phone as string | undefined) || "";
};

const getUserName = (user: ReturnType<typeof useAuth>["user"]) => {
  if (!user) return "";
  return (
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    ""
  );
};

const RiderSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const { support } = useSupportSettings();

  const selectedPayment = useRiderStore((state) => state.selectedPayment);
  const setPayment = useRiderStore((state) => state.setPayment);
  const soundsEnabled = useRiderStore((state) => state.soundsEnabled);
  const toggleSounds = useRiderStore((state) => state.toggleSounds);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [language, setLanguage] = useState<LanguageCode>(() => {
    const stored = localStorage.getItem("raan-language");
    return stored === "ku" || stored === "en" ? stored : "ar";
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteChecking, setDeleteChecking] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteBlockers, setDeleteBlockers] = useState<string[]>([]);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleteReason, setDeleteReason] = useState("");

  const userId = user?.id || null;
  const fallbackPhone = getUserPhone(user);
  const fallbackEmail = user?.email || "";

  const supportWhatsapp = useMemo(
    () => (support.whatsapp || support.phone || "").replace(/[^\d]/g, ""),
    [support.phone, support.whatsapp],
  );

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,user_id,full_name,phone,email,avatar_url,preferred_language")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data);
        setFullName(data.full_name || getUserName(user) || "");

        const profileLang = data.preferred_language;
        if (profileLang === "ar" || profileLang === "ku" || profileLang === "en") {
          setLanguage(profileLang);
          localStorage.setItem("raan-language", profileLang);
          void i18n.changeLanguage(profileLang);
        }
      } else {
        setProfile(null);
        setFullName(getUserName(user) || "");
      }
    } catch (error) {
      console.error("Error loading rider settings:", error);
      toast({
        title: "تعذر تحميل الإعدادات",
        description: "تحقق من الاتصال ثم حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if (!user) {
      navigate("/auth?redirect=/rider/settings", { replace: true });
      return;
    }

    void fetchProfile();
  }, [fetchProfile, navigate, user]);

  useEffect(() => {
    const checkNotifStatus = async () => {
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          setNotificationsEnabled(await isPushNotificationEnabled());
        }
      } catch {
        setNotificationsEnabled(false);
      }
    };

    void checkNotifStatus();
  }, []);

  const persistProfile = useCallback(
    async (updates: Partial<Pick<UserProfile, "full_name" | "phone" | "email" | "preferred_language">>) => {
      if (!user) throw new Error("لا توجد جلسة مستخدم");

      const payload = {
        user_id: user.id,
        full_name: fullName.trim() || null,
        phone: profile?.phone || fallbackPhone || null,
        email: profile?.email || fallbackEmail || null,
        preferred_language: language,
        updated_at: new Date().toISOString(),
        ...updates,
      };

      if (profile?.id) {
        const { data, error } = await supabase
          .from("profiles")
          .update(payload)
          .eq("id", profile.id)
          .select("id,user_id,full_name,phone,email,avatar_url,preferred_language")
          .single();
        if (error) throw error;
        setProfile(data);
        return data;
      }

      const { data, error } = await supabase
        .from("profiles")
        .insert(payload)
        .select("id,user_id,full_name,phone,email,avatar_url,preferred_language")
        .single();
      if (error) throw error;
      setProfile(data);
      return data;
    },
    [fallbackEmail, fallbackPhone, fullName, language, profile?.email, profile?.id, profile?.phone, user],
  );

  const handleSave = async () => {
    if (!user || !fullName.trim()) return;

    setSaving(true);
    try {
      await persistProfile({ full_name: fullName.trim() });
      toast({ title: "تم حفظ معلومات الحساب" });
    } catch (error) {
      console.error("Error saving rider profile:", error);
      toast({
        title: "فشل حفظ التغييرات",
        description: "لم نتمكن من تحديث معلومات الحساب",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = async (nextLanguage: LanguageCode) => {
    setLanguage(nextLanguage);
    localStorage.setItem("raan-language", nextLanguage);
    void i18n.changeLanguage(nextLanguage);

    try {
      await persistProfile({ preferred_language: nextLanguage });
      toast({ title: "تم تحديث اللغة" });
    } catch (error) {
      console.error("Error updating language:", error);
      toast({
        title: "تم تغيير اللغة محلياً",
        description: "تعذر حفظ التفضيل في الحساب حالياً",
        variant: "destructive",
      });
    }
  };

  const handlePaymentChange = (method: PaymentMethod) => {
    setPayment(method);
    toast({ title: "تم تحديث طريقة الدفع الافتراضية" });
  };

  const handleSoundsChange = (checked: boolean) => {
    if (checked !== soundsEnabled) toggleSounds();
    setSoundEnabled(checked);
    toast({ title: checked ? "تم تفعيل أصوات التطبيق" : "تم إيقاف أصوات التطبيق" });
  };

  const handleToggleNotifications = async () => {
    if (!userId) return;

    setNotifLoading(true);
    try {
      if (notificationsEnabled) {
        await unsubscribeFromPushNotifications(userId, "rider");
        setNotificationsEnabled(false);
        toast({ title: "تم إيقاف الإشعارات", description: "لن تصلك تنبيهات تحديثات الرحلات" });
        return;
      }

      await registerServiceWorker();
      const permission = await requestNotificationPermission();

      if (permission === "granted") {
        const subscription = await subscribeToPushNotifications(userId, "rider");
        if (!subscription) throw new Error("فشل إنشاء اشتراك الإشعارات");
        setNotificationsEnabled(true);
        toast({ title: "تم تفعيل الإشعارات", description: "ستصلك تنبيهات تحديثات الرحلات" });
      } else if (permission === "denied") {
        toast({
          title: "الإشعارات محظورة",
          description: "افتح إعدادات المتصفح وامنح الصلاحية لهذا الموقع",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Notification toggle error:", error);
      toast({
        title: "تعذر تحديث الإشعارات",
        description: "تحقق من صلاحيات المتصفح ثم حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setNotifLoading(false);
    }
  };

  const checkDeleteEligibility = useCallback(async () => {
    if (!userId) return;

    setDeleteChecking(true);
    try {
      const blockers: string[] = [];
      const { data: activeRides, error: activeError } = await supabase
        .from("rides")
        .select("id")
        .eq("rider_id", userId)
        .in("status", ["pending", "accepted", "arrived", "in_progress"])
        .limit(1);

      if (activeError) throw activeError;
      if (activeRides && activeRides.length > 0) {
        blockers.push("لديك رحلة نشطة أو قيد البحث، يجب إنهاؤها أو إلغاؤها أولاً.");
      }

      const { data: scheduledRides, error: scheduledError } = await supabase
        .from("scheduled_rides")
        .select("id")
        .eq("rider_id", userId)
        .in("status", ["pending", "accepted"])
        .limit(1);

      if (scheduledError) throw scheduledError;
      if (scheduledRides && scheduledRides.length > 0) {
        blockers.push("لديك رحلة مجدولة قادمة، يجب إلغاؤها أولاً.");
      }

      setDeleteBlockers(blockers);
    } catch (error) {
      console.error("Delete eligibility check failed:", error);
      setDeleteBlockers(["تعذر التحقق من حالة الرحلات حالياً. لا يمكن الحذف قبل اكتمال التحقق."]);
    } finally {
      setDeleteChecking(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!deleteOpen) return;
    setDeletePhrase("");
    setDeleteReason("");
    setDeleteBlockers([]);
    void checkDeleteEligibility();
  }, [checkDeleteEligibility, deleteOpen]);

  const handleDeleteAccount = async () => {
    if (!userId || deletePhrase !== DELETE_CONFIRM_PHRASE || deleteBlockers.length > 0) return;

    setDeleteSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user-account", {
        body: {
          userId,
          userType: "rider",
          reason: deleteReason.trim() || "لم يذكر سبب",
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "فشل حذف الحساب");

      toast({ title: "تم حذف الحساب", description: "تم حذف حسابك وبياناتك بنجاح" });
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (error: any) {
      console.error("Delete account error:", error);
      toast({
        title: "فشل حذف الحساب",
        description: error.message || "حدث خطأ أثناء حذف الحساب",
        variant: "destructive",
      });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  const displayName = fullName || profile?.full_name || getUserName(user) || "راكب ران";
  const displayPhone = profile?.phone || fallbackPhone || "غير مضاف";
  const displayEmail = profile?.email || fallbackEmail || "غير مضاف";
  const canDelete =
    deletePhrase === DELETE_CONFIRM_PHRASE &&
    deleteBlockers.length === 0 &&
    !deleteChecking &&
    !deleteSubmitting;

  const Section = ({
    icon: Icon,
    title,
    children,
  }: {
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
  }) => (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--raan-surface)", border: "1px solid var(--raan-border)" }}
    >
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--raan-divider)" }}>
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" style={{ color: "var(--raan-accent)" }} />
          <h3 className="text-[15px] font-bold" style={{ color: "var(--raan-text)" }}>
            {title}
          </h3>
        </div>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </motion.section>
  );

  const ActionRow = ({
    icon: Icon,
    title,
    subtitle,
    onClick,
    href,
  }: {
    icon: React.ElementType;
    title: string;
    subtitle: string;
    onClick?: () => void;
    href?: string;
  }) => {
    const content = (
      <>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 text-right">
          <span className="block text-[13px] font-semibold" style={{ color: "var(--raan-text)" }}>
            {title}
          </span>
          <span className="block truncate text-[11px]" style={{ color: "var(--raan-text-sub)" }}>
            {subtitle}
          </span>
        </span>
        <ChevronLeft className="h-4 w-4 shrink-0" style={{ color: "var(--raan-text-sub)" }} />
      </>
    );

    const className =
      "flex w-full items-center gap-3 rounded-xl p-3 text-right transition-colors hover:bg-white/5";

    if (href) {
      return (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={className}>
          {content}
        </a>
      );
    }

    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  };

  return (
    <div
      className="flex min-h-full flex-col transition-colors duration-300"
      style={{
        background: "var(--raan-bg)",
        paddingTop: "calc(4rem + env(safe-area-inset-top, 0px))",
      }}
      dir="rtl"
    >
      <RiderPageHeader title="الإعدادات" />

      <div className="space-y-5 p-4 pb-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <Loader2 className="h-9 w-9 animate-spin text-emerald-400" />
            <p className="text-sm text-slate-400">جاري تحميل الإعدادات...</p>
          </div>
        ) : (
          <>
            <Section icon={User} title="معلومات الحساب">
              <div className="flex justify-center py-2">
                {profile?.id ? (
                  <RiderAvatarUpload
                    riderId={profile.id}
                    currentAvatarUrl={profile.avatar_url}
                    riderName={displayName}
                    onAvatarUpdated={(avatarUrl) =>
                      setProfile((current) => (current ? { ...current, avatar_url: avatarUrl || null } : current))
                    }
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-2xl font-bold text-emerald-400">
                    {displayName.slice(0, 1)}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="full-name" className="text-[13px]" style={{ color: "var(--raan-text)" }}>
                  الاسم الكامل
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
                  <Input
                    id="full-name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="أدخل اسمك الكامل"
                    className="h-12 rounded-xl pr-10"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="mb-1 flex items-center gap-2 text-[12px] text-slate-400">
                    <Phone className="h-4 w-4" />
                    رقم الهاتف
                  </div>
                  <div className="truncate text-[14px] font-semibold text-white" dir="ltr">
                    {displayPhone}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="mb-1 flex items-center gap-2 text-[12px] text-slate-400">
                    <Mail className="h-4 w-4" />
                    البريد الإلكتروني
                  </div>
                  <div className="truncate text-[14px] font-semibold text-white" dir="ltr">
                    {displayEmail}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || !fullName.trim()}
                className="h-12 w-full gap-2 rounded-xl bg-[#5bdda6] text-[#0b1326] hover:bg-[#4ecf99]"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ التغييرات
              </Button>
            </Section>

            <Section icon={Palette} title="مظهر التطبيق">
              <ThemeToggle />
            </Section>

            <Section icon={Shield} title="التفضيلات العامة">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Languages className="h-4 w-4 text-emerald-400" />
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-white">لغة التطبيق</p>
                    <p className="text-[11px] text-slate-400">
                      {languageOptions.find((option) => option.value === language)?.hint}
                    </p>
                  </div>
                </div>
                <Select value={language} onValueChange={(value) => handleLanguageChange(value as LanguageCode)}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="اختر اللغة" />
                  </SelectTrigger>
                  <SelectContent>
                    {languageOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <Label
                  htmlFor="rider-notifications-switch"
                  className="flex flex-1 cursor-pointer items-center gap-3"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Bell className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-white">الإشعارات</p>
                    <p className="text-[11px] text-slate-400">
                      {notificationsEnabled ? "الإشعارات مفعلة" : "فعّل تنبيهات الرحلات"}
                    </p>
                  </div>
                </Label>
                {notifLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : (
                  <Switch
                    id="rider-notifications-switch"
                    checked={notificationsEnabled}
                    onCheckedChange={handleToggleNotifications}
                  />
                )}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Volume2 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-white">أصوات التطبيق</p>
                    <p className="text-[11px] text-slate-400">
                      {soundsEnabled ? "الأصوات مفعلة للتنبيهات المهمة" : "الأصوات متوقفة"}
                    </p>
                  </div>
                </div>
                <Switch checked={soundsEnabled} onCheckedChange={handleSoundsChange} />
              </div>
            </Section>

            <Section icon={CreditCard} title="الدفع والتنقل">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-3">
                  <p className="text-[13px] font-semibold text-white">طريقة الدفع الافتراضية</p>
                  <p className="text-[11px] text-slate-400">تُستخدم تلقائياً عند بدء الحجز</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {paymentOptions.map((option) => {
                    const Icon = option.icon;
                    const active = selectedPayment === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handlePaymentChange(option.value)}
                        className={`rounded-xl border p-3 text-right transition-colors ${
                          active
                            ? "border-emerald-400 bg-emerald-500/15 text-white"
                            : "border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/5"
                        }`}
                      >
                        <Icon className="mb-2 h-5 w-5 text-emerald-400" />
                        <span className="block text-[13px] font-bold">{option.label}</span>
                        <span className="block text-[11px] text-slate-400">{option.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <ActionRow
                icon={CreditCard}
                title="إدارة المدفوعات"
                subtitle="المحفظة وعمليات الشحن"
                onClick={() => navigate("/rider/payments")}
              />
              <ActionRow
                icon={MapPin}
                title="الأماكن المحفوظة"
                subtitle="البيت والعمل والمواقع المفضلة"
                onClick={() => navigate("/rider/saved-places")}
              />
              <ActionRow
                icon={FileText}
                title="سجل الرحلات"
                subtitle="الرحلات السابقة والمجدولة"
                onClick={() => navigate("/rider/rides")}
              />
            </Section>

            {userId && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <ReferralCard userId={userId} variant="compact" />
                <ReferralInput userId={userId} />
              </motion.div>
            )}

            <Section icon={HelpCircle} title="الدعم والخصوصية">
              <ActionRow
                icon={HelpCircle}
                title="مركز المساعدة"
                subtitle="الأسئلة الشائعة والتواصل"
                onClick={() => navigate("/help")}
              />
              <ActionRow icon={Phone} title="اتصال مباشر" subtitle={support.phone} href={`tel:${support.phone}`} />
              {supportWhatsapp && (
                <ActionRow
                  icon={MessageCircle}
                  title="واتساب"
                  subtitle="تواصل سريع مع فريق الدعم"
                  href={`https://wa.me/${supportWhatsapp}`}
                />
              )}
              <ActionRow icon={Mail} title="البريد الإلكتروني" subtitle={support.email} href={`mailto:${support.email}`} />
              <ActionRow
                icon={Shield}
                title="سياسة الخصوصية"
                subtitle="كيفية حفظ واستخدام البيانات"
                onClick={() => navigate("/privacy")}
              />
              <ActionRow
                icon={FileText}
                title="الشروط والأحكام"
                subtitle="حقوقك والتزامات استخدام الخدمة"
                onClick={() => navigate("/terms")}
              />
            </Section>

            <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleLogout}
                className="h-12 w-full gap-2 rounded-xl border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300"
              >
                <LogOut className="h-4 w-4" />
                تسجيل الخروج
              </Button>

              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full gap-2 rounded-xl text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف الحساب
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-lg" dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-red-500">
                      <Trash2 className="h-5 w-5" />
                      حذف الحساب نهائياً
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      سيتم حذف ملفك الشخصي وبياناتك المرتبطة بالحساب. لا يمكن تنفيذ الحذف إذا كانت لديك رحلة نشطة أو رحلة مجدولة.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className="space-y-4">
                    {deleteChecking ? (
                      <Alert>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <AlertDescription>جاري التحقق من الرحلات النشطة والمجدولة...</AlertDescription>
                      </Alert>
                    ) : deleteBlockers.length > 0 ? (
                      <Alert className="border-amber-500/40 bg-amber-500/10">
                        <Shield className="h-4 w-4 text-amber-500" />
                        <AlertDescription className="space-y-1">
                          {deleteBlockers.map((blocker) => (
                            <div key={blocker}>{blocker}</div>
                          ))}
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="border-red-500/40 bg-red-500/10">
                        <Shield className="h-4 w-4 text-red-500" />
                        <AlertDescription>
                          لا توجد رحلات تمنع الحذف حالياً. اكتب العبارة التالية للتأكيد:{" "}
                          <strong>{DELETE_CONFIRM_PHRASE}</strong>
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="delete-reason">سبب الحذف (اختياري)</Label>
                      <Textarea
                        id="delete-reason"
                        value={deleteReason}
                        onChange={(event) => setDeleteReason(event.target.value)}
                        rows={3}
                        placeholder="اكتب السبب إذا أردت"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="delete-phrase">عبارة التأكيد</Label>
                      <Input
                        id="delete-phrase"
                        value={deletePhrase}
                        onChange={(event) => setDeletePhrase(event.target.value)}
                        placeholder={DELETE_CONFIRM_PHRASE}
                      />
                    </div>
                  </div>

                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel disabled={deleteSubmitting}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(event) => {
                        event.preventDefault();
                        void handleDeleteAccount();
                      }}
                      disabled={!canDelete}
                      className="bg-red-600 text-white hover:bg-red-700"
                    >
                      {deleteSubmitting ? (
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="ml-2 h-4 w-4" />
                      )}
                      حذف نهائي
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </motion.section>
          </>
        )}
      </div>
    </div>
  );
};

export default RiderSettingsPage;
