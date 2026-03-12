import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDriverVisibilitySettings } from "./useDriverVisibilitySettings";

type VehicleType = "economy" | "comfort" | "premium" | "women_only";

interface DriverLocation {
  id: string;
  lat: number;
  lng: number;
  vehicle_type?: VehicleType;
  vehicle_model?: string;
  vehicle_color?: string;
  rating?: number;
  lastUpdated?: number;
}

interface UseOptimizedNearbyDriversOptions {
  /** Debounce time for location updates in ms */
  debounceMs?: number;
  /** Max radius in km to consider drivers */
  maxRadiusKm?: number;
  /** Enable realtime updates */
  enableRealtime?: boolean;
  /** Throttle marker updates in ms */
  throttleMs?: number;
}

const DEFAULT_OPTIONS: UseOptimizedNearbyDriversOptions = {
  debounceMs: 1000, // Increased from 500ms for better performance
  maxRadiusKm: 10,
  enableRealtime: true,
  throttleMs: 2000, // Increased from 1000ms to reduce re-renders
};

// Calculate distance between two coordinates in km (Haversine formula)
const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const useOptimizedNearbyDrivers = (
  pickupCoords: { lat: number; lng: number } | null,
  selectedVehicle: VehicleType,
  options: UseOptimizedNearbyDriversOptions = {}
) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Get visibility settings
  const { showRealDrivers, showFakeDrivers, fakeDrivers } =
    useDriverVisibilitySettings();

  const [nearbyDriversCount, setNearbyDriversCount] = useState<number | null>(
    null
  );
  const [availableDriversByType, setAvailableDriversByType] = useState<
    Record<VehicleType, number> | undefined
  >(undefined);
  const [nearbyDriverLocations, setNearbyDriverLocations] = useState<
    DriverLocation[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  // Refs for debouncing and caching
  const debounceTimerRef = useRef<any>(null);
  const lastFetchRef = useRef<number>(0);
  const driversCache = useRef<Map<string, DriverLocation>>(new Map());
  const throttleRef = useRef<any>(null);
  const fallbackLogShownRef = useRef(false);

  // Memoize filtered drivers based on vehicle type and distance
  const filteredDrivers = useMemo(() => {
    if (!pickupCoords) return [];

    return nearbyDriverLocations.filter((driver) => {
      const distance = calculateDistance(
        pickupCoords.lat,
        pickupCoords.lng,
        driver.lat,
        driver.lng
      );
      return distance <= (opts.maxRadiusKm || 10);
    });
  }, [nearbyDriverLocations, pickupCoords, opts.maxRadiusKm]);

  // Optimized fetch function with caching
  const fetchDrivers = useCallback(async () => {
    if (!pickupCoords) {
      setNearbyDriversCount(null);
      setAvailableDriversByType(undefined);
      setNearbyDriverLocations([]);
      driversCache.current.clear();
      return;
    }

    // Prevent too frequent fetches
    const now = Date.now();
    if (now - lastFetchRef.current < 1000) return;
    lastFetchRef.current = now;

    setIsLoading(true);

    try {
      const countsByType: Record<VehicleType, number> = {
        economy: 0,
        comfort: 0,
        premium: 0,
        women_only: 0,
      };

      let newLocations: DriverLocation[] = [];
      const newCache = new Map<string, DriverLocation>();

      // Fetch real drivers only if enabled
      if (showRealDrivers) {
        // Try both available_drivers_safe and drivers table
        let { data: drivers, error } = await supabase
          .from("available_drivers_safe")
          .select(
            "id, vehicle_type, vehicle_model, vehicle_color, rating, current_location, is_online, is_available"
          )
          .eq("is_online", true)
          .eq("is_available", true)
          .not("current_location", "is", null);

        // If available_drivers_safe doesn't work, try drivers table directly
        if (error || !drivers || drivers.length === 0) {
          console.log("Trying drivers table directly...");
          const response = await supabase
            .from("drivers")
            .select(
              `
              id, 
              vehicle_type, 
              vehicle_model, 
              vehicle_color, 
              rating, 
              current_location,
              is_online,
              is_available,
              status
            `
            )
            .eq("status", "approved")
            .eq("is_online", true)
            .eq("is_available", true)
            .not("current_location", "is", null);

          drivers = response.data;
          error = response.error;
        }

        if (error) throw error;

        if (drivers) {
          drivers.forEach((driver) => {
            const type = driver.vehicle_type as VehicleType;
            if (type && countsByType[type] !== undefined) {
              countsByType[type]++;
            }

            const loc = driver.current_location as {
              lat: number;
              lng: number;
            } | null;
            if (loc?.lat && loc?.lng) {
              const driverData: DriverLocation = {
                id: driver.id,
                lat: loc.lat,
                lng: loc.lng,
                vehicle_type: type,
                vehicle_model: driver.vehicle_model || undefined,
                vehicle_color: driver.vehicle_color || undefined,
                rating: driver.rating || 5.0,
                lastUpdated: now,
              };
              newLocations.push(driverData);
              newCache.set(driver.id, driverData);
            }
          });
        }
      }

      // Add fake drivers if enabled
      if (showFakeDrivers && fakeDrivers.length > 0) {
        fakeDrivers.forEach((fakeDriver) => {
          const type = fakeDriver.vehicle_type as VehicleType;
          if (type && countsByType[type] !== undefined) {
            countsByType[type]++;
          }

          const loc = fakeDriver.location as {
            lat: number;
            lng: number;
          } | null;
          if (loc?.lat && loc?.lng) {
            const driverData: DriverLocation = {
              id: `fake-${fakeDriver.id}`,
              lat: loc.lat,
              lng: loc.lng,
              vehicle_type: type,
              vehicle_model: fakeDriver.vehicle_model || undefined,
              vehicle_color: fakeDriver.vehicle_color || undefined,
              rating: fakeDriver.rating || 4.8,
              lastUpdated: now,
            };
            newLocations.push(driverData);
            newCache.set(driverData.id, driverData);
          }
        });
      }

      // Add fallback fake drivers for development if no real drivers found
      if (newLocations.length === 0 && pickupCoords) {
        if (!fallbackLogShownRef.current) {
          console.log("No drivers found, adding fallback drivers for development");
          fallbackLogShownRef.current = true;
        }
        const fallbackDrivers = [
          {
            id: "dev-1",
            vehicle_type: "economy" as VehicleType,
            lat: pickupCoords.lat + 0.001,
            lng: pickupCoords.lng + 0.001,
            vehicle_model: "Toyota Corolla",
            vehicle_color: "أبيض",
            rating: 4.8,
          },
          {
            id: "dev-2",
            vehicle_type: "comfort" as VehicleType,
            lat: pickupCoords.lat - 0.001,
            lng: pickupCoords.lng - 0.001,
            vehicle_model: "Honda Civic",
            vehicle_color: "أسود",
            rating: 4.9,
          },
          {
            id: "dev-3",
            vehicle_type: "premium" as VehicleType,
            lat: pickupCoords.lat + 0.002,
            lng: pickupCoords.lng - 0.002,
            vehicle_model: "BMW X5",
            vehicle_color: "رمادي",
            rating: 4.95,
          },
          {
            id: "dev-4",
            vehicle_type: "women_only" as VehicleType,
            lat: pickupCoords.lat - 0.002,
            lng: pickupCoords.lng + 0.002,
            vehicle_model: "Nissan Altima",
            vehicle_color: "أحمر",
            rating: 4.85,
          },
        ];

        fallbackDrivers.forEach((fallbackDriver) => {
          const type = fallbackDriver.vehicle_type;
          countsByType[type]++;

          const driverData: DriverLocation = {
            id: fallbackDriver.id,
            lat: fallbackDriver.lat,
            lng: fallbackDriver.lng,
            vehicle_type: type,
            vehicle_model: fallbackDriver.vehicle_model,
            vehicle_color: fallbackDriver.vehicle_color,
            rating: fallbackDriver.rating,
            lastUpdated: now,
          };
          newLocations.push(driverData);
          newCache.set(driverData.id, driverData);
        });
      }

      // Update cache
      driversCache.current = newCache;

      setAvailableDriversByType(countsByType);
      setNearbyDriversCount(countsByType[selectedVehicle] || 0);
      setNearbyDriverLocations(newLocations);
    } catch (error) {
      console.error("Error fetching nearby drivers:", error);
    } finally {
      setIsLoading(false);
    }
  }, [
    pickupCoords,
    selectedVehicle,
    showRealDrivers,
    showFakeDrivers,
    fakeDrivers,
  ]);

  // Debounced fetch when pickup coords change
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchDrivers();
    }, opts.debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [pickupCoords, fetchDrivers, opts.debounceMs]);

  // Realtime subscription for driver location updates
  useEffect(() => {
    if (!opts.enableRealtime || !pickupCoords) return;

    const channel = supabase
      .channel("drivers-location-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "drivers",
          filter: "is_online=eq.true",
        },
        (payload) => {
          // Throttle updates to prevent too many re-renders
          if (throttleRef.current) return;

          throttleRef.current = setTimeout(() => {
            throttleRef.current = null;
          }, opts.throttleMs);

          const updatedDriver = payload.new as {
            id: string;
            current_location: { lat: number; lng: number } | null;
            vehicle_type: VehicleType;
            is_available: boolean;
            is_online: boolean;
          };

          if (!updatedDriver.is_online || !updatedDriver.is_available) {
            // Remove driver from cache and state
            driversCache.current.delete(updatedDriver.id);
            setNearbyDriverLocations((prev) =>
              prev.filter((d) => d.id !== updatedDriver.id)
            );
            return;
          }

          const loc = updatedDriver.current_location;
          if (!loc?.lat || !loc?.lng) return;

          // Check if within range
          const distance = calculateDistance(
            pickupCoords.lat,
            pickupCoords.lng,
            loc.lat,
            loc.lng
          );

          if (distance > (opts.maxRadiusKm || 10)) {
            // Remove if out of range
            driversCache.current.delete(updatedDriver.id);
            setNearbyDriverLocations((prev) =>
              prev.filter((d) => d.id !== updatedDriver.id)
            );
            return;
          }

          // Update or add driver
          const driverData: DriverLocation = {
            id: updatedDriver.id,
            lat: loc.lat,
            lng: loc.lng,
            vehicle_type: updatedDriver.vehicle_type,
            lastUpdated: Date.now(),
          };

          driversCache.current.set(updatedDriver.id, driverData);

          setNearbyDriverLocations((prev) => {
            const existing = prev.findIndex((d) => d.id === updatedDriver.id);
            if (existing >= 0) {
              // Update existing driver's position
              const updated = [...prev];
              updated[existing] = driverData;
              return updated;
            } else {
              // Add new driver
              return [...prev, driverData];
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }
    };
  }, [pickupCoords, opts.enableRealtime, opts.maxRadiusKm, opts.throttleMs]);

  // Periodic refresh as fallback (less frequent with realtime enabled)
  useEffect(() => {
    if (!pickupCoords) return; // Don't poll if no pickup location
    const interval = opts.enableRealtime ? 45000 : 20000; // 45s with realtime, 20s without (increased)
    const timer = setInterval(fetchDrivers, interval);
    return () => clearInterval(timer);
  }, [fetchDrivers, opts.enableRealtime, pickupCoords]);

  // Update count when vehicle type changes
  useEffect(() => {
    if (availableDriversByType) {
      setNearbyDriversCount(availableDriversByType[selectedVehicle] || 0);
    }
  }, [selectedVehicle, availableDriversByType]);

  return {
    nearbyDriversCount,
    availableDriversByType,
    nearbyDriverLocations: filteredDrivers,
    isLoading,
    refresh: fetchDrivers,
  };
};
