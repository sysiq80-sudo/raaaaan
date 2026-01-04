import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Car, Mail, Lock, User, Phone, ArrowRight } from "lucide-react";
import logo from "@/assets/logo.png";
import OTPVerification from "@/components/OTPVerification";
import PasswordResetDialog from "@/components/PasswordResetDialog";
import { phoneSignupSchema } from "@/lib/validations";

const RiderAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPhonePassword, setLoginPhonePassword] = useState("");
  const [optionalEmail, setOptionalEmail] = useState("");
  const [showOTP, setShowOTP] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    if (!loginPhone || loginPhone.length < 10) {
      setErrors({ loginPhone: 'يرجى إدخال رقم هاتف صحيح' });
      return;
    }

    if (!loginPhonePassword || loginPhonePassword.length < 6) {
      setErrors({ loginPhonePassword: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
      return;
    }

    setLoading(true);
    
    try {
      const phoneEmail = `${loginPhone.replace(/\D/g, '')}@raan.app`;
      
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: phoneEmail,
        password: loginPhonePassword,
      });
      
      if (signInError) {
        toast({
          title: "خطأ في تسجيل الدخول",
          description: signInError.message === "Invalid login credentials" 
            ? "رقم الهاتف أو كلمة المرور غير صحيحة"
            : signInError.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "مرحباً بك!",
          description: "تم تسجيل الدخول بنجاح",
        });
      }
      
    } catch (error: any) {
      toast({
        title: "خطأ في تسجيل الدخول",
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSignup = async () => {
    setErrors({});

    const result = phoneSignupSchema.safeParse({ fullName, phone });
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

    if (!phonePassword || phonePassword.length < 6) {
      setErrors({ phonePassword: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
      return;
    }

    // Validate optional email if provided
    if (optionalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(optionalEmail)) {
      setErrors({ optionalEmail: 'البريد الإلكتروني غير صحيح' });
      return;
    }

    setShowOTP(true);
  };

  const handlePhoneVerified = async () => {
    setShowOTP(false);
    
    setLoading(true);
    try {
      const phoneEmail = `${phone.replace(/\D/g, '')}@raan.app`;

      const { data, error } = await supabase.auth.signUp({
        email: phoneEmail,
        password: phonePassword,
        options: {
          emailRedirectTo: `${window.location.origin}/rider`,
          data: {
            full_name: fullName,
            phone: phone,
            auth_method: 'phone',
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            title: "رقم الهاتف مسجل مسبقاً",
            description: "يرجى تسجيل الدخول بدلاً من إنشاء حساب جديد",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      if (data.user) {
        // Update profile with phone and optional email
        await supabase
          .from('profiles')
          .update({ 
            phone, 
            full_name: fullName,
            email: optionalEmail || null
          })
          .eq('user_id', data.user.id);

        toast({
          title: "تم إنشاء الحساب! ✅",
          description: "مرحباً بك في ران",
        });
        navigate("/rider");
      }
    } catch (error: any) {
      toast({
        title: "خطأ في التسجيل",
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (showOTP) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src={logo} alt="RAAN" className="w-20 h-20 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-foreground">ران <span className="text-primary">RAAN</span></h1>
            <p className="text-muted-foreground mt-2">تسجيل راكب جديد</p>
          </div>

          <Card className="border-0 shadow-xl">
            <CardContent className="pt-6">
              <OTPVerification
                phone={phone}
                purpose="rider_registration"
                onVerified={handlePhoneVerified}
                onBack={() => setShowOTP(false)}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="RAAN" className="w-20 h-20 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground">ران <span className="text-primary">RAAN</span></h1>
          <p className="text-muted-foreground mt-2">تسجيل الراكب</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle>أهلاً بك</CardTitle>
            <CardDescription>سجل دخولك أو أنشئ حساب راكب جديد</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">تسجيل الدخول</TabsTrigger>
                <TabsTrigger value="signup">حساب جديد</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handlePhoneLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label>رقم الهاتف (WhatsApp)</Label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        placeholder="07xxxxxxxxx"
                        value={loginPhone}
                        onChange={(e) => setLoginPhone(e.target.value)}
                        className={`pr-10 ${errors.loginPhone ? 'border-destructive' : ''}`}
                        required
                        dir="ltr"
                      />
                    </div>
                    {errors.loginPhone && <p className="text-xs text-destructive">{errors.loginPhone}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>كلمة المرور</Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={loginPhonePassword}
                        onChange={(e) => setLoginPhonePassword(e.target.value)}
                        className={`pr-10 ${errors.loginPhonePassword ? 'border-destructive' : ''}`}
                        required
                        minLength={6}
                        dir="ltr"
                      />
                    </div>
                    {errors.loginPhonePassword && <p className="text-xs text-destructive">{errors.loginPhonePassword}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "جاري التحميل..." : "تسجيل الدخول"}
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
              </TabsContent>

              <TabsContent value="signup">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>الاسم الكامل</Label>
                    <div className="relative">
                      <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="أحمد محمد"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={`pr-10 ${errors.fullName ? 'border-destructive' : ''}`}
                        required
                      />
                    </div>
                    {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>رقم WhatsApp</Label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        placeholder="07xxxxxxxxx"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={`pr-10 ${errors.phone ? 'border-destructive' : ''}`}
                        required
                        dir="ltr"
                      />
                    </div>
                    {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>كلمة المرور</Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={phonePassword}
                        onChange={(e) => setPhonePassword(e.target.value)}
                        className={`pr-10 ${errors.phonePassword ? 'border-destructive' : ''}`}
                        required
                        minLength={6}
                        dir="ltr"
                      />
                    </div>
                    {errors.phonePassword && <p className="text-xs text-destructive">{errors.phonePassword}</p>}
                  </div>
                  
                  {/* Optional Email Field */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <span>البريد الإلكتروني</span>
                      <span className="text-xs text-muted-foreground">(اختياري)</span>
                    </Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="example@email.com"
                        value={optionalEmail}
                        onChange={(e) => setOptionalEmail(e.target.value)}
                        className={`pr-10 ${errors.optionalEmail ? 'border-destructive' : ''}`}
                        dir="ltr"
                      />
                    </div>
                    {errors.optionalEmail && <p className="text-xs text-destructive">{errors.optionalEmail}</p>}
                  </div>

                  <Button 
                    type="button" 
                    className="w-full" 
                    disabled={loading}
                    onClick={handlePhoneSignup}
                  >
                    {loading ? "جاري التحميل..." : "التحقق من الرقم"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            {/* Link to driver auth */}
            <div className="mt-6 pt-4 border-t text-center">
              <p className="text-sm text-muted-foreground mb-2">هل أنت سائق؟</p>
              <Link to="/driver/auth">
                <Button variant="outline" className="w-full">
                  <Car className="w-4 h-4 ml-2" />
                  تسجيل دخول السائقين
                  <ArrowRight className="w-4 h-4 mr-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Back to home */}
        <div className="text-center mt-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
            العودة للصفحة الرئيسية
          </Link>
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

export default RiderAuth;
