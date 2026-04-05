import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Eye, Database, UserCheck, FileText, Home, ChevronRight, Fingerprint } from "lucide-react";
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
    <div className="min-h-screen bg-[#0a0f1c] text-white relative overflow-hidden font-sans" dir="rtl">
      {/* Ambient Premium Glows */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none -translate-y-1/3 -translate-x-1/4" />
      <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-[#1a2333]/40 rounded-full blur-[150px] pointer-events-none translate-y-1/2 translate-x-1/3" />
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
            <h1 className="font-bold text-lg text-slate-200">سياسة الخصوصية</h1>
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
                <Fingerprint className="w-10 h-10 text-emerald-400" />
              </div>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight">
              سياسة الخصوصية
            </h2>
            <div className="inline-flex items-center justify-center px-5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 shrink-0 animate-pulse" />
              <p className="text-slate-300 text-sm font-medium mr-2">تحديث: 12 ديسمبر 2024م</p>
            </div>
          </div>

          <div className="space-y-6 sm:space-y-8">
            
            {/* Sec 1 */}
            <section className="bg-[#121b2b]/60 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border border-white/5 hover:border-emerald-500/20 hover:bg-[#121b2b]/80 transition-all duration-300 shadow-xl group">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <Database className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white">البيانات التي نجمعها</h3>
              </div>
              <p className="text-slate-300 leading-relaxed mb-5 text-[15px] sm:text-base">
                نستخدم أحدث تقنيات تجميع البيانات بشكل دقيق بهدف الارتقاء بتجربتك الفاخرة، ونلتزم بالشفافية الكاملة. نجمع البيانات التالية:
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-300 text-[15px] sm:text-base">
                {[
                  { title: "معلومات شخصية:", desc: "الاسم ورقم الجوال" },
                  { title: "بيانات الإحداثيات:", desc: "مواقع الانطلاق والوصول" },
                  { title: "بصمة الجهاز:", desc: "معلومات الجهاز ونظامه" },
                  { title: "سجل النشاط:", desc: "الرحلات السابقة والتقييمات" },
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 bg-white/5 p-4 rounded-[1.25rem] border border-white/5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 mt-2 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    <div>
                      <strong className="text-white block mb-0.5">{item.title}</strong>
                      <span className="text-slate-400 text-sm">{item.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Sec 2 */}
            <section className="bg-[#121b2b]/60 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border border-white/5 hover:border-emerald-500/20 hover:bg-[#121b2b]/80 transition-all duration-300 shadow-xl group">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <Eye className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white">كيف نستخدم بياناتك المُدرجة</h3>
              </div>
              <ul className="space-y-4 text-slate-300 text-[15px] sm:text-base">
                {[
                  "الربط الفوري الذكي بين الكابتن والراكب",
                  "تخصيص الواجهة وتحسين اقتراحات الذكاء الاصطناعي",
                  "إشعارات دقيقة لحالة رحلتك",
                  "تحليل السلوكيات لمنع الاحتيال وتعزيز الأمان (Trust & Safety)",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                      <ChevronRight className="w-3 h-3 text-emerald-400" />
                    </span>
                    <span className="font-medium text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Sec 3 */}
            <section className="bg-[#121b2b]/60 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border border-white/5 hover:border-emerald-500/20 hover:bg-[#121b2b]/80 transition-all duration-300 shadow-xl group">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <Lock className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white">منظومة الحماية القصوى</h3>
              </div>
              <p className="text-slate-300 leading-relaxed text-[15px] sm:text-base">
                بياناتك ليست مجرد معلومات، بل هي أمانة. نحن نعالج بياناتك في بيئة مشفرة من النهاية إلى النهاية باستخدام بروتوكولات آمنة حديثة وخوادم خاضعة لمراقبة أمنية متواصلة (24/7). وصول فريق التطوير إلى هذه البيانات مقيد بأقصى درجات الحزم لضمان عدم المساس بها بأي شكل.
              </p>
            </section>

            {/* Sec 4 */}
            <section className="bg-[#121b2b]/60 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 border border-white/5 hover:border-emerald-500/20 hover:bg-[#121b2b]/80 transition-all duration-300 shadow-xl group">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white">قيود مشاركة البيانات</h3>
              </div>
              <p className="text-slate-300 leading-relaxed mb-5 text-[15px] sm:text-base">نشارك بياناتك في حدود ضيقة جداً وللضرورة القصوى فقط:</p>
              <div className="flex flex-col gap-3">
                {[
                  { title: "مع شركاء التوصيل:", desc: "يتم مشاركة رقمك واسمك مع الكابتن عند مطابقة الرحلة وفقط لفترة الرحلة" },
                  { title: "الأطراف الثالثة المؤمنة:", desc: "ميسري عمليات الدفع والمصارف المعتمدة حصراً" },
                  { title: "الجهات القانونية:", desc: "إذا طُلب منا ذلك بشكل قانوني للامتثال أو لضمان الأمن القومي" },
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-3 bg-white/5 p-4 rounded-[1rem] border border-white/5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 mt-2 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    <div>
                      <strong className="text-emerald-300 block mb-1">{item.title}</strong>
                      <span className="text-slate-300 text-[15px]">{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3 justify-center text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
                <p className="text-white font-bold text-sm sm:text-base">لا نبيع بياناتك الشخصية لأي جهة إعلانية أو تجارية، قرار نهائي غير قابل للتبديل.</p>
              </div>
            </section>

          </div>

          {/* Bottom Nav Action */}
          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/terms" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full h-14 px-8 border-white/10 hover:bg-white/5 text-white font-bold text-[16px] rounded-full transition-all flex items-center justify-center gap-2">
                <FileText className="w-5 h-5 text-slate-400" />
                قراءة شروط الاستخدام
              </Button>
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Privacy;
