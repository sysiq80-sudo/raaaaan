import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";
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
  Mic,
  Sparkles,
  Brain,
  Volume2,
  Bot,
  MessageCircle,
  Globe,
  ChevronDown,
  Play,
  CheckCircle2,
  ArrowUpRight,
  Send,
  Menu,
  X,
} from "lucide-react";

// ═══════════════════════════════════════
// Voice Wave Animation
// ═══════════════════════════════════════
const VoiceWaveAnimation = ({ isActive }: { isActive: boolean }) => (
  <div className="flex items-end gap-[3px] h-8">
    {[1, 2, 3, 4, 5, 4, 3, 2, 1].map((h, i) => (
      <div
        key={i}
        className="w-[3px] rounded-full bg-primary transition-all duration-500"
        style={{
          height: isActive ? `${h * 7}px` : "4px",
          opacity: isActive ? 0.6 + h * 0.08 : 0.3,
          animation: isActive ? `voiceBar 0.6s ease-in-out ${i * 0.07}s infinite alternate` : "none",
        }}
      />
    ))}
  </div>
);

// ═══════════════════════════════════════
// AI Chat Demo — animated conversation
// ═══════════════════════════════════════
const AIChatDemo = () => {
  const [step, setStep] = useState(0);
  const msgs = [
    { from: "user" as const, text: "🎙️ أريد أروح لجامعة الأنبار" },
    { from: "ai" as const, text: "فهمت! وجهتك: جامعة الأنبار 🎓" },
    { from: "ai" as const, text: "📍 من: موقعك الحالي\n🏁 إلى: جامعة الأنبار\n💰 السعر: 3,500 د.ع" },
    { from: "ai" as const, text: "✅ تم الحجز! الكابتن في طريقه إليك 🚗" },
  ];

  useEffect(() => {
    const len = msgs.length;
    const t = setInterval(() => setStep((p) => (p + 1) % (len + 2)), 2500);
    return () => clearInterval(t);
  }, [msgs.length]);

  return (
    <div className="space-y-3 min-h-[200px]">
      {msgs.map((m, i) => (
        <div
          key={i}
          className={`flex ${m.from === "user" ? "justify-end" : "justify-start"} transition-all duration-500 ${
            i <= step ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div
            className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
              m.from === "user"
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-card border border-border/50 text-foreground rounded-bl-md"
            }`}
          >
            {m.text}
          </div>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════
// How-It-Works Step Card
// ═══════════════════════════════════════
const StepCard = ({
  number,
  icon,
  title,
  description,
  delay,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) => (
  <div className="relative text-center group animate-fade-up opacity-0 fill-forwards" style={{ animationDelay: `${delay}ms` }}>
    <div className="relative mx-auto w-20 h-20 mb-5">
      <div className="absolute inset-0 rounded-2xl bg-primary/10 rotate-6 group-hover:rotate-12 transition-transform duration-300" />
      <div className="relative w-full h-full rounded-2xl bg-card border border-border/50 flex items-center justify-center group-hover:border-primary/40 transition-colors">
        <div className="text-primary">{icon}</div>
      </div>
      <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-glow-sm">
        {number}
      </div>
    </div>
    <h3 className="font-bold text-foreground mb-2 text-lg">{title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed max-w-[250px] mx-auto">{description}</p>
  </div>
);

// ═══════════════════════════════════════
// Feature Card
// ═══════════════════════════════════════
const FeatureCard = ({
  icon,
  title,
  description,
  highlight,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: boolean;
  delay: number;
}) => (
  <div
    className={`group p-6 rounded-2xl border transition-all duration-300 hover:shadow-lg animate-fade-up opacity-0 fill-forwards ${
      highlight
        ? "bg-primary/5 border-primary/30 hover:border-primary/60 hover:shadow-primary/10"
        : "bg-card border-border/30 hover:border-primary/30 hover:shadow-primary/5"
    }`}
    style={{ animationDelay: `${delay}ms` }}
  >
    <div
      className={`w-12 h-12 mb-4 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
        highlight
          ? "bg-primary text-primary-foreground shadow-glow-sm"
          : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-glow-sm"
      }`}
    >
      {icon}
    </div>
    {highlight && (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold mb-2">
        <Sparkles className="w-3 h-3" /> الأول عالمياً
      </span>
    )}
    <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
  </div>
);

// ═══════════════════════════════════════
// Stat Card
// ═══════════════════════════════════════
const StatCard = ({ icon, number, label }: { icon: React.ReactNode; number: string; label: string }) => (
  <div className="text-center p-6 bg-card/50 rounded-2xl border border-border/30 hover:border-primary/20 transition-colors">
    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-primary/10 flex items-center justify-center text-primary">{icon}</div>
    <p className="text-2xl md:text-3xl font-bold text-foreground mb-1">{number}</p>
    <p className="text-sm text-muted-foreground">{label}</p>
  </div>
);

// ═══════════════════════════════════════
// Testimonial Card
// ═══════════════════════════════════════
const TestimonialCard = ({ name, role, text, rating }: { name: string; role: string; text: string; rating: number }) => (
  <div className="p-6 bg-card rounded-2xl border border-border/30 hover:border-primary/20 transition-all">
    <div className="flex items-center gap-1 mb-3">
      {[...Array(rating)].map((_, i) => (
        <Star key={i} className="w-4 h-4 text-primary fill-primary" />
      ))}
    </div>
    <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{text}"</p>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg">👤</div>
      <div>
        <p className="font-semibold text-foreground text-sm">{name}</p>
        <p className="text-xs text-muted-foreground">{role}</p>
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════
// Main Page
// ═══════════════════════════════════════
const Index = () => {
  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setIsVoiceActive((p) => !p), 3000);
    return () => clearInterval(t);
  }, []);

  // تمكين التمرير للموقع التعريفي
  useEffect(() => {
    document.documentElement.classList.add("marketing-site");
    document.documentElement.classList.remove("app-shell");
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    document.body.style.minHeight = "100%";
    return () => {
      document.documentElement.classList.remove("marketing-site");
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.body.style.minHeight = "";
    };
  }, []);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isStandalone || isMobile) navigate("/rider", { replace: true });
  }, [navigate]);

  const scrollTo = (id: string) => {
    setMobileMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* ═══════════ HEADER — مطابق لـ MarketingShell ═══════════ */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-4 md:h-20">
          {/* الشعار */}
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="RAAN" className="h-11 w-11 rounded-2xl shadow-glow-sm" />
            <div>
              <div className="text-lg font-bold text-foreground">ران <span className="text-primary">RAAN</span></div>
              <div className="text-xs text-muted-foreground">AI Taxi for Anbar</div>
            </div>
          </Link>

          {/* القائمة — desktop فقط */}
          <nav className="hidden items-center gap-7 lg:flex">
            {[
              { label: "الرئيسية", to: "/" },
              { label: "الذكاء الاصطناعي", to: "/ai" },
              { label: "المميزات", to: "/features" },
              { label: "كن كابتن", to: "/drive" },
              { label: "من نحن", to: "/about" },
              { label: "تواصل معنا", to: "/contact" },
            ].map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="relative text-sm font-medium text-muted-foreground transition-colors hover:text-foreground
                  after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:rounded-full after:bg-primary
                  after:w-0 hover:after:w-full after:transition-[width] after:duration-300"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          {/* أزرار desktop */}
          <div className="hidden items-center gap-3 lg:flex">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">تسجيل الراكب</Button>
            </Link>
            <Link to="/driver/auth">
              <Button variant="outline" size="sm" className="border-primary/40 text-primary hover:bg-primary/10">تسجيل السائق</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="bg-gradient-primary px-5 font-semibold shadow-glow btn-glow">احجز الآن</Button>
            </Link>
          </div>

          {/* زر القائمة — mobile */}
          <button
            type="button"
            onClick={() => setMobileMenu(!mobileMenu)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/30 bg-card/70 text-foreground lg:hidden"
          >
            {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* القائمة المنسدلة — mobile */}
        {mobileMenu && (
          <div className="border-t border-border/30 bg-background/95 p-4 backdrop-blur-xl lg:hidden">
            <div className="space-y-2">
              {[
                { to: "/", label: "الرئيسية" },
                { to: "/ai", label: "الذكاء الاصطناعي" },
                { to: "/features", label: "المميزات" },
                { to: "/drive", label: "كن كابتن" },
                { to: "/about", label: "من نحن" },
                { to: "/contact", label: "تواصل معنا" },
              ].map((s) => (
                <Link
                  key={s.to}
                  to={s.to}
                  onClick={() => setMobileMenu(false)}
                  className="block rounded-2xl px-4 py-3 text-sm font-medium text-foreground hover:bg-card transition-colors"
                >
                  {s.label}
                </Link>
              ))}
            </div>
            <div className="mt-4 grid gap-3">
              <Link to="/auth"><Button variant="ghost" className="w-full justify-center">تسجيل الراكب</Button></Link>
              <Link to="/driver/auth"><Button variant="outline" className="w-full justify-center border-primary/30 text-primary">تسجيل السائق</Button></Link>
              <Link to="/auth"><Button className="w-full justify-center bg-gradient-primary shadow-glow">احجز الآن</Button></Link>
            </div>
          </div>
        )}
      </header>

      {/* ═══════════ HERO ═══════════ */}
      <section id="hero" className="relative pt-20 md:pt-24 pb-16 md:pb-24 hero-gradient min-h-screen flex items-center">
        <div className="absolute inset-0 dots-pattern opacity-30" />
        <div className="absolute top-20 right-[15%] w-80 h-80 bg-primary/10 rounded-full blur-[100px] animate-pulse-glow" />
        <div className="absolute bottom-20 left-[10%] w-96 h-96 bg-primary/8 rounded-full blur-[120px]" />

        <div className="container relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Text */}
            <div className="text-center lg:text-right order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-fade-up opacity-0 fill-forwards">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                <span className="text-sm font-medium text-primary">🤖 أول تاكسي بالعالم يعمل بالذكاء الاصطناعي</span>
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-[1.1] animate-fade-up opacity-0 fill-forwards delay-100">
                احجز بـ<span className="text-gradient text-glow">صوتك</span>،
                <br />
                <span className="text-gradient text-glow">الذكاء الاصطناعي</span>
                <br />
                يسوي الباقي
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed animate-fade-up opacity-0 fill-forwards delay-200">
                بس تكلم وكول وين رايح — الذكاء الاصطناعي يفهمك، يحدد المكان على الخريطة، يحسب السعر، ويرسلك كابتن.
                <span className="text-primary font-semibold"> بثوانٍ فقط!</span>
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-up opacity-0 fill-forwards delay-300">
                <Link to="/auth">
                  <Button size="lg" className="w-full sm:w-auto bg-gradient-primary shadow-glow-lg btn-glow text-lg px-8 py-6 font-semibold gap-2">
                    <Mic className="w-5 h-5" /> جرب الحجز الصوتي <ArrowLeft className="w-5 h-5" />
                  </Button>
                </Link>
                <Link to="/driver/auth">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 py-6 font-semibold border-primary/30 text-foreground hover:bg-primary/10">
                    سجل كسائق
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-8 justify-center lg:justify-start mt-10 animate-fade-up opacity-0 fill-forwards delay-400">
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-bold text-primary">AI</p>
                  <p className="text-sm text-muted-foreground">حجز بالصوت</p>
                </div>
                <div className="w-px h-12 bg-border" />
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-bold text-primary">3 ثوانٍ</p>
                  <p className="text-sm text-muted-foreground">وقت الحجز</p>
                </div>
                <div className="w-px h-12 bg-border" />
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-bold text-primary">24/7</p>
                  <p className="text-sm text-muted-foreground">خدمة مستمرة</p>
                </div>
              </div>
            </div>

            {/* Phone Mockup — AI Voice Screen */}
            <div className="relative order-1 lg:order-2 flex justify-center animate-scale-in opacity-0 fill-forwards delay-200">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-[80px] rounded-full scale-75" />
                <div className="relative w-72 h-[580px] md:w-80 md:h-[640px] bg-card rounded-[3rem] border border-border/50 phone-shadow overflow-hidden">
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-background rounded-full" />
                  <div className="absolute inset-3 top-10 rounded-[2.5rem] bg-background overflow-hidden border border-border/30">
                    <div className="flex items-center justify-between px-6 py-2 text-xs text-muted-foreground">
                      <span className="font-medium">9:41</span>
                      <div className="w-4 h-2.5 bg-muted-foreground/50 rounded-sm" />
                    </div>
                    <div className="px-5 pt-3 flex flex-col items-center" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(34,197,94,0.08) 0%, transparent 70%)" }}>
                      <img src={logo} alt="ران" className="w-12 h-12 mb-2" />
                      <div className="flex items-center gap-1 mb-1">
                        <Sparkles className="w-3 h-3 text-primary/60" />
                        <span className="text-[10px] text-primary/50">مدعوم بالذكاء الاصطناعي</span>
                        <Sparkles className="w-3 h-3 text-primary/60" />
                      </div>
                      <div className="w-full mt-2 mb-4">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
                          <Navigation className="w-3 h-3 text-primary" />
                          <div>
                            <p className="text-[9px] text-primary/40">سيأخذك السائق من</p>
                            <p className="text-[11px] font-medium text-foreground">شارع المستودع، الرمادي</p>
                          </div>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-foreground mb-1">وين تحب تروح؟</p>
                      <p className="text-[11px] text-muted-foreground mb-6">تكلم بحرية، الذكاء الاصطناعي يسمعك</p>
                      <div className="relative mb-4">
                        <div className="absolute inset-[-8px] rounded-full border-2 border-primary/20 animate-ping opacity-30" />
                        <div className="w-20 h-20 rounded-full bg-primary/20 border-4 border-primary/40 flex items-center justify-center">
                          <Mic className="w-8 h-8 text-primary" />
                        </div>
                      </div>
                      <VoiceWaveAnimation isActive={isVoiceActive} />
                      <p className="text-[11px] text-muted-foreground mt-3 mb-2">{isVoiceActive ? "🎙️ يسمعك..." : "🎤 اضغط مطولاً وتكلم"}</p>
                      <p className="text-[10px] text-primary/40 animate-pulse mt-1">جرب أن تقول: لجامعة الأنبار</p>
                    </div>
                  </div>
                </div>

                {/* Floating cards */}
                <div className="absolute -right-4 top-20 animate-float-slow">
                  <div className="bg-card p-3 rounded-2xl shadow-xl border border-border/50 flex items-center gap-3 gradient-border">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">AI</p>
                      <p className="text-xs text-muted-foreground">ذكاء اصطناعي</p>
                    </div>
                  </div>
                </div>
                <div className="absolute -left-6 bottom-36 animate-float animate-float-delay-1s">
                  <div className="bg-card p-3 rounded-2xl shadow-xl border border-border/50 flex items-center gap-3 gradient-border">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Volume2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">حجز صوتي</p>
                      <p className="text-xs text-muted-foreground">بـ 3 ثوانٍ فقط</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-5 h-5 text-primary/40" />
        </div>
      </section>

      {/* ═══════════ AI SHOWCASE ═══════════ */}
      <section id="ai-section" className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/3 via-transparent to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        <div className="container relative">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-bold mb-6">
              <Brain className="w-4 h-4" /> ابتكار عالمي حصري
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              أول تطبيق تاكسي بالعالم
              <br />
              <span className="text-gradient text-glow">يحجز بالذكاء الاصطناعي</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
              تطبيق ران يستخدم <span className="text-primary font-semibold">أحدث تقنيات الذكاء الاصطناعي</span> لفهم صوتك بالعراقي وحجز الرحلة فوراً — بدون ما تكتب حرف واحد!
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Chat Demo */}
            <div className="order-2 lg:order-1">
              <div className="bg-card rounded-3xl border border-border/50 p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/30">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-glow-sm">
                    <Bot className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">مساعد ران الذكي</p>
                    <p className="text-xs text-muted-foreground">يفهم اللهجة العراقية • متصل</p>
                  </div>
                  <div className="mr-auto flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs text-primary">نشط</span>
                  </div>
                </div>
                <AIChatDemo />
              </div>
            </div>

            {/* AI Features List */}
            <div className="order-1 lg:order-2 space-y-6">
              {[
                { icon: <Mic className="w-6 h-6" />, title: "تحويل الصوت للنص", desc: 'تقنية التعرف الصوتي المتقدمة تحول كلامك بالعراقي لنص دقيق — حتى لو تكول "أريد أروح ليم الجامعة"' },
                { icon: <Brain className="w-6 h-6" />, title: "فهم المقصد بذكاء", desc: 'الذكاء الاصطناعي يفهم إنك تقصد "جامعة الأنبار" ويحدد الإحداثيات بدقة على خريطة الرمادي' },
                { icon: <MapPin className="w-6 h-6" />, title: "تحديد المواقع تلقائياً", desc: "يعرف 27+ معلم ومنطقة بالرمادي — من حي التأميم لجامعة الأنبار لتقاطع الزيوت" },
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-4 p-5 rounded-2xl bg-card border border-border/30 hover:border-primary/30 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">{f.icon}</div>
                  <div>
                    <h4 className="font-bold text-foreground mb-1">{f.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-4 p-5 rounded-2xl bg-primary/5 border border-primary/30 hover:border-primary/50 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-glow-sm">
                  <Send className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground mb-1">حجز عبر تيليغرام أيضاً!</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    دز رسالة صوتية لبوت <span className="text-primary font-semibold">@raan_1_bot</span> على تيليغرام والبوت يحجز لك — بدون تطبيق!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="py-20 md:py-28 bg-card/30 relative">
        <div className="absolute inset-0 dots-pattern opacity-10" />
        <div className="container relative">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              <Play className="w-4 h-4" /> شلون يشتغل؟
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              احجز رحلتك بـ <span className="text-gradient">3 خطوات</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-lg">من صوتك للسيارة — بدون كتابة، بدون تعقيد</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <StepCard number="1" icon={<Mic className="w-8 h-8" />} title="تكلم" description='اضغط زر المايكروفون وكول وين رايح. مثال: "أريد أروح لجامعة الأنبار"' delay={0} />
            <StepCard number="2" icon={<Brain className="w-8 h-8" />} title="الذكاء الاصطناعي يفهمك" description="يحلل كلامك، يحدد الوجهة على الخريطة، ويحسب السعر — بثانية" delay={200} />
            <StepCard number="3" icon={<CheckCircle2 className="w-8 h-8" />} title="أكّد وانطلق" description="أكّد الحجز وأقرب كابتن يجيك — بدون انتظار طويل" delay={400} />
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURES ═══════════ */}
      <section id="features" className="py-20 md:py-28 relative">
        <div className="absolute inset-0 dots-pattern opacity-20" />
        <div className="container relative">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              <Zap className="w-4 h-4" /> مميزات ذكية تفهم احتياجاتك
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              تصميم <span className="text-gradient">لاحتياجات</span> شوارع الأنبار
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">وجهتك بناءً على نقاط معروفة بأسلوب أنباري مألوف وبسيط</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard icon={<Mic className="w-6 h-6" />} title="حجز بالصوت" description="تكلم بالعراقي والذكاء الاصطناعي يفهمك ويحجز لك — أول تطبيق بالعالم بهذه الميزة" highlight delay={0} />
            <FeatureCard icon={<Route className="w-6 h-6" />} title="توجيه ذكي" description="التطبيق يختار لك أفضل الطرق ويتجنب الازدحامات" delay={100} />
            <FeatureCard icon={<MapPinned className="w-6 h-6" />} title="نقاط دالة أنبارية" description="استخدم أسماء المناطق والمعالم المعروفة بدلاً من العناوين" delay={200} />
            <FeatureCard icon={<Wallet className="w-6 h-6" />} title="دفع مرن" description="ادفع نقداً أو عبر زين كاش وآسيا حوالة" delay={300} />
            <FeatureCard icon={<Shield className="w-6 h-6" />} title="أمان متقدم" description="جميع سائقينا معتمدون ومتحقق من هوياتهم وسياراتهم" delay={400} />
            <FeatureCard icon={<Zap className="w-6 h-6" />} title="خفيف وسريع" description="التطبيق يعمل حتى مع ضعف الإنترنت ويستهلك بيانات قليلة" delay={500} />
            <FeatureCard icon={<HeartHandshake className="w-6 h-6" />} title="تكسي نسائي" description="سائقات محترفات للنساء فقط براحة وخصوصية تامة" delay={600} />
            <FeatureCard icon={<CreditCard className="w-6 h-6" />} title="أسعار شفافة" description="اعرف السعر مسبقاً بدون مفاجآت أو رسوم خفية" delay={700} />
          </div>
        </div>
      </section>

      {/* ═══════════ BOOKING CHANNELS ═══════════ */}
      <section className="py-20 md:py-28 bg-card/50 relative overflow-hidden">
        <div className="absolute inset-0 dots-pattern opacity-10" />
        <div className="container relative">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              <Globe className="w-4 h-4" /> قنوات الحجز
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">احجز من <span className="text-gradient">أي مكان</span></h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-lg">ثلاث طرق سهلة لحجز رحلتك</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Voice */}
            <div className="group p-8 bg-card rounded-3xl border border-primary/30 hover:border-primary/60 transition-all text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-primary to-emerald-400" />
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                <Mic className="w-8 h-8 text-primary group-hover:text-primary-foreground" />
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold mb-3">
                <Sparkles className="w-3 h-3" /> الأكثر شعبية
              </span>
              <h3 className="text-xl font-bold text-foreground mb-2">الحجز الصوتي</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">افتح التطبيق، اضغط على المايكروفون، وكول وين تريد تروح</p>
              <Link to="/auth"><Button className="w-full bg-gradient-primary shadow-glow btn-glow font-semibold">جرّب الآن <ArrowLeft className="w-4 h-4 mr-1" /></Button></Link>
            </div>
            {/* Telegram */}
            <div className="group p-8 bg-card rounded-3xl border border-border/50 hover:border-primary/30 transition-all text-center">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500 transition-all">
                <Send className="w-8 h-8 text-blue-500 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">بوت تيليغرام</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">دز رسالة صوتية لبوت @raan_1_bot على تيليغرام وخلي البوت يحجز لك</p>
              <a href="https://t.me/raan_1_bot" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full border-blue-500/30 text-blue-500 hover:bg-blue-500/10 font-semibold">افتح البوت <ArrowUpRight className="w-4 h-4 mr-1" /></Button>
              </a>
            </div>
            {/* Map */}
            <div className="group p-8 bg-card rounded-3xl border border-border/50 hover:border-primary/30 transition-all text-center">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                <MapPin className="w-8 h-8 text-primary group-hover:text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">الخريطة التقليدية</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">حدد نقطة الانطلاق والوجهة على الخريطة بالطريقة المعتادة</p>
              <Link to="/auth"><Button variant="outline" className="w-full border-primary/30 text-foreground hover:bg-primary/10 font-semibold">ابدأ الحجز <ArrowLeft className="w-4 h-4 mr-1" /></Button></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ TESTIMONIALS ═══════════ */}
      <section className="py-20 md:py-28 relative">
        <div className="container relative">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              <Star className="w-4 h-4" /> آراء المستخدمين
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">شنو يكولون عن <span className="text-gradient">ران</span>؟</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <TestimonialCard name="أبو محمد" role="راكب من الرمادي" text="والله شي خرافي! بس كلت أريد أروح الجامعة وطلع لي السعر وجا الكابتن. ما احتجت أكتب شي." rating={5} />
            <TestimonialCard name="هدى العاني" role="راكبة من حي التأميم" text="أحسن شي التكسي النسائي. وميزة الصوت سهلتها علينا كلش — خاصة لما أكون مستعجلة." rating={5} />
            <TestimonialCard name="كابتن علي" role="سائق في ران" text="الطلبات توصلني وية لأنه يوزع بالعدل. وأرباحي زادت 40% من يوم ما بديت ويه ران." rating={5} />
          </div>
        </div>
      </section>

      {/* ═══════════ STATS ═══════════ */}
      <section className="py-20 relative overflow-hidden bg-card/30">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container relative">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-2">أرقام <span className="text-gradient">تتكلم</span></h3>
            <p className="text-muted-foreground">نطمح لنصل لثقة كل عائلة في الأنبار</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCard icon={<Clock className="w-6 h-6" />} number="24/7" label="خدمة متواصلة" />
            <StatCard icon={<Users className="w-6 h-6" />} number="+40" label="كابتن نشط" />
            <StatCard icon={<Star className="w-6 h-6" />} number="4.9" label="تقييم المستخدمين" />
            <StatCard icon={<Shield className="w-6 h-6" />} number="100%" label="سائقون معتمدون" />
          </div>
        </div>
      </section>

      {/* ═══════════ ABOUT US ═══════════ */}
      <section id="about-us" className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/3 to-transparent" />
        <div className="absolute top-1/2 left-[10%] w-72 h-72 bg-primary/5 rounded-full blur-[100px] -translate-y-1/2" />
        <div className="absolute top-1/3 right-[5%] w-56 h-56 bg-primary/8 rounded-full blur-[80px]" />

        <div className="container relative">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-bold mb-6 animate-fade-up opacity-0 fill-forwards">
              <Users className="w-4 h-4" /> تعرّف علينا
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 animate-fade-up opacity-0 fill-forwards" style={{ animationDelay: '100ms' }}>
              من نحن — <span className="text-gradient text-glow">قصة ران</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed animate-fade-up opacity-0 fill-forwards" style={{ animationDelay: '200ms' }}>
              فكرة وُلدت من قلب الرمادي لحل مشكلة حقيقية
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Story Side */}
            <div className="space-y-6">
              <div className="p-6 bg-card rounded-3xl border border-border/50 hover:border-primary/30 transition-all animate-fade-up opacity-0 fill-forwards" style={{ animationDelay: '300ms' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Star className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg">مركز الرؤية للتدريب والتطوير</h3>
                    <p className="text-sm text-primary">الرمادي، محافظة الأنبار</p>
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  كادر برمجي تابع إلى <span className="text-primary font-semibold">مركز الرؤية للتدريب والتطوير</span> في مدينة الرمادي.
                  وجدنا مشكلة حقيقية في عشوائية عمل التاكسي بالمدينة — لا تنظيم، لا أسعار ثابتة، ولا أمان كافي.
                </p>
              </div>

              <div className="p-6 bg-card rounded-3xl border border-border/50 hover:border-primary/30 transition-all animate-fade-up opacity-0 fill-forwards" style={{ animationDelay: '450ms' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground text-lg">الفكرة والحل</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  وجدنا حل سهل وسريع — ومن هذا الوصف تكوّنت الفكرة الأولى والاستثنائية.
                  بدأنا نحل مشاكل التطبيقات الأخرى وخرجنا بفكرة <span className="text-primary font-bold">ران RAAN</span> —
                  أول تطبيق تاكسي بالعالم يعمل بالذكاء الاصطناعي ومصمم خصيصاً لشوارع ومعالم الأنبار.
                </p>
              </div>

              <div className="p-6 bg-primary/5 rounded-3xl border border-primary/30 hover:border-primary/50 transition-all animate-fade-up opacity-0 fill-forwards" style={{ animationDelay: '600ms' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-glow-sm">
                    <Brain className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h3 className="font-bold text-foreground text-lg">ليش ران مختلف؟</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  لأننا لم نقلد أحد — بنينا من الصفر تطبيق يفهم اللهجة العراقية، يعرف معالم الرمادي،
                  ويخلي الراكب يحجز بصوته بثوانٍ فقط. هذا شي ما سواه أحد بالعالم قبلنا.
                </p>
              </div>
            </div>

            {/* Visual Side */}
            <div className="relative flex justify-center animate-scale-in opacity-0 fill-forwards" style={{ animationDelay: '400ms' }}>
              <div className="relative">
                <div className="absolute inset-0 bg-primary/15 blur-[60px] rounded-full scale-90" />
                <div className="relative bg-card rounded-3xl border border-border/50 p-8 shadow-2xl max-w-sm">
                  {/* Logo */}
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center p-2 animate-pulse-glow">
                      <img src={logo} alt="RAAN" className="w-14 h-14" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground">ران <span className="text-primary">RAAN</span></h3>
                    <p className="text-sm text-muted-foreground">تاكسي الأنبار الذكي</p>
                  </div>

                  {/* Values */}
                  <div className="space-y-3">
                    {[
                      { icon: <Shield className="w-4 h-4" />, text: "الأمان أولاً — سلامتك أولويتنا" },
                      { icon: <CreditCard className="w-4 h-4" />, text: "شفافية — أسعار واضحة بدون مفاجآت" },
                      { icon: <CheckCircle2 className="w-4 h-4" />, text: "جودة — نختار أفضل السائقين" },
                      { icon: <MapPin className="w-4 h-4" />, text: "محلية — نفهم شوارع ومعالم الأنبار" },
                      { icon: <Mic className="w-4 h-4" />, text: "ابتكار — حجز صوتي بالذكاء الاصطناعي" },
                    ].map((v, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border/30 hover:border-primary/30 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">{v.icon}</div>
                        <span className="text-sm text-foreground">{v.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* Badge */}
                  <div className="mt-6 text-center">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
                      <Sparkles className="w-3 h-3" /> صُنع بفخر في الرمادي 🇮🇶
                    </span>
                  </div>
                </div>

                {/* Floating badges */}
                <div className="absolute -right-4 top-10 animate-float-slow">
                  <div className="bg-card px-4 py-2 rounded-2xl shadow-xl border border-border/50 gradient-border">
                    <p className="text-sm font-bold text-primary">🎯 فكرة أنبارية</p>
                    <p className="text-[10px] text-muted-foreground">محلية 100%</p>
                  </div>
                </div>
                <div className="absolute -left-6 bottom-20 animate-float animate-float-delay-1s">
                  <div className="bg-card px-4 py-2 rounded-2xl shadow-xl border border-border/50 gradient-border">
                    <p className="text-sm font-bold text-primary">🤖 ذكاء اصطناعي</p>
                    <p className="text-[10px] text-muted-foreground">الأول عالمياً</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Team Bar */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-up opacity-0 fill-forwards" style={{ animationDelay: '700ms' }}>
            {[
              { icon: <Users className="w-6 h-6" />, title: "فريق التطوير", desc: "مبرمجون ومصممون من الأنبار يبنون المستقبل" },
              { icon: <HeartHandshake className="w-6 h-6" />, title: "فريق العمليات", desc: "إدارة السائقين والتحقق والدعم التشغيلي" },
              { icon: <Phone className="w-6 h-6" />, title: "خدمة العملاء", desc: "دعم الركاب والسائقين على مدار الساعة" },
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-4 p-5 bg-card rounded-2xl border border-border/30 hover:border-primary/30 transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">{t.icon}</div>
                <div>
                  <h4 className="font-bold text-foreground mb-1">{t.title}</h4>
                  <p className="text-sm text-muted-foreground">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ DRIVER CTA ═══════════ */}
      <section id="driver-cta" className="py-20 md:py-28 relative">
        <div className="absolute inset-0 dots-pattern opacity-15" />
        <div className="container relative">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
                <img src={logo} alt="RAAN" className="w-4 h-4 rounded" /> انضم لفريق ران
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                كن كابتن <span className="text-gradient">وابدأ الربح</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">تبحث عن دخل إضافي؟ ران توفر لك فرص الربح الأفضل في الأنبار مع نظام عادل وشفاف</p>
              <div className="space-y-4 mb-8">
                {[
                  { icon: <Wallet className="w-5 h-5" />, title: "ربح أعلى", desc: "نسبة عمولة منخفضة وحوافز يومية للسائقين النشطين" },
                  { icon: <Clock className="w-5 h-5" />, title: "مرونة كاملة", desc: "اعمل بوقتك الخاص بدون التزامات أو جداول ثابتة" },
                  { icon: <Navigation className="w-5 h-5" />, title: "خرائط حرارية", desc: "نظهر لك مناطق الطلب العالي لزيادة أرباحك بشكل ذكي" },
                  { icon: <HeartHandshake className="w-5 h-5" />, title: "دعم متواصل", desc: "فريق دعم على مدار الساعة لمساعدتك وحل أي مشكلة" },
                ].map((b, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">{b.icon}</div>
                    <div>
                      <h4 className="font-bold text-foreground mb-1">{b.title}</h4>
                      <p className="text-sm text-muted-foreground">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/driver/register"><Button size="lg" className="w-full sm:w-auto bg-gradient-primary shadow-glow btn-glow font-semibold px-8">سجل ككابتن <ArrowLeft className="mr-2 w-5 h-5" /></Button></Link>
                <Link to="/driver/auth"><Button size="lg" variant="outline" className="w-full sm:w-auto border-primary/30 hover:bg-primary/10">لدي حساب بالفعل</Button></Link>
              </div>
            </div>
            {/* Driver Mockup */}
            <div className="relative flex justify-center">
              <div className="relative w-72 h-[500px] bg-card rounded-[2.5rem] border border-border/50 overflow-hidden shadow-2xl gradient-border">
                <div className="absolute inset-3 rounded-[2rem] bg-background overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-6">
                      <div><p className="text-sm text-muted-foreground">مرحباً كابتن</p><h3 className="font-bold text-foreground">محمد الدليمي</h3></div>
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-2xl">👨</div>
                    </div>
                    <div className="p-4 bg-gradient-primary rounded-2xl mb-4 shadow-glow">
                      <p className="text-primary-foreground/80 text-sm mb-1">أرباح اليوم</p>
                      <p className="text-3xl font-bold text-primary-foreground">125,000 <span className="text-lg">د.ع</span></p>
                      <div className="flex items-center gap-4 mt-3 text-sm text-primary-foreground/80"><span>12 رحلة</span><span>•</span><span>45 كم</span></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 bg-card rounded-xl border border-border/50 text-center"><p className="text-2xl font-bold text-primary">4.9</p><p className="text-xs text-muted-foreground">تقييمك</p></div>
                      <div className="p-3 bg-card rounded-xl border border-border/50 text-center"><p className="text-2xl font-bold text-foreground">98%</p><p className="text-xs text-muted-foreground">معدل القبول</p></div>
                    </div>
                    <div className="p-4 bg-primary/10 rounded-2xl border border-primary/30 text-center">
                      <div className="w-16 h-16 mx-auto rounded-full bg-gradient-primary flex items-center justify-center mb-2 shadow-glow animate-pulse-glow overflow-hidden"><img src={logo} alt="RAAN" className="w-12 h-12" /></div>
                      <p className="font-bold text-primary">متصل الآن</p>
                      <p className="text-xs text-muted-foreground">جاهز لاستقبال الطلبات</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/10 to-primary/5" />
        <div className="absolute inset-0 dots-pattern opacity-10" />
        <div className="container relative text-center">
          <div className="max-w-3xl mx-auto">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center"><Mic className="w-10 h-10 text-primary" /></div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              جاهز تجرب الحجز<br /><span className="text-gradient text-glow">بالذكاء الاصطناعي؟</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">حمّل تطبيق ران وجرب ميزة الحجز الصوتي — مجاناً ومتاح حالياً في الرمادي</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth"><Button size="lg" className="w-full sm:w-auto bg-gradient-primary shadow-glow-lg btn-glow text-lg px-10 py-7 font-bold gap-2"><Mic className="w-6 h-6" /> احجز بصوتك الآن</Button></Link>
              <a href="https://t.me/raan_1_bot" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 py-7 font-semibold border-primary/30 hover:bg-primary/10 gap-2"><Send className="w-5 h-5" /> أو عبر تيليغرام</Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer id="contact" className="py-12 lg:py-16 bg-background border-t border-border/30 marketing-pb-cta">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img src={logo} alt="RAAN" className="w-12 h-12 rounded-2xl shadow-glow-sm" />
                <span className="text-2xl font-bold text-foreground">ران <span className="text-primary">RAAN</span></span>
              </div>
              <p className="text-muted-foreground max-w-md mb-4 leading-relaxed">
                أول تطبيق تاكسي بالعالم يعمل بالذكاء الاصطناعي. نفهم شوارع الأنبار ونوفر لك تجربة تنقل آمنة ومريحة. احجز بصوتك أو عبر واتساب وتيليغرام!
              </p>
              <div className="flex items-center gap-2 mb-6">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold"><Brain className="w-3 h-3" /> Powered by AI</span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-semibold"><MapPin className="w-3 h-3" /> Google Maps</span>
              </div>
              <div className="flex gap-3">
                {[
                  { icon: <Facebook className="w-5 h-5" />, href: "https://facebook.com/raan.app", color: "hover:bg-blue-600 hover:border-blue-600" },
                  { icon: <Instagram className="w-5 h-5" />, href: "https://instagram.com/raan.app", color: "hover:bg-gradient-to-br hover:from-purple-500 hover:via-pink-500 hover:to-orange-500 hover:border-pink-500" },
                  { icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52V6.84a4.84 4.84 0 0 1-1-.15z"/></svg>, href: "https://tiktok.com/@raan.app", color: "hover:bg-black hover:border-black" },
                ].map((s, i) => (
                  <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className={`w-10 h-10 rounded-xl bg-card border border-border/50 ${s.color} transition-all flex items-center justify-center group`}>
                    <span className="text-muted-foreground group-hover:text-white">{s.icon}</span>
                  </a>
                ))}
                <a href="https://wa.me/9647884669922" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-card border border-border/50 hover:bg-green-500 hover:border-green-500 transition-all flex items-center justify-center group">
                  <MessageCircle className="w-5 h-5 text-muted-foreground group-hover:text-white" />
                </a>
                <a href="https://t.me/raan_1_bot" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-card border border-border/50 hover:bg-blue-500 hover:border-blue-500 transition-all flex items-center justify-center group">
                  <Send className="w-5 h-5 text-muted-foreground group-hover:text-white" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-foreground mb-4">روابط سريعة</h4>
              <ul className="space-y-3 text-muted-foreground">
                <li><button onClick={() => scrollTo("hero")} className="hover:text-primary transition-colors">الرئيسية</button></li>
                <li><button onClick={() => scrollTo("ai-section")} className="hover:text-primary transition-colors">الذكاء الاصطناعي</button></li>
                <li><button onClick={() => scrollTo("features")} className="hover:text-primary transition-colors">المميزات</button></li>
                <li><button onClick={() => scrollTo("driver-cta")} className="hover:text-primary transition-colors">كن كابتن</button></li>
                <li><Link to="/about" className="hover:text-primary transition-colors">عن ران</Link></li>
                <li><Link to="/terms" className="hover:text-primary transition-colors">الشروط والأحكام</Link></li>
                <li><Link to="/privacy" className="hover:text-primary transition-colors">سياسة الخصوصية</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-foreground mb-4">تواصل معنا</h4>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /><span dir="ltr">+964 788 466 9922</span></li>
                <li className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-green-500" /><a href="https://wa.me/9647884669922" target="_blank" rel="noopener noreferrer" className="hover:text-green-500 transition-colors">واتساب ران</a></li>
                <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /><span>info@raan.app</span></li>
                <li className="flex items-center gap-2"><Send className="w-4 h-4 text-blue-500" /><a href="https://t.me/raan_1_bot" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">@raan_1_bot</a></li>
              </ul>
              <h4 className="font-bold text-foreground mb-4 mt-6">حمّل التطبيق</h4>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" className="justify-start border-border/50 hover:bg-card">
                  <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></svg>
                  App Store
                </Button>
                <Button variant="outline" size="sm" className="justify-start border-border/50 hover:bg-card">
                  <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" /></svg>
                  Google Play
                </Button>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-border/30 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-muted-foreground text-sm">© 2026 ران RAAN. جميع الحقوق محفوظة. 🇮🇶</p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link to="/privacy" className="hover:text-primary transition-colors">سياسة الخصوصية</Link>
              <Link to="/terms" className="hover:text-primary transition-colors">الشروط والأحكام</Link>
              <Link to="/contact" className="hover:text-primary transition-colors">تواصل معنا</Link>
              <Link to="/admin/login" className="hover:text-primary transition-colors">لوحة التحكم</Link>
            </div>
          </div>
        </div>
      </footer>

      <style>{`@keyframes voiceBar { 0% { transform: scaleY(0.4); } 100% { transform: scaleY(1); } }`}</style>

      {/* ═══ زر CTA عائم للجوال ═══ */}
      <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden">
        <div className="bg-background/90 backdrop-blur-xl border-t border-border/30 px-4 py-3 pb-safe">
          <Link to="/auth">
            <Button className="w-full bg-gradient-primary shadow-glow btn-glow font-bold text-base h-12">
              احجز الآن 🚗
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
