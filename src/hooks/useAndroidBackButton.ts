/**
 * useAndroidBackButton — معالجة زر Back الجسدي على Android
 *
 * السلوك:
 *  1. إذا كان onBack() يُعيد true  → الحدث مُعالَج (مثلاً: أُغلق drawer) — لا إجراء إضافي
 *  2. إذا كنا على صفحة جذر         → double-back للخروج مع toast تأكيد
 *  3. صفحات أخرى                   → navigate(-1) عادي
 *
 * يُسجَّل عند mount ويُزال عند unmount — لا يؤثر على الصفحات التي لا تستدعيه.
 */
import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { App } from "@capacitor/app";
import { isNativePlatform } from "@/lib/capacitorBridge";
import { useToast } from "@/hooks/use-toast";

/** مسارات الجذر — pressing Back هنا يُشغّل منطق double-back للخروج */
const ROOT_PATHS = ["/rider", "/driver"];

/**
 * @param onBack - دالة اختيارية تُستدعى أولاً.
 *                 أعِد `true` إذا تعاملت مع الحدث (مثلاً أغلقت drawer).
 *                 أعِد `false` للسماح للسلوك الافتراضي بالعمل.
 */
export function useAndroidBackButton(onBack?: () => boolean) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // refs لتجنب إعادة تسجيل الـ listener عند تغيُّر القيم
  const locationRef = useRef(location);
  locationRef.current = location;

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const lastBackAtRef = useRef(0);

  useEffect(() => {
    if (!isNativePlatform) return;

    const listenerPromise = App.addListener("backButton", () => {
      // 1. تفويض للصفحة (إغلاق drawer أو modal)
      if (onBackRef.current?.()) return;

      const pathname = locationRef.current.pathname;
      const isRoot = ROOT_PATHS.includes(pathname);

      if (!isRoot) {
        // 2. صفحة فرعية — ارجع للصفحة السابقة
        navigate(-1);
        return;
      }

      // 3. صفحة جذر — double-back للخروج
      const now = Date.now();
      if (now - lastBackAtRef.current < 2000) {
        App.exitApp();
      } else {
        lastBackAtRef.current = now;
        toast({
          description: "اضغط مرة أخرى للخروج",
          duration: 2000,
        });
      }
    });

    return () => {
      listenerPromise.then((h) => h.remove());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — كل القيم المتغيرة عبر refs
}
