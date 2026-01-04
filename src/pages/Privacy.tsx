import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Lock, Eye, Database, UserCheck, FileText } from "lucide-react";

const Privacy = () => {
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
          <h1 className="font-bold text-lg">سياسة الخصوصية</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Content */}
      <main className="pt-20 pb-8 px-4">
        <div className="container max-w-3xl">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">سياسة خصوصية تطبيق ران</h2>
            <p className="text-muted-foreground">آخر تحديث: ديسمبر 2024</p>
          </div>

          <div className="space-y-8">
            {/* Section 1 */}
            <section className="bg-card rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">1. البيانات التي نجمعها</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4">
                نقوم بجمع البيانات التالية لتقديم خدماتنا بشكل أفضل:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span><strong>معلومات الحساب:</strong> الاسم، رقم الهاتف، البريد الإلكتروني</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span><strong>بيانات الموقع:</strong> موقعك الجغرافي أثناء استخدام التطبيق لتحديد نقاط الانطلاق والوصول</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span><strong>سجل الرحلات:</strong> تفاصيل الرحلات السابقة، التقييمات، المدفوعات</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span><strong>معلومات الجهاز:</strong> نوع الجهاز، نظام التشغيل، معرفات فريدة</span>
                </li>
              </ul>
            </section>

            {/* Section 2 */}
            <section className="bg-card rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">2. كيف نستخدم بياناتك</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4">
                نستخدم بياناتك للأغراض التالية:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>تقديم خدمات النقل وربطك بالسائقين</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>تحسين تجربة المستخدم وتطوير الخدمات</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>إرسال إشعارات حول رحلاتك والتحديثات المهمة</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>ضمان سلامة المستخدمين ومنع الاحتيال</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>الامتثال للمتطلبات القانونية</span>
                </li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="bg-card rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">3. حماية البيانات</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                نتخذ إجراءات أمنية صارمة لحماية بياناتك، تشمل التشفير أثناء النقل والتخزين، وضوابط الوصول المحددة، والمراقبة المستمرة للأنظمة. نستخدم بنية تحتية آمنة وموثوقة لتخزين البيانات مع تطبيق أفضل الممارسات في مجال أمن المعلومات.
              </p>
            </section>

            {/* Section 4 */}
            <section className="bg-card rounded-2xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">4. مشاركة البيانات</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4">
                نشارك بياناتك فقط في الحالات التالية:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span><strong>مع السائقين:</strong> اسمك ورقم هاتفك لإتمام الرحلة</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span><strong>مع مزودي الخدمات:</strong> شركاء موثوقين لمعالجة المدفوعات</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span><strong>للامتثال القانوني:</strong> عند طلب الجهات الرسمية</span>
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                <strong>لا نبيع بياناتك الشخصية لأي طرف ثالث.</strong>
              </p>
            </section>

            {/* Section 5 */}
            <section className="bg-card rounded-2xl p-6 border border-border">
              <h3 className="text-lg font-bold text-foreground mb-4">5. حقوقك</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                لديك الحقوق التالية فيما يتعلق ببياناتك:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>الوصول إلى بياناتك الشخصية</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>تصحيح البيانات غير الدقيقة</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>طلب حذف حسابك وبياناتك</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <span>إلغاء الاشتراك في الإشعارات التسويقية</span>
                </li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="bg-card rounded-2xl p-6 border border-border">
              <h3 className="text-lg font-bold text-foreground mb-4">6. ملفات تعريف الارتباط (Cookies)</h3>
              <p className="text-muted-foreground leading-relaxed">
                نستخدم ملفات تعريف الارتباط وتقنيات مشابهة لتحسين تجربتك وتذكر تفضيلاتك. يمكنك التحكم في إعدادات ملفات تعريف الارتباط من خلال إعدادات المتصفح الخاص بك.
              </p>
            </section>

            {/* Section 7 */}
            <section className="bg-card rounded-2xl p-6 border border-border">
              <h3 className="text-lg font-bold text-foreground mb-4">7. التواصل معنا</h3>
              <p className="text-muted-foreground leading-relaxed">
                لأي استفسارات حول سياسة الخصوصية أو لممارسة حقوقك، يمكنك التواصل معنا عبر:
                <br /><br />
                البريد الإلكتروني: privacy@raan.app
                <br />
                أو من خلال قسم الدعم في التطبيق
              </p>
            </section>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <Link to="/terms">
              <Button variant="outline" className="gap-2">
                <FileText className="w-4 h-4" />
                شروط الاستخدام
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
