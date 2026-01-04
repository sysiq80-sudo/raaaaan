import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Car, Lock, Phone, ArrowRight, UserPlus } from "lucide-react";
import logo from "@/assets/logo.png";
import PasswordResetDialog from "@/components/PasswordResetDialog";
import { normalizeIraqiPhone } from "@/lib/validations";

const DriverAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPhonePassword, setLoginPhonePassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  useEffect(() => {
    const checkDriverStatus = async (userPhone?: string) => {
      // Use the database function to link driver by phone
      // This bypasses RLS and handles the user_id mismatch
      if (userPhone) {
        // تجربة تنسيقات متعددة للرقم
        let phoneClean = userPhone.replace(/\D/g, '');

        // إزالة 964 في البداية
        if (phoneClean.startsWith('964')) {
          phoneClean = phoneClean.slice(3);
        }

        // تنسيقات مختلفة للتجربة
        const phoneFormats = [
          normalizeIraqiPhone(userPhone), // التنسيق الأساسي
          '0' + phoneClean.replace(/^0/, ''), // مع صفر
          phoneClean.replace(/^0/, ''), // بدون صفر
        ];

        // إزالة التكرارات
        const uniqueFormats = [...new Set(phoneFormats)];

        console.log('Trying to link driver with phone formats:', uniqueFormats);

        for (const phone of uniqueFormats) {
          const { data, error } = await supabase.rpc('link_driver_by_phone', {
            p_phone: phone
          });

          if (error) {
            console.error('Error linking driver with phone', phone, ':', error);
            continue;
          }

          // Type assertion for the JSON response
          const result = data as { success?: boolean; driver_id?: string; status?: string; error?: string } | null;

          console.log('Link result for', phone, ':', result);

          if (result?.success) {
            // Driver found and linked (or already linked)
            console.log('Driver linked successfully!');
            navigate("/driver");
            return;
          }
        }
      }

      // If no phone or no driver found, redirect to complete registration
      console.log('No driver found, redirecting to complete registration');
      navigate("/driver/complete-registration");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // Extract phone from email if it's a phone-based login
        const email = session.user.email || '';
        const phoneMatch = email.match(/^(\d+)@/);
        const userPhone = phoneMatch ? phoneMatch[1] : undefined;
        checkDriverStatus(userPhone);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const email = session.user.email || '';
        const phoneMatch = email.match(/^(\d+)@/);
        const userPhone = phoneMatch ? phoneMatch[1] : undefined;
        checkDriverStatus(userPhone);
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
      // تنظيف الرقم
      let phoneClean = loginPhone.replace(/\D/g, '');

      // إزالة 964 في البداية
      if (phoneClean.startsWith('964')) {
        phoneClean = phoneClean.slice(3);
      }

      // إزالة الصفر في البداية
      if (phoneClean.startsWith('0')) {
        phoneClean = phoneClean.slice(1);
      }

      // إضافة الصفر للتنسيق الصحيح
      const phoneWithZero = '0' + phoneClean;
      const phoneWithoutZero = phoneClean;

      // محاولة جميع التنسيقات الممكنة
      const phoneEmails = [
        // التنسيق مع صفر
        `${phoneWithZero}@raan.app`,
        `${phoneWithZero}@driver.raan.app`,
        // التنسيق بدون صفر  
        `${phoneWithoutZero}@raan.app`,
        `${phoneWithoutZero}@driver.raan.app`,
        // تنسيق 964
        `964${phoneWithoutZero}@raan.app`,
        `964${phoneWithoutZero}@driver.raan.app`,
      ];

      console.log('Trying login with phones:', phoneEmails);

      let signInSuccess = false;
      let lastError = null;

      for (const phoneEmail of phoneEmails) {
        console.log('Trying:', phoneEmail);
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: phoneEmail,
          password: loginPhonePassword,
        });

        if (!signInError && data.user) {
          signInSuccess = true;
          console.log('Login successful with:', phoneEmail);
          toast({
            title: "مرحباً بك كابتن!",
            description: "تم تسجيل الدخول بنجاح",
          });
          break;
        } else {
          lastError = signInError;
          console.log('Failed with:', phoneEmail, signInError?.message);
        }
      }

      if (!signInSuccess) {
        // تحديد نوع الخطأ وعرض رسالة مناسبة
        let errorMessage = "رقم الهاتف أو كلمة المرور غير صحيحة";

        if (lastError?.message?.includes('Invalid login credentials')) {
          errorMessage = "رقم الهاتف أو كلمة المرور غير صحيحة. تأكد من صحة البيانات.";
        } else if (lastError?.message?.includes('Email not confirmed')) {
          errorMessage = "لم يتم تأكيد الحساب. تواصل مع الدعم.";
        } else if (lastError?.message?.includes('Too many requests')) {
          errorMessage = "محاولات كثيرة جداً. انتظر قليلاً ثم حاول مرة أخرى.";
        }

        toast({
          title: "خطأ في تسجيل الدخول",
          description: errorMessage,
          variant: "destructive",
        });

        console.error('All login attempts failed. Last error:', lastError);
      }

    } catch (error: any) {
      console.error('Login error:', error);
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="RAAN" className="w-20 h-20 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground">ران <span className="text-blue-600">للسائقين</span></h1>
          <p className="text-muted-foreground mt-2">منصة السائقين المحترفين</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle>تسجيل دخول السائق</CardTitle>
            <CardDescription>سجل دخولك للوصول إلى لوحة تحكم السائق</CardDescription>
          </CardHeader>
          <CardContent>
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
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
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

            {/* Register as new driver */}
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground text-center mb-3">لست مسجلاً كسائق؟</p>
              <Link to="/driver/register">
                <Button variant="outline" className="w-full border-blue-600 text-blue-600 hover:bg-blue-50">
                  <UserPlus className="w-4 h-4 ml-2" />
                  سجل كسائق جديد
                  <ArrowRight className="w-4 h-4 mr-2" />
                </Button>
              </Link>
            </div>

            {/* Link to rider auth */}
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">هل أنت راكب؟</p>
              <Link to="/rider/auth">
                <Button variant="ghost" size="sm">
                  تسجيل دخول الركاب
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
        userType="driver"
      />
    </div>
  );
};

export default DriverAuth;
