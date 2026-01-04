import { Route, MapPinned, Wallet, Shield, Zap, HeartHandshake, Navigation, CreditCard } from "lucide-react";

const FeatureCard = ({ icon, title, description, delay }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) => <div className="group p-6 bg-card rounded-2xl border border-border/50 card-hover animate-fade-up opacity-0 fill-forwards animate-fade-up-delay" style={{
  '--animation-delay': `${delay}ms`
} as React.CSSProperties}>
    <div className="w-12 h-12 mb-4 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 group-hover:shadow-glow-sm">
      {icon}
    </div>
    <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
  </div>;

const FeaturesSection = () => {
  return (
    <section id="features" className="py-20 md:py-28 relative">
      <div className="absolute inset-0 dots-pattern opacity-20" />
      <div className="container relative">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
            <Zap className="w-4 h-4" />
            مميزات ذكية تفهم احتياجاتك
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            تصميم <span className="text-gradient">لاحتياجات</span> شوارع الأنبار
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            وجهتك بناءً على نقاط معروفة وملاحظة بأسلوب أنباري مألوف وبسيط
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard icon={<Route className="w-6 h-6" />} title="توجيه ذكي" description="التطبيق يختار لك أفضل الطرق ويتجنب الازدحامات" delay={0} />
          <FeatureCard icon={<MapPinned className="w-6 h-6" />} title="نقاط دالة أنبارية" description="استخدم أسماء المناطق والمعالم المعروفة بدلاً من العناوين" delay={100} />
          <FeatureCard icon={<Wallet className="w-6 h-6" />} title="دفع مرن" description="ادفع نقداً أو عبر زين كاش وآسيا حوالة" delay={200} />
          <FeatureCard icon={<Shield className="w-6 h-6" />} title="أمان متقدم" description="جميع سائقينا معتمدون ومتحقق من هوياتهم وسياراتهم" delay={300} />
          <FeatureCard icon={<Zap className="w-6 h-6" />} title="خفيف وسريع" description="التطبيق يعمل حتى مع ضعف الإنترنت ويستهلك بيانات قليلة" delay={400} />
          <FeatureCard icon={<HeartHandshake className="w-6 h-6" />} title="تكسي نسائي" description="سائقات محترفات للنساء فقط براحة وخصوصية تامة" delay={500} />
          <FeatureCard icon={<Navigation className="w-6 h-6" />} title="خرائط حرارية للكباتن" description="نظهر للسائقين مناطق الطلب العالي لزيادة أرباحهم" delay={600} />
          <FeatureCard icon={<CreditCard className="w-6 h-6" />} title="أسعار شفافة" description="اعرف السعر مسبقاً بدون مفاجآت أو رسوم خفية" delay={700} />
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;