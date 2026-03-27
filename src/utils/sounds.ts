/**
 * ران - أصوات تفاعلية للتطبيق
 * مثل Uber/Careem: صوت عند وصول السائق، بدء الرحلة، إلخ
 * يستخدم Web Audio API لتوليد أصوات بدون ملفات خارجية
 */

type SoundType =
  | "booking_confirmed" // تم تأكيد الحجز
  | "driver_found" // تم العثور على سائق
  | "driver_arrived" // السائق وصل
  | "ride_started" // بدأت الرحلة
  | "ride_completed" // انتهت الرحلة
  | "message_received" // رسالة جديدة
  | "message_sent" // تم إرسال رسالة
  | "error" // خطأ
  | "tap" // نقرة
  | "success" // نجاح عام
  | "notification"; // إشعار

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  try {
    if (!audioContext) {
      audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    }
    return audioContext;
  } catch {
    return null;
  }
};

const playTone = (
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume: number = 0.3,
  delay: number = 0,
) => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = type;
  osc.frequency.value = frequency;

  const startTime = ctx.currentTime + delay;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration);
};

const SOUND_PATTERNS: Record<SoundType, () => void> = {
  booking_confirmed: () => {
    // نغمة صعودية مبهجة (3 نغمات)
    playTone(523, 0.15, "sine", 0.25, 0); // C5
    playTone(659, 0.15, "sine", 0.25, 0.12); // E5
    playTone(784, 0.25, "sine", 0.3, 0.24); // G5
  },

  driver_found: () => {
    // نغمة إشعار مميزة (مثل Uber)
    playTone(880, 0.1, "sine", 0.3, 0); // A5
    playTone(1047, 0.1, "sine", 0.3, 0.1); // C6
    playTone(1319, 0.15, "sine", 0.35, 0.2); // E6
    playTone(1568, 0.3, "sine", 0.3, 0.35); // G6
  },

  driver_arrived: () => {
    // نغمة تنبيه لطيفة (نغمتان متكررتان)
    playTone(698, 0.2, "sine", 0.35, 0); // F5
    playTone(880, 0.3, "sine", 0.35, 0.2); // A5
    playTone(698, 0.2, "sine", 0.3, 0.55); // F5
    playTone(880, 0.3, "sine", 0.35, 0.75); // A5
  },

  ride_started: () => {
    // نغمة بداية سلسة
    playTone(440, 0.15, "sine", 0.2, 0); // A4
    playTone(554, 0.15, "sine", 0.25, 0.15); // C#5
    playTone(659, 0.2, "sine", 0.3, 0.3); // E5
  },

  ride_completed: () => {
    // نغمة نجاح مبهجة (4 نغمات صعودية)
    playTone(523, 0.12, "sine", 0.2, 0); // C5
    playTone(659, 0.12, "sine", 0.25, 0.1); // E5
    playTone(784, 0.12, "sine", 0.3, 0.2); // G5
    playTone(1047, 0.35, "sine", 0.35, 0.3); // C6
  },

  message_received: () => {
    // صوت رسالة واردة (نغمتان)
    playTone(880, 0.08, "triangle", 0.2, 0); // A5
    playTone(1175, 0.12, "triangle", 0.25, 0.1); // D6
  },

  message_sent: () => {
    // صوت إرسال (نغمة واحدة خفيفة)
    playTone(1047, 0.08, "sine", 0.15, 0); // C6
  },

  error: () => {
    // صوت خطأ (نغمتان هابطتان)
    playTone(440, 0.15, "square", 0.2, 0); // A4
    playTone(330, 0.25, "square", 0.2, 0.15); // E4
  },

  tap: () => {
    // نقرة خفيفة
    playTone(1200, 0.03, "sine", 0.1, 0);
  },

  success: () => {
    // نغمة نجاح (نغمتان)
    playTone(659, 0.1, "sine", 0.2, 0); // E5
    playTone(880, 0.2, "sine", 0.25, 0.1); // A5
  },

  notification: () => {
    // إشعار عام
    playTone(784, 0.1, "sine", 0.25, 0); // G5
    playTone(988, 0.15, "sine", 0.3, 0.12); // B5
  },
};

// تخزين تفضيل المستخدم
const SOUND_ENABLED_KEY = "raan_sounds_enabled";

export const isSoundEnabled = (): boolean => {
  try {
    const stored = localStorage.getItem(SOUND_ENABLED_KEY);
    return stored !== "false"; // مفعّل افتراضياً
  } catch {
    return true;
  }
};

export const setSoundEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  } catch {
    // تجاهل أخطاء localStorage
  }
};

/**
 * تشغيل صوت تفاعلي
 * @param sound نوع الصوت المطلوب
 */
export const playSound = (sound: SoundType): void => {
  if (!isSoundEnabled()) return;

  try {
    const pattern = SOUND_PATTERNS[sound];
    if (pattern) {
      pattern();
    }
  } catch (err) {
    console.warn("[Sounds] Failed to play sound:", err);
  }
};

/**
 * تشغيل اهتزاز الجهاز (للأجهزة المحمولة)
 * @param pattern نمط الاهتزاز بالمللي ثانية
 */
export const vibrate = (pattern: number | number[] = 50): void => {
  // guarded by user interaction policy (browser blocks vibrate before first gesture)
  import('../lib/userGestureTracker').then(({ safeVibrate }) => {
    const arr = Array.isArray(pattern) ? pattern : [pattern];
    safeVibrate(arr);
  }).catch(() => { /* ignore */ });
};

/**
 * صوت + اهتزاز معاً (مثالي للإشعارات المهمة)
 */
export const hapticFeedback = (
  sound: SoundType,
  vibratePattern?: number | number[],
): void => {
  playSound(sound);
  vibrate(vibratePattern);
};

export default {
  playSound,
  vibrate,
  hapticFeedback,
  isSoundEnabled,
  setSoundEnabled,
};
