/**
 * ران - Hook تخزين البحوثات السابقة
 * يحفظ آخر الأماكن المبحوث عنها لسهولة الاختيار السريع
 */

import { useCallback, useEffect, useState } from 'react';

export interface RecentSearch {
  id: string;
  mainText: string;
  secondaryText?: string;
  address: string;
  lat: number;
  lng: number;
  timestamp: number;
}

const STORAGE_KEY = 'raan_recent_searches';
const MAX_SEARCHES = 10;

export const useRecentSearches = () => {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  // تحميل البحوثات السابقة من localStorage عند التحميل
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const searches = JSON.parse(stored) as RecentSearch[];

        // تصفية النصوص المتلفة (تحتوي ?? أو نصوص قصيرة جداً أو فارغة)
        const isGarbled = (text: string) =>
          !text || text.includes('??') || /^\?+$/.test(text.trim());

        const cleaned = searches.filter(
          (s) => s.mainText && !isGarbled(s.mainText)
        );

        // إذا وُجد تلف → احفظ القائمة النظيفة فوراً
        if (cleaned.length !== searches.length) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
          } catch { /* ignore */ }
        }

        // فرز حسب الأحدث
        setRecentSearches(cleaned.sort((a, b) => b.timestamp - a.timestamp));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  }, []);

  // إضافة بحث جديد
  const addRecentSearch = useCallback((search: Omit<RecentSearch, 'id' | 'timestamp'>) => {
    try {
      // رفض النصوص المتلفة قبل الحفظ
      if (!search.mainText || search.mainText.includes('??') || /^\?+$/.test(search.mainText.trim())) {
        return;
      }

      setRecentSearches((prev) => {
        // تجنب التكرار - احذف النتيجة القديمة إذا كانت موجودة
        const filtered = prev.filter(
          (s) => !(s.lat === search.lat && s.lng === search.lng)
        );

        // أضف البحث الجديد في البداية
        const newSearch: RecentSearch = {
          id: `${search.lat}-${search.lng}-${Date.now()}`,
          ...search,
          timestamp: Date.now(),
        };

        const updated = [newSearch, ...filtered].slice(0, MAX_SEARCHES);

        // احفظ في localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (error) {
          console.error('Error saving recent searches:', error);
        }

        return updated;
      });
    } catch (error) {
      console.error('Error adding recent search:', error);
    }
  }, []);

  // حذف بحث معين
  const removeRecentSearch = useCallback((id: string) => {
    try {
      setRecentSearches((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (error) {
          console.error('Error saving recent searches:', error);
        }
        return updated;
      });
    } catch (error) {
      console.error('Error removing recent search:', error);
    }
  }, []);

  // مسح جميع البحوثات
  const clearAllSearches = useCallback(() => {
    try {
      setRecentSearches([]);
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing searches:', error);
    }
  }, []);

  return {
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearAllSearches,
  };
};
