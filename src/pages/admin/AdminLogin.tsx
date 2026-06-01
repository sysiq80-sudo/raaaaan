import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";
import { adminLoginSchema } from "@/lib/validations";

// مفتاح تخزين بيانات المشرف من جدول controller
const ADMIN_CONTROLLER_KEY = "raan_admin_controller";

export interface ControllerAdmin {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

export function getControllerAdmin(): ControllerAdmin | null {
  try {
    const raw = localStorage.getItem(ADMIN_CONTROLLER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setControllerAdmin(admin: ControllerAdmin) {
  localStorage.setItem(ADMIN_CONTROLLER_KEY, JSON.stringify(admin));
}

export function clearControllerAdmin() {
  localStorage.removeItem(ADMIN_CONTROLLER_KEY);
}

const AdminLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const checkExistingSession = async () => {
      // تحقق من وجود جلسة Supabase Auth + بيانات controller معاً
      const { data: { session } } = await supabase.auth.getSession();
      const controllerData = getControllerAdmin();
      
      if (session?.user && controllerData) {
        navigate("/admin");
      }
      setCheckingAuth(false);
    };

    checkExistingSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate with Zod
    const result = adminLoginSchema.safeParse({ email, password });
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

    setLoading(true);

    try {
      // 1. التحقق من بيانات الأدمن عبر جدول controller (edge function)
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "admin-login",
        { body: { email, password } }
      );

      if (fnError) {
        let errorMsg = "حدث خطأ في الاتصال بالخادم";
        try {
          const ctx = (fnError as any)?.context;
          if (ctx && typeof ctx.json === "function") {
            const errBody = await ctx.json();
            if (errBody?.error) errorMsg = errBody.error;
          }
        } catch {}

        toast({
          title: "خطأ في تسجيل الدخول",
          description: errorMsg,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!fnData?.success) {
        toast({
          title: "خطأ في تسجيل الدخول",
          description: fnData?.error || "البريد الإلكتروني أو كلمة المرور غير صحيحة",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // 2. حفظ بيانات المشرف من controller (cache عرض فقط)
      setControllerAdmin(fnData.admin);

      // 3. تسجيل الدخول في Supabase Auth (مطلوب — بدونه لا تعمل الصلاحيات)
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !signInData?.session) {
        console.error("Supabase Auth signIn error:", signInError);
        // فشل Supabase Auth — يعني كلمة المرور في auth.users مختلفة
        // أو المستخدم غير موجود في auth.users
        // نحذف controller data لأنها بدون فائدة بدون session
        clearControllerAdmin();
        toast({
          title: "خطأ في المصادقة",
          description: "فشل تسجيل الدخول — تواصل مع المدير التقني لمزامنة الحساب",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // 4. انتظار AuthContext ليكتشف الدور (user_roles يُنشأ من admin-login Edge Function)
      toast({
        title: "مرحباً بك!",
        description: "تم تسجيل الدخول بنجاح",
      });
      navigate("/admin");
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="RAAN" className="w-20 h-20 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground">لوحة التحكم</h1>
          <p className="text-muted-foreground mt-2">ران - RAAN</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle>تسجيل دخول المشرفين</CardTitle>
            <CardDescription>أدخل بيانات حسابك للوصول للوحة التحكم</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">البريد الإلكتروني</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({...prev, email: ''})); }}
                    className={`pr-10 ${errors.email ? 'border-destructive' : ''}`}
                    required
                    dir="ltr"
                    autoComplete="email"
                  />
                </div>
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors(prev => ({...prev, password: ''})); }}
                    className={`pr-10 ${errors.password ? 'border-destructive' : ''}`}
                    required
                    dir="ltr"
                    autoComplete="current-password"
                  />
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري التحميل...
                  </>
                ) : (
                  "تسجيل الدخول"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <a href="/auth" className="text-sm text-muted-foreground hover:text-primary">
                تسجيل الدخول كمستخدم عادي
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
