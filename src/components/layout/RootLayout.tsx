import React from "react";
import { AnimatePresence } from "framer-motion";
import PageTransition from "@/components/layout/PageTransition";

interface RootLayoutProps {
  children: React.ReactNode;
  bottom?: React.ReactNode;
  className?: string;
  mainClassName?: string;
  mainStyle?: React.CSSProperties;
  dir?: "rtl" | "ltr";
  /**
   * عند توفير هذا المفتاح → تُفعَّل انتقالات الصفحة تلقائياً
   * عادةً: location.pathname
   */
  animationKey?: string;
  /**
   * "tab" → fade خفيف (للـ Bottom Tabs)
   * "slide" → slide RTL (للصفحات الداخلية)
   * undefined → بدون animation
   */
  animationMode?: "slide" | "tab";
}

const RootLayout: React.FC<RootLayoutProps> = ({
  children,
  bottom,
  className = "",
  mainClassName = "",
  mainStyle,
  dir,
  animationKey,
  animationMode,
}) => {
  return (
    <div
      className={`flex flex-col h-[100dvh] w-full sm:max-w-[480px] sm:mx-auto sm:shadow-[0_0_60px_rgba(0,0,0,0.6)] sm:border-x sm:border-slate-800/80 relative overflow-hidden bg-background ${className}`.trim()}
      style={{ transform: "translate3d(0, 0, 0)" }}
      dir={dir ?? "rtl"}
    >
      <main
        className={`flex-1 relative overflow-hidden ${mainClassName}`.trim()}
        style={mainStyle}
      >
        {animationKey && animationMode ? (
          <AnimatePresence mode="sync" initial={false}>
            <PageTransition
              pageKey={animationKey}
              mode={animationMode}
              className="absolute inset-0 overflow-y-auto overflow-x-hidden"
            >
              <div data-scroll className="w-full h-full overflow-y-auto overflow-x-hidden">
                {children}
              </div>
            </PageTransition>
          </AnimatePresence>
        ) : (
          <div data-scroll className="w-full h-full overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        )}
      </main>
      {bottom && <div className="shrink-0 z-50">{bottom}</div>}
    </div>
  );
};

export default RootLayout;
