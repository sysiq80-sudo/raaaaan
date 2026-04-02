import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, FileText, AlertCircle, CheckCircle, Home } from "lucide-react";
import logo from "@/assets/logo.png";

const Terms = () => {
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

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="RAAN" className="h-8 w-8 rounded-xl shadow-glow-sm" />
            <span className="font-bold text-foreground">ران <span className="text-primary">RAAN</span></span>
          </Link>
          <h1 className="font-bold text-base text-foreground">شروط الاستخدام</h1>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">الرئيسية</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="pt-20 pb-16 px-4">
        <div className="container max-w-3xl">
          {/* Hero */}
          <div className="text-center mb-10 pt-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-5 border border-primary/20">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">شروط استخدام تطبيق ران</h2>
            <p className="text-muted-foreground text-sm">آخر تحديث: ديسمبر 2024م — 1446هـ</p>
          </div>

          <div className="space-y-5">
            {/* 1 */}
            <section className="bg-card rounded-2xl p-5 sm:p-6 border border-border/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">1. القبول بالشروط</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                باستخدامك لتطبيق ران، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي جزء من هذه الشروط، يرجى عدم استخدام التطبيق. نحتفظ بالحق في تعديل هذه الشروط في أي وقت، وسيتم إخطارك بأي تغييرات جوهرية.
              </p>
            </section>

            {/* 2 */}
            <section className="bg-card rounded-2xl p-5 sm:p-6 border border-border/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">2. الخدمات المقدمة</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4 text-sm sm:text-base">
                يوفر تطبيق ران منصة لربط الركاب بالسائقين المسجلين. نحن نعمل كوسيط تقني ولا نقدم خدمات النقل مباشرة. تشمل خدماتنا:
              </p>
              <ul className="space-y-2.5 text-muted-foreground text-sm sm:text-base">
                {["حجز رحلات التوصيل داخل مناطق الخدمة", "تتبع الرحلات في الوقت الفعلي", "نظام دفع متعدد الخيارات", "نظام تقييم للسائقين والركاب"].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* 3 */}
            <section className="bg-card rounded-2xl p-5 sm:p-6 border border-border/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">3. مسؤوليات المستخدم</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4 text-sm sm:text-base">بصفتك مستخدمًا لتطبيق ران، فإنك توافق على:</p>
              <ul className="space-y-2.5 text-muted-foreground text-sm sm:text-base">
                {[
                  "تقديم معلومات صحيحة ودقيقة عند التسجيل",
                  "الحفاظ على سرية بيانات حسابك",
                  "احترام السائقين والتعامل معهم بلطف",
                  "دفع الأجرة المتفق عليها بالكامل",
                  "عدم استخدام التطبيق لأغراض غير قانونية",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* 4 */}
            <section className="bg-card rounded-2xl p-5 sm:p-6 border border-border/50">
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-3">4. سياسة الإلغاء</h3>
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                يمكنك إلغاء الرحلة قبل وصول السائق دون أي رسوم. في حال الإلغاء المتكرر أو الإلغاء بعد وصول السائق، قد يتم تطبيق رسوم إلغاء. نحتفظ بالحق في إيقاف الحسابات التي تسيء استخدام نظام الإلغاء.
              </p>
            </section>

            {/* 5 */}
            <section className="bg-card rounded-2xl p-5 sm:p-6 border border-border/50">
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-3">5. المسؤولية القانونية</h3>
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                تطبيق ران غير مسؤول عن أي أضرار مباشرة أو غير مباشرة ناتجة عن استخدام الخدمة، بما في ذلك التأخير أو الحوادث أو فقدان الممتلكات. السائقون مقاولون مستقلون وليسوا موظفين لدى ران.
              </p>
            </section>

            {/* 6 */}
            <section className="bg-card rounded-2xl p-5 sm:p-6 border border-border/50">
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-3">6. التواصل معنا</h3>
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                لأي استفسارات حول شروط الاستخدام، يمكنك التواصل معنا عبر قسم الدعم في التطبيق أو عبر البريد الإلكتروني:{" "}
                <a href="mailto:support@raan.app" className="text-primary hover:underline">support@raan.app</a>
              </p>
            </section>
          </div>

          {/* Bottom Nav */}
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center pb-4">
            <Link to="/privacy">
              <Button variant="outline" className="gap-2 w-full sm:w-auto border-border/50">
                <Shield className="w-4 h-4" />
                سياسة الخصوصية
              </Button>
            </Link>
            <Link to="/">
              <Button variant="ghost" className="gap-2 w-full sm:w-auto">
                <Home className="w-4 h-4" />
                العودة للرئيسية
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Terms;
