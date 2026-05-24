/**
 * خدمة "تذكرني" — Capacitor Preferences + localStorage fallback
 * 
 * تستخدم @capacitor/preferences على الأندرويد (أكثر أماناً ولا ينمسح)
 * وتستخدم localStorage كـ fallback بالمتصفح
 * 
 * ⚠️ لا نحفظ كلمة المرور أبداً — فقط رقم الهاتف + تفضيل "تذكرني"
 */
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

const KEYS = {
  REMEMBER_ME: "raan_remember_me",
  SAVED_PHONE: "raan_saved_phone",
  SAVED_ROLE: "raan_saved_role", // "rider" | "driver"
} as const;

const isNative = Capacitor.isNativePlatform();

/* ── قراءة / كتابة عامة ── */
async function setItem(key: string, value: string): Promise<void> {
  if (isNative) {
    await Preferences.set({ key, value });
  } else {
    try { localStorage.setItem(key, value); } catch { /* quota exceeded */ }
  }
}

async function getItem(key: string): Promise<string | null> {
  if (isNative) {
    const { value } = await Preferences.get({ key });
    return value;
  }
  try { return localStorage.getItem(key); } catch { return null; }
}

async function removeItem(key: string): Promise<void> {
  if (isNative) {
    await Preferences.remove({ key });
  } else {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

/* ══════════════════════════════════════════════════════
   واجهة الاستخدام (Public API)
   ══════════════════════════════════════════════════════ */

/**
 * حفظ بيانات "تذكرني" بعد تسجيل دخول ناجح.
 * لا نحفظ كلمة المرور أبداً!
 */
export async function saveRememberMe(
  phone: string,
  role: "rider" | "driver" = "rider",
): Promise<void> {
  await setItem(KEYS.REMEMBER_ME, "true");
  await setItem(KEYS.SAVED_PHONE, phone);
  await setItem(KEYS.SAVED_ROLE, role);
}

/**
 * مسح بيانات "تذكرني" — عند تسجيل الخروج أو إيقاف التفضيل.
 */
export async function clearRememberMe(): Promise<void> {
  await removeItem(KEYS.REMEMBER_ME);
  await removeItem(KEYS.SAVED_PHONE);
  await removeItem(KEYS.SAVED_ROLE);
}

/**
 * استعادة بيانات "تذكرني" عند فتح التطبيق.
 */
export async function getRememberMe(): Promise<{
  enabled: boolean;
  phone: string;
  role: "rider" | "driver";
}> {
  const [enabled, phone, role] = await Promise.all([
    getItem(KEYS.REMEMBER_ME),
    getItem(KEYS.SAVED_PHONE),
    getItem(KEYS.SAVED_ROLE),
  ]);
  return {
    enabled: enabled === "true",
    phone: phone || "",
    role: (role as "rider" | "driver") || "rider",
  };
}

/**
 * هل الجهاز يدعم التخزين الآمن (Native)؟
 */
export function isSecureStorage(): boolean {
  return isNative;
}
