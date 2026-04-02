import { useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Facebook, Globe, Instagram, Menu, Phone, Send, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { APP_INFO } from "@/lib/constants";
import { useMarketingLocale } from "@/contexts/MarketingLocaleContext";

type NavItem = {
  to: string;
  ar: string;
  en: string;
};

const navItems: NavItem[] = [
  { to: "/", ar: "الرئيسية", en: "Home" },
  { to: "/ai", ar: "الذكاء الاصطناعي", en: "AI" },
  { to: "/features", ar: "المميزات", en: "Features" },
  { to: "/drive", ar: "كن كابتن", en: "Drive" },
  { to: "/about", ar: "من نحن", en: "About" },
  { to: "/contact", ar: "تواصل معنا", en: "Contact" },
];

const footerQuickLinks = [
  { to: "/", ar: "الرئيسية", en: "Home" },
  { to: "/ai", ar: "الذكاء الاصطناعي", en: "AI" },
  { to: "/features", ar: "المميزات", en: "Features" },
  { to: "/drive", ar: "كن كابتن", en: "Drive with RAAN" },
  { to: "/about", ar: "عن ران", en: "About RAAN" },
  { to: "/contact", ar: "تواصل معنا", en: "Contact" },
  { to: "/terms", ar: "الشروط والأحكام", en: "Terms" },
  { to: "/privacy", ar: "سياسة الخصوصية", en: "Privacy" },
];

const text = {
  ar: {
    rider: "تسجيل الراكب",
    driver: "تسجيل السائق",
    bookNow: "احجز الآن",
    language: "English",
    quickLinks: "روابط سريعة",
    contact: "تواصل معنا",
    download: "حمّل التطبيق",
    footerDescription: "أول تطبيق تاكسي بالعالم يعمل بالذكاء الاصطناعي. مصمم لطرق الأنبار ولهجتها وتجربة حجز أسرع وأكثر وضوحاً.",
    legal: "© 2026 ران RAAN. جميع الحقوق محفوظة.",
    appStore: "App Store",
    googlePlay: "Google Play",
    social: "تابعنا",
    powered: "مدعوم بالذكاء الاصطناعي وخرائط دقيقة للمدينة",
  },
  en: {
    rider: "Rider Sign In",
    driver: "Driver Sign In",
    bookNow: "Book Now",
    language: "العربية",
    quickLinks: "Quick Links",
    contact: "Contact",
    download: "Get the App",
    footerDescription: "The world's first AI taxi experience built for Anbar streets, landmarks, and a faster booking flow.",
    legal: "© 2026 RAAN. All rights reserved.",
    appStore: "App Store",
    googlePlay: "Google Play",
    social: "Follow us",
    powered: "Powered by AI and hyper-local city mapping",
  },
} as const;

const SocialIcon = ({ href, label, children }: { href: string; label: string; children: React.ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={label}
    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/40 bg-card/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
  >
    {children}
  </a>
);

export const MarketingShell = ({ children }: { children: React.ReactNode }) => {
  const { locale, direction, toggleLocale, isArabic } = useMarketingLocale();
  const copy = text[locale];
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // ═══════════════════════════════════════════════════════════
  // تطبيق class الموقع التعريفي على html لتمكين التمرير
  // ═══════════════════════════════════════════════════════════
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
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location.pathname]);

  return (
    <div dir={direction} className="min-h-screen bg-background text-foreground">

      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-4 md:h-20">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="RAAN" className="h-11 w-11 rounded-2xl shadow-glow-sm" />
            <div>
              <div className="text-lg font-bold text-foreground">ران <span className="text-primary">RAAN</span></div>
              <div className="text-xs text-muted-foreground">AI Taxi for Anbar</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `relative text-sm font-medium transition-colors
                   after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:rounded-full after:bg-primary after:transition-[width] after:duration-300
                   ${isActive
                     ? "text-primary after:w-full"
                     : "text-muted-foreground hover:text-foreground after:w-0 hover:after:w-full"}`
                }
              >
                {locale === "ar" ? item.ar : item.en}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Button variant="ghost" size="sm" onClick={toggleLocale} className="gap-2 text-muted-foreground hover:text-foreground">
              <Globe className="h-4 w-4" />
              {copy.language}
            </Button>
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">{copy.rider}</Button>
            </Link>
            <Link to="/driver/auth">
              <Button variant="outline" size="sm" className="border-primary/40 text-primary hover:bg-primary/10">{copy.driver}</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="bg-gradient-primary px-5 font-semibold shadow-glow btn-glow">{copy.bookNow}</Button>
            </Link>
          </div>

          <button
            type="button"
            aria-label="Toggle navigation"
            onClick={() => setOpen((current) => !current)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/30 bg-card/70 text-foreground lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open ? (
          <div className="border-t border-border/30 bg-background/95 p-4 backdrop-blur-xl lg:hidden">
            <div className="space-y-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `block rounded-2xl px-4 py-3 text-sm font-medium ${isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-card"}`
                  }
                >
                  {locale === "ar" ? item.ar : item.en}
                </NavLink>
              ))}
            </div>
            <div className="mt-4 grid gap-3">
              <Button variant="outline" onClick={toggleLocale} className="justify-center gap-2 border-primary/25 text-foreground hover:bg-primary/10">
                <Globe className="h-4 w-4" />
                {copy.language}
              </Button>
              <Link to="/auth"><Button variant="ghost" className="w-full justify-center">{copy.rider}</Button></Link>
              <Link to="/driver/auth"><Button variant="outline" className="w-full justify-center border-primary/30 text-primary">{copy.driver}</Button></Link>
              <Link to="/auth"><Button className="w-full justify-center bg-gradient-primary shadow-glow">{copy.bookNow}</Button></Link>
            </div>
          </div>
        ) : null}
      </header>

      <div className="[perspective:1100px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, rotateX: 14, y: 28, scale: 0.982 }}
            animate={{ opacity: 1, rotateX: 0, y: 0, scale: 1,
              transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, rotateX: -6, y: -18, scale: 0.992,
              transition: { duration: 0.28, ease: [0.4, 0, 0.6, 1] } }}
            className="origin-top pt-20 md:pt-24"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>

      {/* ═══ زر CTA عائم للجوال ═══ */}
      <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden pb-safe">
        <div className="bg-background/90 backdrop-blur-xl border-t border-border/30 px-4 py-3">
          <Link to="/auth">
            <Button className="w-full bg-gradient-primary shadow-glow btn-glow font-bold text-base h-12">
              {copy.bookNow} 🚗
            </Button>
          </Link>
        </div>
      </div>

      <footer className="border-t border-border/30 bg-card/30 marketing-pb-cta">
        <div className="container py-10 lg:py-14">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.9fr_0.9fr_0.8fr]">
            <div>
              <div className="flex items-center gap-3">
                <img src={logo} alt="RAAN" className="h-12 w-12 rounded-2xl shadow-glow-sm" />
                <div>
                  <div className="text-xl font-bold text-foreground">ران <span className="text-primary">RAAN</span></div>
                  <div className="text-xs text-muted-foreground">{copy.powered}</div>
                </div>
              </div>
              <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">{copy.footerDescription}</p>
              <div className="mt-6 flex items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> AI
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">Google Maps</span>
              </div>
              <div className="mt-6 flex gap-3">
                <SocialIcon href="https://facebook.com/raan.app" label="Facebook"><Facebook className="h-4 w-4" /></SocialIcon>
                <SocialIcon href="https://instagram.com/raan.app" label="Instagram"><Instagram className="h-4 w-4" /></SocialIcon>
                <SocialIcon href="https://t.me/raan_1_bot" label="Telegram"><Send className="h-4 w-4" /></SocialIcon>
                <SocialIcon href={`tel:${APP_INFO.phone}`} label="Phone"><Phone className="h-4 w-4" /></SocialIcon>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">{copy.quickLinks}</h3>
              <div className="mt-5 grid gap-3 text-sm text-muted-foreground">
                {footerQuickLinks.map((item) => (
                  <Link key={item.to} to={item.to} className="transition-colors hover:text-primary">
                    {locale === "ar" ? item.ar : item.en}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">{copy.contact}</h3>
              <div className="mt-5 grid gap-4 text-sm text-muted-foreground">
                <a href={`tel:${APP_INFO.phone}`} className="transition-colors hover:text-primary">{APP_INFO.phone}</a>
                <a href={`mailto:${APP_INFO.email}`} className="transition-colors hover:text-primary">{APP_INFO.email}</a>
                <a href="https://t.me/raan_1_bot" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-primary">@raan_1_bot</a>
                <a href="https://wa.me/9647884669922" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-primary">WhatsApp</a>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">{copy.download}</h3>
              <div className="mt-5 grid gap-3">
                <Button variant="outline" className="justify-start border-border/40 bg-card/70 hover:bg-card">{copy.appStore}</Button>
                <Button variant="outline" className="justify-start border-border/40 bg-card/70 hover:bg-card">{copy.googlePlay}</Button>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-border/30 pt-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <div>{copy.legal}</div>
            <div className="flex flex-wrap items-center gap-5">
              <Link to="/privacy" className="transition-colors hover:text-primary">{locale === "ar" ? "سياسة الخصوصية" : "Privacy"}</Link>
              <Link to="/terms" className="transition-colors hover:text-primary">{locale === "ar" ? "الشروط والأحكام" : "Terms"}</Link>
              <Link to="/contact" className="transition-colors hover:text-primary">{locale === "ar" ? "الدعم" : "Support"}</Link>
              <Link to="/admin/login" className="transition-colors hover:text-primary">{locale === "ar" ? "لوحة التحكم" : "Admin"}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};