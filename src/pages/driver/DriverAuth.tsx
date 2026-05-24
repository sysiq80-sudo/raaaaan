import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Lock, Phone, Eye, EyeOff, BadgeCheck, Headphones, Wallet } from "lucide-react";
import logo from "@/assets/logo.png";
import PasswordResetDialog from "@/components/PasswordResetDialog";
import { normalizeIraqiPhone } from "@/lib/validations";
import { normalizeIraqiPhoneToE164 } from "@/lib/phoneUtils";
import { saveRememberMe, clearRememberMe, getRememberMe } from "@/services/rememberMeService";
import { capacitorStorageSync } from "@/lib/capacitorStorage";

const DriverAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPhonePassword, setLoginPhonePassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // ── تحميل بيانات "تذكرني" من Capacitor Preferences ──
  useEffect(() => {
    getRememberMe().then(({ enabled, phone, role }) => {
      if (enabled && phone && role === "driver") {
        setLoginPhone(phone);
        setRememberMe(true);
      }
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    let hasProcessed = false; // 🔒 علم لتتبع ما إذا تم معالجة الجلسة
    let isProcessing = false; // 🔒 علم محلي لمنع التكرار (بدلاً من state)

    const checkDriverStatus = async (userPhone?: string) => {
      // 🔒 منع المعالجة المتكررة
      if (!isMounted || isProcessing || hasProcessed) return;
      
      isProcessing = true;
      hasProcessed = true;

      try {
        // Use the database function to link driver by phone
        // This bypasses RLS and handles the user_id mismatch
        if (userPhone) {
          // تجربة تنسيقات متعددة للرقم
          let phoneClean = userPhone.replace(/\D/g, "");

          // إزالة 964 في البداية
          if (phoneClean.startsWith("964")) {
            phoneClean = phoneClean.slice(3);
          }

          // تنسيقات مختلفة للتجربة
          const phoneFormats = [
            normalizeIraqiPhone(userPhone), // التنسيق الأساسي
            "0" + phoneClean.replace(/^0/, ""), // مع صفر
            phoneClean.replace(/^0/, ""), // بدون صفر
          ];

          // إزالة التكرارات
          const uniqueFormats = [...new Set(phoneFormats)];

          console.log("Trying to link driver with phone formats:", uniqueFormats);

          for (const phone of uniqueFormats) {
            const { data, error } = await supabase.rpc("link_driver_by_phone", {
              p_phone: phone,
            });

            if (error) {
              console.error("Error linking driver with phone", phone, ":", error);
              continue;
            }

            // Type assertion for the JSON response
            const result = data as {
              success?: boolean;
              driver_id?: string;
              status?: string;
              error?: string;
            } | null;

            console.log("Link result for", phone, ":", result);

            if (result?.success) {
              // Driver found and linked (or already linked)
              console.log("Driver linked successfully!");
              if (isMounted) {
                navigate("/driver");
              }
              return;
            }
          }
        }

        // If no phone or no driver found, redirect to complete registration
        console.log("No driver found, redirecting to complete registration");
        if (isMounted) {
          navigate("/driver/complete-registration");
        }
      } finally {
        isProcessing = false;
      }
    };

    // 🔒 فقط معالجة الحدث SIGNED_IN لتجنب الحلقات
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // فقط معالجة SIGNED_IN أو INITIAL_SESSION
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session && isMounted) {
        // استخراج رقم الهاتف مباشرة من الجلسة
        const rawPhone = session.user.phone || session.user.user_metadata?.phone || "";
        let userPhone = rawPhone.replace(/\D/g, "");
        if (userPhone.startsWith("964")) userPhone = userPhone.slice(3);
        checkDriverStatus(userPhone || undefined);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [navigate]);

  const handlePhoneLogin = async () => {
    setErrors({});

    if (!loginPhone || loginPhone.length < 10) {
      setErrors({ loginPhone: "يرجى إدخال رقم هاتف صحيح" });
      return;
    }

    if (!loginPhonePassword) {
      setErrors({
        loginPhonePassword: "يرجى إدخال كلمة المرور",
      });
      return;
    }

    setLoading(true);

    try {
      // Normalize to canonical Iraqi local format (7XXXXXXXXX)
      let normalizedPhone = loginPhone.replace(/\D/g, "");
      if (normalizedPhone.startsWith("964")) normalizedPhone = normalizedPhone.slice(3);
      if (normalizedPhone.startsWith("0")) normalizedPhone = normalizedPhone.slice(1);

      // Prevent invalid attempts such as 77000000 (too short)
      if (normalizedPhone.length !== 10 || !normalizedPhone.startsWith("7")) {
        setErrors({ loginPhone: "يرجى إدخال رقم عراقي صحيح (مثال: 07XXXXXXXXX)" });
        setLoading(false);
        return;
      }

      const e164Phone = normalizeIraqiPhoneToE164(loginPhone);

      // ── فحص الأرقام المحظورة قبل محاولة الدخول ──
      const phoneForBlockCheck = `964${normalizedPhone}`;
      const { data: isBlocked, error: blockCheckError } = await supabase.rpc(
        "is_phone_blocked",
        { p_phone: phoneForBlockCheck }
      );

      if (!blockCheckError && isBlocked) {
        toast({
          title: "الحساب معطّل",
          description: "لا يمكن تسجيل الدخول بهذا الرقم حالياً. يرجى التواصل مع الدعم.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      console.log("Trying phone-only login:", e164Phone);

      let signInSuccess = false;
      const successfulPhone = normalizedPhone;

      // تسجيل الدخول عبر رقم الهاتف فقط
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        phone: e164Phone,
        password: loginPhonePassword,
      });

      if (!signInError && data.user) {
        signInSuccess = true;
        capacitorStorageSync.setItem("raan_current_role", "driver");
        if (rememberMe) {
          saveRememberMe(loginPhone, "driver");
        } else {
          clearRememberMe();
        }
        toast({
          title: "مرحباً بك كابتن!",
          description: "تم تسجيل الدخول بنجاح",
        });
      }

      if (signInSuccess && successfulPhone) {
        // ✅ استدعاء ربط السائق مباشرة - لا ننتظر onAuthStateChange!
        console.log("🚗 Direct linking attempt with phone:", successfulPhone);
        
        // تنظيف الرقم للربط
        let phoneLinkClean = successfulPhone.replace(/\D/g, "");
        if (phoneLinkClean.startsWith("964")) {
          phoneLinkClean = phoneLinkClean.slice(3);
        }

        const linkPhoneFormats = [
          normalizeIraqiPhone(successfulPhone),
          "0" + phoneLinkClean.replace(/^0/, ""),
          phoneLinkClean.replace(/^0/, ""),
        ];
        const uniqueLinkPhones = [...new Set(linkPhoneFormats)];

        console.log("Trying to link driver with phone formats:", uniqueLinkPhones);

        let driverLinked = false;
        for (const phone of uniqueLinkPhones) {
          const { data, error } = await supabase.rpc("link_driver_by_phone", {
            p_phone: phone,
          });

          if (error) {
            console.error("Error linking driver with phone", phone, ":", error);
            continue;
          }

          const result = data as {
            success?: boolean;
            driver_id?: string;
            status?: string;
            error?: string;
          } | null;

          console.log("Link result for", phone, ":", result);

          if (result?.success) {
            console.log("Driver linked successfully!");
            driverLinked = true;
            break;
          }
        }

        if (driverLinked) {
          // ✅ نجح الربط - اذهب إلى لوحة القيادة
          toast({
            title: "✅ تم الربط بنجاح",
            description: "جاري التوجيه إلى لوحة القيادة...",
          });
          navigate("/driver");
        } else {
          // ❌ لم يجد السائق - اذهب إلى التسجيل
          console.log("No driver found, redirecting to complete registration");
          toast({
            title: "إتمام التسجيل",
            description: "يرجى إكمال بيانات السائق",
          });
          navigate("/driver/complete-registration");
        }
      } else if (!signInSuccess) {
        // تحديد نوع الخطأ وعرض رسالة مناسبة
        let errorMessage = "رقم الهاتف أو كلمة المرور غير صحيحة";

        if (signInError?.message?.includes("Invalid login credentials")) {
          errorMessage =
            "رقم الهاتف أو كلمة المرور غير صحيحة. تأكد من صحة البيانات.";
        } else if (signInError?.message?.includes("Email not confirmed")) {
          errorMessage = "لم يتم تأكيد الحساب. تواصل مع الدعم.";
        } else if (signInError?.message?.includes("Too many requests")) {
          errorMessage = "محاولات كثيرة جداً. انتظر قليلاً ثم حاول مرة أخرى.";
        }

        toast({
          title: "خطأ في تسجيل الدخول",
          description: errorMessage,
          variant: "destructive",
        });

        console.error("Login failed for phone:", e164Phone);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
      console.error("Login error:", error);
      toast({
        title: "خطأ في تسجيل الدخول",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0a0f1c] flex flex-col font-sans" dir="rtl">
      <div className="flex-1 overflow-y-auto w-full max-w-md mx-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col min-h-full px-6 pt-[8vh] pb-8">
            
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-[#111827] rounded-xl flex items-center justify-center border border-slate-800/80 shadow-lg">
              <img src={logo} alt="RAAN" className="w-10 h-10" />
            </div>
          </div>

          {/* Titles */}
          <div className="text-center mb-8">
            <h1 className="text-[26px] font-bold text-white mb-2 leading-tight">
              مرحباً بك في <span className="text-emerald-400 font-extrabold tracking-wide">raan</span>
            </h1>
          </div>

          {/* Tabs */}
          <div className="flex bg-[#131b2c] p-1.5 rounded-xl mb-6 shadow-inner border border-slate-800/40">
            <div className="w-1/2 bg-[#1e293b] text-emerald-400 text-[14px] font-bold py-3 rounded-[10px] text-center shadow-md">
              تسجيل الدخول
            </div>
            <Link to="/driver/register" className="w-1/2 text-slate-400 text-[14px] font-medium py-3 rounded-[10px] text-center hover:text-white transition-colors">
              حساب جديد
            </Link>
          </div>

          {/* Form */}
          <form noValidate onSubmit={(e) => e.preventDefault()} className="space-y-4" id="driver-login-form">
            {/* Phone */}
            <div className="relative mb-5">
              <div className="relative flex items-center bg-[#1a2333] rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-emerald-500/50 transition-shadow">
                <div className="absolute right-0 top-0 bottom-0 w-14 flex items-center justify-center bg-[#0d1321] border-l border-slate-700/50 pointer-events-none z-10 shadow-[-2px_0_10px_rgba(0,0,0,0.2)]">
                  <Phone className="w-[18px] h-[18px] text-emerald-400" />
                </div>
                <Input
                  type="tel"
                  placeholder="07xxxxxxxxx"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  className={`h-14 bg-transparent border-0 text-white placeholder:text-slate-500 placeholder:text-center rounded-none px-16 text-[16px] font-medium tracking-wide focus-visible:ring-0 w-full text-center ${errors.loginPhone ? "shadow-[inset_0_0_0_1px_rgba(239,68,68,0.5)]" : ""}`}
                  dir="ltr"
                />
              </div>
              {errors.loginPhone && (
                <p className="absolute -bottom-5 right-1 pl-1 text-[11px] text-red-400">
                  {errors.loginPhone}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="relative pt-1">
              <div className="relative flex items-center bg-[#1a2333] rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-emerald-500/50 transition-shadow">
              <div className="absolute right-0 top-0 bottom-0 w-14 flex items-center justify-center bg-[#0d1321] border-l border-slate-700/50 pointer-events-none z-10 shadow-[-2px_0_10px_rgba(0,0,0,0.2)]">
                <Lock className="w-[18px] h-[18px] text-emerald-400" />
              </div>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={loginPhonePassword}
                onChange={(e) => setLoginPhonePassword(e.target.value)}
                className={`w-full h-14 bg-transparent border-0 text-white placeholder:text-slate-500 placeholder:text-center rounded-none px-16 text-[15px] text-center focus-visible:ring-0 ${errors.loginPhonePassword ? "shadow-[inset_0_0_0_1px_rgba(239,68,68,0.5)]" : ""}`}
                dir="ltr"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-0 top-0 bottom-0 w-16 flex items-center justify-center text-slate-400 hover:text-white transition-colors z-10 bg-[#0d1321] border-r border-slate-700/50"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
              </div>
              {errors.loginPhonePassword && (
                <p className="absolute -bottom-5 right-1 pl-1 text-[11px] text-red-400">
                  {errors.loginPhonePassword}
                </p>
              )}
            </div>

            {/* Remember Me Toggle */}
            <button
              type="button"
              onClick={() => setRememberMe(!rememberMe)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 ${
                rememberMe ? 'border-emerald-500/40 bg-emerald-500/8 text-emerald-400' : 'border-slate-700/50 bg-[#1a2333] text-slate-400'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${rememberMe ? 'bg-emerald-500/15' : 'bg-slate-800'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${rememberMe ? 'text-emerald-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 mr-auto" dir="rtl">
                <p className="text-sm font-medium whitespace-nowrap">ابقَني مسجلاً دخولي</p>
                <span className="text-[10px] sm:text-[11px] text-slate-500 hidden sm:inline-block">
                  {rememberMe ? '(لن تحتاج لتسجيل دخول مجدداً)' : '(ستُطلب كلمة المرور للفتح)'}
                </span>
                <div className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-1 ${rememberMe ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${rememberMe ? 'right-0.5' : 'left-0.5'}`} />
                </div>
              </div>
            </button>

            {/* Forgot Password */}
            <div className="flex justify-start pt-2">
              <button
                type="button"
                onClick={() => setShowPasswordReset(true)}
                className="text-[13px] text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                نسيت كلمة المرور؟
              </button>
            </div>

            {/* Submit Button */}
            <Button
              type="button"
              onClick={() => handlePhoneLogin()}
              disabled={loading}
              className="w-full h-14 bg-[#34d399] hover:bg-[#10b981] active:bg-[#059669] text-[#064e3b] text-[16px] font-bold rounded-full mt-4 shadow-[0_0_24px_rgba(52,211,153,0.3)] transition-all"
            >
              {loading ? "جاري الدخول..." : "تسجيل الدخول"}
            </Button>
          </form>



          <div className="mt-auto pt-6 pb-2 text-center">
            <p className="text-slate-500 text-[11px]">
              بالمتابعة، أنت توافق على <Link to="/terms" className="border-b border-slate-600 pb-0.5 text-slate-300 hover:text-emerald-400 hover:border-emerald-400 transition-colors">شروط الخدمة</Link> و<Link to="/privacy" className="border-b border-slate-600 pb-0.5 text-slate-300 hover:text-emerald-400 hover:border-emerald-400 transition-colors">سياسة الخصوصية</Link> الخاصة بـ raan.
            </p>
          </div>
            
        </div>
      </div>
    
      <PasswordResetDialog
        open={showPasswordReset}
        onOpenChange={setShowPasswordReset}
        userType="driver"
      />
    </div>
  );
};

export default DriverAuth;
