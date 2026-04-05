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
