/**
 * ران - Hook لحفظ آخر موقع للمستخدم
 * يحفظ الموقع الأخير لتحسين تجربة المستخدم
 */

import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";

interface LastLocation {
  lat: number;
  lng: number;
  address: string;
  timestamp: number;
}

export const useLastLocation = () => {
  const [lastLocation, setLastLocation] = useLocalStorage<LastLocation | null>(
    "raan_last_location",
    null
  );

  const saveLocation = useCallback(
    (location: { lat: number; lng: number; address: string }) => {
      setLastLocation({
        ...location,
        timestamp: Date.now(),
      });
    },
    [setLastLocation]
  );

  const clearLocation = useCallback(() => {
    setLastLocation(null);
  }, [setLastLocation]);

  // التحقق من صلاحية الموقع (أقل من 24 ساعة)
  const isLocationValid = useCallback(() => {
    if (!lastLocation) return false;
    const age = Date.now() - lastLocation.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    return age < maxAge;
  }, [lastLocation]);

  return {
    lastLocation: isLocationValid() ? lastLocation : null,
    saveLocation,
    clearLocation,
    isLocationValid,
  };
};

export default useLastLocation;
