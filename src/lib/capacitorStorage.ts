/**
 * ران — محول تخزين موحد لـ Capacitor و الويب
 * 
 * يستخدم @capacitor/preferences على المنصات الأصلية (Android/iOS)
 * ويعود إلى localStorage على الويب
 * 
 * جميع العمليات غير متزامنة (async) لتوحيد الواجهة
 */

import { Capacitor } from '@capacitor/core';

// كشف البيئة محلياً لتجنب الاعتماد الدائري مع capacitorBridge
const isNativePlatform = Capacitor.isNativePlatform();

let Preferences: typeof import('@capacitor/preferences').Preferences | null = null;

// تحميل كسول لـ Preferences فقط على المنصات الأصلية
if (isNativePlatform) {
  import('@capacitor/preferences').then((mod) => {
    Preferences = mod.Preferences;
  }).catch(() => {
    console.warn('[capacitorStorage] Failed to load @capacitor/preferences — falling back to localStorage');
  });
}

export const capacitorStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isNativePlatform && Preferences) {
      const { value } = await Preferences.get({ key });
      return value;
    }
    return localStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isNativePlatform && Preferences) {
      await Preferences.set({ key, value });
      return;
    }
    localStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    if (isNativePlatform && Preferences) {
      await Preferences.remove({ key });
      return;
    }
    localStorage.removeItem(key);
  },
};

/**
 * نسخة متزامنة — تحاول القراءة من localStorage أولاً (متوفر على الويب و Capacitor كـ fallback)
 * مفيد للاستخدام في useState initializers والكود المتزامن
 */
/**
 * استعادة localStorage من Preferences عند بدء التطبيق الأصلي.
 * يُستدعى مرة واحدة قبل تهيئة Supabase لضمان بقاء الجلسة.
 */
export async function hydrateFromNativeStorage(): Promise<void> {
  if (!isNativePlatform) return;
  try {
    const mod = await import('@capacitor/preferences');
    const { keys } = await mod.Preferences.keys();
    for (const key of keys) {
      // لا نكتب فوق قيمة موجودة بالفعل في localStorage
      if (localStorage.getItem(key) === null) {
        const { value } = await mod.Preferences.get({ key });
        if (value !== null) {
          localStorage.setItem(key, value);
        }
      }
    }
    console.log(`[hydrateFromNativeStorage] Restored ${keys.length} keys`);
  } catch (err) {
    console.warn('[hydrateFromNativeStorage] Failed:', err);
  }
}

export const capacitorStorageSync = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // صامت
    }
    // على المنصات الأصلية — مزامنة مع Preferences في الخلفية
    if (isNativePlatform && Preferences) {
      Preferences.set({ key, value }).catch(() => {});
    }
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // صامت
    }
    if (isNativePlatform && Preferences) {
      Preferences.remove({ key }).catch(() => {});
    }
  },
};
