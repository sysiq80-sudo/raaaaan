/**
 * useDriverLocationSync — مزامنة موقع السائق المباشر
 * 
 * يقوم بتحديث جدول driver_live_locations كل 5 ثوانٍ أثناء الرحلة النشطة
 * حتى تتمكن صفحة التتبع العامة من الاشتراك عبر Supabase Realtime
 * 
 * الاستخدام: يُستدعى في ActiveRideCard فقط
 */

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseDriverLocationSyncProps {
  rideId: string | null;
  driverId: string;
  driverLocation: { lat: number; lng: number; heading?: number | null } | null | undefined;
  isActive: boolean; // true عندما حالة الرحلة accepted/arrived/in_progress
}

// Phase 5B: aligned with MIN_UPDATE_INTERVAL in DriverHome (15 s) to prevent
// driver_live_locations writes from running twice as often as drivers.current_location
const SYNC_INTERVAL_MS = 15000;
// الحد الأدنى للمسافة للتحديث (10 أمتار)
const MIN_DISTANCE_METERS = 10;

// حساب المسافة بين نقطتين (بالأمتار)
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371e3; // نصف قطر الأرض بالأمتار
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useDriverLocationSync({
  rideId,
  driverId,
  driverLocation,
  isActive,
}: UseDriverLocationSyncProps) {
  const lastSyncRef = useRef<number>(0);
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  // دالة المزامنة الفعلية
  const syncLocation = useCallback(async (location: { lat: number; lng: number }) => {
    if (!rideId || !driverId) return;

    const now = Date.now();
    const timeSinceLastSync = now - lastSyncRef.current;

    // تحقق من الحد الأدنى للوقت
    if (timeSinceLastSync < SYNC_INTERVAL_MS) {
      pendingLocationRef.current = location;
      return;
    }

    // تحقق من الحد الأدنى للمسافة
    if (lastLocationRef.current) {
      const distance = haversineDistance(
        lastLocationRef.current.lat, lastLocationRef.current.lng,
        location.lat, location.lng
      );
      if (distance < MIN_DISTANCE_METERS && timeSinceLastSync < SYNC_INTERVAL_MS * 2) {
        return; // لم يتحرك بما يكفي
      }
    }

    try {
      // Upsert: إدراج أو تحديث الموقع
      const { error } = await supabase
        .from("driver_live_locations" as any)
        .upsert(
          {
            ride_id: rideId,
            driver_id: driverId,
            location: { 
              lat: location.lat, 
              lng: location.lng, 
              heading: (location as any).heading !== undefined ? (location as any).heading : null 
            },
            heading: (location as any).heading !== undefined && (location as any).heading !== null ? Math.round((location as any).heading) : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "ride_id" }
        );

      if (error) {
        console.error("[LocationSync] Upsert error:", error.message);
      } else {
        lastSyncRef.current = now;
        lastLocationRef.current = location;
        pendingLocationRef.current = null;
      }
    } catch (err) {
      console.error("[LocationSync] Unexpected error:", err);
    }
  }, [rideId, driverId]);

  // مزامنة عند تغيير الموقع
  useEffect(() => {
    if (!isActive || !driverLocation || !rideId) return;
    syncLocation(driverLocation);
  }, [driverLocation?.lat, driverLocation?.lng, (driverLocation as any)?.heading, isActive, rideId, syncLocation]);

  // مؤقت دوري لإرسال المواقع المعلقة
  useEffect(() => {
    if (!isActive || !rideId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      const pending = pendingLocationRef.current;
      if (pending) {
        syncLocation(pending);
      }
    }, SYNC_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, rideId, syncLocation]);

  // تنظيف عند فك التحميل أو انتهاء الرحلة
  useEffect(() => {
    if (!isActive && rideId && lastLocationRef.current) {
      // حذف الموقع عند انتهاء الرحلة (الـ trigger في DB يفعل ذلك أيضاً)
      supabase
        .from("driver_live_locations" as any)
        .delete()
        .eq("ride_id", rideId)
        .then(({ error }) => {
          if (error) console.warn("[LocationSync] Cleanup error:", error.message);
        });
      lastLocationRef.current = null;
      lastSyncRef.current = 0;
    }
  }, [isActive, rideId]);

  // إرسال أول موقع فوراً عند بدء الرحلة
  useEffect(() => {
    if (isActive && rideId && driverLocation) {
      // فرض الإرسال الفوري
      lastSyncRef.current = 0;
      syncLocation(driverLocation);
    }
  }, [isActive, rideId]); // عمداً لا نضيف driverLocation لتجنب الإرسال المتكرر
}
