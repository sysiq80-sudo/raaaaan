import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Gift, Sparkles, CheckCircle2, Phone, Lock, User, MapPin, Mail, ArrowRight, Clock, Wallet, Trophy, Loader2, AlertTriangle } from 'lucide-react';
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
import { useDriverRegSettings } from '@/hooks/useDriverRegSettings';
import { saveRememberMe } from '@/services/rememberMeService';

const DriverRegister = () => {
  const navigate = useNavigate();
  const { settings, loading: loadingSettings, isPromoActive, daysRemaining } = useDriverRegSettings();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
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

  // Show loading while settings are being fetched
  if (loadingSettings) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
      phone: phone.replace(/[^0-9+]/g, ''),
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
    // Prevent double-submit (can trigger repeated signup requests)
    if (isLoading) return;

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

      // 1) Create auth user via Edge Function (avoids Supabase email rate limits)
      const { data: signupData, error: signupError } = await supabase.functions.invoke('driver-signup', {
        body: {
          phone: normalizedPhone,
          password,
          fullName: fullName.trim(),
          email: email.trim() || null,
          gender,
          workCity,
        },
      });

      if (signupError) {
        // Extract the actual error body from the edge function response
        let errorBody: any = null;
        try {
          if (signupError.context && typeof signupError.context.json === 'function') {
            errorBody = await signupError.context.json();
          }
        } catch (_) { /* ignore parse errors */ }
        console.log('Driver signup error body:', errorBody);

        const msg = errorBody?.error || signupError.message || 'فشل إنشاء الحساب';
        const userExists = errorBody?.user_exists ||
          msg.includes('مسجل مسبقاً') ||
          msg.toLowerCase().includes('already registered');

        if (userExists) {
          toast.error('رقم الهاتف مسجل مسبقاً، يرجى تسجيل الدخول');
          navigate('/driver/auth');
          return;
        }

        // Show server-provided Arabic error if available
        throw new Error(msg);
      }

      const authPhone = signupData?.authPhone as string | undefined;
      const userId = signupData?.userId as string | undefined;

      if (!authPhone || !userId) {
        throw new Error('فشل إنشاء الحساب (بيانات ناقصة)');
      }

      // 2) Sign in to establish session (phone-only)
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        phone: authPhone,
        password,
      });

      if (signInError) throw signInError;

      // احفظ تفويضه بشكل افتراضي لكي لا يخرج عند الإغلاق
      saveRememberMe(phone, "driver");

      const effectiveUserId = signInData.user?.id || userId;

      // 3) Create driver record with pending status
      const { error: driverError } = await supabase
        .from('drivers')
        .insert({
          user_id: effectiveUserId,
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
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'حدث خطأ أثناء التسجيل');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1 mb-5">
      {[1, 2, 3, 4].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold transition-all border-2 ${
              currentStep > step
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_10px_rgba(52,211,153,0.4)]'
                : currentStep === step
                ? 'bg-transparent border-emerald-500 text-emerald-400'
                : 'bg-transparent border-slate-700 text-slate-500'
            }`}
          >
            {currentStep > step ? <CheckCircle2 className="w-4 h-4" /> : step}
          </div>
          {step < 4 && (
            <div className={`w-8 h-0.5 mx-0.5 rounded-full transition-all ${
              currentStep > step ? 'bg-emerald-500' : 'bg-slate-700'
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  // Step 1: Welcome & Promo Offer
  const renderTermsStep = () => {
    if (isPromoActive) {
      // Free registration promo (before end date)
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
              {settings.promo_title}
            </CardTitle>
            <CardDescription className="text-center text-lg mt-2">
              {settings.promo_subtitle}
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
                  <p className="font-bold text-foreground">التفعيل: <span className="text-primary text-xl">{settings.promo_activation_fee.toLocaleString('en-US')} دينار</span></p>
                  <p className="text-sm text-muted-foreground">{settings.promo_activation_fee_text}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Gift className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="font-bold text-foreground">الرصيد: <span className="text-yellow-600 text-xl">{settings.promo_bonus_amount.toLocaleString('en-US')} دينار</span> هدية!</p>
                  <p className="text-sm text-muted-foreground">{settings.promo_bonus_text}</p>
                </div>
              </div>
            </div>
            
            {/* Countdown timer */}
            <div className="flex items-center justify-center p-4 bg-gradient-to-r from-primary/20 via-primary/30 to-primary/20 rounded-xl border-2 border-primary/40">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">{settings.countdown_text}</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-4xl font-bold text-primary animate-pulse">{daysRemaining}</span>
                  <span className="text-xl font-semibold text-primary">{settings.days_text}</span>
                </div>
              </div>
            </div>

            {/* Urgency reminder */}
            <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-xl border border-destructive/20">
              <Clock className="w-6 h-6 text-destructive flex-shrink-0" />
              <div>
                <p className="font-bold text-destructive">⏰ تذكير مهم!</p>
                <p className="text-sm text-muted-foreground">
                  {settings.promo_urgency_text}
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
                {settings.terms_text.includes('أوافق على') ? (
                  <>
                    أوافق على <Link to="/terms" className="text-primary underline">شروط الاستخدام</Link> و<Link to="/privacy" className="text-primary underline">سياسة الخصوصية</Link>
                  </>
                ) : (
                  settings.terms_text
                )}
              </Label>
            </div>

            <Button 
              onClick={handleTermsAccept} 
              className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/25" 
              size="lg"
              disabled={!acceptedTerms}
            >
              <Sparkles className="w-5 h-5 ml-2" />
              {settings.promo_button_text}
            </Button>
          </CardContent>
        </Card>
      );
    }
    
    // Paid registration (after promo end date)
    return (
      <div className="flex flex-col gap-3">
        {/* Activation fee card */}
        <div className="bg-[#1a2333]/80 rounded-[20px] px-5 py-4 flex items-center justify-between border border-slate-700/50 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
          <p className="text-white text-[15px] font-medium z-10 font-bold order-2">
            رسوم التفعيل: <span className="text-emerald-400 font-bold">{settings.paid_activation_fee.toLocaleString('en-US')} دينار</span>
          </p>
          <div className="w-[42px] h-[42px] bg-[#0c261e] border border-emerald-500/20 rounded-xl flex items-center justify-center z-10 order-1">
             <Wallet className="w-[20px] h-[20px] text-emerald-500" />
          </div>
        </div>

        {/* Benefits Card */}
        <div className="bg-transparent border border-emerald-500/60 rounded-[20px] px-5 py-5 space-y-4 shadow-[inset_0_0_20px_rgba(52,211,153,0.03)] relative overflow-hidden">
          <h3 className="text-emerald-400 font-bold text-[15px] flex items-center gap-2.5 mb-2">
            <Gift className="w-5 h-5" />
            بس لا تشيل هم! عدنا مفاجآت:
          </h3>
          
          <div className="flex items-start gap-3">
             <div className="mt-0.5"><Gift className="w-[18px] h-[18px] text-emerald-400" /></div>
             <p className="text-white text-[13px] leading-relaxed">
               {settings.paid_wallet_bonus_text || `رصيد ترحيبي: 50,000 دينار في محفظتك`}
             </p>
          </div>

          <div className="flex items-start gap-3">
             <div className="mt-0.5"><Trophy className="w-[18px] h-[18px] text-emerald-400" /></div>
             <p className="text-white text-[13px] leading-relaxed">
               {settings.paid_challenge_text || `تحدي المبتدئين: أكمل 10 رحلات واربح 100,000 دينار إضافي!`}
             </p>
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-[#1a2333]/80 rounded-[20px] px-5 py-4 flex items-center gap-4 border border-slate-700/50 shadow-md">
            <div className="flex-1 text-right">
              <h3 className="text-emerald-400 font-bold text-[14px] mb-1">الزبدة:</h3>
              <p className="text-[#a4b1cd] text-[12px] leading-snug">
                 {settings.paid_summary_text || `رسوم التفعيل لمرة واحدة فقط - استثمار في مستقبلك`}
              </p>
            </div>
            <div className="w-[42px] h-[42px] flex items-center justify-end flex-shrink-0">
               <Trophy className="w-[24px] h-[24px] text-emerald-500" strokeWidth={1.5} />
            </div>
        </div>

        {/* Note */}
        <div className="bg-[#1a2333]/60 rounded-xl px-4 py-3 flex items-start gap-3 border border-slate-700/30">
             <div className="text-slate-400 flex-shrink-0 mt-0.5"><AlertTriangle className="w-[16px] h-[16px]" /></div>
             <p className="text-[#a4b1cd] text-[12px] leading-relaxed text-right">
                <span className="font-bold text-slate-200">تنويه صغير:</span> {settings.paid_warning_text || `مرة تدفع وتشتغل للأبد، بدون رسوم شهرية أو خفية`}
             </p>
        </div>

        {/* Checkbox */}
        <div className="flex items-start justify-end gap-3 mt-3 mb-1 px-1">
          <Label htmlFor="terms" className="text-[12px] text-[#a4b1cd] cursor-pointer leading-relaxed pt-0.5">
             أوافق على <Link to="/terms" className="text-slate-200 underline underline-offset-4 decoration-slate-600 hover:text-emerald-400 font-medium transition-colors">شروط الاستخدام</Link> و<Link to="/privacy" className="text-slate-200 underline underline-offset-4 decoration-slate-600 hover:text-emerald-400 font-medium transition-colors">سياسة الخصوصية</Link>
          </Label>
          <Checkbox
            id="terms"
            checked={acceptedTerms}
            onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
            className="mt-0.5 border-emerald-500/50 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 rounded bg-[#0a0f1c]"
          />
        </div>

        <Button 
          onClick={handleTermsAccept} 
          className="w-full h-[54px] bg-[#34d399] hover:bg-[#10b981] active:bg-[#059669] text-[#064e3b] text-[16px] font-bold rounded-2xl shadow-[0_4px_20px_rgba(52,211,153,0.25)] transition-all mt-3"
          disabled={!acceptedTerms}
        >
          ابدأ التسجيل الآن
        </Button>
      </div>
    );
  };

  // Step 2: Personal Information
  const renderPersonalInfoStep = () => (
    <div className="flex flex-col gap-4 pb-24">
      {/* Card Header */}
      <div className="bg-[#151f30] rounded-2xl px-5 py-5 border border-slate-700/50">
        <div className="flex items-center gap-3 mb-1">
          <User className="w-5 h-5 text-emerald-400" />
          <h2 className="text-white font-bold text-[17px]">المعلومات الشخصية</h2>
        </div>
        <p className="text-slate-400 text-[12px] pe-8">أدخل بياناتك الأساسية فقط</p>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-4">
        {/* Full Name */}
        <div className="space-y-1.5">
          <label className="text-slate-300 text-[13px] font-medium flex items-center gap-1">
            الاسم الثلاثي (كما في البطاقة الموحدة)
            <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center">
              <User className="w-4 h-4 text-slate-500" />
            </div>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); clearErrors(); }}
              placeholder="مثال: أحمد محمد علي"
              className={`h-12 bg-[#1a2333] border-slate-700/50 text-white placeholder:text-slate-500 rounded-xl pr-11 text-[14px] focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 ${errors.fullName ? 'border-red-500/60' : ''}`}
            />
          </div>
          {errors.fullName ? (
            <p className="text-[11px] text-red-400 flex items-center gap-1"><span className="w-1 h-1 bg-red-400 rounded-full"/>{errors.fullName}</p>
          ) : (
            <p className="text-[11px] text-slate-500">يجب أن يطابق الاسم المدون في البطاقة الموحدة</p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label className="text-slate-300 text-[13px] font-medium flex items-center gap-1">
            رقم الهاتف (واتساب)
            <span className="text-red-400">*</span>
          </label>
          <div className="relative flex items-center bg-[#1a2333] rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-emerald-500/50 transition-shadow border border-slate-700/50 mt-1">
            <div className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center bg-[#0d1321] border-l border-slate-700/50 pointer-events-none z-10 shadow-[-2px_0_8px_rgba(0,0,0,0.1)]">
              <Phone className="w-[18px] h-[18px] text-emerald-400" />
            </div>
            <Input
              id="phone" type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); clearErrors(); }}
              placeholder="07XX XXX XXXX"
              className={`h-12 bg-transparent border-0 text-emerald-400 placeholder:text-slate-500 rounded-none pr-14 pl-4 text-[16px] font-bold tracking-wider focus-visible:ring-0 w-full ${errors.phone ? 'shadow-[inset_0_0_0_1px_rgba(239,68,68,0.5)]' : ''}`}
              dir="ltr"
            />
          </div>
          {errors.phone ? (
            <p className="text-[11px] text-red-400 flex items-center gap-1"><span className="w-1 h-1 bg-red-400 rounded-full"/>{ errors.phone}</p>
          ) : (
            <p className="text-[11px] text-slate-500">تأكد أن الرقم مفعل عليه واتساب</p>
          )}
        </div>

        {/* Gender */}
        <div className="space-y-2">
          <label className="text-slate-300 text-[13px] font-medium flex items-center gap-1">
            الجنس
            <span className="text-red-400">*</span>
          </label>
          <RadioGroup value={gender} onValueChange={(v) => setGender(v as 'male' | 'female')} className="flex gap-6">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="male" id="male" className="border-emerald-500 text-emerald-500" />
              <Label htmlFor="male" className="cursor-pointer text-white text-[14px]">ذكر</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="female" id="female" className="border-emerald-500 text-emerald-500" />
              <Label htmlFor="female" className="cursor-pointer text-white text-[14px]">أنثى</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-slate-300 text-[13px] font-medium">البريد الإلكتروني (اختياري)</label>
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center">
              <Mail className="w-4 h-4 text-slate-500" />
            </div>
            <Input
              id="email" type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="h-12 bg-[#1a2333] border-slate-700/50 text-white placeholder:text-slate-500 rounded-xl pl-11 text-[14px] focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              dir="ltr"
            />
          </div>
        </div>

        {/* City */}
        <div className="space-y-1.5">
          <label className="text-slate-300 text-[13px] font-medium flex items-center gap-1">
            مدينة العمل
            <span className="text-red-400">*</span>
          </label>
          <Select value={workCity} onValueChange={setWorkCity}>
            <SelectTrigger className="h-12 bg-[#1a2333] border-slate-700/50 text-white rounded-xl focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20">
              <SelectValue placeholder="اختر مدينة العمل" className="text-slate-500" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a2333] border-slate-700">
              {ANBAR_CITIES.map((city) => (
                <SelectItem key={city} value={city} className="text-white focus:bg-emerald-500/20 focus:text-white">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    {city}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Fixed Bottom Nav */}
      <div className="fixed bottom-0 right-0 left-0 max-w-md mx-auto px-5 pt-3 bg-[#0a0f1c]/80 backdrop-blur-md border-t border-slate-800/60 flex gap-3" style={{ paddingBottom: 'calc(var(--safe-area-bottom, 0px) + 16px)' }}>
        <button onClick={() => setCurrentStep(1)} className="flex-1 h-12 rounded-2xl border border-slate-700 text-slate-200 text-[15px] font-medium hover:bg-slate-800 transition-colors active:scale-95">
          السابق
        </button>
        <button onClick={handlePersonalInfoSubmit} className="flex-[2] h-12 rounded-2xl bg-[#34d399] hover:bg-[#10b981] text-[#064e3b] text-[15px] font-bold shadow-[0_4px_16px_rgba(52,211,153,0.25)] transition-all active:scale-95">
          التالي
        </button>
      </div>
    </div>
  );

  // Step 3: OTP Verification
  const renderOTPStep = () => (
    <div className="flex flex-col gap-4">
      <div className="bg-[#151f30] rounded-2xl px-5 py-5 border border-slate-700/50">
        <div className="flex items-center gap-3 mb-1">
          <Phone className="w-5 h-5 text-emerald-400" />
          <h2 className="text-white font-bold text-[17px]">التحقق من رقم الهاتف</h2>
        </div>
        <p className="text-slate-400 text-[12px] pe-8">سيتم إرسال رمز تحقق إلى رقم واتساب الخاص بك</p>
      </div>
      <div className="bg-[#151f30] rounded-2xl px-5 py-5 border border-slate-700/50">
        <OTPVerification
          phone={normalizeIraqiPhone(phone)}
          purpose="driver_registration"
          onVerified={handleOTPVerified}
          onBack={() => setCurrentStep(2)}
        />
      </div>
    </div>
  );

  // Step 4: Password
  const renderPasswordStep = () => (
    <div className="flex flex-col gap-4 pb-24">
      <div className="bg-[#151f30] rounded-2xl px-5 py-5 border border-slate-700/50">
        <div className="flex items-center gap-3 mb-1">
          <Lock className="w-5 h-5 text-emerald-400" />
          <h2 className="text-white font-bold text-[17px]">إنشاء كلمة المرور</h2>
        </div>
        <p className="text-slate-400 text-[12px] pe-8">اختر كلمة مرور قوية لحسابك</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <label className="text-slate-300 text-[13px] font-medium flex items-center gap-1">
            كلمة المرور
            <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center">
              <Lock className="w-4 h-4 text-slate-500" />
            </div>
            <Input
              id="password" type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearErrors(); }}
              placeholder="أدخل كلمة مرور قوية"
              className={`h-12 bg-[#1a2333] border-slate-700/50 text-white placeholder:text-slate-500 rounded-xl pr-11 text-[14px] focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 ${errors.password ? 'border-red-500/60' : ''}`}
            />
          </div>
          {errors.password ? (
            <p className="text-[11px] text-red-400 flex items-center gap-1"><span className="w-1 h-1 bg-red-400 rounded-full"/>{errors.password}</p>
          ) : (
            <p className="text-[11px] text-slate-500">8 أحرف على الأقل، مع رقم وحرف</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-slate-300 text-[13px] font-medium flex items-center gap-1">
            تأكيد كلمة المرور
            <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center">
              <Lock className="w-4 h-4 text-slate-500" />
            </div>
            <Input
              id="confirmPassword" type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); clearErrors(); }}
              placeholder="أعد إدخال كلمة المرور"
              className={`h-12 bg-[#1a2333] border-slate-700/50 text-white placeholder:text-slate-500 rounded-xl pr-11 text-[14px] focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 ${errors.confirmPassword ? 'border-red-500/60' : ''}`}
            />
          </div>
          {errors.confirmPassword && (
            <p className="text-[11px] text-red-400 flex items-center gap-1"><span className="w-1 h-1 bg-red-400 rounded-full"/>{errors.confirmPassword}</p>
          )}
        </div>
      </div>

      {/* Fixed Bottom Nav */}
      <div className="fixed bottom-0 right-0 left-0 max-w-md mx-auto px-5 pt-3 bg-[#0a0f1c]/80 backdrop-blur-md border-t border-slate-800/60 flex gap-3" style={{ paddingBottom: 'calc(var(--safe-area-bottom, 0px) + 16px)' }}>
        <button onClick={() => setCurrentStep(3)} className="flex-1 h-12 rounded-2xl border border-slate-700 text-slate-200 text-[15px] font-medium hover:bg-slate-800 transition-colors active:scale-95">
          السابق
        </button>
        <button onClick={handleRegister} disabled={isLoading} className="flex-[2] h-12 rounded-2xl bg-[#34d399] hover:bg-[#10b981] text-[#064e3b] text-[15px] font-bold shadow-[0_4px_16px_rgba(52,211,153,0.25)] transition-all active:scale-95 disabled:opacity-60">
          {isLoading ? 'جاري التسجيل...' : 'إنشاء الحساب'}
        </button>
      </div>
    </div>
  );

  // Step 5: Success
  const renderSuccessStep = () => (
    <div className="flex flex-col gap-4 pb-8">
      {/* Success Icon */}
      <div className="flex flex-col items-center py-6">
        <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500/40 rounded-full flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(52,211,153,0.2)]">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <h2 className="text-[22px] font-bold text-white mb-1">تم تقديم طلبك بنجاح! 🎉</h2>
        <p className="text-slate-400 text-[13px] text-center">
          شكراً لك {fullName} على التسجيل في منصة ران
        </p>
      </div>

      {/* Next Steps */}
      <div className="bg-[#151f30] rounded-2xl px-5 py-5 border border-slate-700/50 space-y-3">
        <p className="font-bold text-white text-[14px] mb-2">📢 ماذا الآن؟</p>
        {[
          'سيتم مراجعة طلبك من قبل فريق الإدارة',
          'تابع الإشعارات في التطبيق لمعرفة حالة طلبك',
          'يمكنك متابعة قناة التليغرام الرسمية للاطلاع على إعلانات قبول الطلبات',
          'عند الموافقة، ستحتاج لإكمال بيانات السيارة والمستندات'
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-emerald-400 text-[10px] font-bold">{i+1}</span>
            </div>
            <p className="text-slate-300 text-[13px] leading-relaxed">{item}</p>
          </div>
        ))}
      </div>

      {/* Warning */}
      <div className="bg-amber-500/8 border border-amber-500/25 rounded-2xl px-4 py-4">
        <p className="text-amber-400 text-[12px] leading-relaxed">
          💡 <strong>ملاحظة:</strong> لن تتمكن من استلام الطلبات حتى تُكمل جميع البيانات المطلوبة ويتم الموافقة على طلبك.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 mt-2">
        <button onClick={() => navigate('/driver/complete-registration')} className="w-full h-14 rounded-2xl bg-[#34d399] hover:bg-[#10b981] text-[#064e3b] text-[16px] font-bold shadow-[0_4px_16px_rgba(52,211,153,0.25)] transition-all active:scale-95">
          إكمال بيانات السيارة والمستندات
        </button>
        <button onClick={() => navigate('/driver')} className="w-full h-12 rounded-2xl border border-slate-700 text-slate-200 text-[15px] font-medium hover:bg-slate-800 transition-colors active:scale-95">
          الذهاب للصفحة الرئيسية
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full sm:max-w-[480px] sm:mx-auto sm:shadow-[0_0_60px_rgba(0,0,0,0.6)] sm:border-x sm:border-slate-800/80 relative overflow-hidden bg-[#0a0f1c] flex flex-col font-sans" style={{ transform: "translate3d(0, 0, 0)" }} dir="rtl">
      <div className="flex-1 overflow-y-auto w-full max-w-md mx-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col min-h-full px-5 pt-[6vh] pb-6">

          {/* Header */}
          <div className="text-center space-y-2 mb-6 relative">
            <Link to="/" className="absolute right-0 top-0 p-2 text-slate-400 hover:text-white transition-colors">
               <ArrowRight className="w-5 h-5" />
            </Link>
            
            {currentStep === 1 ? (
              <div className="pt-2">
                <img src={logo} alt="RAAN" className="w-[80px] mx-auto mb-6 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)] opacity-90" />
                <h1 className="text-[22px] font-bold text-white mb-2 leading-tight">انضم لعائلة ران وابدأ رحلتك</h1>
                <p className="text-[#a4b1cd] text-[13.5px]">استثمر في مستقبلك مع ران</p>
              </div>
            ) : (
              <div className="pt-2">
                <img src={logo} alt="RAAN" className="w-[60px] mx-auto mb-4 opacity-70" />
                <h1 className="text-[18px] font-bold text-white">إكمال بيانات السائق</h1>
              </div>
            )}
          </div>

          {/* Step Indicator */}
          {currentStep <= 4 && (
            <div className="mb-6 px-4">
              {renderStepIndicator()}
            </div>
          )}

          {/* Steps Content */}
          <div className="flex-1">
            {currentStep === 1 && renderTermsStep()}
            {currentStep === 2 && renderPersonalInfoStep()}
            {currentStep === 3 && renderOTPStep()}
            {currentStep === 4 && renderPasswordStep()}
            {currentStep === 5 && renderSuccessStep()}
          </div>

          {/* Login Link */}
          {currentStep <= 4 && (
            <div className="mt-8 text-center pb-2">
              <p className="text-[13px] text-slate-400">
                لديك حساب بالفعل؟{' '}
                <button onClick={() => navigate('/driver/auth')} className="text-white hover:text-emerald-400 font-medium underline underline-offset-4 decoration-slate-600 hover:decoration-emerald-400 transition-colors">
                  تسجيل الدخول
                </button>
              </p>
            </div>
          )}

          {/* Safe Area Bottom */}
          <div style={{ height: 'var(--safe-area-bottom, 4px)' }} />
        </div>
      </div>
    </div>
  );
};

export default DriverRegister;
