/**
 * ران — محول تخزين Zustand لـ Capacitor
 * 
 * يوفر واجهة StateStorage المتوافقة مع Zustand persist middleware
 * يستخدم capacitorStorage (async) تحته
 */

import type { StateStorage } from 'zustand/middleware';
import { capacitorStorage } from './capacitorStorage';

export const zustandCapacitorStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return capacitorStorage.getItem(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    return capacitorStorage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    return capacitorStorage.removeItem(name);
  },
};
