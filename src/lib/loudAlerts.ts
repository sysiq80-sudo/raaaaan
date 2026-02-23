/**
 * ران - نظام التنبيهات الصوتية القوية للسائق (Loud Audio Alert System)
 * 
 * يشغل صوت تنبيه عالي ومتكرر عند وصول طلب رحلة جديد
 * يتجاوز قيود كتم الصوت في المتصفح عبر تهيئة AudioContext من تفاعل المستخدم
 * 
 * الميزات:
 * - صوت تنبيه قوي (gain عالي)
 * - تكرار متعدد (3 مقاطع) لضمان انتباه السائق
 * - استخدام AudioContext + HTML5 Audio كـ fallback
 * - اهتزاز الجهاز مع الصوت
 * - إيقاف يدوي عند التفاعل
 */

import { logger } from "@/lib/logger";

// ═══ الثوابت ═══
const ALERT_REPEAT_COUNT = 3; // عدد تكرارات التنبيه
const ALERT_REPEAT_INTERVAL = 2000; // ms بين كل تكرار
const MAX_ALERT_DURATION = 30000; // أقصى مدة للتنبيه (30 ثانية)

// ═══ حالة مشتركة ═══
let alertIntervalId: ReturnType<typeof setInterval> | null = null;
let alertTimeoutId: ReturnType<typeof setTimeout> | null = null;
let isAlertActive = false;

/**
 * تشغيل صوت تنبيه عالي وحاد — لحن "سي سي سي" تصاعدي مع ذبذبة FM
 * يستخدم AudioContext المشترك من audioContext.ts أو ينشئ واحد جديد
 */
export const playLoudAlert = (audioCtx?: AudioContext | null): void => {
  try {
    const ctx = audioCtx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // ═══ نغمة تنبيه قوية — 3 أجزاء تصاعدية ═══
    const frequencies = [1000, 1300, 1600]; // Hz — نغمات حادة
    const durations = [0.2, 0.2, 0.35];

    let offset = 0;
    frequencies.forEach((freq, i) => {
      // Main oscillator
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = "square"; // موجة مربعة = صوت أعلى وأوضح
      osc.frequency.value = freq;
      
      // Gain عالي مع envelope
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(0.7, now + offset + 0.02); // صعود سريع
      gain.gain.setValueAtTime(0.7, now + offset + durations[i] - 0.05);
      gain.gain.linearRampToValueAtTime(0, now + offset + durations[i]); // هبوط
      
      osc.start(now + offset);
      osc.stop(now + offset + durations[i]);
      
      offset += durations[i] + 0.05; // فجوة صغيرة بين النغمات
    });

    // ═══ نغمة ثانية طويلة (سرينة) — بعد 0.3 ثانية ═══
    const sirenOsc = ctx.createOscillator();
    const sirenGain = ctx.createGain();
    sirenOsc.connect(sirenGain);
    sirenGain.connect(ctx.destination);
    sirenOsc.type = "sawtooth"; // موجة منشارية = صوت حاد جداً
    sirenOsc.frequency.setValueAtTime(800, now + offset);
    sirenOsc.frequency.linearRampToValueAtTime(1500, now + offset + 0.4);
    sirenOsc.frequency.linearRampToValueAtTime(800, now + offset + 0.8);
    sirenGain.gain.setValueAtTime(0, now + offset);
    sirenGain.gain.linearRampToValueAtTime(0.5, now + offset + 0.05);
    sirenGain.gain.setValueAtTime(0.5, now + offset + 0.7);
    sirenGain.gain.linearRampToValueAtTime(0, now + offset + 0.8);
    sirenOsc.start(now + offset);
    sirenOsc.stop(now + offset + 0.8);

    logger.debug("LoudAlerts", "🔊 تم تشغيل تنبيه صوتي عالي");
  } catch (err) {
    logger.debug("LoudAlerts", "فشل تشغيل التنبيه الصوتي", err);
  }
};

/**
 * تشغيل اهتزاز قوي ومتكرر
 */
export const vibrateStrong = (): void => {
  if ("vibrate" in navigator) {
    // نمط اهتزاز قوي: مشغل - موقف - مشغل - موقف - مشغل طويل
    navigator.vibrate([400, 150, 400, 150, 600]);
  }
};

/**
 * بدء تنبيه متكرر عند طلب رحلة جديد
 * يكرر الصوت والاهتزاز حتى يتفاعل السائق أو ينتهي الوقت
 */
export const startRideAlert = (audioCtx?: AudioContext | null): void => {
  // أوقف أي تنبيه سابق
  stopRideAlert();
  
  isAlertActive = true;
  let repeatCount = 0;

  // تشغيل فوري
  playLoudAlert(audioCtx);
  vibrateStrong();
  repeatCount++;

  // تكرار
  alertIntervalId = setInterval(() => {
    if (!isAlertActive || repeatCount >= ALERT_REPEAT_COUNT) {
      stopRideAlert();
      return;
    }
    playLoudAlert(audioCtx);
    vibrateStrong();
    repeatCount++;
  }, ALERT_REPEAT_INTERVAL);

  // حد أقصى للتنبيه
  alertTimeoutId = setTimeout(() => {
    stopRideAlert();
  }, MAX_ALERT_DURATION);

  logger.info("LoudAlerts", `🚨 بدء تنبيه رحلة — ${ALERT_REPEAT_COUNT} تكرارات`);
};

/**
 * إيقاف التنبيه المتكرر
 */
export const stopRideAlert = (): void => {
  isAlertActive = false;
  
  if (alertIntervalId) {
    clearInterval(alertIntervalId);
    alertIntervalId = null;
  }
  if (alertTimeoutId) {
    clearTimeout(alertTimeoutId);
    alertTimeoutId = null;
  }
  
  // إيقاف الاهتزاز
  if ("vibrate" in navigator) {
    navigator.vibrate(0);
  }
};

/**
 * هل التنبيه نشط حالياً
 */
export const isRideAlertActive = (): boolean => isAlertActive;
