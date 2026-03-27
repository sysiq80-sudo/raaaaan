/**
 * ران - نظام دقة GPS لأزرار الرحلة
 * التحقق من موقع السائق قبل السماح بتغيير حالة الرحلة
 */

import { calculateLocalDistance } from "@/lib/mapUtils";

export interface GPSValidation {
  isValid: boolean;
  distance: number;
  message: string;
}

/**
 * التحقق من أن السائق قريب من نقطة الانطلاق
 * @param driverLocation موقع السائق الحالي
 * @param pickupLocation نقطة الانطلاق
 * @param maxDistanceMeters الحد الأقصى للمسافة بالأمتار (افتراضي: 100م)
 */
export const validateDriverAtPickup = (
  driverLocation: { lat: number; lng: number },
  pickupLocation: { lat: number; lng: number },
  maxDistanceMeters: number = 100
): GPSValidation => {
  const distance = calculateLocalDistance(
    driverLocation,
    pickupLocation
  );

  const distanceMeters = distance * 1000;

  if (distanceMeters <= maxDistanceMeters) {
    return {
      isValid: true,
      distance: distanceMeters,
      message: `أنت على بُعد ${Math.round(distanceMeters)}م من موقع الراكب`,
    };
  }

  return {
    isValid: false,
    distance: distanceMeters,
    message: `أنت بعيد عن موقع الراكب (${Math.round(distanceMeters)}م). يجب أن تكون ضمن ${maxDistanceMeters}م`,
  };
};

/**
 * التحقق من أن السائق قريب من نقطة الوجهة
 * @param driverLocation موقع السائق الحالي
 * @param dropoffLocation نقطة الوجهة
 * @param maxDistanceMeters الحد الأقصى للمسافة بالأمتار (افتراضي: 150م)
 */
export const validateDriverAtDropoff = (
  driverLocation: { lat: number; lng: number },
  dropoffLocation: { lat: number; lng: number },
  maxDistanceMeters: number = 150
): GPSValidation => {
  const distance = calculateLocalDistance(
    driverLocation,
    dropoffLocation
  );

  const distanceMeters = distance * 1000;

  if (distanceMeters <= maxDistanceMeters) {
    return {
      isValid: true,
      distance: distanceMeters,
      message: `أنت على بُعد ${Math.round(distanceMeters)}م من الوجهة`,
    };
  }

  return {
    isValid: false,
    distance: distanceMeters,
    message: `لم تصل للوجهة بعد (${Math.round(distanceMeters)}م متبقية). يجب أن تكون ضمن ${maxDistanceMeters}م`,
  };
};

/**
 * التحقق من دقة GPS الحالية
 * @param accuracy دقة GPS بالأمتار من Geolocation API
 * @param maxAccuracy الحد الأقصى المقبول للدقة (افتراضي: 50م)
 */
export const validateGPSAccuracy = (
  accuracy: number | undefined,
  maxAccuracy: number = 50
): GPSValidation => {
  if (accuracy === undefined) {
    return {
      isValid: false,
      distance: 0,
      message: "لا يمكن تحديد دقة GPS. يرجى التأكد من تفعيل تحديد الموقع",
    };
  }

  if (accuracy <= maxAccuracy) {
    return {
      isValid: true,
      distance: accuracy,
      message: `دقة GPS جيدة (±${Math.round(accuracy)}م)`,
    };
  }

  return {
    isValid: false,
    distance: accuracy,
    message: `دقة GPS ضعيفة (±${Math.round(accuracy)}م). يرجى الانتظار للحصول على إشارة أفضل`,
  };
};

/**
 * الحصول على الموقع الحالي مع دقة عالية
 * @param timeout مهلة الانتظار بالميلي ثانية (افتراضي: 10 ثوانٍ)
 */
export const getCurrentLocationHighAccuracy = (
  timeout: number = 10000
): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation غير مدعوم في هذا المتصفح"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => {
        let message = "فشل في تحديد الموقع";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "تم رفض إذن الوصول للموقع. يرجى تفعيله من إعدادات المتصفح";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "معلومات الموقع غير متاحة حالياً";
            break;
          case error.TIMEOUT:
            message = "انتهت مهلة تحديد الموقع. يرجى المحاولة مرة أخرى";
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: timeout,
        maximumAge: 0, // عدم استخدام موقع مخزن مسبقاً
      }
    );
  });
};

/**
 * التحقق الكامل قبل تغيير حالة الرحلة
 */
export const validateRideStatusChange = async (
  newStatus: "arrived" | "in_progress" | "completed",
  driverLocation: { lat: number; lng: number },
  pickupLocation: { lat: number; lng: number },
  dropoffLocation: { lat: number; lng: number },
  gpsAccuracy?: number
): Promise<GPSValidation> => {
  // التحقق من دقة GPS أولاً
  const accuracyCheck = validateGPSAccuracy(gpsAccuracy);
  if (!accuracyCheck.isValid) {
    return accuracyCheck;
  }

  // التحقق حسب الحالة المطلوبة
  switch (newStatus) {
    case "arrived":
      // يجب أن يكون السائق ضمن 100م من نقطة الانطلاق
      return validateDriverAtPickup(driverLocation, pickupLocation, 100);

    case "in_progress":
      // يجب أن يكون السائق ضمن 100م من نقطة الانطلاق
      return validateDriverAtPickup(driverLocation, pickupLocation, 100);

    case "completed":
      // يجب أن يكون السائق ضمن 150م من الوجهة
      return validateDriverAtDropoff(driverLocation, dropoffLocation, 150);

    default:
      return {
        isValid: false,
        distance: 0,
        message: "حالة الرحلة غير صحيحة",
      };
  }
};

/**
 * حساب المسافة المتبقية للوجهة
 */
export const getRemainingDistance = (
  currentLocation: { lat: number; lng: number },
  targetLocation: { lat: number; lng: number }
): { distanceKm: number; distanceMeters: number; message: string } => {
  const distanceKm = calculateLocalDistance(
    currentLocation,
    targetLocation
  );

  const distanceMeters = distanceKm * 1000;

  let message = "";
  if (distanceMeters < 100) {
    message = `أنت قريب جداً (${Math.round(distanceMeters)}م)`;
  } else if (distanceMeters < 500) {
    message = `${Math.round(distanceMeters)}م متبقية`;
  } else if (distanceKm < 5) {
    message = `${distanceKm.toFixed(1)} كم متبقية`;
  } else {
    message = `${Math.round(distanceKm)} كم متبقية`;
  }

  return {
    distanceKm,
    distanceMeters,
    message,
  };
};
