import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, Phone, ArrowRight, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";
import OTPVerification from "@/components/OTPVerification";
import PasswordResetDialog from "@/components/PasswordResetDialog";
import { phoneSignupSchema } from "@/lib/validations";

type AuthStep = "phone" | "login" | "register" | "otp";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Step management
  const [step, setStep] = useState<AuthStep>("phone");
  const [checkingPhone, setCheckingPhone] = useState(false);

  // Phone step
  const [phoneInput, setPhoneInput] = useState("");

  // Login step
  const [loginPassword, setLoginPassword] = useState("");
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  // Register step
  const [fullName, setFullName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [optionalEmail, setOptionalEmail] = useState("");

  // Common
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/rider");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/rider");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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

  // Check if phone exists in database (profiles) OR auth.users
  const checkPhoneNumber = async () => {
    setErrors({});

    const cleanedPhone = phoneInput.replace(/\D/g, "");

    if (!phoneInput || cleanedPhone.length < 10) {
      setErrors({ phone: "يرجى إدخال رقم هاتف صحيح (10 أرقام على الأقل)" });
      return;
    }

    setCheckingPhone(true);

    try {
      const phoneFormats = formatPhoneForLookup(phoneInput);
      const orCondition = phoneFormats.map((p) => `phone.eq.${p}`).join(",");

      // Check profiles table first
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, phone")
        .or(orCondition)
        .limit(1);

      if (profileError) {
        console.error("Error checking profiles:", profileError);
      }

      console.log("Phone check results:", {
        profileFound: profileData && profileData.length > 0,
        profileData,
        phoneFormats,
      });

      if (profileData && profileData.length > 0) {
        // Phone exists in profiles - go to login
        setStep("login");
        toast({
          title: "مرحباً بعودتك! 👋",
          description: "الرقم مسجل مسبقاً، يرجى إدخال كلمة المرور",
        });
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

  // Handle login with password - try both rider and driver domains
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
      const domains = ["@raan.app", "@driver.raan.app"];

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

      if (!loginSuccess && lastError) {
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

    // FOR DEVELOPMENT: Skip OTP and register directly
    // TODO: Enable OTP in production
    setLoading(true);
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
            phone: phoneInput,
            auth_method: "phone",
          },
        },
      });

      if (error) {
        console.error("SignUp error:", error);
        setErrors({ general: error.message });
        toast({
          title: "خطأ في التسجيل",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        // Update profile with phone number
        const { error: profileError } = await supabase.from("profiles").upsert(
          {
            user_id: data.user.id,
            phone: phoneInput,
            full_name: fullName,
            email: optionalEmail || null,
          },
          { onConflict: "user_id" },
        );

        if (profileError) {
          console.error("Profile update error:", profileError);
        }

        toast({
          title: "تم إنشاء الحساب! ✅",
          description: "مرحباً بك في ران",
        });
        navigate("/rider");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      setErrors({ general: error.message });
      toast({
        title: "خطأ في التسجيل",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }

    // Original OTP flow (commented out for development)
    // setStep("otp");
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
            phone: phoneInput,
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

        // Update profile with phone number
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            phone: phoneInput,
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

  // Reset to phone step
  const resetToPhoneStep = () => {
    setStep("phone");
    setLoginPassword("");
    setFullName("");
    setRegisterPassword("");
    setOptionalEmail("");
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src={logo} alt="RAAN" className="w-20 h-20 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-foreground">
              ران <span className="text-primary">RAAN</span>
            </h1>
          </div>

          <Card className="border-0 shadow-xl">
            <CardContent className="pt-6">
              <OTPVerification
                phone={phoneInput}
                purpose="rider_registration"
                onVerified={handleOTPVerified}
                onBack={() => setStep("register")}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="RAAN" className="w-20 h-20 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground">
            ران <span className="text-primary">RAAN</span>
          </h1>
        </div>

        {/* Cards Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Rider Card */}
          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl font-bold text-primary mb-2">
                تسجيل دخول الراكب
              </CardTitle>
              <CardTitle className="text-lg">أهلاً بك</CardTitle>
              <CardDescription>أدخل رقم هاتفك للمتابعة</CardDescription>
            </CardHeader>

            <CardContent>
              {/* Step 1: Phone Input */}
              {step === "phone" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>رقم الهاتف (WhatsApp)</Label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        placeholder="07xxxxxxxxx"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        className={`pr-10 ${errors.phone ? "border-destructive" : ""}`}
                        dir="ltr"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            checkPhoneNumber();
                          }
                        }}
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-xs text-destructive">{errors.phone}</p>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    onClick={checkPhoneNumber}
                    disabled={checkingPhone}
                  >
                    {checkingPhone ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جاري التحقق...
                      </>
                    ) : (
                      "متابعة"
                    )}
                  </Button>
                </div>
              )}

              {/* Step 2a: Login (Phone exists) */}
              {step === "login" && (
                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Show phone number with change option */}
                  <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" />
                      <span className="font-medium" dir="ltr">
                        {formatPhoneDisplay(phoneInput)}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetToPhoneStep}
                      className="text-xs"
                    >
                      تغيير
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>كلمة المرور</Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className={`pr-10 ${errors.password ? "border-destructive" : ""}`}
                        required
                        minLength={6}
                        dir="ltr"
                        autoFocus
                      />
                    </div>
                    {errors.password && (
                      <p className="text-xs text-destructive">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جاري تسجيل الدخول...
                      </>
                    ) : (
                      "تسجيل الدخول"
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="link"
                    className="w-full text-muted-foreground"
                    onClick={() => setShowPasswordReset(true)}
                  >
                    نسيت كلمة المرور؟
                  </Button>
                </form>
              )}

              {/* Step 2b: Register (New phone) */}
              {step === "register" && (
                <div className="space-y-4">
                  {/* Show phone number with change option */}
                  <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" />
                      <span className="font-medium" dir="ltr">
                        {formatPhoneDisplay(phoneInput)}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetToPhoneStep}
                      className="text-xs"
                    >
                      تغيير
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>الاسم الكامل</Label>
                    <div className="relative">
                      <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="أحمد محمد"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={`pr-10 ${errors.fullName ? "border-destructive" : ""}`}
                        required
                        autoFocus
                      />
                    </div>
                    {errors.fullName && (
                      <p className="text-xs text-destructive">
                        {errors.fullName}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>كلمة المرور</Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        className={`pr-10 ${errors.password ? "border-destructive" : ""}`}
                        required
                        minLength={6}
                        dir="ltr"
                      />
                    </div>
                    {errors.password && (
                      <p className="text-xs text-destructive">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <span>البريد الإلكتروني</span>
                      <span className="text-xs text-muted-foreground">
                        (اختياري)
                      </span>
                    </Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="example@email.com"
                        value={optionalEmail}
                        onChange={(e) => setOptionalEmail(e.target.value)}
                        className={`pr-10 ${errors.email ? "border-destructive" : ""}`}
                        dir="ltr"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email}</p>
                    )}
                  </div>

                  <Button
                    type="button"
                    className="w-full"
                    disabled={loading}
                    onClick={handleRegisterSubmit}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جاري إنشاء الحساب...
                      </>
                    ) : (
                      <>
                        إنشاء الحساب
                        <ArrowRight className="mr-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Driver Card */}
          <Card className="border-0 shadow-xl border-gray-700 bg-gray-900">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-white">هل أنت سائق؟</CardTitle>
              <CardDescription className="text-gray-300">
                انضم إلى شبكة السائقين لدينا
              </CardDescription>
            </CardHeader>

            <CardContent className="flex items-center justify-center min-h-[200px]">
              <Link to="/driver/auth" className="w-full">
                <Button
                  variant="outline"
                  className="w-full text-white border-white hover:bg-white hover:text-gray-900 h-12 text-lg font-medium"
                >
                  تسجيل دخول السائقين
                  <ArrowRight className="mr-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Back to home link */}
        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            العودة للصفحة الرئيسية
          </Link>
        </div>
      </div>

      {/* Password Reset Dialog */}
      <PasswordResetDialog
        open={showPasswordReset}
        onOpenChange={setShowPasswordReset}
        userType="rider"
      />
    </div>
  );
};

export default Auth;
