/**
 * ران - Hook لحفظ البيانات في localStorage
 * يحفظ آخر الرحلات والمواقع والإعدادات
 */

import React, { useEffect, useCallback, useState } from "react";

export const useLocalStorage = <T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] => {
  // الحصول على القيمة من localStorage
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item =
        typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading from localStorage[${key}]:`, error);
      return defaultValue;
    }
  });

  // حفظ القيمة في localStorage
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(`Error writing to localStorage[${key}]:`, error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
};

/**
 * Hook لحفظ آخر رحلة
 */
export const useLastRide = () => {
  const [lastRide, setLastRide] = useLocalStorage("raan_last_ride", {
    pickupAddress: "",
    pickupLat: 0,
    pickupLng: 0,
    dropoffAddress: "",
    dropoffLat: 0,
    dropoffLng: 0,
    vehicleType: "economy",
    timestamp: 0,
  });

  const saveLastRide = useCallback(
    (rideData: typeof lastRide) => {
      setLastRide({
        ...rideData,
        timestamp: Date.now(),
      });
    },
    [setLastRide]
  );

  const clearLastRide = useCallback(() => {
    setLastRide({
      pickupAddress: "",
      pickupLat: 0,
      pickupLng: 0,
      dropoffAddress: "",
      dropoffLat: 0,
      dropoffLng: 0,
      vehicleType: "economy",
      timestamp: 0,
    });
  }, [setLastRide]);

  return { lastRide, saveLastRide, clearLastRide };
};

/**
 * Hook لحفظ الإعدادات المفضلة
 */
export const useRiderPreferences = () => {
  const [preferences, setPreferences] = useLocalStorage(
    "raan_rider_preferences",
    {
      preferredVehicleType: "economy",
      preferredPaymentMethod: "cash",
      enableNotifications: true,
      enableLocationSharing: true,
      theme: "dark" as "light" | "dark",
      language: "ar" as "ar" | "en" | "ku",
    }
  );

  const updatePreference = useCallback(
    <K extends keyof typeof preferences>(
      key: K,
      value: (typeof preferences)[K]
    ) => {
      setPreferences((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    [setPreferences]
  );

  return { preferences, updatePreference };
};
