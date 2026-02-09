import { useNavigate, Link } from "react-router-dom";
import { useEffect } from "react";
import logo from "@/assets/logo.png";
import HeroSection from "@/components/index/HeroSection";
import FeaturesSection from "@/components/index/FeaturesSection";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Clock,
  MapPin,
  Wallet,
  Users,
  Star,
  Navigation,
  Zap,
  Route,
  MapPinned,
  Shield,
  HeartHandshake,
  CreditCard,
  Smartphone,
  Facebook,
  Twitter,
  Instagram,
  Phone,
  Mail,
} from "lucide-react";
const Index = () => {
  const navigate = useNavigate();
  useEffect(() => {
    // Check if running as installed PWA or on mobile device
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    // Redirect to auth page if installed as PWA or on mobile
    if (isStandalone || isMobile) {
      navigate("/auth", {
        replace: true,
      });
    }
  }, [navigate]);
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container flex items-center justify-between h-16 md:h-20 border-primary">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="RAAN"
              className="w-10 h-10 rounded-xl shadow-glow-sm"
            />
            <span className="text-xl font-bold text-foreground">
              ران <span className="text-primary">RAAN</span>
            </span>
          </div>
          <nav className="hidden lg:flex items-center gap-8">
            <Link to="/" className="text-foreground font-medium">
              الرئيسية
            </Link>
            <Link
              to="#features"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              المميزات
            </Link>
            <Link
              to="/driver"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              كن كابتن
            </Link>
            <Link
              to="#contact"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              تواصل معنا
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/rider/auth" className="hidden sm:block">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
              >
                تسجيل الراكب
              </Button>
            </Link>
            <Link to="/driver/auth" className="hidden sm:block">
              <Button
                variant="outline"
                size="sm"
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                تسجيل السائق
              </Button>
            </Link>
            <Link to="/auth">
              <Button
                size="sm"
                className="bg-gradient-primary shadow-glow btn-glow font-semibold px-5"
              >
                احجز الآن
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 md:pt-32 pb-16 md:pb-24 hero-gradient min-h-screen flex items-center">
        {/* Background Elements */}
        <div className="absolute inset-0 dots-pattern opacity-30" />
        <div className="absolute top-20 right-[15%] w-80 h-80 bg-primary/10 rounded-full blur-[100px] animate-pulse-glow" />
        <div className="absolute bottom-20 left-[10%] w-96 h-96 bg-primary/8 rounded-full blur-[120px]" />

        <div className="container relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Text Content */}
            <div className="text-center lg:text-right order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-fade-up opacity-0 fill-forwards">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="text-sm font-medium text-primary">
                  الآن في الأنبار
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-[1.1] animate-fade-up opacity-0 fill-forwards delay-100">
                ران، <span className="text-gradient text-glow">أسرع</span>،
                <br />
                أرخص، وأكثر أماناً
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed animate-fade-up opacity-0 fill-forwards delay-200">
                تطبيق ران يفهم شوارع الأنبار. أسعار واضحة بناءً على نقطة
                الانطلاق والوجهة، ودفع نقدي أو إلكتروني. احجز رحلتك الآن!
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-up opacity-0 fill-forwards delay-300">
                <Link to="/rider/auth">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-gradient-primary shadow-glow-lg btn-glow text-lg px-8 py-6 font-semibold"
                  >
                    سجل كراكب
                    <ArrowLeft className="mr-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link to="/driver/auth">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto text-lg px-8 py-6 font-semibold border-blue-600 text-blue-600 hover:bg-blue-50"
                  >
                    سجل كسائق
                  </Button>
                </Link>
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-8 justify-center lg:justify-start mt-10 animate-fade-up opacity-0 fill-forwards delay-400">
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-bold text-primary">
                    +50K
                  </p>
                  <p className="text-sm text-muted-foreground">راكب سعيد</p>
                </div>
                <div className="w-px h-12 bg-border" />
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-bold text-primary">
                    +10K
                  </p>
                  <p className="text-sm text-muted-foreground">كابتن</p>
                </div>
                <div className="w-px h-12 bg-border" />
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-bold text-primary">
                    4.9
                  </p>
                  <p className="text-sm text-muted-foreground">تقييم من 5</p>
                </div>
              </div>
            </div>

            {/* Phone Mockup */}
            <div className="relative order-1 lg:order-2 flex justify-center animate-scale-in opacity-0 fill-forwards delay-200">
              <div className="relative">
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-primary/20 blur-[80px] rounded-full scale-75" />

                {/* Phone Frame */}
                <div className="relative w-72 h-[580px] md:w-80 md:h-[640px] bg-card rounded-[3rem] border border-border/50 phone-shadow overflow-hidden">
                  {/* Phone Notch */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-background rounded-full" />

                  {/* Phone Content */}
                  <div className="absolute inset-3 top-10 rounded-[2.5rem] bg-background overflow-hidden border border-border/30">
                    {/* Status Bar */}
                    <div className="flex items-center justify-between px-6 py-2 text-xs text-muted-foreground">
                      <span className="font-medium">9:41</span>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-2.5 bg-muted-foreground/50 rounded-sm" />
                      </div>
                    </div>

                    {/* App Header */}
                    <div className="px-5 py-3">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <img
                            src={logo}
                            alt="RAAN"
                            className="w-8 h-8 rounded-lg shadow-glow-sm"
                          />
                          <span className="font-bold text-foreground">ران</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10">
                          <Clock className="w-3 h-3 text-primary" />
                          <span className="text-xs font-medium text-primary">
                            3 دقائق
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        مرحباً، أحمد!
                      </p>
                      <h3 className="text-lg font-bold text-foreground">
                        إلى أين؟
                      </h3>
                    </div>

                    {/* Recent Trips */}
                    <div className="px-5 mt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-3">
                        الرحلات الأخيرة
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50 card-hover">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              التأميم - السجارية
                            </p>
                            <p className="text-xs text-muted-foreground">
                              5,500 د.ع
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50 card-hover">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              الملعب - جامعة الأنبار
                            </p>
                            <p className="text-xs text-muted-foreground">
                              4,000 د.ع
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Car Types */}
                    <div className="px-5 mt-4">
                      <p className="text-xs font-medium text-muted-foreground mb-3">
                        نوع السيارة
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="text-center p-2 bg-primary/10 rounded-xl border border-primary/30">
                          <span className="text-lg">🚗</span>
                          <p className="text-[10px] text-primary font-medium mt-1">
                            اقتصادي
                          </p>
                        </div>
                        <div className="text-center p-2 bg-card rounded-xl border border-border/50">
                          <span className="text-lg">🚙</span>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            مريح
                          </p>
                        </div>
                        <div className="text-center p-2 bg-card rounded-xl border border-border/50">
                          <span className="text-lg">🚘</span>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            فاخر
                          </p>
                        </div>
                        <div className="text-center p-2 bg-card rounded-xl border border-border/50">
                          <span className="text-lg">👩</span>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            نسائي
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Promo Banner */}
                    <div className="mx-5 mt-4 p-3 bg-gradient-primary rounded-xl">
                      <p className="text-xs font-bold text-primary-foreground">
                        خصم 20% على أول رحلة!
                      </p>
                      <p className="text-[10px] text-primary-foreground/80">
                        استخدم كود: RAAN20
                      </p>
                    </div>

                    {/* Bottom Nav */}
                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-around py-3 bg-card/90 backdrop-blur-lg border-t border-border/30">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <span className="text-[9px] text-primary font-medium">
                          الرئيسية
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <Clock className="w-5 h-5 text-muted-foreground" />
                        <span className="text-[9px] text-muted-foreground">
                          رحلاتي
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <Wallet className="w-5 h-5 text-muted-foreground" />
                        <span className="text-[9px] text-muted-foreground">
                          المحفظة
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <Users className="w-5 h-5 text-muted-foreground" />
                        <span className="text-[9px] text-muted-foreground">
                          حسابي
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating Cards */}
                <div className="absolute -right-4 top-24 animate-float-slow">
                  <div className="bg-card p-3 rounded-2xl shadow-xl border border-border/50 flex items-center gap-3 gradient-border">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Star className="w-5 h-5 text-primary fill-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">4.9</p>
                      <p className="text-xs text-muted-foreground">
                        تقييم السائق
                      </p>
                    </div>
                  </div>
                </div>

                <div className="absolute -left-6 bottom-36 animate-float animate-float-delay-1s">
                  <div className="bg-card p-3 rounded-2xl shadow-xl border border-border/50 flex items-center gap-3 gradient-border">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Navigation className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        وصل الكابتن
                      </p>
                      <p className="text-xs text-muted-foreground">
                        تويوتا كورولا
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-28 relative">
        <div className="absolute inset-0 dots-pattern opacity-20" />
        <div className="container relative">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              مميزات ذكية تفهم احتياجاتك
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              تصميم <span className="text-gradient">لاحتياجات</span> شوارع
              الأنبار
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              وجهتك بناءً على نقاط معروفة وملاحظة بأسلوب أنباري مألوف وبسيط
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={<Route className="w-6 h-6" />}
              title="توجيه ذكي"
              description="التطبيق يختار لك أفضل الطرق ويتجنب الازدحامات"
              delay={0}
            />
            <FeatureCard
              icon={<MapPinned className="w-6 h-6" />}
              title="نقاط دالة أنبارية"
              description="استخدم أسماء المناطق والمعالم المعروفة بدلاً من العناوين"
              delay={100}
            />
            <FeatureCard
              icon={<Wallet className="w-6 h-6" />}
              title="دفع مرن"
              description="ادفع نقداً أو عبر زين كاش وآسيا حوالة"
              delay={200}
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="أمان متقدم"
              description="جميع سائقينا معتمدون ومتحقق من هوياتهم وسياراتهم"
              delay={300}
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="خفيف وسريع"
              description="التطبيق يعمل حتى مع ضعف الإنترنت ويستهلك بيانات قليلة"
              delay={400}
            />
            <FeatureCard
              icon={<HeartHandshake className="w-6 h-6" />}
              title="تكسي نسائي"
              description="سائقات محترفات للنساء فقط براحة وخصوصية تامة"
              delay={500}
            />
            <FeatureCard
              icon={<Navigation className="w-6 h-6" />}
              title="خرائط حرارية للكباتن"
              description="نظهر للسائقين مناطق الطلب العالي لزيادة أرباحهم"
              delay={600}
            />
            <FeatureCard
              icon={<CreditCard className="w-6 h-6" />}
              title="أسعار شفافة"
              description="اعرف السعر مسبقاً بدون مفاجآت أو رسوم خفية"
              delay={700}
            />
          </div>
        </div>
      </section>

      {/* Booking Demo Section */}
      <section className="py-20 md:py-28 bg-card/50 relative overflow-hidden">
        <div className="absolute inset-0 dots-pattern opacity-10" />
        <div className="container relative">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              <Smartphone className="w-4 h-4" />
              جرّب الحجز الآن
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              واجهة <span className="text-gradient">بسيطة</span>، خطوات واضحة
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-lg">
              رحلة سهلة في خطوات
            </p>
          </div>

          <div className="max-w-md mx-auto">
            {/* Booking Card Mockup */}
            <div className="bg-card rounded-3xl border border-border/50 overflow-hidden shadow-2xl gradient-border">
              {/* Header */}
              <div className="p-6 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-primary font-medium text-sm">
                      4.9 كم
                    </span>
                  </div>
                </div>
              </div>

              {/* Locations */}
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full bg-primary shadow-glow-sm" />
                  <div className="flex-1 p-3 bg-secondary/50 rounded-xl border border-border/30">
                    <p className="text-sm text-foreground font-medium">
                      شارع 20 الرمادي - قرب جامعة الأنبار
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full bg-muted-foreground/50" />
                  <div className="flex-1 p-3 bg-secondary/50 rounded-xl border border-border/30">
                    <p className="text-sm text-foreground font-medium">
                      سوق الرمادي المركزي - البوابة الرئيسية
                    </p>
                  </div>
                </div>
              </div>

              {/* Car Selection */}
              <div className="px-6 pb-4">
                <p className="text-xs text-muted-foreground mb-3">
                  اختر نوع السيارة
                </p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-3 bg-primary/10 rounded-xl border border-primary/30">
                    <span className="text-xl">🚗</span>
                    <p className="text-xs font-bold text-primary mt-1">
                      اقتصادي
                    </p>
                    <p className="text-[10px] text-primary/70">5,000</p>
                  </div>
                  <div className="text-center p-3 bg-secondary rounded-xl border border-border/30">
                    <span className="text-xl">🚙</span>
                    <p className="text-xs font-medium text-muted-foreground mt-1">
                      مريح
                    </p>
                    <p className="text-[10px] text-muted-foreground">7,500</p>
                  </div>
                  <div className="text-center p-3 bg-secondary rounded-xl border border-border/30">
                    <span className="text-xl">👩</span>
                    <p className="text-xs font-medium text-muted-foreground mt-1">
                      نسائي
                    </p>
                    <p className="text-[10px] text-muted-foreground">6,000</p>
                  </div>
                  <div className="text-center p-3 bg-secondary rounded-xl border border-border/30">
                    <span className="text-xl">🚘</span>
                    <p className="text-xs font-medium text-muted-foreground mt-1">
                      فاخر
                    </p>
                    <p className="text-[10px] text-muted-foreground">12,000</p>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="px-6 pb-4">
                <p className="text-xs text-muted-foreground mb-3">
                  طريقة الدفع
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center justify-center gap-2 p-3 bg-primary/10 rounded-xl border border-primary/30">
                    <Wallet className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-primary">
                      نقدي
                    </span>
                  </div>
                  <div className="flex-1 flex items-center justify-center gap-2 p-3 bg-secondary rounded-xl border border-border/30">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      المحفظة
                    </span>
                  </div>
                </div>
              </div>

              {/* Price Summary */}
              <div className="px-6 pb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">سعر الرحلة</span>
                  <span className="text-foreground">4,500 د.ع</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">رسوم الخدمة</span>
                  <span className="text-foreground">500 د.ع</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-border/30">
                  <span className="text-foreground">المجموع</span>
                  <span className="text-primary">5,000 د.ع</span>
                </div>
              </div>

              {/* Confirm Button */}
              <div className="p-6 pt-2">
                <Button className="w-full bg-gradient-primary shadow-glow btn-glow py-6 text-lg font-bold">
                  تأكيد الحجز
                  <ArrowLeft className="mr-2 w-5 h-5" />
                </Button>
              </div>

              {/* Driver Preview */}
              <div className="px-6 pb-6">
                <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-2xl border border-border/30">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-2xl">
                    👨
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-foreground">
                      كابتن محمد الدليمي
                    </p>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-primary fill-primary" />
                      <span className="text-xs text-muted-foreground">
                        4.9 • تويوتا كورولا
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-primary">أقرب</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container relative">
          <div className="text-center mb-12">
            <p className="text-muted-foreground mb-2">
              نطمح لنصل الى ثقة الناس والسوق في ران
            </p>
            <h3 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary text-glow">
              150,000
            </h3>
            <p className="text-muted-foreground">رحلة مكتملة</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCard
              icon={<Clock className="w-6 h-6" />}
              number="24/7"
              label="خدمة متواصلة"
            />
            <StatCard
              icon={<Users className="w-6 h-6" />}
              number="+40"
              label="كابتن"
            />
            <StatCard
              icon={<Star className="w-6 h-6" />}
              number="85%"
              label="رضا العملاء"
            />
            <StatCard
              icon={<Shield className="w-6 h-6" />}
              number="100%"
              label="سائقون معتمدون"
            />
          </div>
        </div>
      </section>

      {/* Driver CTA Section */}
      <section className="py-20 md:py-28 bg-card/30 relative">
        <div className="absolute inset-0 dots-pattern opacity-15" />
        <div className="container relative">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
                <img src={logo} alt="RAAN" className="w-4 h-4 rounded" />
                انضم لفريق ران
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                وابدأ <span className="text-gradient">الربح</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                تبحث عن دخل إضافي، ران توفر لك الفرص الأفضل في الأنبار
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground mb-1">ربح أعلى</h4>
                    <p className="text-sm text-muted-foreground">
                      نسبة عمولة منخفضة وحوافز يومية للسائقين النشطين
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground mb-1">
                      مرونة كاملة
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      اعمل بوقتك الخاص بدون التزامات أو جداول ثابتة
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <HeartHandshake className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground mb-1">
                      دعم متواصل
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      فريق دعم على مدار الساعة لمساعدتك وحل أي مشكلة
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/driver/register">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-gradient-primary shadow-glow btn-glow font-semibold px-8"
                  >
                    سجل ككابتن
                    <ArrowLeft className="mr-2 w-5 h-5" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary/30 hover:bg-primary/10"
                >
                  اعرف المزيد
                </Button>
              </div>
            </div>

            <div className="relative flex justify-center">
              <div className="relative w-72 h-[500px] bg-card rounded-[2.5rem] border border-border/50 overflow-hidden shadow-2xl gradient-border">
                {/* Driver App Preview */}
                <div className="absolute inset-3 rounded-[2rem] bg-background overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          مرحباً كابتن
                        </p>
                        <h3 className="font-bold text-foreground">
                          محمد الدليمي
                        </h3>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-2xl">
                        👨
                      </div>
                    </div>

                    {/* Earnings Card */}
                    <div className="p-4 bg-gradient-primary rounded-2xl mb-4 shadow-glow">
                      <p className="text-primary-foreground/80 text-sm mb-1">
                        أرباح اليوم
                      </p>
                      <p className="text-3xl font-bold text-primary-foreground">
                        125,000 <span className="text-lg">د.ع</span>
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-sm text-primary-foreground/80">
                        <span>12 رحلة</span>
                        <span>•</span>
                        <span>45 كم</span>
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 bg-card rounded-xl border border-border/50 text-center">
                        <p className="text-2xl font-bold text-primary">4.9</p>
                        <p className="text-xs text-muted-foreground">تقييمك</p>
                      </div>
                      <div className="p-3 bg-card rounded-xl border border-border/50 text-center">
                        <p className="text-2xl font-bold text-foreground">
                          98%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          معدل القبول
                        </p>
                      </div>
                    </div>

                    {/* Go Online Button */}
                    <div className="p-4 bg-primary/10 rounded-2xl border border-primary/30 text-center">
                      <div className="w-16 h-16 mx-auto rounded-full bg-gradient-primary flex items-center justify-center mb-2 shadow-glow animate-pulse-glow overflow-hidden">
                        <img src={logo} alt="RAAN" className="w-12 h-12" />
                      </div>
                      <p className="font-bold text-primary">متصل الآن</p>
                      <p className="text-xs text-muted-foreground">
                        جاهز لاستقبال الطلبات
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        id="contact"
        className="py-16 bg-background border-t border-border/30"
      >
        <div className="container">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={logo}
                  alt="RAAN"
                  className="w-12 h-12 rounded-2xl shadow-glow-sm"
                />
                <span className="text-2xl font-bold text-foreground">
                  ران <span className="text-primary">RAAN</span>
                </span>
              </div>
              <p className="text-muted-foreground max-w-md mb-6 leading-relaxed">
                منصة ران هي الخيار الأمثل للتنقل في الأنبار. نفهم شوارع المحافظة
                ونوفر لك تجربة تنقل آمنة ومريحة. قريباً في باقي المحافظات!
              </p>
              <div className="flex gap-3">
                <a
                  href="#"
                  title="تابعنا على فيسبوك"
                  className="w-10 h-10 rounded-xl bg-card border border-border/50 hover:bg-primary hover:border-primary transition-all flex items-center justify-center group"
                >
                  <Facebook className="w-5 h-5 text-muted-foreground group-hover:text-primary-foreground" />
                </a>
                <a
                  href="#"
                  title="تابعنا على تويتر"
                  className="w-10 h-10 rounded-xl bg-card border border-border/50 hover:bg-primary hover:border-primary transition-all flex items-center justify-center group"
                >
                  <Twitter className="w-5 h-5 text-muted-foreground group-hover:text-primary-foreground" />
                </a>
                <a
                  href="#"
                  title="تابعنا على إنستغرام"
                  className="w-10 h-10 rounded-xl bg-card border border-border/50 hover:bg-primary hover:border-primary transition-all flex items-center justify-center group"
                >
                  <Instagram className="w-5 h-5 text-muted-foreground group-hover:text-primary-foreground" />
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-foreground mb-4">روابط سريعة</h4>
              <ul className="space-y-3 text-muted-foreground">
                <li>
                  <Link to="/" className="hover:text-primary transition-colors">
                    الرئيسية
                  </Link>
                </li>
                <li>
                  <Link
                    to="#features"
                    className="hover:text-primary transition-colors"
                  >
                    المميزات
                  </Link>
                </li>
                <li>
                  <Link
                    to="/driver"
                    className="hover:text-primary transition-colors"
                  >
                    كن كابتن
                  </Link>
                </li>
                <li>
                  <Link
                    to="/about"
                    className="hover:text-primary transition-colors"
                  >
                    عن ران
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-foreground mb-4">تواصل معنا</h4>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />
                  <span dir="ltr">+964 7734446636</span>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  <span>info@raan.app</span>
                </li>
              </ul>

              <h4 className="font-bold text-foreground mb-4 mt-6">
                حمّل التطبيق
              </h4>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start border-border/50 hover:bg-card"
                >
                  <svg
                    className="w-5 h-5 ml-2"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                  App Store
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start border-border/50 hover:bg-card"
                >
                  <svg
                    className="w-5 h-5 ml-2"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" />
                  </svg>
                  Google Play
                </Button>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-border/30 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-muted-foreground text-sm">
              © 2024 ران RAAN. جميع الحقوق محفوظة.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link
                to="/privacy"
                className="hover:text-primary transition-colors"
              >
                سياسة الخصوصية
              </Link>
              <Link
                to="/terms"
                className="hover:text-primary transition-colors"
              >
                الشروط والأحكام
              </Link>
              <Link
                to="/admin/login"
                className="hover:text-primary transition-colors"
              >
                لوحة التحكم
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Feature Card Component
const FeatureCard = ({
  icon,
  title,
  description,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) => (
  <div
    className="p-6 bg-card rounded-2xl border border-border/30 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 card-hover animate-fade-up opacity-0 fill-forwards"
    style={{
      animationDelay: `${delay}ms`,
    }}
  >
    <div className="w-12 h-12 mb-4 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
      {icon}
    </div>
    <h3 className="font-bold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed">
      {description}
    </p>
  </div>
);

// Stat Card Component
const StatCard = ({
  icon,
  number,
  label,
}: {
  icon: React.ReactNode;
  number: string;
  label: string;
}) => (
  <div className="text-center p-6 bg-card/50 rounded-2xl border border-border/30">
    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
      {icon}
    </div>
    <p className="text-2xl md:text-3xl font-bold text-foreground mb-1">
      {number}
    </p>
    <p className="text-sm text-muted-foreground">{label}</p>
  </div>
);
export default Index;
