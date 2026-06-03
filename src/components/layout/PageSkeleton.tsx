/**
 * ران — PageSkeleton
 *
 * هيكل انتظار (Skeleton Screen) متطور يظهر أثناء تحميل الصفحات
 * يحاكي تخطيط الصفحة الحقيقي ويستخدم تأثير الشيمر (Shimmer) السريع
 * لمنح إحساس بالسرعة والانسيابية، ويمنع الوميض الأبيض تماماً.
 */
import { memo } from "react";

interface PageSkeletonProps {
  /** عدد الأسطر الوهمية في حالة القائمة */
  rows?: number;
  /** إظهار رأس الصفحة الوهمي */
  showHeader?: boolean;
  /** نوع التخطيط لتطابق الصفحة الفعلية */
  layout?: "list" | "map" | "voice";
}

const SkeletonBlock = ({ className, style }: { className: string; style?: React.CSSProperties }) => (
  <div
    className={`raan-shimmer-bg ${className}`}
    style={style}
  />
);

// 🗺️ تخطيط الخريطة (مثالي لصفحة GoPage و الخرائط)
const MapSkeleton = () => (
  <div className="w-full h-full flex flex-col justify-between p-4 relative overflow-hidden" style={{ minHeight: "100vh" }}>
    {/* خلفية تحاكي شبكة الخريطة مع توهج خفيف */}
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] rounded-full bg-[#3b82f6]/[0.02] blur-[80px]" />
      <div className="absolute bottom-[30%] right-[10%] w-[250px] h-[250px] rounded-full bg-emerald-500/[0.01] blur-[70px]" />
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)
        `,
        backgroundSize: "45px 45px"
      }} />
      <div className="absolute top-[40%] left-0 w-full h-[2px] bg-white/[0.02] -rotate-12" />
      <div className="absolute top-[60%] left-0 w-full h-[2px] bg-white/[0.02] rotate-6" />
      <div className="absolute top-0 left-[30%] w-[2px] h-full bg-white/[0.02] rotate-12" />
    </div>

    {/* لوحة البحث العائمة في الأعلى */}
    <div className="w-full rounded-3xl p-5 bg-[#0f172a]/90 backdrop-blur-md border border-white/[0.04] shadow-2xl flex flex-col gap-4 relative z-10">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-[#3b82f6]/40 shrink-0" />
        <SkeletonBlock className="h-4.5 w-3/4 rounded-lg" />
      </div>
      <div className="h-[1px] bg-white/[0.06] mx-6" />
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-emerald-500/40 shrink-0" />
        <SkeletonBlock className="h-4.5 w-1/2 rounded-lg" />
      </div>
    </div>

    {/* علامة الموقع في منتصف الشاشة (أزرق هادئ بدون نبض وموجات) */}
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center border border-[#3b82f6]/20">
        <div className="w-3 h-3 rounded-full bg-[#3b82f6]" />
      </div>
    </div>

    {/* اللوحة السفلية لاختيار السيارات */}
    <div className="w-full rounded-t-3xl p-6 bg-[#0f172a]/95 backdrop-blur-lg border-t border-white/[0.06] shadow-[0_-15px_40px_rgba(0,0,0,0.4)] flex flex-col gap-5 relative z-10">
      <div className="flex justify-between items-center">
        <SkeletonBlock className="h-5 w-24 rounded-lg" />
        <SkeletonBlock className="h-4.5 w-16 rounded-lg opacity-60" />
      </div>

      {/* خيارات فئات السيارات */}
      <div className="flex gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex-1 p-4 rounded-2xl border border-white/[0.03] bg-white/[0.01] flex flex-col gap-3.5 items-center">
            <SkeletonBlock className="w-12 h-9 rounded-xl" />
            <SkeletonBlock className="h-3 w-12 rounded-md" />
            <SkeletonBlock className="h-3 w-8 rounded-md opacity-60" />
          </div>
        ))}
      </div>

      {/* زر الحجز الرئيسي */}
      <SkeletonBlock className="w-full h-14 rounded-2xl" />
    </div>
  </div>
);

// 🎤 تخطيط الصوت والواجهة الرئيسية (AIVoiceHome)
const VoiceSkeleton = () => (
  <div className="w-full h-full flex flex-col justify-between p-4 relative overflow-hidden" style={{ minHeight: "100vh", background: "linear-gradient(170deg, #060d18 0%, #0b1326 40%, #091120 100%)" }}>
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-[-5%] right-[-10%] w-[320px] h-[320px] rounded-full bg-[#5bdda6]/[0.03] blur-[90px]" />
      <div className="absolute bottom-[20%] right-[10%] w-[280px] h-[280px] rounded-full bg-[#5bdda6]/[0.02] blur-[100px]" />
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `
          linear-gradient(rgba(91,221,166,0.3) 1px, transparent 1px),
          linear-gradient(90deg, rgba(91,221,166,0.3) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
      }} />
    </div>

    {/* زر القائمة الجانبية */}
    <div className="flex justify-end p-2 z-10">
      <SkeletonBlock className="w-10 h-10 rounded-xl" />
    </div>

    {/* منطقة الميكروفون والعنوان */}
    <div className="flex-1 flex flex-col items-center justify-center gap-9 z-10 -translate-y-6">
      <div className="text-center space-y-3">
        <SkeletonBlock className="h-8 w-44 mx-auto rounded-xl" />
        <SkeletonBlock className="h-4.5 w-32 mx-auto rounded-lg opacity-40" />
      </div>

      {/* المايكروفون الوهمي */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-36 h-36 rounded-full border border-[#5bdda6]/10 animate-pulse" />
        <SkeletonBlock className="w-28 h-28 rounded-full" />
      </div>

      <SkeletonBlock className="h-4.5 w-28 rounded-lg opacity-35" />
    </div>

    {/* اللوحة السفلية للأماكن المحفوظة وزر الخريطة */}
    <div className="w-full rounded-t-3xl p-5 bg-[#0b1326]/98 border-t border-[#5bdda6]/10 flex flex-col gap-5 z-10">
      <div className="flex justify-center">
        <div className="w-12 h-1 bg-white/10 rounded-full" />
      </div>
      <div className="flex gap-3.5 justify-center">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 w-14">
            <SkeletonBlock className="w-12 h-12 rounded-2xl" />
            <SkeletonBlock className="h-2.5 w-10 rounded-md opacity-50" />
          </div>
        ))}
      </div>
      <SkeletonBlock className="w-full h-14 rounded-2xl" />
    </div>
  </div>
);

// 📄 تخطيط القائمة الافتراضي (لصفحات الرحلات، المحفظة، الإعدادات...)
const ListSkeleton = ({ rows, showHeader }: { rows: number; showHeader: boolean }) => (
  <div className="w-full h-full flex flex-col gap-5 px-4 overflow-hidden" style={{ minHeight: "100vh" }}>
    {/* رأس الصفحة */}
    {showHeader && (
      <div className="flex items-center justify-between mb-1 shrink-0">
        <SkeletonBlock className="h-6 w-28 rounded-xl" />
        <SkeletonBlock className="h-9 w-9 rounded-2xl" />
      </div>
    )}

    {/* بطاقة رئيسية وهمية للمحتوى البارز */}
    {rows > 1 && (
      <div className="w-full h-32 rounded-3xl p-5 flex flex-col justify-between border border-white/[0.01] bg-[#0e172a] shrink-0">
        <SkeletonBlock className="h-4.5 w-1/3 rounded-lg" />
        <div className="flex gap-2.5">
          <SkeletonBlock className="h-8 w-20 rounded-xl" />
          <SkeletonBlock className="h-8 w-16 rounded-xl opacity-60" />
        </div>
      </div>
    )}

    {/* أسطر القائمة المنتظمة */}
    <div className="flex-1 space-y-1 overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-4 border-b border-white/[0.02]">
          {/* أيقونة أو أفاتار */}
          <SkeletonBlock className="w-11 h-11 rounded-full shrink-0" />
          
          {/* تفاصيل النص */}
          <div className="flex-1 space-y-2.5 min-w-0">
            <SkeletonBlock className="h-4 w-2/5 rounded-lg" />
            <SkeletonBlock className="h-3 w-3/5 rounded-lg opacity-50" />
          </div>

          {/* سهم أو خيار النهاية */}
          <SkeletonBlock className="w-7 h-7 rounded-xl shrink-0 opacity-30" />
        </div>
      ))}
    </div>
  </div>
);

const PageSkeleton = memo(({ rows = 3, showHeader = true, layout = "list" }: PageSkeletonProps) => (
  <div
    className="w-full h-full overflow-hidden"
    style={{
      background: "var(--raan-bg, #0b1326)",
    }}
    aria-busy="true"
    aria-label="جاري التحميل..."
  >
    <style>{`
      @keyframes raan-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .raan-shimmer-bg {
        background: linear-gradient(90deg, #0e172a 25%, #1d293d 50%, #0e172a 75%);
        background-size: 200% 100%;
        animation: raan-shimmer 1.2s infinite linear;
      }
    `}</style>

    {layout === "map" ? (
      <MapSkeleton />
    ) : layout === "voice" ? (
      <VoiceSkeleton />
    ) : (
      <ListSkeleton rows={rows} showHeader={showHeader} />
    )}
  </div>
));

PageSkeleton.displayName = "PageSkeleton";

export default PageSkeleton;
