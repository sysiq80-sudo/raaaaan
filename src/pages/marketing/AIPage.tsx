import { Brain, Mic, MapPin, Zap, Bot, Languages } from "lucide-react";
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
import { AIOrbIllustration } from "@/components/marketing/MarketingIllustrations";

const AIPageContent = () => {
  const { locale } = useMarketingLocale();
  const isAr = locale === "ar";

  const hero = isAr
    ? {
        badge: "ذكاء اصطناعي متقدم",
        title: "تاكسي يفهم لهجتك",
        description: "نظام ذكاء اصطناعي مُدرَّب خصيصاً على اللهجة العراقية والأنبارية. قل وجهتك بصوتك — ران يفهمك ويحجز الرحلة فوراً.",
        actions: [
          { label: "احجز الآن", href: "/auth", variant: "primary" as const },
          { label: "تعرف على المميزات", href: "/features", variant: "secondary" as const },
        ],
        stats: [
          { value: "98%", label: "دقة التعرف الصوتي" },
          { value: "< 2ث", label: "وقت الاستجابة" },
          { value: "٣ لغات", label: "عربي، كردي، إنجليزي" },
        ],
      }
    : {
        badge: "Advanced AI",
        title: "A Taxi That Understands You",
        description: "AI trained specifically on Iraqi and Anbari dialect. Say your destination by voice — RAAN understands and books instantly.",
        actions: [
          { label: "Book Now", href: "/auth", variant: "primary" as const },
          { label: "See Features", href: "/features", variant: "secondary" as const },
        ],
        stats: [
          { value: "98%", label: "Voice Recognition Accuracy" },
          { value: "< 2s", label: "Response Time" },
          { value: "3 Languages", label: "Arabic, Kurdish, English" },
        ],
      };

  const featuresSection = isAr
    ? { eyebrow: "قدرات الذكاء الاصطناعي", title: "تقنية مصنوعة لفهم العراق", description: "لا تكتب العنوان — فقط تكلّم. نظام ران يتعرف على الأحياء والمعالم والأماكن بطريقة طبيعية تماماً." }
    : { eyebrow: "AI Capabilities", title: "Technology Built for Iraq", description: "Don't type an address — just speak. RAAN recognizes neighborhoods, landmarks, and local places naturally." };

  const features = isAr
    ? [
        { icon: <Mic className="h-6 w-6" />, title: "حجز صوتي فوري", description: "قل وجهتك باللهجة العراقية وسيفهمك ران تماماً. لا حاجة للكتابة أو البحث." },
        { icon: <Brain className="h-6 w-6" />, title: "فهم السياق المحلي", description: "يفهم أسماء المناطق والأحياء والمعالم المحلية دون الحاجة إلى صياغة رسمية." },
        { icon: <Languages className="h-6 w-6" />, title: "دعم متعدد اللغات", description: "العربية والكردية والإنجليزية — اختر لغتك وتكلّم بطبيعية." },
        { icon: <MapPin className="h-6 w-6" />, title: "تعرف ذكي بالمعالم", description: "قل 'جامعة الأنبار' أو 'مستشفى الرمادي' — ران يعرف بالضبط أين تقصد." },
        { icon: <Zap className="h-6 w-6" />, title: "حجز في ثوانٍ", description: "من لحظة قولك للوجهة حتى تأكيد الرحلة أقل من ثانيتين في المتوسط." },
        { icon: <Bot className="h-6 w-6" />, title: "مساعد ذكي دائماً", description: "يجيب على استفساراتك، يقترح وجهات، ويتذكر أماكنك المفضلة." },
      ]
    : [
        { icon: <Mic className="h-6 w-6" />, title: "Instant Voice Booking", description: "Say your destination in Iraqi dialect and RAAN will understand you perfectly. No typing needed." },
        { icon: <Brain className="h-6 w-6" />, title: "Local Context Awareness", description: "Understands neighborhood names, districts, and local landmarks without formal phrasing." },
        { icon: <Languages className="h-6 w-6" />, title: "Multi-Language Support", description: "Arabic, Kurdish, and English — choose your language and speak naturally." },
        { icon: <MapPin className="h-6 w-6" />, title: "Smart Landmark Recognition", description: "Say 'University of Anbar' or 'Ramadi Hospital' — RAAN knows exactly where you mean." },
        { icon: <Zap className="h-6 w-6" />, title: "Booked in Seconds", description: "From saying the destination to ride confirmation averages under two seconds." },
        { icon: <Bot className="h-6 w-6" />, title: "Always-On Assistant", description: "Answers your questions, suggests destinations, and remembers your favorite places." },
      ];

  const stepsSection = isAr
    ? { eyebrow: "كيف يعمل", title: "من الصوت إلى الرحلة", description: "ثلاث خطوات بسيطة وأنت في طريقك." }
    : { eyebrow: "How It Works", title: "From Voice to Ride", description: "Three simple steps and you're on your way." };

  const steps = isAr
    ? [
        { number: "١", title: "افتح التطبيق وتكلّم", description: "اضغط زر الصوت وقل وجهتك بأي لهجة تريحك." },
        { number: "٢", title: "ران يفهم ويؤكد", description: "يعرض لك الخريطة بالوجهة المفهومة لتأكيدها بنقرة واحدة." },
        { number: "٣", title: "الكابتن في طريقه", description: "يُحجز الكابتن الأقرب تلقائياً ويصلك خلال دقائق." },
      ]
    : [
        { number: "1", title: "Open the app and speak", description: "Tap the voice button and say your destination in any dialect." },
        { number: "2", title: "RAAN understands and confirms", description: "Shows a map with the understood destination to confirm in one tap." },
        { number: "3", title: "Captain is on the way", description: "The nearest captain is automatically booked and arrives within minutes." },
      ];

  const cta = isAr
    ? { title: "جرّب ذكاء ران الآن", description: "سجّل واحجز رحلتك الأولى بصوتك خلال دقيقة واحدة.", primary: { label: "ابدأ الآن", href: "/auth" }, secondary: { label: "تعرف على المميزات", href: "/features" } }
    : { title: "Try RAAN AI Right Now", description: "Sign up and book your first ride by voice in under a minute.", primary: { label: "Get Started", href: "/auth" }, secondary: { label: "See Features", href: "/features" } };

  return (
    <MarketingShell>
      <MarketingHero
        badge={hero.badge}
        title={hero.title}
        description={hero.description}
        actions={hero.actions}
        stats={hero.stats}
        visual={<AIOrbIllustration />}
      />

      <PageSection>
        <SectionIntro
          eyebrow={featuresSection.eyebrow}
          title={featuresSection.title}
          description={featuresSection.description}
        />
        <div className="mt-12">
          <InfoGrid items={features} columns={3} />
        </div>
      </PageSection>

      <PageSection className="bg-card/20">
        <SectionIntro
          eyebrow={stepsSection.eyebrow}
          title={stepsSection.title}
          description={stepsSection.description}
        />
        <div className="mt-12">
          <ProcessSteps items={steps} />
        </div>
      </PageSection>

      <CTASection
        title={cta.title}
        description={cta.description}
        primary={cta.primary}
        secondary={cta.secondary}
      />
    </MarketingShell>
  );
};

const AIPage = () => (
  <MarketingLocaleProvider>
    <AIPageContent />
  </MarketingLocaleProvider>
);

export default AIPage;
