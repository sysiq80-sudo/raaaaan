import { MapPin, Shield, Wallet, Clock, Star, Route, HeartHandshake, Navigation, Users } from "lucide-react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingLocaleProvider, useMarketingLocale } from "@/contexts/MarketingLocaleContext";
import {
  MarketingHero,
  SectionIntro,
  InfoGrid,
  QuoteGrid,
  CTASection,
  PageSection,
} from "@/components/marketing/MarketingBlocks";
import { CityGridIllustration } from "@/components/marketing/MarketingIllustrations";

const FeaturesPageContent = () => {
  const { locale } = useMarketingLocale();
  const isAr = locale === "ar";

  const hero = isAr
    ? {
        badge: "مميزات ران",
        title: "كل ما تحتاجه في تطبيق واحد",
        description: "من الحجز الصوتي والتتبع اللحظي إلى مناطق الخدمة الدقيقة والدفع الآمن — ران صُمِّم ليكون صاحبك على الطريق.",
        actions: [
          { label: "احجز الآن", href: "/auth", variant: "primary" as const },
          { label: "كن كابتن", href: "/drive", variant: "secondary" as const },
        ],
        stats: [
          { value: "+40", label: "كابتن معتمد" },
          { value: "24/7", label: "خدمة مستمرة" },
          { value: "4.9★", label: "تقييم المستخدمين" },
        ],
      }
    : {
        badge: "RAAN Features",
        title: "Everything You Need in One App",
        description: "From voice booking and live tracking to precise service zones and secure payment — RAAN is built to be your road companion.",
        actions: [
          { label: "Book Now", href: "/auth", variant: "primary" as const },
          { label: "Become a Captain", href: "/drive", variant: "secondary" as const },
        ],
        stats: [
          { value: "40+", label: "Approved Captains" },
          { value: "24/7", label: "Always Available" },
          { value: "4.9★", label: "User Rating" },
        ],
      };

  const riderSection = isAr
    ? { eyebrow: "مميزات الراكب", title: "تجربة حجز سلسة من أول لمسة", description: "واجهة مصممة للراكب العراقي — بسيطة وسريعة وتفهم ما تريده." }
    : { eyebrow: "Rider Features", title: "A Smooth Booking Experience from First Tap", description: "Designed for the Iraqi rider — simple, fast, and understands what you need." };

  const riderFeatures = isAr
    ? [
        { icon: <MapPin className="h-6 w-6" />, title: "تحديد الموقع الذكي", description: "يتعرف على موقعك تلقائياً مع إمكانية اختيار نقطة انطلاق يدوياً على الخريطة." },
        { icon: <Navigation className="h-6 w-6" />, title: "تتبع لحظي للكابتن", description: "شاهد الكابتن وهو يقترب منك على الخريطة وتلقَّ إشعارات عند وصوله." },
        { icon: <Wallet className="h-6 w-6" />, title: "دفع مرن وآمن", description: "ادفع نقداً أو من المحفظة الإلكترونية بضغطة زر واحدة." },
        { icon: <Clock className="h-6 w-6" />, title: "حجز مسبق", description: "جدوِل رحلتك مسبقاً وسيصلك الكابتن في الوقت المحدد تماماً." },
        { icon: <Star className="h-6 w-6" />, title: "تقييم بعد كل رحلة", description: "قيّم الكابتن والرحلة وساعد في الحفاظ على جودة الخدمة." },
        { icon: <HeartHandshake className="h-6 w-6" />, title: "أماكن مفضلة", description: "احفظ المنزل والعمل وأي مكان تتردد عليه لحجز أسرع في المرات القادمة." },
      ]
    : [
        { icon: <MapPin className="h-6 w-6" />, title: "Smart Location Detection", description: "Automatically detects your position with the option to manually pick a departure point on the map." },
        { icon: <Navigation className="h-6 w-6" />, title: "Live Captain Tracking", description: "Watch the captain approach on the map and receive notifications when they arrive." },
        { icon: <Wallet className="h-6 w-6" />, title: "Flexible & Secure Payment", description: "Pay cash or from your e-wallet with a single tap." },
        { icon: <Clock className="h-6 w-6" />, title: "Advance Booking", description: "Schedule your ride in advance and the captain will arrive exactly on time." },
        { icon: <Star className="h-6 w-6" />, title: "Post-Ride Rating", description: "Rate the captain and ride after each trip to help maintain service quality." },
        { icon: <HeartHandshake className="h-6 w-6" />, title: "Saved Places", description: "Save home, work, and frequently visited places for faster booking next time." },
      ];

  const safetySection = isAr
    ? { eyebrow: "الأمان أولاً", title: "رحلتك محمية من البداية للنهاية", description: "نظام أمان متكامل يضمن راحة بالك في كل رحلة." }
    : { eyebrow: "Safety First", title: "Your Ride is Protected Start to Finish", description: "An integrated safety system that gives you peace of mind on every ride." };

  const safetyFeatures = isAr
    ? [
        { icon: <Shield className="h-6 w-6" />, title: "كابتن معتمد فحسب", description: "كل الكباتن يمرون بفحص أمني وتدريب قبل القبول في المنصة.", accent: "bg-emerald-500/10 text-emerald-400" },
        { icon: <Route className="h-6 w-6" />, title: "تتبع المسار", description: "يُسجَّل مسار كل رحلة ومدتها كاملاً لضمان الشفافية.", accent: "bg-blue-500/10 text-blue-400" },
        { icon: <Users className="h-6 w-6" />, title: "دعم 24/7", description: "فريق دعم متاح على مدار الساعة للرد على أي استفسار أو طارئ.", accent: "bg-violet-500/10 text-violet-400" },
      ]
    : [
        { icon: <Shield className="h-6 w-6" />, title: "Verified Captains Only", description: "All captains pass a security check and training before being approved on the platform.", accent: "bg-emerald-500/10 text-emerald-400" },
        { icon: <Route className="h-6 w-6" />, title: "Route Tracking", description: "Every ride's route and duration is fully recorded to ensure transparency.", accent: "bg-blue-500/10 text-blue-400" },
        { icon: <Users className="h-6 w-6" />, title: "24/7 Support", description: "Support team available around the clock to respond to any inquiry or emergency.", accent: "bg-violet-500/10 text-violet-400" },
      ];

  const testimonials = isAr
    ? [
        { quote: "التطبيق سريع وحجزت رحلتي بالصوت خلال ثواني. الكابتن وصل قبل ما أتوقع!", name: "أحمد محمد", role: "راكب — الرمادي" },
        { quote: "أخيراً تطبيق تاكسي يفهم المناطق الأنبارية صح. مو بس يعطيك إحداثيات مو واضحة.", name: "سارة العبيدي", role: "راكبة — الفلوجة" },
        { quote: "الدفع بالمحفظة مريح جداً وآمن. ما اضطر أخرج فلوس كل مرة.", name: "عمر خالد", role: "راكب — الأنبار" },
      ]
    : [
        { quote: "The app is fast and I booked my ride by voice in seconds. The captain arrived sooner than expected!", name: "Ahmed Mohammed", role: "Rider — Ramadi" },
        { quote: "Finally a taxi app that understands Anbar areas properly. Not just unclear coordinates.", name: "Sara Al-Ubeidi", role: "Rider — Fallujah" },
        { quote: "Wallet payment is very convenient and secure. I don't have to carry cash every time.", name: "Omar Khalid", role: "Rider — Anbar" },
      ];

  const cta = isAr
    ? { title: "جاهز تجرّب؟", description: "سجّل الآن واحجز رحلتك الأولى في ثوانٍ.", primary: { label: "ابدأ الآن", href: "/auth" }, secondary: { label: "كن كابتن", href: "/drive" } }
    : { title: "Ready to Try?", description: "Sign up now and book your first ride in seconds.", primary: { label: "Get Started", href: "/auth" }, secondary: { label: "Become a Captain", href: "/drive" } };

  return (
    <MarketingShell>
      <MarketingHero
        badge={hero.badge}
        title={hero.title}
        description={hero.description}
        actions={hero.actions}
        stats={hero.stats}
        visual={<CityGridIllustration />}
      />

      <PageSection>
        <SectionIntro eyebrow={riderSection.eyebrow} title={riderSection.title} description={riderSection.description} />
        <div className="mt-12">
          <InfoGrid items={riderFeatures} columns={3} />
        </div>
      </PageSection>

      <PageSection className="bg-card/20">
        <SectionIntro eyebrow={safetySection.eyebrow} title={safetySection.title} description={safetySection.description} />
        <div className="mt-12">
          <InfoGrid items={safetyFeatures} columns={3} />
        </div>
      </PageSection>

      <PageSection>
        <SectionIntro
          eyebrow={isAr ? "آراء المستخدمين" : "User Reviews"}
          title={isAr ? "ماذا يقول ركابنا" : "What Our Riders Say"}
          description={isAr ? "تجارب حقيقية من مستخدمي ران في الأنبار." : "Real experiences from RAAN users across Anbar."}
        />
        <div className="mt-12">
          <QuoteGrid items={testimonials} />
        </div>
      </PageSection>

      <CTASection title={cta.title} description={cta.description} primary={cta.primary} secondary={cta.secondary} />
    </MarketingShell>
  );
};

const FeaturesPage = () => (
  <MarketingLocaleProvider>
    <FeaturesPageContent />
  </MarketingLocaleProvider>
);

export default FeaturesPage;
