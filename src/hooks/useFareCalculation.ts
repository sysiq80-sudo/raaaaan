import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

type VehicleType = 'economy' | 'comfort' | 'premium' | 'women_only';

export interface FareBreakdown {
  base_fare: number;
  distance_km: number;
  distance_fare: number;
  per_km_rate: number;
  waiting_minutes: number;
  waiting_fare: number;
  vehicle_type: string;
  vehicle_multiplier: number;
  subtotal: number;
  vehicle_adjusted_fare: number;
  service_fee: number;
  total_fare: number;
  region_name: string;
  region_id?: string;
  formatted_fare: string;
}

export const useFareCalculation = (
  pickupCoords: { lat: number; lng: number } | null,
  dropoffCoords: { lat: number; lng: number } | null,
  selectedVehicle: VehicleType,
  routeDistance: number | null
) => {
  const [fareBreakdown, setFareBreakdown] = useState<FareBreakdown | null>(null);
  const [fareLoading, setFareLoading] = useState(false);
  const [fareError, setFareError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSuccessfulFareRef = useRef<FareBreakdown | null>(null);

  const estimateFareLocally = (
    distanceKm: number,
    vehicle: VehicleType,
  ): FareBreakdown => {
    const baseFare = 2000;
    const perKmRate = 500;
    const vehicleMultipliers: Record<VehicleType, number> = {
      economy: 1,
      comfort: 1.3,
      premium: 1.8,
      women_only: 1.2,
    };
    const vehicleMultiplier = vehicleMultipliers[vehicle] ?? 1;
    const distanceFare = distanceKm * perKmRate;
    const subtotal = Math.max(baseFare, baseFare + distanceFare);
    const totalFare = Math.round(subtotal * vehicleMultiplier);

    return {
      base_fare: baseFare,
      distance_km: distanceKm,
      distance_fare: distanceFare,
      per_km_rate: perKmRate,
      waiting_minutes: 0,
      waiting_fare: 0,
      vehicle_type: vehicle,
      vehicle_multiplier: vehicleMultiplier,
      subtotal,
      vehicle_adjusted_fare: totalFare,
      service_fee: 0,
      total_fare: totalFare,
      region_name: "تقدير تقريبي",
      formatted_fare: `${totalFare.toLocaleString()} د.ع`,
    };
  };

  useEffect(() => {
    // Clear any previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const calculateFare = async () => {
      // ⚠️ Early return if missing coordinates
      if (!pickupCoords || !dropoffCoords) {
        setFareBreakdown(null);
        setFareError(null);
        return;
      }

      // ⚠️ If route distance is not available, wait a bit longer
      // routeDistance can be 0, so check for null/undefined specifically, not falsy
      if (routeDistance === null || routeDistance === undefined) {
        setFareBreakdown(null);
        return;
      }

      setFareLoading(true);
      setFareError(null);

      try {
        // Set a timeout to prevent infinite loading (20 seconds)
        const timeoutPromise = new Promise((_, reject) => {
          timeoutRef.current = setTimeout(() => {
            reject(new Error('Fare calculation timeout'));
          }, 20000);
        });

        const invokePromise = (async () => {
          const { data, error } = await supabase.functions.invoke('calculate-fare', {
            body: {
              pickup_lat: pickupCoords.lat,
              pickup_lng: pickupCoords.lng,
              dropoff_lat: dropoffCoords.lat,
              dropoff_lng: dropoffCoords.lng,
              distance_km: routeDistance,
              vehicle_type: selectedVehicle,
              waiting_minutes: 0
            }
          });

          if (error) {
            console.error('❌ Edge Function error:', error);
            throw new Error(`API Error: ${error.message || 'Unknown error'}`);
          }

          if (data?.error) {
            console.error('❌ Fare calculation error:', data.error);
            throw new Error(data.error);
          }

          if (!data) {
            throw new Error('No fare data received');
          }

          return data;
        })();

        const data = await Promise.race([invokePromise, timeoutPromise]);
        
        if (data) {
          setFareBreakdown(data);
          lastSuccessfulFareRef.current = data as FareBreakdown;
          console.log('✅ Fare calculated successfully:', data.formatted_fare);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ Error calculating fare:', errorMsg);
        setFareError(errorMsg);

        // لا تمسح الأجرة السابقة عند timeout/خطأ عابر — للحفاظ على قابلية الحجز
        if (lastSuccessfulFareRef.current) {
          setFareBreakdown(lastSuccessfulFareRef.current);
        } else if (routeDistance !== null && routeDistance !== undefined) {
          // Fallback محلي إذا لا توجد أجرة سابقة
          setFareBreakdown(estimateFareLocally(routeDistance, selectedVehicle));
        } else {
          setFareBreakdown(null);
        }
      } finally {
        setFareLoading(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    };

    calculateFare();

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [pickupCoords, dropoffCoords, selectedVehicle, routeDistance]);

  return { fareBreakdown, fareLoading, fareError, setFareBreakdown };
};
