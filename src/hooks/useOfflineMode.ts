/**
 * ران - Offline Support Hook
 * يدعم العمل الجزئي بدون إنترنت
 */

import { useEffect, useState, useCallback } from "react";

export const useOfflineMode = () => {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window === "undefined") return true;
    return navigator.onLine;
  });

  const [offlineSyncQueue, setOfflineSyncQueue] = useState<
    Array<{
      id: string;
      action: "create" | "update" | "delete";
      data: Record<string, unknown>;
      timestamp: number;
    }>
  >([]);

  // مراقبة حالة الإنترنت
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // إضافة عملية للـ queue
  const addToSyncQueue = useCallback(
    (action: "create" | "update" | "delete", data: Record<string, unknown>) => {
      const queueItem = {
        id: `${Date.now()}_${Math.random()}`,
        action,
        data,
        timestamp: Date.now(),
      };

      setOfflineSyncQueue((prev) => [...prev, queueItem]);

      // حفظ في localStorage
      if (typeof window !== "undefined") {
        try {
          const queue = JSON.parse(
            window.localStorage.getItem("raan_sync_queue") || "[]"
          );
          queue.push(queueItem);
          window.localStorage.setItem("raan_sync_queue", JSON.stringify(queue));
        } catch (error) {
          console.error("Error saving to sync queue:", error);
        }
      }

      return queueItem.id;
    },
    []
  );

  // معالجة الـ sync queue عند الاتصال
  const processSyncQueue = useCallback(
    async (
      syncFunction: (
        action: string,
        data: Record<string, unknown>
      ) => Promise<void>
    ) => {
      try {
        const queue = JSON.parse(
          typeof window !== "undefined"
            ? window.localStorage.getItem("raan_sync_queue") || "[]"
            : "[]"
        );

        for (const item of queue) {
          try {
            await syncFunction(item.action, item.data);
            // إزالة من localStorage بعد النجاح
            if (typeof window !== "undefined") {
              const updatedQueue = queue.filter(
                (q: Record<string, unknown>) => q.id !== item.id
              );
              window.localStorage.setItem(
                "raan_sync_queue",
                JSON.stringify(updatedQueue)
              );
            }
          } catch (error) {
            console.error("Error syncing item:", item, error);
            // ترك العنصر في الـ queue للمحاولة لاحقاً
          }
        }

        setOfflineSyncQueue([]);
      } catch (error) {
        console.error("Error processing sync queue:", error);
      }
    },
    []
  );

  // المحاولة التلقائية عند الاتصال
  useEffect(() => {
    if (!isOnline || typeof window === "undefined") return;

    // عند العودة للإنترنت، نحاول مزامنة القائمة تلقائياً
    const queue = JSON.parse(
      window.localStorage.getItem("raan_sync_queue") || "[]"
    );
    if (queue.length > 0) {
      console.log(`[OfflineSync] تم الاتصال — ${queue.length} عمليات معلقة`);
      // حفظ البيانات المهمة عند الاتصال
      cacheImportantData();
    }
  }, [isOnline]);

  return {
    isOnline,
    offlineSyncQueue,
    addToSyncQueue,
    processSyncQueue,
  };
};

/**
 * تخزين البيانات المهمة تلقائياً عند الاتصال
 * (المفضلة، إعدادات المنطقة، أنواع المركبات)
 */
async function cacheImportantData() {
  if (typeof window === "undefined") return;

  const { supabase } = await import("@/integrations/supabase/client");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  try {
    // تخزين الأماكن المفضلة
    const { data: places } = await supabase
      .from("saved_places")
      .select("id, name, address, location, place_type")
      .eq("user_id", session.user.id)
      .limit(20);
    if (places) {
      window.localStorage.setItem(
        "raan_cache_saved_places",
        JSON.stringify({ data: places, timestamp: Date.now() })
      );
    }

    // تخزين أنواع المركبات والأسعار
    const { data: regions } = await supabase
      .from("regions")
      .select("id, name_ar, base_fare, per_km_fare, per_minute_fare, is_active")
      .eq("is_active", true)
      .limit(50);
    if (regions) {
      window.localStorage.setItem(
        "raan_cache_regions",
        JSON.stringify({ data: regions, timestamp: Date.now() })
      );
    }
  } catch (err) {
    console.error("[OfflineSync] Failed to cache data:", err);
  }
}

/**
 * Hook للتحقق من توفر الخدمات الأساسية
 */
export const useServiceAvailability = () => {
  const { isOnline } = useOfflineMode();
  const [serviceStatus, setServiceStatus] = useState({
    mapbox: isOnline,
    supabase: isOnline,
    location: false,
  });

  useEffect(() => {
    const checkServices = async () => {
      // فحص Mapbox
      const mapboxAvailable = isOnline; // يمكن إضافة فحص أكثر دقة

      // فحص Geolocation
      const locationAvailable =
        "geolocation" in navigator && isOnline === false
          ? false
          : "geolocation" in navigator;

      setServiceStatus({
        mapbox: mapboxAvailable,
        supabase: isOnline,
        location: locationAvailable,
      });
    };

    checkServices();
  }, [isOnline]);

  return serviceStatus;
};

/**
 * Hook لحفظ البيانات المؤقتة
 */
export const useCachedData = <T>(
  key: string,
  fetchFunction: () => Promise<T>,
  options: {
    ttl?: number; // Time to live in milliseconds
    offline?: boolean; // السماح بالبيانات المخزنة عند عدم الاتصال
  } = {}
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const { isOnline } = useOfflineMode();

  useEffect(() => {
    const loadData = async () => {
      const cacheKey = `raan_cache_${key}`;
      const cached =
        typeof window !== "undefined"
          ? window.localStorage.getItem(cacheKey)
          : null;

      if (cached) {
        try {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;

          // إذا كانت البيانات طازة
          if (!options.ttl || age < options.ttl) {
            setData(cachedData);
            return;
          }
        } catch (error) {
          console.error("Error parsing cached data:", error);
        }
      }

      // إذا لم نكن متصلين، نعيد البيانات المخزنة مهما كان عمرها
      if (!isOnline) {
        if (cached) {
          try {
            const { data: cachedData } = JSON.parse(cached);
            setData(cachedData);
          } catch (error) {
            console.error("Error loading offline data:", error);
          }
        }
        return;
      }

      // جلب البيانات الجديدة
      if (isOnline) {
        setLoading(true);
        try {
          const newData = await fetchFunction();
          setData(newData);

          // حفظ في localStorage
          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(
                cacheKey,
                JSON.stringify({
                  data: newData,
                  timestamp: Date.now(),
                })
              );
            } catch (error) {
              console.error("Error caching data:", error);
            }
          }
        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadData();
  }, [key, isOnline, fetchFunction, options]);

  return { data, loading };
};
