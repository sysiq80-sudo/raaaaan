/**
 * ران - Hook لحفظ آخر موقع للمستخدم
 * يحفظ الموقع الأخير لتحسين تجربة المستخدم
 */

import { useCallback, useMemo, useRef } from "react";
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
  
  // Use ref to track if we've already saved this location
  const lastSavedRef = useRef<string>("");

  const saveLocation = useCallback(
    (location: { lat: number; lng: number; address: string }) => {
      // Create a unique key for this location
      const locationKey = `${location.lat.toFixed(4)}_${location.lng.toFixed(4)}`;
      
      // Don't save if it's the same location
      if (lastSavedRef.current === locationKey) {
        return;
      }
      
      lastSavedRef.current = locationKey;
      setLastLocation({
        ...location,
        timestamp: Date.now(),
      });
    },
    [setLastLocation]
  );

  const clearLocation = useCallback(() => {
    lastSavedRef.current = "";
    setLastLocation(null);
  }, [setLastLocation]);

  // التحقق من صلاحية الموقع (أقل من 24 ساعة)
  const isLocationValid = useMemo(() => {
    if (!lastLocation) return false;
    const age = Date.now() - lastLocation.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    return age < maxAge;
  }, [lastLocation]);

  const validLocation = useMemo(() => {
    return isLocationValid ? lastLocation : null;
  }, [isLocationValid, lastLocation]);

  return {
    lastLocation: validLocation,
    saveLocation,
    clearLocation,
    isLocationValid,
  };
};

export default useLastLocation;
