/**
 * ران - دليل عائلة ران
 * صفحة شرح النظام الخاص بالسائقين
 * تظهر فقط للسائقين المسجلين
 */

import { useNavigate } from "react-router-dom";
import { 
  ArrowRight,
  Wifi, 
  WifiOff, 
  Coffee,
  MapPin,
  Navigation,
  Bell,
  CheckCircle2,
  XCircle,
  Clock,
  Wallet,
  Star,
  Shield,
  Zap,
  Car,
  Users,
  Phone,
  HelpCircle,
  ChevronDown,
  Sparkles,
  Route,
  Target,
  TrendingUp
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Accordion Section
const GuideSection = ({ 
  icon, 
  title, 
  children, 
  defaultOpen = false,
  accentColor = "emerald"
}: { 
  icon: React.ReactNode; 
  title: string; 
  children: React.ReactNode;
  defaultOpen?: boolean;
  accentColor?: string;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  const colorMap: Record<string, string> = {
    emerald: "from-emerald-500/15 to-emerald-600/5 border-emerald-500/20",
    amber: "from-amber-500/15 to-amber-600/5 border-amber-500/20",
    blue: "from-blue-500/15 to-blue-600/5 border-blue-500/20",
    purple: "from-purple-500/15 to-purple-600/5 border-purple-500/20",
    red: "from-red-500/15 to-red-600/5 border-red-500/20",
    yellow: "from-yellow-500/15 to-yellow-600/5 border-yellow-500/20",
  };

  return (
    <Card className="border-none shadow-md rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 p-4 bg-gradient-to-r ${colorMap[accentColor] || colorMap.emerald} transition-all duration-300`}
      >
        <div className="shrink-0">{icon}</div>
        <span className="flex-1 text-right font-bold text-foreground text-sm">{title}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <CardContent className="p-4 pt-2 text-sm leading-relaxed text-muted-foreground space-y-3">
              {children}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

// Status Badge
const StatusItem = ({ 
  icon, 
  label, 
  description, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  description: string;
  color: string;
}) => (
  <div className={`flex items-start gap-3 p-3 rounded-xl bg-${color}-500/10 border border-${color}-500/20`}>
    <div className="shrink-0 mt-0.5">{icon}</div>
    <div>
      <p className={`font-bold text-${color}-500 text-sm`}>{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
  </div>
);

// Step Item
const StepItem = ({ 
  number, 
  title, 
  description 
}: { 
  number: number; 
  title: string; 
  description: string;
}) => (
  <div className="flex items-start gap-3">
    <div className="w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
      {number}
    </div>
    <div>
      <p className="font-bold text-foreground text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
  </div>
);

const DriverGuide = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-emerald-950/5">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-card hover:bg-accent transition-colors"
            aria-label="رجوع"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              خاص لعائلة ران
            </h1>
            <p className="text-xs text-muted-foreground">دليل شامل لنظام السائق</p>
          </div>
        </div>
      </header>

      {/* Welcome Banner */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-5 text-white shadow-xl">
          <div className="relative z-10">
            <h2 className="text-xl font-black mb-1">مرحباً بك في عائلة ران 🚕</h2>
            <p className="text-emerald-100 text-sm leading-relaxed">
              هذا الدليل يشرح لك كيفية استخدام التطبيق واستقبال الطلبات وإدارة رحلاتك بكل سهولة.
            </p>
          </div>
          {/* Decorative circles */}
          <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-white/5" />
          <div className="absolute -bottom-12 -right-12 w-40 h-40 rounded-full bg-white/5" />
        </div>
      </div>

      {/* Guide Sections */}
      <div className="px-4 py-4 space-y-3 pb-24">

        {/* 1. حالات السائق */}
        <GuideSection
          icon={<Wifi className="w-5 h-5 text-emerald-500" />}
          title="حالات السائق الثلاث"
          defaultOpen={true}
          accentColor="emerald"
        >
          <p className="text-foreground font-medium">لديك ثلاث حالات أساسية:</p>
          
          <StatusItem
            icon={<Wifi className="w-4 h-4 text-emerald-500" />}
            label="متصل ✅"
            description="أنت جاهز لاستقبال الطلبات. الموقع يُتتبع والنظام يبحث لك عن ركاب قريبين."
            color="emerald"
          />
          
          <StatusItem
            icon={<Coffee className="w-4 h-4 text-amber-500" />}
            label="مشغول ☕"
            description="أنت لا تزال متصلاً لكن لا تريد طلبات مؤقتاً (استراحة، تزود بالوقود). اضغط 'استئناف' للعودة فوراً."
            color="amber"
          />
          
          <StatusItem
            icon={<WifiOff className="w-4 h-4 text-slate-400" />}
            label="غير متصل ⚫"
            description="خرجت من النظام بالكامل. لا موقع، لا طلبات. تحتاج تضغط زر التشغيل لإعادة الاتصال."
            color="slate"
          />
        </GuideSection>

        {/* 2. كيف تبدأ يومك */}
        <GuideSection
          icon={<Target className="w-5 h-5 text-blue-500" />}
          title="كيف تبدأ يومك؟"
          accentColor="blue"
        >
          <StepItem
            number={1}
            title="افتح التطبيق"
            description="سيظهر لك الزر الكبير في وسط الشاشة."
          />
          <StepItem
            number={2}
            title="اضغط زر التشغيل"
            description="الزر الأخضر الكبير — سيتحول للون الأخضر وتبدأ حالة 'متصل'."
          />
          <StepItem
            number={3}
            title="انتظر الطلبات"
            description="ستظهر لك بطاقة 'طلب جديد' عندما يطلب راكب قريب منك."
          />
          <StepItem
            number={4}
            title="اقبل أو تخطَّ"
            description="اضغط 'قبول' لبدء الرحلة أو 'تخطي' للانتظار لطلب آخر."
          />
        </GuideSection>

        {/* 3. استقبال الطلبات */}
        <GuideSection
          icon={<Bell className="w-5 h-5 text-amber-500" />}
          title="استقبال وقبول الطلبات"
          accentColor="amber"
        >
          <div className="space-y-2">
            <p className="text-foreground font-medium">عندما يصلك طلب جديد:</p>
            <ul className="space-y-2 pr-2">
              <li className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>يظهر صوت تنبيه واهتزاز لتنبيهك.</span>
              </li>
              <li className="flex items-start gap-2">
                <Wallet className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>الأجرة المقدرة بالأخضر الكبير في الأعلى.</span>
              </li>
              <li className="flex items-start gap-2">
                <Route className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span>المسافة والمدة المتوقعة للرحلة.</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>نقطة الانطلاق (أخضر) والوجهة (أحمر).</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>العداد في الأعلى — بعد انتهائه يبقى الطلب ظاهراً حتى تتخذ إجراء.</span>
              </li>
            </ul>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="font-bold text-emerald-500 text-xs">زر القبول</span>
            </div>
            <p className="text-xs">الزر الأخضر الكبير — اضغطه لقبول الرحلة والبدء بالتوجه لنقطة الانطلاق.</p>
          </div>
          
          <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-slate-400" />
              <span className="font-bold text-slate-400 text-xs">زر التخطي</span>
            </div>
            <p className="text-xs">اضغطه إذا لا تريد هذا الطلب — سيختفي وتنتظر طلب آخر.</p>
          </div>
        </GuideSection>

        {/* 4. مراحل الرحلة */}
        <GuideSection
          icon={<Navigation className="w-5 h-5 text-purple-500" />}
          title="مراحل الرحلة"
          accentColor="purple"
        >
          <StepItem
            number={1}
            title="متجه للراكب"
            description="بعد القبول، انطلق لنقطة الانطلاق. يمكنك الضغط على العنوان لفتح الملاحة."
          />
          <StepItem
            number={2}
            title="وصلت"
            description="عند وصولك لنقطة الانطلاق، اضغط 'وصلت' لإبلاغ الراكب."
          />
          <StepItem
            number={3}
            title="ركب الراكب → بدء الرحلة"
            description="عندما يركب الراكب، اضغط 'بدء الرحلة' لتبدأ الرحلة فعلياً."
          />
          <StepItem
            number={4}
            title="إنهاء الرحلة"
            description="عند الوصول للوجهة، اضغط 'إنهاء الرحلة'. ستظهر لك تفاصيل الأجرة النهائية."
          />
          
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="font-bold text-red-500 text-xs">إلغاء الرحلة</span>
            </div>
            <p className="text-xs">يمكنك إلغاء الرحلة قبل أن يركب الراكب. الإلغاء المتكرر قد يؤثر على تقييمك.</p>
          </div>
        </GuideSection>

        {/* 5. الأرباح والعمولة */}
        <GuideSection
          icon={<Wallet className="w-5 h-5 text-emerald-500" />}
          title="الأرباح والعمولة"
          accentColor="emerald"
        >
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>أرباحك = الأجرة النهائية - عمولة ران.</span>
            </div>
            <div className="flex items-start gap-2">
              <Target className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span>يتم تحديد هدف يومي ديناميكي بناءً على أدائك في الأسبوع الماضي.</span>
            </div>
            <div className="flex items-start gap-2">
              <Star className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>كلما أكملت رحلات أكثر، زادت مكافآتك وحوافزك.</span>
            </div>
          </div>
          
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <p className="text-xs">
              💡 <strong>نصيحة:</strong> تابع أرباحك اليومية من القائمة الجانبية → الأرباح. الهدف اليومي يساعدك على زيادة دخلك.
            </p>
          </div>
        </GuideSection>

        {/* 6. التقييم */}
        <GuideSection
          icon={<Star className="w-5 h-5 text-yellow-500" />}
          title="التقييم وكيف تحسّنه"
          accentColor="yellow"
        >
          <div className="space-y-2">
            <p className="text-foreground font-medium">تقييمك مهم لأنه:</p>
            <ul className="space-y-1.5 pr-2">
              <li className="flex items-start gap-2">
                <span className="text-amber-500">•</span>
                <span>يؤثر على أولوية حصولك على الطلبات.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500">•</span>
                <span>التقييم المنخفض قد يؤدي لتقليل عدد الطلبات.</span>
              </li>
            </ul>
            
            <p className="text-foreground font-medium mt-3">كيف تحسّن تقييمك:</p>
            <ul className="space-y-1.5 pr-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>كن ودوداً ومحترماً مع الركاب.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>حافظ على نظافة السيارة.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>التزم بالطريق الأقصر.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>تجنب الإلغاء المتكرر للرحلات.</span>
              </li>
            </ul>
          </div>
        </GuideSection>

        {/* 7. الأمان */}
        <GuideSection
          icon={<Shield className="w-5 h-5 text-red-500" />}
          title="الأمان والسلامة"
          accentColor="red"
        >
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>تأكد دائماً من هوية الراكب قبل بدء الرحلة.</span>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span>يمكنك الاتصال بالراكب من خلال التطبيق.</span>
            </div>
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>في حالة الطوارئ، تواصل مع الدعم الفني فوراً.</span>
            </div>
          </div>
          
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <p className="text-xs">
              🚨 <strong>مهم:</strong> سلامتك أولاً! لا تقبل رحلات تشعر أنها غير آمنة. يمكنك الإلغاء في أي وقت.
            </p>
          </div>
        </GuideSection>

        {/* 8. نصائح لزيادة الدخل */}
        <GuideSection
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
          title="نصائح لزيادة دخلك"
          accentColor="emerald"
        >
          <div className="space-y-2.5">
            <div className="flex items-start gap-2">
              <span className="text-lg">🕐</span>
              <div>
                <p className="font-bold text-foreground text-xs">أوقات الذروة</p>
                <p className="text-xs">اعمل في أوقات الذروة (7-9 صباحاً، 12-2 ظهراً، 5-8 مساءً) لمزيد من الطلبات.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-lg">📍</span>
              <div>
                <p className="font-bold text-foreground text-xs">المناطق الحيوية</p>
                <p className="text-xs">تمركز قرب المولات، الجامعات، والمناطق التجارية.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-lg">⭐</span>
              <div>
                <p className="font-bold text-foreground text-xs">حافظ على تقييمك</p>
                <p className="text-xs">تقييم عالي = أولوية أعلى في استقبال الطلبات.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-lg">🔋</span>
              <div>
                <p className="font-bold text-foreground text-xs">ابقَ متصلاً</p>
                <p className="text-xs">كلما بقيت متصلاً أطول، زادت فرصك في الحصول على طلبات.</p>
              </div>
            </div>
          </div>
        </GuideSection>

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Car className="w-5 h-5 text-emerald-500" />
            <Users className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-sm font-bold text-foreground">عائلة ران — معاً نوصّل العراق 🇮🇶</p>
          <p className="text-xs text-muted-foreground mt-1">لأي استفسار، تواصل مع الدعم الفني</p>
        </div>

      </div>
    </div>
  );
};

export default DriverGuide;
