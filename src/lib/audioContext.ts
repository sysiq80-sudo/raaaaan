/**
 * ران - مدير الصوت المركزي (Centralized Audio Manager)
 * 
 * يحل مشكلة حظر المتصفح لـ AudioContext بدون تفاعل المستخدم
 * يتم تهيئة AudioContext مرة واحدة عند أول ضغط "Go Online" (تفاعل حقيقي)
 * ثم يُعاد استخدامه لجميع الأصوات اللاحقة
 */

import { logger } from "@/lib/logger";

let sharedAudioContext: AudioContext | null = null;
let isInitialized = false;

/**
 * إرجاع السياق الحالي فقط بدون إنشاء جديد
 * (آمن للاستخدام خارج تفاعل المستخدم)
 */
export const getAudioContext = (): AudioContext | null => {
  if (!isInitialized || !sharedAudioContext || sharedAudioContext.state === 'closed') {
    return null;
  }
  return sharedAudioContext;
};

/**
 * تهيئة AudioContext - يجب استدعاؤها خلال تفاعل المستخدم (click/tap)
 * مثل: ضغط زر "Go Online" أو أي زر آخر
 */
export const initAudioContext = (): AudioContext | null => {
  try {
    if (sharedAudioContext && sharedAudioContext.state !== "closed") {
      // استئناف السياق إذا كان معلقاً
      if (sharedAudioContext.state === "suspended") {
        sharedAudioContext.resume().catch(() => {});
      }
      isInitialized = true;
      return sharedAudioContext;
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      logger.debug("AudioContext", "AudioContext غير مدعوم في هذا المتصفح");
      return null;
    }

    sharedAudioContext = new AudioCtx();
    isInitialized = true;
    logger.info("AudioContext", "✅ تم تهيئة AudioContext بنجاح");
    return sharedAudioContext;
  } catch (error) {
    logger.error("AudioContext", "فشل تهيئة AudioContext", error);
    return null;
  }
};

/**
 * استئناف AudioContext إذا كان معلقاً
 * يُستدعى عند أي تفاعل مستخدم لضمان عدم تعليقه
 */
export const resumeAudioContext = async (): Promise<void> => {
  if (sharedAudioContext && sharedAudioContext.state === "suspended") {
    try {
      await sharedAudioContext.resume();
    } catch {
      // صامت - ليس ضرورياً
    }
  }
};

/**
 * تشغيل صوت إشعار الطلب الجديد
 * لحن ثلاثي: 880Hz → 1100Hz → 1320Hz (تصاعدي ومميز)
 */
export const playNotificationSound = (): void => {
  try {
    // إذا لم يتم التهيئة بعد، حاول إنشاء سياق جديد (قد يُحظر)
    if (!sharedAudioContext || sharedAudioContext.state === "closed") {
      if (!isInitialized) {
        logger.debug("AudioContext", "لم يتم تهيئة AudioContext بعد - تخطي الصوت");
        return;
      }
      // إعادة إنشاء إذا تم إغلاقه
      sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // استئناف السياق المعلق
    if (sharedAudioContext.state === "suspended") {
      sharedAudioContext.resume().catch(() => {});
    }

    const ctx = sharedAudioContext;
    const now = ctx.currentTime;

    const playTone = (frequency: number, duration: number, startTime: number) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    // لحن إشعار مميز: تصاعدي ثلاثي
    playTone(880, 0.15, now);        // نغمة 1
    playTone(1100, 0.15, now + 0.15); // نغمة 2
    playTone(1320, 0.2, now + 0.3);   // نغمة 3

    logger.debug("AudioContext", "🔔 تم تشغيل صوت الإشعار");
  } catch {
    logger.debug("AudioContext", "فشل تشغيل الصوت - Audio غير مدعوم");
  }
};

/**
 * تشغيل صوت قصير (للتأكيد، مثل قبول الطلب)
 */
export const playConfirmSound = (): void => {
  try {
    if (!sharedAudioContext || sharedAudioContext.state === "closed") return;
    if (sharedAudioContext.state === "suspended") {
      sharedAudioContext.resume().catch(() => {});
    }

    const ctx = sharedAudioContext;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 1200;
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  } catch {
    // صامت
  }
};

/**
 * تنظيف AudioContext عند الخروج
 */
export const cleanupAudioContext = (): void => {
  if (sharedAudioContext && sharedAudioContext.state !== "closed") {
    sharedAudioContext.close().catch(() => {});
    sharedAudioContext = null;
    isInitialized = false;
  }
};
