import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMarketingLocale } from "@/contexts/MarketingLocaleContext";

export type HeroAction = {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
};

export const SectionIntro = ({
  eyebrow,
  title,
  description,
  centered = true,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  centered?: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.25 }}
    transition={{ duration: 0.45 }}
    className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}
  >
    {eyebrow ? <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-primary/80">{eyebrow}</p> : null}
    <h2 className="text-3xl font-bold leading-tight text-foreground md:text-5xl">{title}</h2>
    <p className="mt-5 text-base leading-8 text-muted-foreground md:text-lg">{description}</p>
  </motion.div>
);

export const MarketingHero = ({
  badge,
  title,
  description,
  actions,
  stats,
  visual,
}: {
  badge: string;
  title: string;
  description: string;
  actions: HeroAction[];
  stats: Array<{ value: string; label: string }>;
  visual: React.ReactNode;
}) => {
  const { isArabic } = useMarketingLocale();
  const ArrowIcon = isArabic ? ArrowLeft : ArrowRight;

  return (
    <section className="relative overflow-hidden pb-20 md:pb-28">
      <div className="absolute inset-0 hero-gradient" />
      <div className="absolute inset-0 dots-pattern opacity-20" />
      <div className="absolute -top-24 right-[10%] h-80 w-80 rounded-full bg-primary/10 blur-[100px]" />
      <div className="absolute bottom-0 left-[8%] h-80 w-80 rounded-full bg-primary/10 blur-[120px]" />
      <div className="container relative">
        <div className="grid items-center gap-8 lg:gap-12 lg:grid-cols-[1.02fr_0.98fr]">
          {/* النص — يجيء أولاً على الجوال */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="text-center lg:text-start order-1"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs sm:text-sm font-medium text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-80" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              {badge}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1] text-foreground">{title}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base sm:text-lg leading-7 sm:leading-8 text-muted-foreground lg:mx-0">{description}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              {actions.map((action) => (
                <Link key={action.href} to={action.href} className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant={action.variant === "secondary" ? "outline" : "default"}
                    className={
                      action.variant === "secondary"
                        ? "w-full border-primary/30 px-6 py-5 sm:px-8 sm:py-6 text-sm sm:text-base font-semibold text-foreground hover:bg-primary/10"
                        : "w-full bg-gradient-primary px-6 py-5 sm:px-8 sm:py-6 text-sm sm:text-base font-semibold shadow-glow btn-glow"
                    }
                  >
                    {action.label}
                    <ArrowIcon className="ms-2 h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </Link>
              ))}
            </div>
            {/* إحصاءات — 3 أعمدة دائماً */}
            <div className="mt-8 grid grid-cols-3 gap-3">
              {stats.map((stat) => (
                <Card key={stat.label} className="border-border/30 bg-card/50 backdrop-blur-xl">
                  <CardContent className="p-3 sm:p-5 text-center">
                    <div className="text-lg sm:text-2xl md:text-3xl font-bold text-primary">{stat.value}</div>
                    <div className="mt-1 text-[10px] sm:text-sm text-muted-foreground leading-tight">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
          {/* الصورة/الرسم — يجيء ثانياً على الجوال */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="order-2 flex justify-center"
          >
            {visual}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export const InfoGrid = ({
  items,
  columns = 3,
}: {
  items: Array<{ icon: React.ReactNode; title: string; description: string; accent?: string }>;
  columns?: 2 | 3 | 4;
}) => (
  <div className={`grid gap-5 md:grid-cols-2 ${columns === 4 ? "xl:grid-cols-4" : columns === 3 ? "xl:grid-cols-3" : "xl:grid-cols-2"}`}>
    {items.map((item, index) => (
      <motion.div
        key={item.title}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35, delay: index * 0.06 }}
      >
        <Card className="card-hover h-full border-border/30 bg-card/70 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${item.accent ?? "bg-primary/10 text-primary"}`}>
              {item.icon}
            </div>
            <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
          </CardContent>
        </Card>
      </motion.div>
    ))}
  </div>
);

export const ProcessSteps = ({
  items,
}: {
  items: Array<{ number: string; title: string; description: string }>;
}) => (
  <div className="grid gap-5 lg:grid-cols-3">
    {items.map((item, index) => (
      <motion.div
        key={item.number}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35, delay: index * 0.08 }}
      >
        <Card className="h-full border-primary/15 bg-background/60 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-glow-sm">
              {item.number}
            </div>
            <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
          </CardContent>
        </Card>
      </motion.div>
    ))}
  </div>
);

export const QuoteGrid = ({
  items,
}: {
  items: Array<{ quote: string; name: string; role: string }>;
}) => (
  <div className="grid gap-5 lg:grid-cols-3">
    {items.map((item, index) => (
      <motion.div
        key={item.name}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35, delay: index * 0.08 }}
      >
        <Card className="h-full border-border/30 bg-card/70 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="mb-4 flex gap-1 text-primary">
              {Array.from({ length: 5 }).map((_, starIndex) => (
                <CheckCircle2 key={starIndex} className="h-4 w-4" />
              ))}
            </div>
            <p className="text-sm leading-7 text-muted-foreground">“{item.quote}”</p>
            <div className="mt-5 border-t border-border/40 pt-5">
              <div className="font-semibold text-foreground">{item.name}</div>
              <div className="text-xs text-muted-foreground">{item.role}</div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    ))}
  </div>
);

export const CTASection = ({
  title,
  description,
  primary,
  secondary,
}: {
  title: string;
  description: string;
  primary: HeroAction;
  secondary?: HeroAction;
}) => {
  const { isArabic } = useMarketingLocale();
  const ArrowIcon = isArabic ? ArrowLeft : ArrowRight;

  return (
    <section className="container py-14 md:py-20 lg:py-24">
      <div className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-card/70 px-5 py-10 shadow-glow sm:px-8 md:px-10 md:py-12">
        <div className="absolute inset-0 hero-gradient opacity-80" />
        <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-3xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground md:text-5xl">{title}</h2>
            <p className="mt-3 text-sm sm:text-base leading-7 sm:leading-8 text-muted-foreground md:text-lg">{description}</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link to={primary.href} className="w-full sm:w-auto">
              <Button size="lg" className="w-full bg-gradient-primary px-6 py-5 sm:px-8 sm:py-6 text-sm sm:text-base font-semibold shadow-glow btn-glow">
                {primary.label}
                <ArrowIcon className="ms-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
            {secondary ? (
              <Link to={secondary.href} className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full border-primary/25 px-6 py-5 sm:px-8 sm:py-6 text-sm sm:text-base font-semibold text-foreground hover:bg-primary/10">
                  {secondary.label}
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

export const PageSection = ({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) => <section id={id} className={`container py-12 md:py-16 lg:py-24 ${className}`}>{children}</section>;
