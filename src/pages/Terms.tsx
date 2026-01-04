import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, FileText, AlertCircle, CheckCircle } from "lucide-react";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container flex items-center justify-between h-16">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="font-bold text-lg">شروط الاستخدام</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Content */}
      <main className="pt-20 pb-8 px-4">
        <div className="container max-w-3xl">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">شروط استخدام تطبيق ران</h2>
            <p className="text-muted-foreground">آخر تحديث: ديسمبر 2024</p>
          </div>

          <div className="space-y-8">
            {/* Section 1 */}
            <section className="bg-card rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">1. القبول بالشروط</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                باستخدامك لتطبيق ران، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي جزء من هذه الشروط، يرجى عدم استخدام التطبيق. نحتفظ بالحق في تعديل هذه الشروط في أي وقت، وسيتم إخطارك بأي تغييرات جوهرية.
              </p>
            </section>

            {/* Section 2 */}
            <section className="bg-card rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">2. الخدمات المقدمة</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4">
                يوفر تطبيق ران منصة لربط الركاب بالسائقين المسجلين. نحن نعمل كوسيط تقني ولا نقدم خدمات النقل مباشرة. تشمل خدماتنا:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>حجز رحلات التوصيل داخل مناطق الخدمة</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>تتبع الرحلات في الوقت الفعلي</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>نظام دفع متعدد الخيارات</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>نظام تقييم للسائقين والركاب</span>
                </li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="bg-card rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">3. مسؤوليات المستخدم</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4">
                بصفتك مستخدمًا لتطبيق ران، فإنك توافق على:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>تقديم معلومات صحيحة ودقيقة عند التسجيل</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>الحفاظ على سرية بيانات حسابك</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>احترام السائقين والتعامل معهم بلطف</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>دفع الأجرة المتفق عليها بالكامل</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>عدم استخدام التطبيق لأغراض غير قانونية</span>
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="bg-card rounded-2xl p-6 border border-border">
              <h3 className="text-lg font-bold text-foreground mb-4">4. سياسة الإلغاء</h3>
              <p className="text-muted-foreground leading-relaxed">
                يمكنك إلغاء الرحلة قبل وصول السائق دون أي رسوم. في حال الإلغاء المتكرر أو الإلغاء بعد وصول السائق، قد يتم تطبيق رسوم إلغاء. نحتفظ بالحق في إيقاف الحسابات التي تسيء استخدام نظام الإلغاء.
              </p>
            </section>

            {/* Section 5 */}
            <section className="bg-card rounded-2xl p-6 border border-border">
              <h3 className="text-lg font-bold text-foreground mb-4">5. المسؤولية القانونية</h3>
              <p className="text-muted-foreground leading-relaxed">
                تطبيق ران غير مسؤول عن أي أضرار مباشرة أو غير مباشرة ناتجة عن استخدام الخدمة، بما في ذلك التأخير أو الحوادث أو فقدان الممتلكات. السائقون مقاولون مستقلون وليسوا موظفين لدى ران.
              </p>
            </section>

            {/* Section 6 */}
            <section className="bg-card rounded-2xl p-6 border border-border">
              <h3 className="text-lg font-bold text-foreground mb-4">6. التواصل معنا</h3>
              <p className="text-muted-foreground leading-relaxed">
                لأي استفسارات حول شروط الاستخدام، يمكنك التواصل معنا عبر قسم الدعم في التطبيق أو عبر البريد الإلكتروني: support@raan.app
              </p>
            </section>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <Link to="/privacy">
              <Button variant="outline" className="gap-2">
                <Shield className="w-4 h-4" />
                سياسة الخصوصية
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Terms;
