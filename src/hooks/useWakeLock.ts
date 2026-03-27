/**
 * ران - خطاف قفل الشاشة (Wake Lock Hook)
 * 
 * يمنع إطفاء شاشة السائق أثناء فتح لوحة التحكم
 * يستخدم Screen Wake Lock API مع fallback للمتصفحات التي لا تدعمها
 * 
 * الاستخدام:
 *   const { isWakeLockActive, requestWakeLock, releaseWakeLock } = useWakeLock();
 */

import { useState, useRef, useCallback, useEffect } from "react";

interface UseWakeLockReturn {
  /** هل قفل الشاشة مفعل حالياً */
  isWakeLockActive: boolean;
  /** هل المتصفح يدعم Wake Lock API */
  isSupported: boolean;
  /** تفعيل قفل الشاشة */
  requestWakeLock: () => Promise<void>;
  /** إلغاء قفل الشاشة */
  releaseWakeLock: () => Promise<void>;
}

export const useWakeLock = (): UseWakeLockReturn => {
  const [isWakeLockActive, setIsWakeLockActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const isSupported = "wakeLock" in navigator;

  // تفعيل قفل الشاشة
  const requestWakeLock = useCallback(async () => {
    if (!isSupported) {
      console.log("⚠️ Wake Lock API غير مدعوم في هذا المتصفح");
      // Fallback: استخدام فيديو مخفي لمنع إطفاء الشاشة (خدعة كلاسيكية)
      startNoSleepFallback();
      return;
    }

    try {
      // إطلاق القفل السابق إن وجد
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
      }

      const wakeLock = await navigator.wakeLock.request("screen");
      wakeLockRef.current = wakeLock;
      setIsWakeLockActive(true);
      console.log("🔒 تم تفعيل قفل الشاشة — الشاشة لن تنطفئ");

      // Event listener لإعادة التفعيل عند فقدان القفل (مثلاً: تبديل التطبيقات)
      wakeLock.addEventListener("release", () => {
        console.log("🔓 تم إطلاق قفل الشاشة");
        setIsWakeLockActive(false);
        wakeLockRef.current = null;
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("فشل تفعيل Wake Lock:", message);
      // Fallback إذا فشل الـ API
      startNoSleepFallback();
    }
  }, [isSupported]);

  // إلغاء قفل الشاشة
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsWakeLockActive(false);
        console.log("🔓 تم إلغاء قفل الشاشة");
      } catch (err) {
        console.error("خطأ في إلغاء Wake Lock:", err);
      }
    }
    stopNoSleepFallback();
  }, []);

  // إعادة تفعيل القفل عند العودة للصفحة (visibilitychange)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && isWakeLockActive && !wakeLockRef.current) {
        // إعادة طلب القفل عند الرجوع للتطبيق
        try {
          if (isSupported) {
            const wakeLock = await navigator.wakeLock.request("screen");
            wakeLockRef.current = wakeLock;
            setIsWakeLockActive(true);
            wakeLock.addEventListener("release", () => {
              setIsWakeLockActive(false);
              wakeLockRef.current = null;
            });
            console.log("🔒 تم إعادة تفعيل قفل الشاشة بعد العودة");
          }
        } catch {
          // صامت
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isWakeLockActive, isSupported]);

  // تنظيف عند unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
      stopNoSleepFallback();
    };
  }, []);

  return { isWakeLockActive, isSupported, requestWakeLock, releaseWakeLock };
};

// ═══ NoSleep Fallback ═══
// للمتصفحات التي لا تدعم Wake Lock API
// يستخدم فيديو مخفي فارغ لمنع الشاشة من الإطفاء
let noSleepVideo: HTMLVideoElement | null = null;
let noSleepInterval: ReturnType<typeof setInterval> | null = null;

function startNoSleepFallback() {
  try {
    if (noSleepVideo) return; // تم التفعيل بالفعل

    // إنشاء فيديو مصغر (MP4 فارغ — base64 encoded)
    // هذا الفيديو الفارغ يخدع المتصفح ليعتقد أن هناك وسائط نشطة
    const base64Video =
      "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhtZGF0AAAA" +
      "GgYF//+c3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDEyNSAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLS" +
      "BDb3B5bGVmdCAyMDAzLTIwMTIgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25z" +
      "OiBjYWJhYz0xIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDM6MHgxMTMgbWU9aGV4IHN1Ym1lPTcg" +
      "cHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVs" +
      "bGlzPTEgOHg4ZGN0PTEgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZz" +
      "ZXQ9LTIgdGhyZWFkcz02IGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2lt" +
      "YXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9" +
      "MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAg" +
      "d2VpZ2h0cD0yIGtleWludD0yNTAga2V5aW50X21pbj0yNSBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAg" +
      "cmNfbG9va2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBt" +
      "YXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAAA9liIQAV/0TAAYdeBTXzg8AAEAAAg" +
      "AAegAAADAIAAAAwAAAAMA=";

    noSleepVideo = document.createElement("video");
    noSleepVideo.setAttribute("playsinline", "");
    noSleepVideo.setAttribute("muted", "");
    noSleepVideo.setAttribute("loop", "");
    noSleepVideo.style.cssText = "position:fixed;top:-1px;left:-1px;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1";
    noSleepVideo.src = base64Video;
    noSleepVideo.muted = true;
    document.body.appendChild(noSleepVideo);

    noSleepVideo.play().catch(() => {
      console.log("NoSleep fallback: تحتاج تفاعل المستخدم أولاً");
    });

    // إعادة التشغيل كل 30 ثانية كاحتياط
    noSleepInterval = setInterval(() => {
      if (noSleepVideo && noSleepVideo.paused) {
        noSleepVideo.play().catch(() => {});
      }
    }, 30000);

    console.log("🔒 NoSleep fallback مفعل");
  } catch {
    console.log("فشل تفعيل NoSleep fallback");
  }
}

function stopNoSleepFallback() {
  if (noSleepVideo) {
    noSleepVideo.pause();
    noSleepVideo.remove();
    noSleepVideo = null;
  }
  if (noSleepInterval) {
    clearInterval(noSleepInterval);
    noSleepInterval = null;
  }
}

export default useWakeLock;
