import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Phone, Eye, EyeOff, BadgeCheck, Headphones, Wallet } from "lucide-react";
import logo from "@/assets/logo.png";
import PasswordResetDialog from "@/components/PasswordResetDialog";
import { normalizeIraqiPhone } from "@/lib/validations";
import { saveRememberMe, clearRememberMe, getRememberMe } from "@/services/rememberMeService";

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
  const [isLinking, setIsLinking] = useState(false); // 🔒 منع الحلقات اللا نهائية

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

    const checkDriverStatus = async (userPhone?: string) => {
      // 🔒 منع المعالجة المتكررة
      if (!isMounted || isLinking || hasProcessed) return;
      
      setIsLinking(true);
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
        if (isMounted) {
          setIsLinking(false);
        }
      }
    };

    // 🔒 فقط معالجة الحدث SIGNED_IN لتجنب الحلقات
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // فقط معالجة SIGNED_IN أو INITIAL_SESSION
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session && isMounted) {
        // Extract phone from email if it's a phone-based login
        const email = session.user.email || "";
        const phoneMatch = email.match(/^(\d+)@/);
        const userPhone = phoneMatch ? phoneMatch[1] : undefined;
        checkDriverStatus(userPhone);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [navigate, isLinking]);

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!loginPhone || loginPhone.length < 10) {
      setErrors({ loginPhone: "يرجى إدخال رقم هاتف صحيح" });
      return;
    }

    if (!loginPhonePassword || loginPhonePassword.length < 6) {
      setErrors({
        loginPhonePassword: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
      });
      return;
    }

    setLoading(true);

    try {
      // تنظيف الرقم
      let phoneClean = loginPhone.replace(/\D/g, "");

      // إزالة 964 في البداية
      if (phoneClean.startsWith("964")) {
        phoneClean = phoneClean.slice(3);
      }

      // إزالة الصفر في البداية
      if (phoneClean.startsWith("0")) {
        phoneClean = phoneClean.slice(1);
      }

      // Normalize to single canonical format to avoid multiple auth attempts
      let normalizedPhone = phoneClean;
      if (normalizedPhone.startsWith("964")) {
        normalizedPhone = normalizedPhone.slice(3);
      }
      // Remove leading 0 if present
      if (normalizedPhone.startsWith("0")) {
        normalizedPhone = normalizedPhone.slice(1);
      }

      // Try driver domain first, then fallback to general domain
      const phoneEmails = [
        `${normalizedPhone}@driver.raan.app`,
        `${normalizedPhone}@raan.app`,
      ];

      console.log("Trying login with phones:", phoneEmails);

      let signInSuccess = false;
      let lastError = null;
      let successfulPhone = ""; // ✅ تتبع الرقم الناجح

      for (const phoneEmail of phoneEmails) {
        console.log("Trying:", phoneEmail);
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: phoneEmail,
            password: loginPhonePassword,
          });

        if (!signInError && data.user) {
          signInSuccess = true;
          // استخرج الرقم من البريد الناجح
          const match = phoneEmail.match(/^(\d+)@/);
          successfulPhone = match ? match[1] : loginPhone; // ✅ احفظ الرقم
          // حفظ دور السائق فوراً لضمان توجيهه لشاشة السائق
          localStorage.setItem("raan_current_role", "driver");
          // حفظ "تذكرني" عبر Capacitor Preferences
          if (rememberMe) {
            saveRememberMe(loginPhone, "driver");
          } else {
            clearRememberMe();
          }
          console.log("Login successful with:", phoneEmail);
          toast({
            title: "مرحباً بك كابتن!",
            description: "تم تسجيل الدخول بنجاح",
          });
          break;
        } else {
          lastError = signInError;
          console.log("Failed with:", phoneEmail, signInError?.message);
        }
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

        if (lastError?.message?.includes("Invalid login credentials")) {
          errorMessage =
            "رقم الهاتف أو كلمة المرور غير صحيحة. تأكد من صحة البيانات.";
        } else if (lastError?.message?.includes("Email not confirmed")) {
          errorMessage = "لم يتم تأكيد الحساب. تواصل مع الدعم.";
        } else if (lastError?.message?.includes("Too many requests")) {
          errorMessage = "محاولات كثيرة جداً. انتظر قليلاً ثم حاول مرة أخرى.";
        }

        toast({
          title: "خطأ في تسجيل الدخول",
          description: errorMessage,
          variant: "destructive",
        });

        console.error("All login attempts failed. Last error:", lastError);
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "خطأ في تسجيل الدخول",
        description: error.message || "حدث خطأ غير متوقع",
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
          <form onSubmit={handlePhoneLogin} className="space-y-4" id="driver-login-form">
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
                  className={`h-14 bg-transparent border-0 text-white placeholder:text-slate-500 rounded-none pr-16 pl-4 text-[16px] font-medium tracking-wide focus-visible:ring-0 w-full text-center ${errors.loginPhone ? "shadow-[inset_0_0_0_1px_rgba(239,68,68,0.5)]" : ""}`}
                  required
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
                placeholder="كلمة المرور"
                value={loginPhonePassword}
                onChange={(e) => setLoginPhonePassword(e.target.value)}
                className={`w-full h-14 bg-transparent border-0 text-white placeholder-slate-400 rounded-none pr-16 pl-12 text-[15px] focus-visible:ring-0 ${errors.loginPhonePassword ? "shadow-[inset_0_0_0_1px_rgba(239,68,68,0.5)]" : ""}`}
                required
                minLength={6}
                dir="rtl"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-0 inset-y-0 flex items-center pl-4 text-slate-400 hover:text-white transition-colors z-10"
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
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-[#34d399] hover:bg-[#10b981] active:bg-[#059669] text-[#064e3b] text-[16px] font-bold rounded-full mt-4 shadow-[0_0_24px_rgba(52,211,153,0.3)] transition-all"
            >
              {loading ? "جاري الدخول..." : "تسجيل الدخول"}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 mt-10 mb-6">
            <div className="flex-1 h-px bg-[#1e293b]" />
            <span className="text-[13px] text-slate-400 font-medium">أو تواصل عبر</span>
            <div className="flex-1 h-px bg-[#1e293b]" />
          </div>

          {/* Social */}
          <div className="grid grid-cols-2 gap-4">
            <Button type="button" variant="outline" className="h-12 bg-[#131b2c] border-[#1e293b] text-white hover:bg-[#1e293b] rounded-xl flex items-center justify-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
              <span className="font-bold">جوجل</span>
            </Button>
            <Button type="button" variant="outline" className="h-12 bg-[#131b2c] border-[#1e293b] text-white hover:bg-[#1e293b] rounded-xl flex items-center justify-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor"><path d="M16.365,2.152c-1.393,0-3.085,0.852-3.92,1.803c-0.655,0.729-1.314,2.028-1.054,3.31c1.497,0.115,3.155-0.758,3.957-1.748C16.142,4.551,16.793,3.315,16.365,2.152z M17.922,17.472c-0.342,0.92-2.181,3.226-3.868,3.226c-1.037,0-1.465-0.653-3.141-0.653c-1.696,0-2.222,0.671-3.161,0.671c-1.744,0-3.896-2.585-4.52-4.32C1.908,12.637,2.822,7.319,6.066,7.319c1.693,0,2.693,0.887,3.945,0.887c1.334,0,2.887-1.077,4.505-1.077c1.087,0,3.649,0.297,4.981,2.073c-3.16,1.424-2.618,5.77-0.125,6.861C19.168,16.48,18.528,17.026,17.922,17.472z"/></svg>
              <span className="font-bold">آبل</span>
            </Button>
          </div>

          {/* Info Section */}
          <div className="mt-14 mb-8">
            <h2 className="text-white font-bold text-[18px] mb-4 text-center">لماذا تقود مع <span className="text-white">raan</span>؟</h2>
            <div className="grid grid-cols-2 gap-3" dir="rtl">
              {/* Right column -> Instant Payouts */}
              <div className="col-span-1 bg-[#151c2b] rounded-2xl p-4 flex flex-col justify-end relative overflow-hidden h-36">
                {/* Background icon watermark */}
                <div className="absolute -left-4 -bottom-4 text-slate-800/40">
                  <svg className="w-28 h-28" fill="currentColor" viewBox="0 0 24 24"><path d="M21 18v1a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1h-9a2 2 0 00-2 2v8a2 2 0 002 2h9zm-9-2h10V8H12v8zm4-2.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/></svg>
                </div>
                {/* Small Icon top right */}
                <div className="absolute top-4 right-4 text-emerald-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <h3 className="text-white font-bold text-[15px] z-10 mb-1 drop-shadow-sm">دفعات فورية</h3>
                <p className="text-slate-400 text-[11px] leading-tight z-10 px-1">الأرباح متاحة على مدار الساعة</p>
              </div>
              
              {/* Left column -> Two stacked cards */}
              <div className="col-span-1 flex flex-col gap-3">
                <div className="bg-[#1a2333] rounded-2xl p-3 px-4 flex items-center justify-between flex-1">
                  <div>
                    <h3 className="text-white font-bold text-[13px]">عضوية النخبة</h3>
                  </div>
                  <div className="bg-[#0f2922] p-1.5 rounded-lg text-emerald-400 border border-emerald-500/10">
                    <BadgeCheck className="w-[18px] h-[18px]" />
                  </div>
                </div>
                <div className="bg-[#101421] rounded-2xl p-3 px-4 flex items-center justify-between flex-1 border border-slate-800/60">
                  <div>
                    <h3 className="text-white font-bold text-[13px] leading-tight mt-1">خدمة المساعدة<br/>24/7</h3>
                  </div>
                  <div className="bg-[#2a1e1d] p-1.5 rounded-lg text-rose-400 border border-rose-500/10">
                    <Headphones className="w-[18px] h-[18px]" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-6 pb-2 text-center">
            <p className="text-slate-500 text-[11px]">
              بالمتابعة، أنت توافق على <span className="border-b border-slate-600 pb-0.5">شروط الخدمة</span> و<span className="border-b border-slate-600 pb-0.5">سياسة الخصوصية</span> الخاصة بـ raan.
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
