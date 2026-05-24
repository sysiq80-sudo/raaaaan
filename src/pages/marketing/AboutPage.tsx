import { MapPin, Heart, Zap, Shield, Target, Lightbulb } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingLocaleProvider, useMarketingLocale } from "@/contexts/MarketingLocaleContext";
import {
  MarketingHero,
  SectionIntro,
  InfoGrid,
  CTASection,
  PageSection,
} from "@/components/marketing/MarketingBlocks";
import { StoryIllustration } from "@/components/marketing/MarketingIllustrations";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

const AboutPageContent = () => {
  const { locale } = useMarketingLocale();
  const isAr = locale === "ar";

  const hero = isAr
    ? {
        badge: "من نحن",
        title: "أول تاكسي ذكي في الأنبار",
        description: "ران وُلِد من الأنبار وصُمَّم لشوارعها ولهجتها وناسها. مشروع عراقي بالكامل يجمع بين التقنية المتقدمة والحضور المحلي الحقيقي.",
        actions: [
          { label: "احجز رحلتك", href: "/auth", variant: "primary" as const },
          { label: "تواصل معنا", href: "/contact", variant: "secondary" as const },
        ],
        stats: [
          { value: "٢٠٢٤", label: "سنة التأسيس" },
          { value: "+٤٠", label: "كابتن معتمد" },
          { value: "٤.٩★", label: "متوسط التقييم" },
        ],
      }
    : {
        badge: "About Us",
        title: "Anbar's First Smart Taxi",
        description: "RAAN was born from Anbar and designed for its streets, dialect, and people. A fully Iraqi project combining advanced technology with genuine local presence.",
        actions: [
          { label: "Book a Ride", href: "/auth", variant: "primary" as const },
          { label: "Contact Us", href: "/contact", variant: "secondary" as const },
        ],
        stats: [
          { value: "2024", label: "Year Founded" },
          { value: "40+", label: "Approved Captains" },
          { value: "4.9★", label: "Average Rating" },
        ],
      };

  const storySection = isAr
    ? {
        eyebrow: "القصة",
        title: "لماذا ران؟",
        description: "في مدينة تعتمد على التنقل اليومي ولا تجد تطبيقاً يفهم أسماء أحيائها وشوارعها، كانت الحاجة حقيقية لحل محلي حقيقي. ران جاء ليملأ هذا الفراغ بتقنية AI مدرّبة على الأنبار، وتجربة مستخدم مصممة للعراقي.",
      }
    : {
        eyebrow: "The Story",
        title: "Why RAAN?",
        description: "In a city that depends on daily transportation but lacked an app that understood its neighborhood names and streets, there was a real need for a genuine local solution. RAAN was built to fill that gap with AI trained on Anbar and a user experience designed for Iraqis.",
      };

  const valuesSection = isAr
    ? { eyebrow: "قيمنا", title: "ما الذي يقودنا", description: "القيم التي بنينا عليها كل قرار في ران." }
    : { eyebrow: "Our Values", title: "What Drives Us", description: "The values behind every decision we've made at RAAN." };

  const values = isAr
    ? [
        { icon: <MapPin className="h-6 w-6" />, title: "المحلية أولاً", description: "نفهم الأنبار لأننا منها. كل ميزة بُنيت بناءً على احتياج حقيقي من السكان." },
        { icon: <Zap className="h-6 w-6" />, title: "السرعة والبساطة", description: "نؤمن أن أفضل تجربة هي التي لا تفكر فيها — بسيطة وسريعة ومباشرة." },
        { icon: <Shield className="h-6 w-6" />, title: "الأمان والثقة", description: "كل كابتن معتمد وكل رحلة مُراقبة. الثقة ليست كلمة — هي نظام." },
        { icon: <Heart className="h-6 w-6" />, title: "الإنسان قبل التقنية", description: "التقنية خادمة للمستخدم. نصمم لأناس حقيقيين بحياة حقيقية." },
        { icon: <Target className="h-6 w-6" />, title: "التحسين المستمر", description: "نستمع، نتعلم، ونتطور. كل تعليق يُعدّ فرصة للارتقاء." },
        { icon: <Lightbulb className="h-6 w-6" />, title: "الابتكار المحلي", description: "لا نستورد حلولاً — نبني الحل المناسب لبيئتنا الخاصة." },
      ]
    : [
        { icon: <MapPin className="h-6 w-6" />, title: "Local First", description: "We understand Anbar because we're from it. Every feature was built based on a real need from the residents." },
        { icon: <Zap className="h-6 w-6" />, title: "Speed & Simplicity", description: "We believe the best experience is one you don't think about — simple, fast, and direct." },
        { icon: <Shield className="h-6 w-6" />, title: "Safety & Trust", description: "Every captain is verified and every ride is monitored. Trust isn't a word — it's a system." },
        { icon: <Heart className="h-6 w-6" />, title: "People Before Technology", description: "Technology serves the user. We design for real people with real lives." },
        { icon: <Target className="h-6 w-6" />, title: "Continuous Improvement", description: "We listen, learn, and evolve. Every piece of feedback is an opportunity to improve." },
        { icon: <Lightbulb className="h-6 w-6" />, title: "Local Innovation", description: "We don't import solutions — we build the right solution for our own environment." },
      ];

  const statsItems = isAr
    ? [
        { value: "+٤٠", label: "كابتن معتمد في الأنبار" },
        { value: "٢٤/٧", label: "خدمة مستمرة بدون انقطاع" },
        { value: "٤.٩★", label: "متوسط تقييم المستخدمين" },
        { value: "+٢٧", label: "معلم مدرَّب عليه النظام" },
      ]
    : [
        { value: "40+", label: "Approved Captains in Anbar" },
        { value: "24/7", label: "Continuous Service" },
        { value: "4.9★", label: "Average User Rating" },
        { value: "27+", label: "Landmarks Trained in the System" },
      ];

  const cta = isAr
    ? { title: "كن جزءاً من ران", description: "سواء كنت راكباً أو كابتناً — مكانك معنا.", primary: { label: "ابدأ الآن", href: "/auth" }, secondary: { label: "كن كابتن", href: "/drive" } }
    : { title: "Be Part of RAAN", description: "Whether you're a rider or a captain — your place is with us.", primary: { label: "Get Started", href: "/auth" }, secondary: { label: "Become a Captain", href: "/drive" } };

  return (
    <MarketingShell>
      <MarketingHero
        badge={hero.badge}
        title={hero.title}
        description={hero.description}
        actions={hero.actions}
        stats={hero.stats}
        visual={<StoryIllustration />}
      />

      <PageSection>
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
          <motion.div
            initial={{ opacity: 0, x: isAr ? 24 : -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
          >
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-primary/80">{storySection.eyebrow}</p>
            <h2 className="text-3xl font-bold leading-tight text-foreground md:text-5xl">{storySection.title}</h2>
            <p className="mt-6 text-base leading-8 text-muted-foreground md:text-lg">{storySection.description}</p>
          </motion.div>
          <div className="grid grid-cols-2 gap-5">
            {statsItems.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.35, delay: index * 0.08 }}
              >
                <Card className="border-border/30 bg-card/70 backdrop-blur-xl">
                  <CardContent className="p-5 text-center">
                    <div className="text-3xl font-bold text-primary">{stat.value}</div>
                    <div className="mt-2 text-sm text-muted-foreground">{stat.label}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </PageSection>

      <PageSection className="bg-card/20">
        <SectionIntro eyebrow={valuesSection.eyebrow} title={valuesSection.title} description={valuesSection.description} />
        <div className="mt-12">
          <InfoGrid items={values} columns={3} />
        </div>
      </PageSection>

      <CTASection title={cta.title} description={cta.description} primary={cta.primary} secondary={cta.secondary} />
    </MarketingShell>
  );
};

const AboutPage = () => (
  <MarketingLocaleProvider>
    <AboutPageContent />
  </MarketingLocaleProvider>
);

export default AboutPage;
