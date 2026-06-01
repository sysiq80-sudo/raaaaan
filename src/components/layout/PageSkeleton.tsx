/**
 * ران — PageSkeleton
 *
 * Skeleton بسيط يظهر داخل كل <Suspense> فردي
 * بديل عن SplashScreen الثقيل عند تحميل الصفحات
 * يحافظ على ارتفاع الشاشة ولون الخلفية بدون flash أبيض
 */
import { memo } from "react";

interface PageSkeletonProps {
  /** عدد الأسطر الوهمية */
  rows?: number;
  /** إظهار رأس الصفحة الوهمي */
  showHeader?: boolean;
}

const SkeletonBlock = ({ className, style }: { className: string; style?: React.CSSProperties }) => (
  <div
    className={`rounded-2xl bg-[#171f33] animate-pulse ${className}`}
    style={{ animationDuration: "1.4s", ...style }}
  />
);

const PageSkeleton = memo(({ rows = 3, showHeader = true }: PageSkeletonProps) => (
  <div
    className="w-full h-full flex flex-col gap-4 px-4"
    style={{
      paddingTop: "max(1.5rem, calc(env(safe-area-inset-top, 0px) + 1rem))",
      paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
      background: "var(--raan-bg, #0b1326)",
    }}
    aria-busy="true"
    aria-label="جار التحميل"
  >
    {showHeader && (
      <div className="flex items-center justify-between mb-2">
        <SkeletonBlock className="h-7 w-32" />
        <SkeletonBlock className="h-8 w-8 rounded-xl" />
      </div>
    )}
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonBlock
        key={i}
        className="w-full"
        style={{ height: i === 0 ? "80px" : "64px", opacity: 1 - i * 0.15 }}
      />
    ))}
  </div>
));

PageSkeleton.displayName = "PageSkeleton";

export default PageSkeleton;
