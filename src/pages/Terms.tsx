import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, FileText, AlertCircle, CheckCircle, Home, Scale, ChevronRight } from "lucide-react";
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
    <div className="min-h-screen bg-[#0a0f1c] text-white relative overflow-hidden font-sans" dir="rtl">
      {/* Ambient Premium Glows */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none -translate-y-1/3 translate-x-1/4" />
      <div className="absolute bottom-1/4 left-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none translate-y-1/2 -translate-x-1/3" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>

      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#0a0f1c]/70 backdrop-blur-2xl">
        <div className="container max-w-5xl flex items-center justify-between h-20 px-6">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/30 rounded-xl blur-md group-hover:blur-lg transition-all opacity-0 group-hover:opacity-100" />
              <img src={logo} alt="RAAN" className="h-10 w-10 rounded-xl relative z-10 border border-white/10" />
            </div>
            <span className="font-extrabold text-xl tracking-tight">ران <span className="text-emerald-400">RAAN</span></span>
          </Link>
          <div className="hidden sm:block absolute left-1/2 -translate-x-1/2">
            <h1 className="font-bold text-lg text-slate-200">الشروط والأحكام</h1>
          </div>
          <Link to="/">
            <Button variant="ghost" className="gap-2 text-slate-300 hover:text-white hover:bg-white/5 transition-all rounded-full px-5">
              <span className="hidden sm:inline font-bold">الرئيسية</span>
              <Home className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="pt-32 pb-24 px-4 sm:px-6 relative z-10">
        <div className="container max-w-3xl mx-auto">
          
          {/* Hero Section */}
          <div className="text-center mb-16 animate-fade-up">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-emerald-500/20 blur-[30px] rounded-full" />
              <div className="w-24 h-24 relative mx-auto rounded-[2rem] bg-gradient-to-b from-emerald-500/20 to-transparent border border-emerald-500/30 flex items-center justify-center shadow-2xl backdrop-blur-md">
                <Scale className="w-10 h-10 text-emerald-400" />
              </div>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight">
              شروط الاستخدام
            </h2>
            <div className="inline-flex items-center justify-center px-5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 shrink-0 animate-pulse" />
              <p className="text-slate-300 text-sm font-medium mr-2">آخر تحديث: 12 ديسمبر 2024م</p>
            </div>
          </div>

          <div className="space-y-6 sm:space-y-8">
            
            {/* Rule 1 */}
            <section className="bg-[#121b2b]/60 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border border-white/5 hover:border-emerald-500/20 hover:bg-[#121b2b]/80 transition-all duration-300 shadow-xl group">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white">القبول بالشروط</h3>
              </div>
              <p className="text-slate-300 leading-relaxed text-[15px] sm:text-base">
                باستخدامك لتطبيق ران بطرحه الجديد، فإنك توافق بشكل كامل على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي جزء من هذه الشروط، يرجى عدم استكمال عملية التسجيل أو استخدام التطبيق. نحن نحتفظ بالحق المطلق في تعديل وتحديث هذه الشروط في أي وقت لتحسين جودة الخدمة.
              </p>
            </section>

            {/* Rule 2 */}
            <section className="bg-[#121b2b]/60 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border border-white/5 hover:border-emerald-500/20 hover:bg-[#121b2b]/80 transition-all duration-300 shadow-xl group">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <Shield className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white">الخدمات المقدمة</h3>
              </div>
              <p className="text-slate-300 leading-relaxed mb-5 text-[15px] sm:text-base">
                تطبيق ران منصة تقنية رائدة مدعومة بالذكاء الاصطناعي تعمل كوسيط تقني مبتكر لربط الركاب بالسائقين. نحن نسخر أحدث التقنيات لتقديم:
              </p>
              <ul className="space-y-4 text-slate-300 text-[15px] sm:text-base">
                {[
                  "حجز رحلات آمنة وسريعة باستخدام الأوامر الصوتية",
                  "تتبع الرحلة والمركبات في الوقت الفعلي بدقة متناهية",
                  "بوابات دفع آمنة تشمل وسائل إلكترونية ونقدية",
                  "نظام سمعة متكامل وتقييم احترافي لضمان أعلى معايير الجودة",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                      <ChevronRight className="w-3 h-3 text-emerald-400" />
                    </span>
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Rule 3 */}
            <section className="bg-[#121b2b]/60 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border border-white/5 hover:border-emerald-500/20 hover:bg-[#121b2b]/80 transition-all duration-300 shadow-xl group">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <AlertCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white">مسؤوليات المستخدم</h3>
              </div>
              <p className="text-slate-300 leading-relaxed mb-5 text-[15px] sm:text-base">بصفتك مستخدماً لمنظومة ران الفاخرة، فإنك توافق وتتعهد بـ:</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-300 text-[15px] sm:text-base">
                {[
                  "تقديم معلومات صحيحة ودقيقة",
                  "الحفاظ على سرية بياناتك",
                  "الالتزام بالسلوك الراقي",
                  "دفع الأجرة المتفق عليها فوراً",
                  "عدم التلاعب بالنظام",
                  "الإبلاغ عن المشكلات العاجلة",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    <span className="font-semibold">{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Rule 4 */}
            <section className="bg-[#121b2b]/60 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border border-white/5 hover:border-emerald-500/20 hover:bg-[#121b2b]/80 transition-all duration-300 shadow-xl group">
              <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-4">سياسة الإلغاء والمسؤولية القانوينة</h3>
              <p className="text-slate-300 leading-relaxed text-[15px] sm:text-base mb-4">
                في منصة ران المرنة، يمكنك إلغاء الرحلة قبل وصول السائق دون أي رسوم تجسيداً لحسن النية. ولكن في حال تكرار عمليات الإلغاء بعد انطلاق السائق وتقطعه لمسافات، قد يطبق النظام بشكل تلقائي رسوماً تعويضية وتنبيهات تنظيمية للحفاظ على حقوق السائقين.
              </p>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm sm:text-[15px] text-red-200">
                  يرجى ملاحظة أن السائقين لدينا هم شركاء مستقلون. لا تتحمل ران مسؤولية قانونية مباشرة تجاه الأضرار العرضية ولكننا نضمن اتخاذ كافة الإجراءات الصارمة ضد المخالفين لحماية المستخدم.
                </p>
              </div>
            </section>

            {/* Rule 5 */}
            <section className="bg-gradient-to-br from-[#121b2b] to-[#152033] backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border border-white/5 text-center shadow-lg">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-3">هل لديك استفسارات قانونية؟</h3>
              <p className="text-slate-400 leading-relaxed text-sm sm:text-base mb-6 max-w-lg mx-auto">
                فريقنا القانوني وفريق الدعم على أتم الاستعداد للإجابة على استفساراتكم على مدار الساعة.
              </p>
              <a href="mailto:support@raan.app" className="inline-flex items-center justify-center px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold rounded-full transition-all">
                support@raan.app
              </a>
            </section>
          </div>

          {/* Bottom Nav Action */}
          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/privacy" className="w-full sm:w-auto">
              <Button className="w-full h-14 px-8 bg-emerald-400 hover:bg-emerald-500 text-[#064e3b] font-extrabold text-[16px] rounded-full shadow-[0_0_24px_rgba(52,211,153,0.3)] transition-all flex items-center justify-center gap-2">
                <Shield className="w-5 h-5" />
                قرأت الشروط، اعرض الخصوصية
              </Button>
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Terms;
