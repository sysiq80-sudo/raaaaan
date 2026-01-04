import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Gift, Sparkles, CheckCircle2, Phone, Lock, User, MapPin, Mail, ArrowRight, Clock, Wallet, Trophy } from 'lucide-react';
import logo from "@/assets/logo.png";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import OTPVerification from '@/components/OTPVerification';
import { 
  normalizeIraqiPhone, 
  driverPersonalInfoSchema, 
  driverPasswordSchema,
  ANBAR_CITIES 
} from '@/lib/validations';

// Promo configuration
const PROMO_END_DATE = new Date('2026-01-30');

const DriverRegister = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Check if promo is active
  const isPromoActive = new Date() < PROMO_END_DATE;
  
  // Step 1: Terms acceptance
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  // Step 2: Personal info
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [email, setEmail] = useState('');
  const [workCity, setWorkCity] = useState('');
  
  // Step 4: Password
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const clearErrors = () => setErrors({});

  const handleTermsAccept = () => {
    if (!acceptedTerms) {
      toast.error('يجب الموافقة على الشروط والأحكام');
      return;
    }
    setCurrentStep(2);
  };

  const handlePersonalInfoSubmit = () => {
    clearErrors();
    
    const result = driverPersonalInfoSchema.safeParse({
      fullName: fullName.trim(),
      phone: phone.trim(),
      gender,
      email: email.trim() || undefined,
      workCity: workCity || undefined,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      
      // Show first error as toast
      const firstError = result.error.errors[0];
      toast.error(firstError.message);
      return;
    }
    
    setCurrentStep(3);
  };

  const handleOTPVerified = () => {
    setCurrentStep(4);
  };

  const handleRegister = async () => {
    clearErrors();
    
    // Validate password with Zod
    const passwordResult = driverPasswordSchema.safeParse({
      password,
      confirmPassword,
    });

    if (!passwordResult.success) {
      const fieldErrors: Record<string, string> = {};
      passwordResult.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      toast.error(passwordResult.error.errors[0].message);
      return;
    }

    setIsLoading(true);

    try {
      const normalizedPhone = normalizeIraqiPhone(phone);
      const authEmail = email || `${normalizedPhone.replace(/\D/g, '')}@driver.raan.app`;
      
      // 1. Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: authEmail,
        password: password,
        options: {
          emailRedirectTo: `${window.location.origin}/driver`,
          data: {
            full_name: fullName,
            phone: normalizedPhone,
            role: 'driver'
          }
        }
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          toast.error('رقم الهاتف مسجل مسبقاً، يرجى تسجيل الدخول');
          navigate('/driver/auth');
          return;
        }
        throw authError;
      }

      if (authData.user) {
        // 2. Create driver record with pending status
        const { error: driverError } = await supabase
          .from('drivers')
          .insert({
            user_id: authData.user.id,
            full_name: fullName.trim(),
            phone: normalizedPhone,
            email: email.trim() || null,
            gender: gender,
            status: 'pending',
            is_online: false,
            is_available: false,
            vehicle_type: gender === 'female' ? 'women_only' : 'economy'
          });

        if (driverError) {
          console.error('Driver insert error:', driverError);
        }

        // Show success
        setCurrentStep(5);
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'حدث خطأ أثناء التسجيل');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3, 4].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              currentStep >= step
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {currentStep > step ? <CheckCircle2 className="w-5 h-5" /> : step}
          </div>
          {step < 4 && (
            <div
              className={`w-8 h-1 mx-1 rounded ${
                currentStep > step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  // Step 1: Welcome & Promo Offer
  const renderTermsStep = () => {
    if (isPromoActive) {
      // Free registration promo (before 30.01.2026)
      return (
        <Card className="border-primary/50 bg-gradient-to-br from-primary/10 via-background to-primary/5 overflow-hidden relative">
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-primary/10 rounded-full translate-x-1/2 translate-y-1/2" />
          
          <CardHeader className="relative">
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
                  <Gift className="w-10 h-10 text-primary" />
                </div>
                <Sparkles className="w-6 h-6 text-yellow-500 absolute -top-1 -right-1 animate-bounce" />
              </div>
            </div>
            <CardTitle className="text-center text-2xl text-primary">
              وية ران.. التسجيل بلاش والرصيد علينا! 😉
            </CardTitle>
            <CardDescription className="text-center text-lg mt-2">
              كابتنا، لا تفوت الفرصة وسجل قبل ما يخلص الوقت!
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4 relative">
            {/* Promo benefits */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-primary/10 rounded-xl border border-primary/20">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">التفعيل: <span className="text-primary text-xl">0 دينار</span></p>
                  <p className="text-sm text-muted-foreground">ما تدفع ولا فلس!</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Gift className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="font-bold text-foreground">الرصيد: <span className="text-yellow-600 text-xl">25,000 دينار</span> هدية!</p>
                  <p className="text-sm text-muted-foreground">أول ما يتفعل حسابك يجيك الرصيد، عندك 15 يوم تستفاد منها وتشتغل براحتك.</p>
                </div>
              </div>
            </div>
            
            {/* Countdown timer */}
            {(() => {
              const daysRemaining = Math.max(0, Math.ceil((PROMO_END_DATE.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
              return (
                <div className="flex items-center justify-center p-4 bg-gradient-to-r from-primary/20 via-primary/30 to-primary/20 rounded-xl border-2 border-primary/40">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">باقي على انتهاء العرض</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-4xl font-bold text-primary animate-pulse">{daysRemaining}</span>
                      <span className="text-xl font-semibold text-primary">يوم</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Urgency reminder */}
            <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-xl border border-destructive/20">
              <Clock className="w-6 h-6 text-destructive flex-shrink-0" />
              <div>
                <p className="font-bold text-destructive">⏰ تذكير مهم!</p>
                <p className="text-sm text-muted-foreground">
                  هذا العرض يخلص يوم <strong className="text-foreground">30.01.2026</strong>، وبعدها يرجع التفعيل بفلوس (25,000)، يعني سجل اليوم أحسن مما تدفع باجر!
                </p>
              </div>
            </div>

            {/* Terms checkbox */}
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
              />
              <Label htmlFor="terms" className="text-sm cursor-pointer leading-relaxed">
                أوافق على <Link to="/terms" className="text-primary underline">شروط الاستخدام</Link> و<Link to="/privacy" className="text-primary underline">سياسة الخصوصية</Link>
              </Label>
            </div>

            <Button 
              onClick={handleTermsAccept} 
              className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/25" 
              size="lg"
              disabled={!acceptedTerms}
            >
              <Sparkles className="w-5 h-5 ml-2" />
              سجل الآن واستفد من العرض! 🚀
            </Button>
          </CardContent>
        </Card>
      );
    }
    
    // Paid registration (after 30.01.2026)
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-background via-primary/5 to-background overflow-hidden relative">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <img src={logo} alt="RAAN" className="w-20 h-20" />
          </div>
          <CardTitle className="text-center text-2xl">
            انضم ويانة بتطبيق RAAN 🚗
          </CardTitle>
          <CardDescription className="text-center text-lg mt-2">
            وابدأ مشروعك صح!
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Activation fee */}
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl border">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground">رسوم التفعيل: <span className="text-primary">20,000 دينار</span></p>
            </div>
          </div>
          
          {/* Benefits */}
          <div className="bg-primary/10 rounded-xl p-4 space-y-3 border border-primary/20">
            <p className="font-bold text-primary flex items-center gap-2">
              <Gift className="w-5 h-5" />
              بس لا تشيل هم! عدنا مفاجآت:
            </p>
            
            <div className="flex items-start gap-2">
              <span className="text-primary">🎁</span>
              <p className="text-sm">أول ما يتفعل حسابك ينزلك <strong>10,000 دينار</strong> رصيد صافي بالمحفظة.</p>
            </div>
            
            <div className="flex items-start gap-2">
              <span className="text-primary">🏆</span>
              <p className="text-sm">تحدي: كمل <strong>15 طلب صباحي</strong> بأول أسبوع، وتستلم <strong>10,000 دينار</strong> مكافأة!</p>
            </div>
          </div>
          
          {/* Summary */}
          <div className="flex items-start gap-3 p-4 bg-green-500/10 rounded-xl border border-green-500/20">
            <Trophy className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-green-600">💰 الزبدة:</p>
              <p className="text-sm text-muted-foreground">
                الـ 20,000 اللي دفعتها رجعت لجيبك (10,000 رصيد + 10,000 مكافأة تسجيل أول مرة) ✅
              </p>
            </div>
          </div>
          
          {/* Note */}
          <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg text-sm">
            <span>⚠️</span>
            <p className="text-muted-foreground">
              <strong>تنويه صغير:</strong> رصيد المحفظة مخصص لعمولة التطبيق، يعني إذا صفرت لازم تشحنها حتى تكمل استقبال الطلبات.
            </p>
          </div>

          {/* Terms checkbox */}
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl">
            <Checkbox
              id="terms"
              checked={acceptedTerms}
              onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
            />
            <Label htmlFor="terms" className="text-sm cursor-pointer leading-relaxed">
              أوافق على <Link to="/terms" className="text-primary underline">شروط الاستخدام</Link> و<Link to="/privacy" className="text-primary underline">سياسة الخصوصية</Link>
            </Label>
          </div>

          <Button 
            onClick={handleTermsAccept} 
            className="w-full h-14 text-lg font-bold" 
            size="lg"
            disabled={!acceptedTerms}
          >
            ابدأ التسجيل الآن 🚀
          </Button>
        </CardContent>
      </Card>
    );
  };

  // Step 2: Personal Information
  const renderPersonalInfoStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          المعلومات الشخصية
        </CardTitle>
        <CardDescription>أدخل بياناتك الأساسية فقط</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">الاسم الثلاثي (كما في البطاقة الموحدة) *</Label>
          <div className="relative">
            <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); clearErrors(); }}
              placeholder="مثال: أحمد محمد علي"
              className={`pr-10 ${errors.fullName ? 'border-destructive' : ''}`}
            />
          </div>
          {errors.fullName ? (
            <p className="text-xs text-destructive">{errors.fullName}</p>
          ) : (
            <p className="text-xs text-muted-foreground">يجب أن يطابق الاسم المدون في البطاقة الموحدة</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">رقم الهاتف (واتساب) *</Label>
          <div className="relative">
            <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); clearErrors(); }}
              placeholder="07XX XXX XXXX"
              className={`pr-10 ${errors.phone ? 'border-destructive' : ''}`}
              dir="ltr"
            />
          </div>
          {errors.phone ? (
            <p className="text-xs text-destructive">{errors.phone}</p>
          ) : (
            <p className="text-xs text-muted-foreground">تأكد أن الرقم مفعل عليه واتساب</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>الجنس *</Label>
          <RadioGroup value={gender} onValueChange={(v) => setGender(v as 'male' | 'female')} className="flex gap-6">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="male" id="male" />
              <Label htmlFor="male" className="cursor-pointer">ذكر</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="female" id="female" />
              <Label htmlFor="female" className="cursor-pointer">أنثى</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">البريد الإلكتروني (اختياري)</Label>
          <div className="relative">
            <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="pr-10"
              dir="ltr"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>مدينة العمل *</Label>
          <Select value={workCity} onValueChange={setWorkCity}>
            <SelectTrigger>
              <SelectValue placeholder="اختر مدينة العمل" />
            </SelectTrigger>
            <SelectContent>
              {ANBAR_CITIES.map((city) => (
                <SelectItem key={city} value={city}>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {city}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex-1">
            رجوع
          </Button>
          <Button onClick={handlePersonalInfoSubmit} className="flex-1">
            التالي
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Step 3: OTP Verification
  const renderOTPStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          التحقق من رقم الهاتف
        </CardTitle>
        <CardDescription>سيتم إرسال رمز تحقق إلى رقم واتساب الخاص بك</CardDescription>
      </CardHeader>
      <CardContent>
        <OTPVerification
          phone={normalizeIraqiPhone(phone)}
          purpose="driver_registration"
          onVerified={handleOTPVerified}
          onBack={() => setCurrentStep(2)}
        />
      </CardContent>
    </Card>
  );

  // Step 4: Password
  const renderPasswordStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          إنشاء كلمة المرور
        </CardTitle>
        <CardDescription>اختر كلمة مرور قوية لحسابك</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">كلمة المرور *</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); clearErrors(); }}
            placeholder="أدخل كلمة مرور قوية"
            className={errors.password ? 'border-destructive' : ''}
          />
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password}</p>
          ) : (
            <p className="text-xs text-muted-foreground">6 أحرف على الأقل</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">تأكيد كلمة المرور *</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); clearErrors(); }}
            placeholder="أعد إدخال كلمة المرور"
            className={errors.confirmPassword ? 'border-destructive' : ''}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword}</p>
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={() => setCurrentStep(3)} className="flex-1">
            رجوع
          </Button>
          <Button onClick={handleRegister} className="flex-1" disabled={isLoading}>
            {isLoading ? 'جاري التسجيل...' : 'إنشاء الحساب'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Step 5: Success
  const renderSuccessStep = () => (
    <Card className="border-primary/50 bg-primary/5">
      <CardContent className="pt-8 text-center space-y-6">
        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-12 h-12 text-primary" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-primary">تم تقديم طلبك بنجاح! 🎉</h2>
          <p className="text-muted-foreground">
            شكراً لك {fullName} على التسجيل في منصة ران
          </p>
        </div>

        <div className="bg-background p-4 rounded-lg border text-sm space-y-3 text-right">
          <p className="font-semibold text-foreground">📢 ماذا الآن؟</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>• سيتم مراجعة طلبك من قبل فريق الإدارة</li>
            <li>• <strong>تابع الإشعارات</strong> في التطبيق لمعرفة حالة طلبك</li>
            <li>• يمكنك متابعة <strong>قناة التليغرام الرسمية</strong> للاطلاع على إعلانات قبول طلبات الانضمام للسائقين الجدد</li>
            <li>• عند الموافقة، ستحتاج لإكمال بيانات السيارة والمستندات</li>
          </ul>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg">
          <p className="text-amber-700 dark:text-amber-400 text-sm">
            💡 <strong>ملاحظة:</strong> لن تتمكن من استلام الطلبات حتى تُكمل جميع البيانات المطلوبة (معلومات السيارة، المستندات، الصورة الشخصية) ويتم الموافقة على طلبك من قبل الإدارة.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <Button onClick={() => navigate('/driver/complete-registration')} size="lg" className="w-full">
            إكمال بيانات السيارة والمستندات
          </Button>
          <Button variant="outline" onClick={() => navigate('/driver')} className="w-full">
            الذهاب للصفحة الرئيسية
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4" dir="rtl">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 pt-4">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          <img src={logo} alt="RAAN" className="w-16 h-16 mx-auto" />
          <h1 className="text-2xl font-bold">انضم لفريق ران</h1>
          <p className="text-muted-foreground text-sm">سجّل كسائق وابدأ الربح</p>
        </div>

        {/* Step Indicator */}
        {currentStep <= 4 && renderStepIndicator()}

        {/* Steps */}
        {currentStep === 1 && renderTermsStep()}
        {currentStep === 2 && renderPersonalInfoStep()}
        {currentStep === 3 && renderOTPStep()}
        {currentStep === 4 && renderPasswordStep()}
        {currentStep === 5 && renderSuccessStep()}

        {/* Login Link */}
        {currentStep <= 4 && (
          <p className="text-center text-sm text-muted-foreground">
            لديك حساب بالفعل؟{' '}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/driver/auth')}>
              تسجيل الدخول
            </Button>
          </p>
        )}
      </div>
    </div>
  );
};

export default DriverRegister;
