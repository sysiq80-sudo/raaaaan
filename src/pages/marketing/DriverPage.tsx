import { Car, DollarSign, Clock, Shield, Smartphone, MapPin, TrendingUp, Users, CheckCircle2 } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingLocaleProvider, useMarketingLocale } from "@/contexts/MarketingLocaleContext";
import {
  MarketingHero,
  SectionIntro,
  InfoGrid,
  ProcessSteps,
  CTASection,
  PageSection,
} from "@/components/marketing/MarketingBlocks";
import { DriverConsoleIllustration } from "@/components/marketing/MarketingIllustrations";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

const DriverPageContent = () => {
  const { locale } = useMarketingLocale();
  const isAr = locale === "ar";

  const hero = isAr
    ? {
        badge: "انضم كسائق",
        title: "كن كابتن ران واكسب أكثر",
        description: "اشتغل بوقتك الحر، اختر رحلاتك، واكسب دخلاً محترماً. ران يوفر لك التقنية وأنت توفر الخبرة.",
        actions: [
          { label: "سجّل كسائق", href: "/driver/auth", variant: "primary" as const },
          { label: "تعرف على المتطلبات", href: "#requirements", variant: "secondary" as const },
        ],
        stats: [
          { value: "125K+", label: "دخل يومي بالدينار العراقي" },
          { value: "98%", label: "معدل رضا الكباتن" },
          { value: "< 48ساعة", label: "وقت القبول" },
        ],
      }
    : {
        badge: "Join as a Driver",
        title: "Become a RAAN Captain & Earn More",
        description: "Work on your own schedule, choose your rides, and earn a solid income. RAAN provides the technology; you provide the expertise.",
        actions: [
          { label: "Register as Driver", href: "/driver/auth", variant: "primary" as const },
          { label: "See Requirements", href: "#requirements", variant: "secondary" as const },
        ],
        stats: [
          { value: "125K+", label: "Daily Income (IQD)" },
          { value: "98%", label: "Captain Satisfaction Rate" },
          { value: "< 48h", label: "Approval Time" },
        ],
      };

  const benefitsSection = isAr
    ? { eyebrow: "مميزات الكابتن", title: "لماذا تختار ران؟", description: "نظام مصمم ليجعل حياة الكابتن أسهل وأكثر ربحاً." }
    : { eyebrow: "Captain Benefits", title: "Why Choose RAAN?", description: "A system designed to make the captain's life easier and more profitable." };

  const benefits = isAr
    ? [
        { icon: <DollarSign className="h-6 w-6" />, title: "عمولة منخفضة", description: "نسبة عمولة تنافسية تضمن أنك تحتفظ بالجزء الأكبر من كل رحلة.", accent: "bg-primary/10 text-primary" },
        { icon: <Clock className="h-6 w-6" />, title: "وقتك بيدك", description: "اشتغل متى تريد وتوقف متى تريد. لا ساعات ثابتة ولا التزامات.", accent: "bg-emerald-500/10 text-emerald-400" },
        { icon: <MapPin className="h-6 w-6" />, title: "رحلات قريبة منك", description: "خوارزمية ذكية تعطيك الرحلات الأقرب لتقليل وقت التنقل الفارغ.", accent: "bg-blue-500/10 text-blue-400" },
        { icon: <TrendingUp className="h-6 w-6" />, title: "إحصاءات مفصلة", description: "تابع دخلك اليومي والأسبوعي ومعدل القبول وتقييمك من لوحة التحكم.", accent: "bg-violet-500/10 text-violet-400" },
        { icon: <Shield className="h-6 w-6" />, title: "دعم مستمر", description: "فريق دعم متاح 24/7 لمساعدتك في أي مشكلة أثناء الرحلة.", accent: "bg-orange-500/10 text-orange-400" },
        { icon: <Users className="h-6 w-6" />, title: "مجتمع الكباتن", description: "انضم لمجتمع الكباتن، شارك التجارب، واستفد من الخبرات.", accent: "bg-rose-500/10 text-rose-400" },
      ]
    : [
        { icon: <DollarSign className="h-6 w-6" />, title: "Low Commission", description: "Competitive commission rate ensuring you keep the biggest share of every ride.", accent: "bg-primary/10 text-primary" },
        { icon: <Clock className="h-6 w-6" />, title: "Your Time, Your Rules", description: "Work when you want and stop when you want. No fixed hours or obligations.", accent: "bg-emerald-500/10 text-emerald-400" },
        { icon: <MapPin className="h-6 w-6" />, title: "Rides Close to You", description: "Smart algorithm gives you nearest rides to minimize empty travel time.", accent: "bg-blue-500/10 text-blue-400" },
        { icon: <TrendingUp className="h-6 w-6" />, title: "Detailed Analytics", description: "Track your daily and weekly income, acceptance rate, and rating from the dashboard.", accent: "bg-violet-500/10 text-violet-400" },
        { icon: <Shield className="h-6 w-6" />, title: "Continuous Support", description: "Support team available 24/7 to help with any issue during a ride.", accent: "bg-orange-500/10 text-orange-400" },
        { icon: <Users className="h-6 w-6" />, title: "Captain Community", description: "Join the captains community, share experiences, and learn from peers.", accent: "bg-rose-500/10 text-rose-400" },
      ];

  const requirementsSection = isAr
    ? { eyebrow: "متطلبات الانضمام", title: "ما الذي تحتاجه للبدء؟", description: "متطلبات بسيطة وعملية بدون تعقيد." }
    : { eyebrow: "Requirements", title: "What Do You Need to Start?", description: "Simple and practical requirements without complexity." };

  const requirements = isAr
    ? [
        { icon: <Car className="h-6 w-6" />, title: "سيارة بحالة جيدة", description: "أي سيارة لا يتجاوز عمرها ١٠ سنوات وبحالة ميكانيكية جيدة." },
        { icon: <CheckCircle2 className="h-6 w-6" />, title: "وثائق سارية", description: "هوية الأحوال الشخصية + إجازة السيارة + رخصة القيادة سارية الصلاحية." },
        { icon: <Smartphone className="h-6 w-6" />, title: "هاتف ذكي", description: "هاتف iOS أو Android للتطبيق مع اتصال إنترنت مستقر." },
      ]
    : [
        { icon: <Car className="h-6 w-6" />, title: "A Vehicle in Good Condition", description: "Any car no older than 10 years and in good mechanical condition." },
        { icon: <CheckCircle2 className="h-6 w-6" />, title: "Valid Documents", description: "National ID + vehicle registration + valid driver's license." },
        { icon: <Smartphone className="h-6 w-6" />, title: "A Smartphone", description: "iOS or Android phone for the app with a stable internet connection." },
      ];

  const stepsSection = isAr
    ? { eyebrow: "خطوات الانضمام", title: "ابدأ خلال ٤٨ ساعة", description: "عملية تسجيل سريعة ومبسطة." }
    : { eyebrow: "Joining Steps", title: "Start Within 48 Hours", description: "A fast and streamlined registration process." };

  const steps = isAr
    ? [
        { number: "١", title: "سجّل حسابك", description: "أنشئ حسابك ببياناتك الأساسية من خلال تطبيق الكابتن." },
        { number: "٢", title: "ارفع وثائقك", description: "أرفع صور الوثائق المطلوبة — يتم المراجعة خلال ٢٤ ساعة." },
        { number: "٣", title: "ابدأ الاشتغال", description: "بعد القبول، فعّل حسابك وابدأ قبول الرحلات فوراً." },
      ]
    : [
        { number: "1", title: "Register Your Account", description: "Create your account with basic details through the captain app." },
        { number: "2", title: "Upload Your Documents", description: "Upload photos of required documents — reviewed within 24 hours." },
        { number: "3", title: "Start Working", description: "After approval, activate your account and start accepting rides immediately." },
      ];

  const earningsTitle = isAr ? "مثال على الأرباح اليومية" : "Daily Earnings Example";
  const earningsItems = isAr
    ? [
        { trips: "٦ رحلات", income: "٤٢,٠٠٠ د.ع", hours: "٤ ساعات" },
        { trips: "١٠ رحلات", income: "٧٠,٠٠٠ د.ع", hours: "٧ ساعات" },
        { trips: "١٦ رحلات", income: "١١٢,٠٠٠ د.ع", hours: "١١ ساعة" },
      ]
    : [
        { trips: "6 Trips", income: "42,000 IQD", hours: "4 Hours" },
        { trips: "10 Trips", income: "70,000 IQD", hours: "7 Hours" },
        { trips: "16 Trips", income: "112,000 IQD", hours: "11 Hours" },
      ];

  const cta = isAr
    ? { title: "ابدأ الكسب مع ران", description: "سجّل الآن وانضم لمجتمع الكباتن في الأنبار.", primary: { label: "سجّل كسائق", href: "/driver/auth" }, secondary: { label: "تواصل معنا", href: "/contact" } }
    : { title: "Start Earning with RAAN", description: "Sign up now and join the captains community in Anbar.", primary: { label: "Register as Driver", href: "/driver/auth" }, secondary: { label: "Contact Us", href: "/contact" } };

  return (
    <MarketingShell>
      <MarketingHero
        badge={hero.badge}
        title={hero.title}
        description={hero.description}
        actions={hero.actions}
        stats={hero.stats}
        visual={<DriverConsoleIllustration />}
      />

      <PageSection>
        <SectionIntro eyebrow={benefitsSection.eyebrow} title={benefitsSection.title} description={benefitsSection.description} />
        <div className="mt-12">
          <InfoGrid items={benefits} columns={3} />
        </div>
      </PageSection>

      <PageSection className="bg-card/20">
        <SectionIntro eyebrow={stepsSection.eyebrow} title={stepsSection.title} description={stepsSection.description} />
        <div className="mt-12">
          <ProcessSteps items={steps} />
        </div>
      </PageSection>

      <PageSection id="requirements">
        <SectionIntro eyebrow={requirementsSection.eyebrow} title={requirementsSection.title} description={requirementsSection.description} />
        <div className="mt-12">
          <InfoGrid items={requirements} columns={3} />
        </div>
      </PageSection>

      <PageSection className="bg-card/20">
        <SectionIntro eyebrow={isAr ? "الأرباح" : "Earnings"} title={earningsTitle} description={isAr ? "الأرقام التالية تقديرية بناءً على متوسط الرحلات في المنطقة." : "The following figures are estimates based on average trip rates in the area."} />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {earningsItems.map((item, index) => (
            <motion.div
              key={item.trips}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.35, delay: index * 0.1 }}
            >
              <Card className="border-primary/20 bg-card/70 backdrop-blur-xl">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-primary">{item.income}</div>
                  <div className="mt-2 text-lg font-semibold text-foreground">{item.trips}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{item.hours}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </PageSection>

      <CTASection title={cta.title} description={cta.description} primary={cta.primary} secondary={cta.secondary} />
    </MarketingShell>
  );
};

const DriverPage = () => (
  <MarketingLocaleProvider>
    <DriverPageContent />
  </MarketingLocaleProvider>
);

export default DriverPage;
