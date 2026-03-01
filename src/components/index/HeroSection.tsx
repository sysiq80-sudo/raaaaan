import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock } from "lucide-react";
import logo from "@/assets/logo.png";

const HeroSection = () => {
  return (
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
              <span className="text-sm font-medium text-primary">متاح الآن في الأنبار</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-[1.1] animate-fade-up opacity-0 fill-forwards delay-100">
              ​ران، <span className="text-gradient text-glow">أسرع</span>،
              <br />
              أرخص، وأكثر أماناً
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed animate-fade-up opacity-0 fill-forwards delay-200">
              تطبيق ران يفهم شوارع الأنبار. أسعار واضحة بناءً على نقطة الانطلاق والوجهة، ودفع نقدي أو إلكتروني.
              احجز رحلتك الآن!
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-up opacity-0 fill-forwards delay-300">
              <Link to="/auth">
                <Button size="lg" className="w-full sm:w-auto bg-gradient-primary shadow-glow-lg btn-glow text-lg px-8 py-6 font-semibold">
                  سجل كراكب
                  <ArrowLeft className="mr-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/driver/auth">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 py-6 font-semibold border-blue-600 text-blue-600 hover:bg-blue-50">
                  سجل كسائق
                </Button>
              </Link>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-8 justify-center lg:justify-start mt-10 animate-fade-up opacity-0 fill-forwards delay-400">
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-bold text-primary">+50K</p>
                <p className="text-sm text-muted-foreground">راكب سعيد</p>
              </div>
              <div className="w-px h-12 bg-border" />
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-bold text-primary">+10K</p>
                <p className="text-sm text-muted-foreground">كابتن</p>
              </div>
              <div className="w-px h-12 bg-border" />
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-bold text-primary">4.9</p>
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
                        <img src={logo} alt="RAAN" className="w-8 h-8 rounded-lg shadow-glow-sm" />
                        <span className="font-bold text-foreground">ران</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10">
                        <Clock className="w-3 h-3 text-primary" />
                        <span className="text-xs font-medium text-primary">3 دقائق</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;