/**
 * ران — صفحة المصادقة (Omnichannel-Ready)
 *
 * ══ هندسة توحيد الحسابات (App ↔ Bot) — تعليمات لمطوري Flutter/React Native ══
 *
 * عندما يحاول مستخدم التسجيل/الدخول من التطبيق:
 *
 * السيناريو 1: مستخدم جديد تماماً → تسجيل عادي (signUp)
 *
 * السيناريو 2: مستخدم "حساب شبح" (Ghost Account) — جاء من البوت أولاً:
 *   1. استدعِ is_phone_registered(p_phone) → ستُرجع true
 *   2. المستخدم يحاول تسجيل الدخول لكنه لا يعرف كلمة المرور (عشوائية)
 *   3. عند فشل تسجيل الدخول أو طلب "نسيت كلمة المرور":
 *      a. أرسل OTP عبر SMS (OTPIQ) أو عبر بوت واتساب نفسه
 *      b. بعد تحقق OTP بنجاح، استخدم:
 *         supabase.auth.admin.updateUserById(user_id, { password: new_password })
 *         أو من جانب العميل بعد signIn:
 *         supabase.auth.updateUser({ password: new_password })
 *      c. حدّث user_metadata لإزالة علامة الشبح:
 *         supabase.auth.admin.updateUserById(user_id, {
 *           user_metadata: { is_ghost_account: false, app_activated_at: new Date() }
 *         })
 *   4. النتيجة: المستخدم يرى رصيده + رحلاته السابقة من البوت!
 *
 * السيناريو 3: مستخدم تطبيق يراسل البوت لاحقاً:
 *   - البوت يبحث بصيغة E.164 (+964...) → يجد الحساب → يربط تلقائياً
 *   - لا يُنشئ حساب مكرر
 *
 * الأرقام تُحفظ بصيغة E.164 الموحدة: +964XXXXXXXXX
 */
import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, Phone, ArrowLeft, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";
import OTPVerification from "@/components/OTPVerification";
import PasswordResetDialog from "@/components/PasswordResetDialog";
import { phoneSignupSchema } from "@/lib/validations";
import { normalizeIraqiPhoneToE164 } from "@/lib/phoneUtils";
import { saveRememberMe, clearRememberMe, getRememberMe } from "@/services/rememberMeService";

type AuthStep = "phone" | "login" | "register" | "otp" | "ghost-otp" | "ghost-password";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // حدد وجهة إعادة التوجيه بعد تسجيل الدخول
  const searchParams = new URLSearchParams(location.search);
  const redirectTo = (location.state as { from?: string })?.from || searchParams.get('redirect') || "/rider";

  // Step management
  const [step, setStep] = useState<AuthStep>("phone");
  const [checkingPhone, setCheckingPhone] = useState(false);

  // Phone step
  const [phoneInput, setPhoneInput] = useState("");

  // Login step
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  // Register step
  const [fullName, setFullName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [optionalEmail, setOptionalEmail] = useState("");

  // Common
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Ghost account recovery
  const [ghostPassword, setGhostPassword] = useState("");
  const [ghostConfirmPassword, setGhostConfirmPassword] = useState("");

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate(redirectTo, { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate(redirectTo, { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, redirectTo]);

  // ── تحميل بيانات "تذكرني" من Capacitor Preferences عند فتح الصفحة ──
  useEffect(() => {
    getRememberMe().then(({ enabled, phone }) => {
      if (enabled && phone) {
        setPhoneInput(phone);
        setRememberMe(true);
      }
    });
  }, []);

  // Format phone for database lookup
  const formatPhoneForLookup = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    // Return multiple formats for searching
    const formats = [cleaned];

    if (cleaned.startsWith("964")) {
      formats.push(cleaned.slice(3)); // Remove 964
      formats.push("0" + cleaned.slice(3)); // Add leading 0
    } else if (cleaned.startsWith("0")) {
      formats.push(cleaned.slice(1)); // Remove leading 0
      formats.push("964" + cleaned.slice(1)); // Add 964
    } else {
      formats.push("0" + cleaned); // Add leading 0
      formats.push("964" + cleaned); // Add 964
    }

    return formats;
  };

  // Check if phone exists using secure RPC function
  const checkPhoneNumber = async () => {
    setErrors({});

    const cleanedPhone = phoneInput.replace(/\D/g, "");

    if (!phoneInput || cleanedPhone.length < 10) {
      setErrors({ phone: "يرجى إدخال رقم هاتف صحيح (10 أرقام على الأقل)" });
      return;
    }

    setCheckingPhone(true);

    try {
      console.log("Checking phone via RPC:", phoneInput);

      // Use the secure RPC function that bypasses RLS
      const { data: isRegistered, error: rpcError } = await supabase.rpc(
        "is_phone_registered",
        { p_phone: phoneInput }
      );

      if (rpcError) {
        console.error("RPC error:", rpcError);
        throw rpcError;
      }

      console.log("Phone registration check result:", isRegistered);

      if (isRegistered) {
        // تحقق إذا كان حساب شبح (Ghost Account) من بوت واتساب/تلغرام
        const { data: isGhost } = await supabase.rpc(
          "check_ghost_account",
          { p_phone: phoneInput }
        );

        if (isGhost) {
          // حساب شبح — توجيه لتفعيل الحساب عبر OTP
          setStep("ghost-otp");
          toast({
            title: "وجدنا حسابك! 🎉",
            description: "حسابك من واتساب/تلغرام جاهز. فعّله الآن بخطوة بسيطة",
          });
        } else {
          // Phone exists - go to login
          setStep("login");
          toast({
            title: "مرحباً بعودتك! 👋",
            description: "الرقم مسجل مسبقاً، يرجى إدخال كلمة المرور",
          });
        }
      } else {
        // New phone - go to register
        setStep("register");
        toast({
          title: "مستخدم جديد! 🎉",
          description: "أكمل بياناتك لإنشاء حساب جديد",
        });
      }
    } catch (error) {
      console.error("Check phone error:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setCheckingPhone(false);
    }
  };

  // Handle login with password - rider domain only (@raan.app)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!loginPassword || loginPassword.length < 6) {
      setErrors({ password: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
      return;
    }

    setLoading(true);

    try {
      const cleanedPhone = phoneInput.replace(/\D/g, "");
      const phoneFormats = formatPhoneForLookup(phoneInput);
      // الراكب يسجل دخول فقط عبر @raan.app - لا يسمح بنطاقات السائق أو الأدمن
      const domains = ["@raan.app"];

      // Generate all possible email combinations
      const emailsToTry: string[] = [];
      for (const phone of phoneFormats) {
        for (const domain of domains) {
          emailsToTry.push(`${phone}${domain}`);
        }
      }

      let loginSuccess = false;
      let lastError: any = null;

      // Try each email format until one works
      for (const email of emailsToTry) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email,
          password: loginPassword,
        });

        if (!error) {
          loginSuccess = true;
          toast({
            title: "مرحباً بك! ✅",
            description: "تم تسجيل الدخول بنجاح",
          });
          break;
        }
        lastError = error;
      }

      if (loginSuccess) {
        // حفظ تفضيل تذكر الجلسة عبر Capacitor Preferences (آمن ولا ينمسح)
        if (rememberMe) {
          saveRememberMe(phoneInput, "rider");
        } else {
          clearRememberMe();
        }
      } else if (lastError) {
        if (lastError.message === "Invalid login credentials") {
          setErrors({ password: "كلمة المرور غير صحيحة" });
          toast({
            title: "خطأ في تسجيل الدخول",
            description: "كلمة المرور غير صحيحة",
            variant: "destructive",
          });
        } else {
          toast({
            title: "خطأ في تسجيل الدخول",
            description: lastError.message,
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle registration form submission - go to OTP or direct register
  const handleRegisterSubmit = async () => {
    setErrors({});

    const result = phoneSignupSchema.safeParse({ fullName, phone: phoneInput });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    if (!registerPassword || registerPassword.length < 6) {
      setErrors({ password: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
      return;
    }

    if (optionalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(optionalEmail)) {
      setErrors({ email: "البريد الإلكتروني غير صحيح" });
      return;
    }

    // إرسال OTP للتحقق من الرقم
    setStep("otp");
  };

  // Handle OTP verification success
  const handleOTPVerified = async () => {
    setLoading(true);
    setErrors({});

    try {
      const phoneEmail = `${phoneInput.replace(/\D/g, "")}@raan.app`;

      console.log("Creating user with email:", phoneEmail);

      const { data, error } = await supabase.auth.signUp({
        email: phoneEmail,
        password: registerPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
            phone: normalizeIraqiPhoneToE164(phoneInput),
            auth_method: "phone",
          },
        },
      });

      if (error) {
        console.error("SignUp error:", error);

        // Check if user already exists
        if (
          error.message.includes("already registered") ||
          error.message.includes("User already registered") ||
          error.status === 422
        ) {
          toast({
            title: "رقم الهاتف مسجل مسبقاً",
            description: "جاري تحويلك لتسجيل الدخول...",
          });
          setStep("login");
          setRegisterPassword("");
          return;
        }
        throw error;
      }

      if (data.user) {
        console.log("User created successfully:", data.user.id);

        // تخزين الرقم بصيغة E.164 الموحدة لضمان المطابقة مع حسابات البوت (Omnichannel Sync)
        const e164Phone = normalizeIraqiPhoneToE164(phoneInput);

        // Update profile with phone number
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            phone: e164Phone,
            full_name: fullName,
            email: optionalEmail || null,
          })
          .eq("user_id", data.user.id);

        if (profileError) {
          console.error("Profile update error:", profileError);
          // Don't throw - user is created, profile update is secondary
        }

        toast({
          title: "تم إنشاء الحساب! ✅",
          description: "مرحباً بك في ران",
        });
        navigate("/rider");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      const errorMessage = error.message || "حدث خطأ غير متوقع";
      setErrors({ general: errorMessage });
      toast({
        title: "خطأ في التسجيل",
        description: errorMessage,
        variant: "destructive",
      });
      // Go back to register step so user can try again
      setStep("register");
    } finally {
      setLoading(false);
    }
  };

  // تفعيل حساب شبح — تعيين كلمة مرور بعد التحقق من OTP
  const handleGhostPasswordSet = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!ghostPassword || ghostPassword.length < 6) {
      setErrors({ ghostPassword: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
      return;
    }

    if (ghostPassword !== ghostConfirmPassword) {
      setErrors({ ghostConfirmPassword: "كلمات المرور غير متطابقة" });
      return;
    }

    setLoading(true);
    try {
      // استخدام نفس edge function لتغيير كلمة المرور (يزيل علامة الشبح تلقائياً)
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { phone: phoneInput, newPassword: ghostPassword },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // محاولة تسجيل دخول تلقائي بكلمة المرور الجديدة
      const phoneFormats = formatPhoneForLookup(phoneInput);
      let loginSuccess = false;

      for (const phone of phoneFormats) {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: `${phone}@raan.app`,
          password: ghostPassword,
        });
        if (!loginError) {
          loginSuccess = true;
          break;
        }
      }

      if (loginSuccess) {
        toast({
          title: "تم تفعيل حسابك! ✅",
          description: "مرحباً بك في تطبيق ران — رصيدك ورحلاتك السابقة بانتظارك",
        });
      } else {
        // نجح تعيين كلمة المرور لكن فشل الدخول التلقائي — توجيه لصفحة الدخول
        toast({
          title: "تم تعيين كلمة المرور ✅",
          description: "يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة",
        });
        setStep("login");
      }
    } catch (error: any) {
      console.error("Ghost activation error:", error);
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ في تعيين كلمة المرور",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Reset to phone step
  const resetToPhoneStep = () => {
    setStep("phone");
    setLoginPassword("");
    setFullName("");
    setRegisterPassword("");
    setOptionalEmail("");
    setGhostPassword("");
    setGhostConfirmPassword("");
    setErrors({});
  };

  // Format phone for display
  const formatPhoneDisplay = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length >= 10) {
      return (
        cleaned.slice(0, 4) + " " + cleaned.slice(4, 7) + " " + cleaned.slice(7)
      );
    }
    return phone;
  };

  // Render OTP verification step
  if (step === "otp") {
    return (
      <div className="h-screen w-screen overflow-hidden bg-[#0a0f1c] flex flex-col font-sans" dir="rtl">
        <div className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-6 pt-[8vh] pb-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-[#111827] rounded-2xl flex items-center justify-center border border-slate-800/80">
              <img src={logo} alt="RAAN" className="w-10 h-10" />
            </div>
          </div>
          <div className="bg-[#151f30] rounded-2xl px-5 py-5 border border-slate-700/50 mb-4">
            <h2 className="text-white font-bold text-[17px] mb-1">التحقق من رقم الهاتف</h2>
            <p className="text-slate-400 text-[12px]">سيتم إرسال رمز تحقق إلى رقم واتساب الخاص بك</p>
          </div>
          <div className="bg-[#151f30] rounded-2xl px-5 py-5 border border-slate-700/50">
            <OTPVerification
              phone={phoneInput}
              purpose="rider_registration"
              onVerified={handleOTPVerified}
              onBack={() => setStep("register")}
            />
          </div>
        </div>
      </div>
    );
  }

  // Render ghost account OTP verification step
  if (step === "ghost-otp") {
    return (
      <div className="h-screen w-screen overflow-hidden bg-[#0a0f1c] flex flex-col font-sans" dir="rtl">
        <div className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-6 pt-[8vh] pb-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-[#111827] rounded-2xl flex items-center justify-center border border-slate-800/80">
              <img src={logo} alt="RAAN" className="w-10 h-10" />
            </div>
          </div>
          <div className="bg-[#151f30] rounded-2xl px-5 py-5 border border-emerald-500/30 mb-4">
            <h2 className="text-emerald-400 font-bold text-[17px] mb-1">وجدنا حسابك من واتساب/تلغرام! 🎉</h2>
            <p className="text-slate-400 text-[12px]">تحقق من رقمك لتفعيل حسابك في التطبيق</p>
          </div>
          <div className="bg-[#151f30] rounded-2xl px-5 py-5 border border-slate-700/50">
            <OTPVerification
              phone={phoneInput}
              purpose="password_reset"
              onVerified={() => setStep("ghost-password")}
              onBack={resetToPhoneStep}
            />
          </div>
        </div>
      </div>
    );
  }

  // Render ghost account password setup step
  if (step === "ghost-password") {
    return (
      <div className="h-screen w-screen overflow-hidden bg-[#0a0f1c] flex flex-col font-sans" dir="rtl">
        <div className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-6 pt-[8vh] pb-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-[#111827] rounded-2xl flex items-center justify-center border border-slate-800/80">
              <img src={logo} alt="RAAN" className="w-10 h-10" />
            </div>
          </div>
          <div className="text-center mb-8">
            <h1 className="text-[24px] font-bold text-white mb-2">تعيين كلمة مرور</h1>
            <p className="text-[13px] text-slate-400">اختر كلمة مرور لتسجيل الدخول من التطبيق</p>
          </div>
          <form onSubmit={handleGhostPasswordSet} className="flex flex-col gap-4">
            {/* Phone Display */}
            <div className="bg-[#1a2333] rounded-xl px-4 py-3 flex items-center justify-center gap-2 border border-slate-700/50">
              <Phone className="h-4 w-4 text-emerald-400" />
              <span className="text-white font-medium" dir="ltr">{formatPhoneDisplay(phoneInput)}</span>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-slate-300 text-[13px] font-medium">كلمة المرور الجديدة</label>
              <div className="relative">
                <div className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none">
                  <Lock className="w-4 h-4 text-slate-500" />
                </div>
                <Input
                  type="password" placeholder="••••••••"
                  value={ghostPassword}
                  onChange={(e) => setGhostPassword(e.target.value)}
                  className={`h-12 bg-[#1a2333] border-slate-700/50 text-white placeholder:text-slate-500 rounded-xl pr-11 text-[14px] focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 ${errors.ghostPassword ? 'border-red-500/60' : ''}`}
                  required minLength={6} dir="ltr" autoFocus
                />
              </div>
              {errors.ghostPassword && <p className="text-[11px] text-red-400">{errors.ghostPassword}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-slate-300 text-[13px] font-medium">تأكيد كلمة المرور</label>
              <div className="relative">
                <div className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none">
                  <Lock className="w-4 h-4 text-slate-500" />
                </div>
                <Input
                  type="password" placeholder="••••••••"
                  value={ghostConfirmPassword}
                  onChange={(e) => setGhostConfirmPassword(e.target.value)}
                  className={`h-12 bg-[#1a2333] border-slate-700/50 text-white placeholder:text-slate-500 rounded-xl pr-11 text-[14px] focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 ${errors.ghostConfirmPassword ? 'border-red-500/60' : ''}`}
                  required minLength={6} dir="ltr"
                />
              </div>
              {errors.ghostConfirmPassword && <p className="text-[11px] text-red-400">{errors.ghostConfirmPassword}</p>}
            </div>

            <button type="submit" disabled={loading} className="w-full h-[54px] bg-[#34d399] hover:bg-[#10b981] text-[#064e3b] text-[16px] font-bold rounded-2xl shadow-[0_4px_20px_rgba(52,211,153,0.25)] transition-all mt-2 disabled:opacity-60">
              {loading ? 'جاري تفعيل الحساب...' : 'تفعيل الحساب'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Main Return (Phone / Login / Register steps) ──
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0a0f1c] flex flex-col font-sans" dir="rtl">
      <div className="flex-1 overflow-y-auto w-full max-w-md mx-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col min-h-full px-6 pt-[7vh] pb-8">

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-[#111827] rounded-2xl flex items-center justify-center border border-slate-800/80 shadow-lg">
              <img src={logo} alt="RAAN" className="w-10 h-10" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-[26px] font-bold text-white mb-2 leading-tight">
              {step === 'phone' ? <>مرحباً بك في <span className="text-emerald-400 font-extrabold">raan</span></> :
               step === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
            </h1>
          </div>

          {/* ── Step: Phone ── */}
          {step === 'phone' && (
            <div className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <label className="text-slate-300 text-[13px] font-medium">رقم الهاتف (WhatsApp)</label>
                <div className="relative flex items-center bg-[#1a2333] rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-emerald-500/50 transition-shadow">
                  <div className="absolute left-0 top-0 bottom-0 w-14 flex items-center justify-center bg-[#0d1321] border-r border-slate-700/50 pointer-events-none z-10 shadow-[2px_0_10px_rgba(0,0,0,0.2)]">
                    <Phone className="w-[18px] h-[18px] text-emerald-400" />
                  </div>
                  <Input
                    type="tel" placeholder="07xxxxxxxxx"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className={`h-14 bg-transparent border-0 text-white placeholder:text-slate-500 rounded-none pl-16 pr-4 text-[16px] font-medium tracking-wide focus-visible:ring-0 w-full ${errors.phone ? 'shadow-[inset_0_0_0_1px_rgba(239,68,68,0.5)]' : ''}`}
                    dir="ltr"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); checkPhoneNumber(); } }}
                  />
                </div>
                {errors.phone && <p className="text-[11px] text-red-400">{errors.phone}</p>}
                <p className="text-[11px] text-slate-500">تأكد أن الرقم مفعل عليه واتساب</p>
              </div>

              <button
                onClick={checkPhoneNumber}
                disabled={checkingPhone}
                className="w-full h-14 bg-[#34d399] hover:bg-[#10b981] active:bg-[#059669] text-[#064e3b] text-[16px] font-bold rounded-full mt-2 shadow-[0_0_24px_rgba(52,211,153,0.3)] transition-all disabled:opacity-60"
              >
                {checkingPhone ? 'جاري التحقق...' : 'متابعة'}
              </button>
            </div>
          )}

          {/* ── Step: Login ── */}
          {step === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              {/* Phone badge */}
              <div className="bg-[#1a2333] rounded-xl px-4 py-3 flex items-center justify-between border border-slate-700/50">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-emerald-400" />
                  <span className="text-white font-medium text-[14px]" dir="ltr">{formatPhoneDisplay(phoneInput)}</span>
                </div>
                <button type="button" onClick={resetToPhoneStep} className="text-[12px] text-slate-400 hover:text-emerald-400 transition-colors">تغيير</button>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-slate-300 text-[13px] font-medium">كلمة المرور</label>
                <div className="relative">
                  <div className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none">
                    <Lock className="w-[18px] h-[18px] text-emerald-400" />
                  </div>
                  <Input
                    type="password" placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className={`h-14 bg-[#1a2333] border-0 text-white placeholder:text-slate-400 rounded-xl pr-12 pl-4 text-[15px] focus-visible:ring-1 focus-visible:ring-emerald-500/50 ${errors.password ? 'ring-1 ring-red-500/50' : ''}`}
                    required minLength={6} dir="ltr" autoFocus
                  />
                </div>
                {errors.password && <p className="text-[11px] text-red-400">{errors.password}</p>}
              </div>

              {/* Remember Me */}
              <button
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                  rememberMe ? 'border-emerald-500/40 bg-emerald-500/8 text-emerald-400' : 'border-slate-700/50 bg-[#1a2333] text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg transition-colors ${rememberMe ? 'bg-emerald-500/15' : 'bg-slate-800'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${rememberMe ? 'text-emerald-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">ابقَني مسجلاً دخولي</p>
                    <p className="text-xs text-slate-500">{rememberMe ? 'لن تحتاج لتسجيل دخول مجدداً' : 'ستُطلب كلمة المرور عند إعادة الفتح'}</p>
                  </div>
                </div>
                <div className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${rememberMe ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${rememberMe ? 'right-0.5' : 'left-0.5'}`} />
                </div>
              </button>

              {/* Forgot password */}
              <button type="button" onClick={() => setShowPasswordReset(true)} className="text-start text-[13px] text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                نسيت كلمة المرور؟
              </button>

              <button type="submit" disabled={loading} className="w-full h-14 bg-[#34d399] hover:bg-[#10b981] active:bg-[#059669] text-[#064e3b] text-[16px] font-bold rounded-full mt-1 shadow-[0_0_24px_rgba(52,211,153,0.3)] transition-all disabled:opacity-60">
                {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
              </button>
            </form>
          )}

          {/* ── Step: Register ── */}
          {step === 'register' && (
            <div className="flex flex-col gap-4">
              {/* Phone badge */}
              <div className="bg-[#1a2333] rounded-xl px-4 py-3 flex items-center justify-between border border-slate-700/50">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-emerald-400" />
                  <span className="text-white font-medium text-[14px]" dir="ltr">{formatPhoneDisplay(phoneInput)}</span>
                </div>
                <button type="button" onClick={resetToPhoneStep} className="text-[12px] text-slate-400 hover:text-emerald-400 transition-colors">تغيير</button>
              </div>

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-slate-300 text-[13px] font-medium">الاسم الكامل</label>
                <div className="relative">
                  <div className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none">
                    <User className="w-[18px] h-[18px] text-emerald-400" />
                  </div>
                  <Input
                    type="text" placeholder="أحمد محمد"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`h-14 bg-[#1a2333] border-0 text-white placeholder:text-slate-400 rounded-xl pr-12 pl-4 text-[15px] focus-visible:ring-1 focus-visible:ring-emerald-500/50 ${errors.fullName ? 'ring-1 ring-red-500/50' : ''}`}
                    required autoFocus
                  />
                </div>
                {errors.fullName && <p className="text-[11px] text-red-400">{errors.fullName}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-slate-300 text-[13px] font-medium">كلمة المرور</label>
                <div className="relative">
                  <div className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none">
                    <Lock className="w-[18px] h-[18px] text-emerald-400" />
                  </div>
                  <Input
                    type="password" placeholder="••••••••"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className={`h-14 bg-[#1a2333] border-0 text-white placeholder:text-slate-400 rounded-xl pr-12 pl-4 text-[15px] focus-visible:ring-1 focus-visible:ring-emerald-500/50 ${errors.password ? 'ring-1 ring-red-500/50' : ''}`}
                    required minLength={6} dir="ltr"
                  />
                </div>
                {errors.password && <p className="text-[11px] text-red-400">{errors.password}</p>}
              </div>

              {/* Optional Email */}
              <div className="space-y-1.5">
                <label className="text-slate-300 text-[13px] font-medium">البريد الإلكتروني <span className="text-slate-500 font-normal">(اختياري)</span></label>
                <div className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center pointer-events-none">
                    <Mail className="w-[18px] h-[18px] text-slate-500" />
                  </div>
                  <Input
                    type="email" placeholder="example@email.com"
                    value={optionalEmail}
                    onChange={(e) => setOptionalEmail(e.target.value)}
                    className={`h-14 bg-[#1a2333] border-0 text-white placeholder:text-slate-400 rounded-xl pr-4 pl-12 text-[14px] focus-visible:ring-1 focus-visible:ring-emerald-500/50 ${errors.email ? 'ring-1 ring-red-500/50' : ''}`}
                    dir="ltr"
                  />
                </div>
                {errors.email && <p className="text-[11px] text-red-400">{errors.email}</p>}
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleRegisterSubmit}
                className="w-full h-14 bg-[#34d399] hover:bg-[#10b981] active:bg-[#059669] text-[#064e3b] text-[16px] font-bold rounded-full mt-2 shadow-[0_0_24px_rgba(52,211,153,0.3)] transition-all disabled:opacity-60"
              >
                {loading ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب'}
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto pt-8 pb-2 text-center">
            <p className="text-slate-500 text-[11px]">
              بالمتابعة، أنت توافق على <span className="border-b border-slate-600 pb-0.5">شروط الخدمة</span> و<span className="border-b border-slate-600 pb-0.5">سياسة الخصوصية</span>
            </p>
          </div>
        </div>
      </div>

      <PasswordResetDialog
        open={showPasswordReset}
        onOpenChange={setShowPasswordReset}
        userType="rider"
      />
    </div>
  );
};

export default Auth;
