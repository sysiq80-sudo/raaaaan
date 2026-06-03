/**
 * ران — PageTransition
 *
 * نوعان من الانتقال:
 * • "slide" — للصفحات الداخلية (drawer / sub-pages)
 *   يدخل من اليسار (RTL) ويخرج للأيمن — مطابق لنمط iOS
 * • "tab" — للتنقل بين الـ Bottom Tabs
 *   fade + scale خفيف جداً، لا slide — مثل iOS tab bar السلوك الأصلي
 *
 * المدة: 150-180ms فقط لإحساس native حقيقي
 * easing: [0.25, 0.1, 0.25, 1.0] — cubic-bezier أصيل من iOS
 */
import { motion } from "framer-motion";
import type { ReactNode } from "react";

type TransitionMode = "slide" | "tab";

interface PageTransitionProps {
  children: ReactNode;
  /** مفتاح فريد يتغير عند تغيير الصفحة — يُفعِّل الـ animation */
  pageKey: string;
  mode?: TransitionMode;
  className?: string;
}

// ─── Variants ───────────────────────────────────────────────

/** Slide قصير جداً — transform/opacity فقط لتجنب أي freeze عند التنقل */
const slideVariants = {
  initial:  { opacity: 0, x: 14 },
  animate:  { opacity: 1, x: 0 },
  exit:     { opacity: 0, x: -10 },
};

/** Fade + scale خفيف جداً للـ tabs (لا slide) */
const tabVariants = {
  initial:  { opacity: 0, scale: 0.995 },
  animate:  { opacity: 1, scale: 1 },
  exit:     { opacity: 0, scale: 0.998 },
};

// ─── Transitions ─────────────────────────────────────────────

const slideTransition = {
  duration: 0.18,
  ease: [0.25, 0.1, 0.25, 1.0] as [number, number, number, number],
};

const tabTransition = {
  duration: 0.15,
  ease: [0.25, 0.1, 0.25, 1.0] as [number, number, number, number],
};

// ─── Component ───────────────────────────────────────────────

const PageTransition = ({
  children,
  pageKey,
  mode = "slide",
  className = "",
}: PageTransitionProps) => {
  const variants  = mode === "tab" ? tabVariants  : slideVariants;
  const transition = mode === "tab" ? tabTransition : slideTransition;

  return (
    <motion.div
      key={pageKey}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transition}
      className={`w-full h-full ${className}`.trim()}
      style={{
        willChange: "transform, opacity",
        backfaceVisibility: "hidden",
      }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
