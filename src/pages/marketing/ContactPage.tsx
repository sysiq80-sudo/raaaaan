import { Phone, Mail, MessageCircle, Send, ChevronDown } from "lucide-react";
import { useState } from "react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MarketingLocaleProvider, useMarketingLocale } from "@/contexts/MarketingLocaleContext";
import {
  MarketingHero,
  SectionIntro,
  InfoGrid,
  CTASection,
  PageSection,
} from "@/components/marketing/MarketingBlocks";
import { ContactBridgeIllustration } from "@/components/marketing/MarketingIllustrations";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-border/30 bg-card/70 backdrop-blur-xl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-5 text-start"
      >
        <span className="font-semibold text-foreground">{question}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="faq-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <CardContent className="px-5 pb-5 pt-0 text-sm leading-7 text-muted-foreground">
              {answer}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

const ContactPageContent = () => {
  const { locale } = useMarketingLocale();
  const isAr = locale === "ar";
  const [formName, setFormName] = useState("");
  const [formMsg, setFormMsg] = useState("");

  const hero = isAr
    ? {
        badge: "تواصل معنا",
        title: "نحن هنا دائماً لمساعدتك",
        description: "سواء كان لديك سؤال أو مشكلة أو اقتراح — فريق ران مستعد للرد عبر قنوات متعددة على مدار الساعة.",
        actions: [
          { label: "واتساب مباشر", href: "https://wa.me/9647884669922", variant: "primary" as const },
          { label: "اقرأ الأسئلة الشائعة", href: "#faq", variant: "secondary" as const },
        ],
        stats: [
          { value: "< ٥ دقائق", label: "متوسط وقت الرد" },
          { value: "٢٤/٧", label: "دعم مستمر" },
          { value: "٤ قنوات", label: "للتواصل" },
        ],
      }
    : {
        badge: "Contact Us",
        title: "We're Always Here to Help",
        description: "Whether you have a question, problem, or suggestion — RAAN's team is ready to respond through multiple channels around the clock.",
        actions: [
          { label: "Direct WhatsApp", href: "https://wa.me/9647884669922", variant: "primary" as const },
          { label: "Read FAQs", href: "#faq", variant: "secondary" as const },
        ],
        stats: [
          { value: "< 5 min", label: "Average Response Time" },
          { value: "24/7", label: "Continuous Support" },
          { value: "4 Channels", label: "to Reach Us" },
        ],
      };

  const channelsSection = isAr
    ? { eyebrow: "قنوات التواصل", title: "كيف تتواصل معنا؟", description: "اختر القناة التي تناسبك." }
    : { eyebrow: "Contact Channels", title: "How to Reach Us?", description: "Choose the channel that suits you." };

  const channels = isAr
    ? [
        { icon: <Phone className="h-6 w-6" />, title: "اتصال مباشر", description: "+964 788 466 9922 — متوفر خلال ساعات العمل للمساعدة الفورية.", accent: "bg-primary/10 text-primary" },
        { icon: <MessageCircle className="h-6 w-6" />, title: "واتساب", description: "راسلنا على واتساب وسنرد في أسرع وقت ممكن على مدار الساعة.", accent: "bg-emerald-500/10 text-emerald-400" },
        { icon: <Send className="h-6 w-6" />, title: "تيليجرام", description: "تواصل معنا عبر بوت تيليجرام @raan_1_bot للرد الفوري التلقائي.", accent: "bg-blue-500/10 text-blue-400" },
        { icon: <Mail className="h-6 w-6" />, title: "البريد الإلكتروني", description: "info@raan.app — للاستفسارات الرسمية والشكاوي التفصيلية.", accent: "bg-violet-500/10 text-violet-400" },
      ]
    : [
        { icon: <Phone className="h-6 w-6" />, title: "Direct Call", description: "+964 788 466 9922 — available during working hours for immediate assistance.", accent: "bg-primary/10 text-primary" },
        { icon: <MessageCircle className="h-6 w-6" />, title: "WhatsApp", description: "Message us on WhatsApp and we'll respond as quickly as possible around the clock.", accent: "bg-emerald-500/10 text-emerald-400" },
        { icon: <Send className="h-6 w-6" />, title: "Telegram", description: "Contact us via Telegram bot @raan_1_bot for instant automatic responses.", accent: "bg-blue-500/10 text-blue-400" },
        { icon: <Mail className="h-6 w-6" />, title: "Email", description: "info@raan.app — for official inquiries and detailed complaints.", accent: "bg-violet-500/10 text-violet-400" },
      ];

  const faqs = isAr
    ? [
        { question: "كيف أحجز رحلة؟", answer: "افتح التطبيق، اضغط الميكروفون وقل وجهتك، أو اكتبها يدوياً على الخريطة. سيجد لك ران كابتناً في دقائق." },
        { question: "ما هي طرق الدفع المتاحة؟", answer: "يمكنك الدفع نقداً للكابتن مباشرة، أو استخدام المحفظة الإلكترونية داخل التطبيق." },
        { question: "كيف أصبح كابتناً؟", answer: "اضغط على 'كن كابتن' في القائمة، أنشئ حسابك، ارفع وثائقك، وانتظر الموافقة خلال ٢٤-٤٨ ساعة." },
        { question: "ما منطقة تغطية الخدمة؟", answer: "حالياً نخدم محافظة الأنبار وبالتحديد مدينة الرمادي والمناطق المحيطة بها. نعمل على التوسع." },
        { question: "ماذا أفعل إذا نسيت شيئاً في السيارة؟", answer: "تواصل معنا فوراً عبر واتساب أو تيليجرام مع ذكر رقم الرحلة وسنتواصل مع الكابتن في أسرع وقت." },
        { question: "كيف أقيّم الرحلة؟", answer: "بعد انتهاء الرحلة ستظهر لك شاشة التقييم تلقائياً. يمكنك تقييم الكابتن من ١ إلى ٥ نجوم." },
      ]
    : [
        { question: "How do I book a ride?", answer: "Open the app, tap the microphone and say your destination, or type it manually on the map. RAAN will find you a captain within minutes." },
        { question: "What payment methods are available?", answer: "You can pay cash directly to the captain, or use the in-app e-wallet." },
        { question: "How do I become a captain?", answer: "Tap 'Become a Captain' in the menu, create your account, upload your documents, and await approval within 24-48 hours." },
        { question: "What is your service coverage area?", answer: "We currently serve Anbar Governorate, specifically Ramadi city and surrounding areas. We're working on expanding." },
        { question: "What if I forget something in the car?", answer: "Contact us immediately via WhatsApp or Telegram with your ride number and we'll reach out to the captain as quickly as possible." },
        { question: "How do I rate a ride?", answer: "After the ride ends, a rating screen will automatically appear. You can rate the captain from 1 to 5 stars." },
      ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formMsg.trim()) return;
    toast.success(isAr ? "تم إرسال رسالتك، سنتواصل معك قريباً!" : "Your message has been sent. We'll get back to you soon!");
    setFormName("");
    setFormMsg("");
  };

  const cta = isAr
    ? { title: "هل مازلت بحاجة لمساعدة؟", description: "فريقنا متاح على مدار الساعة عبر واتساب.", primary: { label: "واتساب مباشر", href: "https://wa.me/9647884669922" }, secondary: { label: "احجز رحلة", href: "/auth" } }
    : { title: "Still Need Help?", description: "Our team is available 24/7 via WhatsApp.", primary: { label: "Direct WhatsApp", href: "https://wa.me/9647884669922" }, secondary: { label: "Book a Ride", href: "/auth" } };

  return (
    <MarketingShell>
      <MarketingHero
        badge={hero.badge}
        title={hero.title}
        description={hero.description}
        actions={hero.actions}
        stats={hero.stats}
        visual={<ContactBridgeIllustration />}
      />

      <PageSection>
        <SectionIntro eyebrow={channelsSection.eyebrow} title={channelsSection.title} description={channelsSection.description} />
        <div className="mt-12">
          <InfoGrid items={channels} columns={4} />
        </div>
      </PageSection>

      <PageSection className="bg-card/20">
        <div className="grid gap-14 lg:grid-cols-2">
          <div>
            <SectionIntro
              eyebrow={isAr ? "أرسل رسالة" : "Send a Message"}
              title={isAr ? "راسلنا مباشرة" : "Message Us Directly"}
              description={isAr ? "اترك لنا رسالة وسنرد عليك في أقرب وقت ممكن." : "Leave us a message and we'll reply as soon as possible."}
              centered={false}
            />
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <Input
                placeholder={isAr ? "الاسم الكامل" : "Full Name"}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="border-border/40 bg-card/70"
                required
              />
              <Textarea
                placeholder={isAr ? "اكتب رسالتك هنا..." : "Write your message here..."}
                value={formMsg}
                onChange={(e) => setFormMsg(e.target.value)}
                className="min-h-[140px] border-border/40 bg-card/70"
                required
              />
              <Button type="submit" className="w-full bg-gradient-primary font-semibold shadow-glow btn-glow">
                {isAr ? "إرسال الرسالة" : "Send Message"}
              </Button>
            </form>
          </div>
          <div id="faq">
            <SectionIntro
              eyebrow={isAr ? "الأسئلة الشائعة" : "FAQ"}
              title={isAr ? "أسئلة يطرحها الناس كثيراً" : "Frequently Asked Questions"}
              description={isAr ? "إجابات سريعة على أكثر الأسئلة شيوعاً." : "Quick answers to the most common questions."}
              centered={false}
            />
            <div className="mt-8 space-y-3">
              {faqs.map((faq) => (
                <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </div>
        </div>
      </PageSection>

      <CTASection title={cta.title} description={cta.description} primary={cta.primary} secondary={cta.secondary} />
    </MarketingShell>
  );
};

const ContactPage = () => (
  <MarketingLocaleProvider>
    <ContactPageContent />
  </MarketingLocaleProvider>
);

export default ContactPage;
