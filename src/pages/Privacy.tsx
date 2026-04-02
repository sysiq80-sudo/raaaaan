import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Eye, Database, UserCheck, FileText, Home } from "lucide-react";
import logo from "@/assets/logo.png";

const Privacy = () => {
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
          <h1 className="font-bold text-base text-foreground">سياسة الخصوصية</h1>
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
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">سياسة خصوصية تطبيق ران</h2>
            <p className="text-muted-foreground text-sm">آخر تحديث: ديسمبر 2024م — 1446هـ</p>
          </div>

          <div className="space-y-5">
            {/* 1 */}
            <section className="bg-card rounded-2xl p-5 sm:p-6 border border-border/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">1. البيانات التي نجمعها</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4 text-sm sm:text-base">
                نقوم بجمع البيانات التالية لتقديم خدماتنا بشكل أفضل:
              </p>
              <ul className="space-y-2.5 text-muted-foreground text-sm sm:text-base">
                {[
                  { title: "معلومات الحساب:", desc: "الاسم، رقم الهاتف، البريد الإلكتروني" },
                  { title: "بيانات الموقع:", desc: "موقعك الجغرافي أثناء استخدام التطبيق لتحديد نقاط الانطلاق والوصول" },
                  { title: "سجل الرحلات:", desc: "تفاصيل الرحلات السابقة، التقييمات، المدفوعات" },
                  { title: "معلومات الجهاز:", desc: "نوع الجهاز، نظام التشغيل، معرفات فريدة" },
                ].map((item) => (
                  <li key={item.title} className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span><strong>{item.title}</strong> {item.desc}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* 2 */}
            <section className="bg-card rounded-2xl p-5 sm:p-6 border border-border/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Eye className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">2. كيف نستخدم بياناتك</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4 text-sm sm:text-base">نستخدم بياناتك للأغراض التالية:</p>
              <ul className="space-y-2.5 text-muted-foreground text-sm sm:text-base">
                {[
                  "تقديم خدمات النقل وربطك بالسائقين",
                  "تحسين تجربة المستخدم وتطوير الخدمات",
                  "إرسال إشعارات حول رحلاتك والتحديثات المهمة",
                  "ضمان سلامة المستخدمين ومنع الاحتيال",
                  "الامتثال للمتطلبات القانونية",
                ].map((item) => (
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
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">3. حماية البيانات</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                نتخذ إجراءات أمنية صارمة لحماية بياناتك، تشمل التشفير أثناء النقل والتخزين، وضوابط الوصول المحددة، والمراقبة المستمرة للأنظمة. نستخدم بنية تحتية آمنة وموثوقة مع تطبيق أفضل الممارسات في مجال أمن المعلومات.
              </p>
            </section>

            {/* 4 */}
            <section className="bg-card rounded-2xl p-5 sm:p-6 border border-border/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">4. مشاركة البيانات</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4 text-sm sm:text-base">نشارك بياناتك فقط في الحالات التالية:</p>
              <ul className="space-y-2.5 text-muted-foreground text-sm sm:text-base">
                {[
                  { title: "مع السائقين:", desc: "اسمك ورقم هاتفك لإتمام الرحلة" },
                  { title: "مع مزودي الخدمات:", desc: "شركاء موثوقين لمعالجة المدفوعات" },
                  { title: "للامتثال القانوني:", desc: "عند طلب الجهات الرسمية" },
                ].map((item) => (
                  <li key={item.title} className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span><strong>{item.title}</strong> {item.desc}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4 text-sm sm:text-base font-semibold text-foreground/80">
                لا نبيع بياناتك الشخصية لأي طرف ثالث.
              </p>
            </section>

            {/* 5 */}
            <section className="bg-card rounded-2xl p-5 sm:p-6 border border-border/50">
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-3">5. حقوقك</h3>
              <p className="text-muted-foreground leading-relaxed mb-4 text-sm sm:text-base">لديك الحقوق التالية فيما يتعلق ببياناتك:</p>
              <ul className="space-y-2.5 text-muted-foreground text-sm sm:text-base">
                {[
                  "الوصول إلى بياناتك الشخصية",
                  "تصحيح البيانات غير الدقيقة",
                  "طلب حذف حسابك وبياناتك",
                  "إلغاء الاشتراك في الإشعارات التسويقية",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* 6 */}
            <section className="bg-card rounded-2xl p-5 sm:p-6 border border-border/50">
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-3">6. ملفات تعريف الارتباط (Cookies)</h3>
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                نستخدم ملفات تعريف الارتباط وتقنيات مشابهة لتحسين تجربتك وتذكر تفضيلاتك. يمكنك التحكم في إعداداتها من خلال متصفحك.
              </p>
            </section>

            {/* 7 */}
            <section className="bg-card rounded-2xl p-5 sm:p-6 border border-border/50">
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-3">7. التواصل معنا</h3>
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                لأي استفسارات حول سياسة الخصوصية أو لممارسة حقوقك، تواصل معنا عبر:{" "}
                <a href="mailto:privacy@raan.app" className="text-primary hover:underline">privacy@raan.app</a>
                {" "}أو من خلال قسم الدعم في التطبيق.
              </p>
            </section>
          </div>

          {/* Bottom Nav */}
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center pb-4">
            <Link to="/terms">
              <Button variant="outline" className="gap-2 w-full sm:w-auto border-border/50">
                <FileText className="w-4 h-4" />
                شروط الاستخدام
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

export default Privacy;
