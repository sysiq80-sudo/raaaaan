/**
 * ران - إعداد Supabase (React Native)
 * يستخدم expo-secure-store للتخزين الآمن
 */

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Secure storage adapter for Supabase Auth
const secureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.error('SecureStore setItem error:', e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.error('SecureStore removeItem error:', e);
    }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStoreAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // لا يوجد URL في React Native
  },
  realtime: {
    params: { eventsPerSecond: 10 },
    heartbeatIntervalMs: 15000,
    reconnectAfterMs: (tries: number) =>
      Math.min(500 * Math.pow(2, tries), 10000),
  },
  global: {
    headers: { 'X-Client-Info': 'raan-mobile-app' },
  },
});
