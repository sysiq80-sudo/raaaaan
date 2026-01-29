/**
 * ران - نظام تنبيه التأخير
 * يرسل تنبيهات للراكب إذا تأخر السائق عن الوقت المتوقع
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { showNotification } from "@/utils/rideNotificationSounds";

export interface DelayAlert {
  rideId: string;
  driverId: string;
  riderId: string;
  estimatedArrivalMinutes: number;
  actualDelayMinutes: number;
  status: "accepted" | "arrived" | "in_progress";
  driverLocation: { lat: number; lng: number };
  targetLocation: { lat: number; lng: number };
}

/**
 * حساب الوقت المتوقع للوصول بناءً على المسافة
 * @param distanceKm المسافة بالكيلومترات
 * @returns الوقت المتوقع بالدقائق
 */
export const calculateEstimatedArrival = (distanceKm: number): number => {
  // سرعة متوسطة 30 كم/ساعة في المدينة
  const avgSpeedKmh = 30;
  const timeHours = distanceKm / avgSpeedKmh;
  const timeMinutes = timeHours * 60;
  
  // إضافة 2-3 دقائق buffer لكل كيلومتر
  const bufferMinutes = distanceKm * 2.5;
  
  return Math.ceil(timeMinutes + bufferMinutes);
};

/**
 * التحقق من التأخير وإرسال تنبيه
 */
export const checkAndSendDelayAlert = async (
  rideId: string,
  driverId: string,
  riderId: string,
  status: "accepted" | "arrived" | "in_progress",
  driverLocation: { lat: number; lng: number },
  targetLocation: { lat: number; lng: number },
  estimatedArrivalMinutes: number,
  elapsedMinutes: number
): Promise<boolean> => {
  // التأخير = الوقت المنقضي - الوقت المتوقع
  const delayMinutes = elapsedMinutes - estimatedArrivalMinutes;

  // نرسل تنبيه فقط إذا كان التأخير أكثر من 5 دقائق
  if (delayMinutes < 5) {
    return false;
  }

  // التحقق من عدم إرسال تنبيهات متكررة (خلال 5 دقائق الأخيرة)
  // TODO: استخدام جدول delay_alerts بعد تنفيذ migration
  // const { data: recentAlerts } = await supabase
  //   .from("delay_alerts")
  //   .select("id, created_at")
  //   .eq("ride_id", rideId)
  //   .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
  //   .limit(1);

  // if (recentAlerts && recentAlerts.length > 0) {
  //   return false; // تم إرسال تنبيه مؤخراً
  // }

  // حفظ التنبيه في قاعدة البيانات
  // TODO: استخدام جدول delay_alerts بعد تنفيذ migration
  // const { error } = await supabase.from("delay_alerts").insert({
  //   ride_id: rideId,
  //   driver_id: driverId,
  //   rider_id: riderId,
  //   estimated_arrival_minutes: estimatedArrivalMinutes,
  //   actual_delay_minutes: delayMinutes,
  //   ride_status: status,
  //   driver_location: driverLocation,
  //   target_location: targetLocation,
  // });

  // if (error) {
  //   console.error("Error saving delay alert:", error);
  //   return false;
  // }

  // إرسال التنبيه للراكب
  const statusText =
    status === "accepted"
      ? "السائق متأخر في الوصول"
      : status === "arrived"
      ? "السائق وصل ولكن متأخر"
      : "الرحلة تستغرق وقتاً أطول";

  const message = `${statusText}. التأخير: ${delayMinutes} دقيقة`;

  // Toast notification
  toast.warning("⏰ تنبيه تأخير", {
    description: message,
    duration: 8000,
  });

  // Browser notification
  showNotification("⏰ تنبيه تأخير", message, {
    tag: `delay-${rideId}`,
    duration: 10000,
  });

  // إرسال إشعار في التطبيق
  // TODO: استخدام جدول notifications بعد تنفيذ migration
  // await supabase.from("notifications").insert({
  //   user_id: riderId,
  //   title: "⌚ تنبيه تأخير",
  //   message: message,
  //   type: "delay_alert",
  //   related_id: rideId,
  // });

  return true;
};

/**
 * Hook لمراقبة التأخير أثناء الرحلة
 */
export const useDelayMonitoring = (
  rideId: string | null,
  driverId: string | null,
  riderId: string | null,
  status: "accepted" | "arrived" | "in_progress" | null,
  driverLocation: { lat: number; lng: number } | null,
  targetLocation: { lat: number; lng: number } | null,
  estimatedArrivalMinutes: number | null,
  enabled: boolean = true
) => {
  const [startTime] = useState<number>(Date.now());
  const [lastAlertTime, setLastAlertTime] = useState<number | null>(null);

  useEffect(() => {
    if (
      !enabled ||
      !rideId ||
      !driverId ||
      !riderId ||
      !status ||
      !driverLocation ||
      !targetLocation ||
      !estimatedArrivalMinutes
    ) {
      return;
    }

    const checkDelay = async () => {
      const elapsedMinutes = Math.floor((Date.now() - startTime) / 1000 / 60);

      // لا نرسل تنبيهات متكررة خلال 5 دقائق
      if (lastAlertTime && Date.now() - lastAlertTime < 5 * 60 * 1000) {
        return;
      }

      const alertSent = await checkAndSendDelayAlert(
        rideId,
        driverId,
        riderId,
        status,
        driverLocation,
        targetLocation,
        estimatedArrivalMinutes,
        elapsedMinutes
      );

      if (alertSent) {
        setLastAlertTime(Date.now());
      }
    };

    // التحقق كل دقيقة
    const interval = setInterval(checkDelay, 60000);

    // التحقق مرة واحدة عند البداية
    checkDelay();

    return () => clearInterval(interval);
  }, [
    enabled,
    rideId,
    driverId,
    riderId,
    status,
    driverLocation,
    targetLocation,
    estimatedArrivalMinutes,
    startTime,
    lastAlertTime,
  ]);
};

/**
 * إنشاء جدول delay_alerts في قاعدة البيانات
 * يتم استدعاؤها مرة واحدة فقط
 * TODO: تفعيل بعد تنفيذ migration
 */
export const createDelayAlertsTable = async () => {
  // const { error } = await supabase.rpc("create_delay_alerts_table");
  
  // if (error) {
  //   console.error("Error creating delay_alerts table:", error);
  //   return false;
  // }

  return true;
};

/**
 * الحصول على سجل التنبيهات لرحلة معينة
 * TODO: تفعيل بعد تنفيذ migration
 */
export const getRideDelayAlerts = async (
  rideId: string
): Promise<DelayAlert[]> => {
  // const { data, error } = await supabase
  //   .from("delay_alerts")
  //   .select("*")
  //   .eq("ride_id", rideId)
  //   .order("created_at", { ascending: false });

  // if (error) {
  //   console.error("Error fetching delay alerts:", error);
  //   return [];
  // }

  // return (data || []) as any as DelayAlert[];
  return [];
};

/**
 * إحصائيات التأخير للسائق
 * TODO: تفعيل بعد تنفيذ migration
 */
export const getDriverDelayStats = async (driverId: string) => {
  // const { data, error } = await supabase
  //   .from("delay_alerts")
  //   .select("actual_delay_minutes")
  //   .eq("driver_id", driverId)
  //   .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // آخر 30 يوم

  // if (error || !data) {
  //   return {
  //     totalAlerts: 0,
  //     averageDelay: 0,
  //     maxDelay: 0,
  //   };
  // }

  // const delays = data.map((d: any) => d.actual_delay_minutes);

  // return {
  //   totalAlerts: delays.length,
  //   averageDelay: delays.length > 0 ? Math.round(delays.reduce((a: number, b: number) => a + b, 0) / delays.length) : 0,
  //   maxDelay: delays.length > 0 ? Math.max(...delays) : 0,
  // };
  
  return {
    totalAlerts: 0,
    averageDelay: 0,
    maxDelay: 0,
  };
};
