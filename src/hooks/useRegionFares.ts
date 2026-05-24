/**
 * Hook for caching region fare information
 * Reduces database queries by caching fare data
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { semiStaticDataConfig, queryKeys } from '@/lib/queryConfig';
import { useMemo, useCallback } from 'react';
import { calculateLocalDistance, type Coordinates } from '@/lib/mapUtils';
import { useVehicleTypes, type VehicleTypeKey } from './useVehicleTypes';

interface RegionFare {
  id: string;
  name_ar: string;
  name_en: string | null;
  base_fare: number;
  per_km_fare: number;
  per_minute_fare: number;
  waiting_fare_per_min: number;
}

interface FareEstimate {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  totalFare: number;
  distance: number; // in km
  estimatedMinutes: number;
}

export function useRegionFares() {
  const { getMultiplier } = useVehicleTypes();

  // Fetch and cache all region fares
  const { data: regionFares = [], isLoading, error } = useQuery({
    queryKey: queryKeys.regionFares(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regions')
        .select('id, name_ar, name_en, base_fare, per_km_fare, per_minute_fare, waiting_fare_per_min')
        .eq('is_active', true);

      if (error) throw error;
      return data as RegionFare[];
    },
    ...semiStaticDataConfig,
  });

  // Get fare info for a specific region
  const getRegionFare = useCallback((regionId: string): RegionFare | undefined => {
    return regionFares.find(r => r.id === regionId);
  }, [regionFares]);

  // Get default fare (first region or fallback)
  const defaultFare = useMemo((): RegionFare => {
    return regionFares[0] || {
      id: 'default',
      name_ar: 'افتراضي',
      name_en: 'Default',
      base_fare: 2000,
      per_km_fare: 500,
      per_minute_fare: 150,
      waiting_fare_per_min: 200
    };
  }, [regionFares]);

  // Calculate fare estimate locally (no API call)
  const calculateFareEstimate = useCallback((
    pickup: Coordinates,
    dropoff: Coordinates,
    regionId?: string,
    vehicleType: VehicleTypeKey = 'economy'
  ): FareEstimate => {
    // Get region fare or use default
    const fare = regionId ? getRegionFare(regionId) : defaultFare;
    const baseFare = fare?.base_fare || 2000;
    const perKmFare = fare?.per_km_fare || 500;
    const perMinuteFare = fare?.per_minute_fare || 0;

    // Calculate distance locally using Turf.js
    const distance = calculateLocalDistance(pickup, dropoff);

    // تقدير وقت الرحلة: متوسط 30 كم/ساعة في المدن العراقية
    const estimatedMinutes = Math.max(1, Math.round((distance / 30) * 60));

    // Calculate fares
    const distanceFare = Math.round(distance * perKmFare);
    const timeFare = Math.round(estimatedMinutes * perMinuteFare);
    const subtotal = baseFare + distanceFare + timeFare;

    // Apply vehicle type multiplier
    const multiplier = getMultiplier(vehicleType);
    const totalFare = Math.round(subtotal * multiplier);

    return {
      baseFare,
      distanceFare,
      timeFare,
      totalFare,
      distance: Math.round(distance * 10) / 10, // Round to 1 decimal
      estimatedMinutes,
    };
  }, [getRegionFare, defaultFare, getMultiplier]);

  // Calculate fare with waiting time
  const calculateFareWithWaiting = useCallback((
    pickup: Coordinates,
    dropoff: Coordinates,
    waitingMinutes: number,
    regionId?: string,
    vehicleType: VehicleTypeKey = 'economy'
  ): FareEstimate & { waitingFare: number } => {
    const estimate = calculateFareEstimate(pickup, dropoff, regionId, vehicleType);
    const fare = regionId ? getRegionFare(regionId) : defaultFare;
    const waitingFarePerMin = fare?.waiting_fare_per_min || 200;

    const waitingFare = Math.round(waitingMinutes * waitingFarePerMin);

    return {
      ...estimate,
      waitingFare,
      totalFare: estimate.totalFare + waitingFare
    };
  }, [calculateFareEstimate, getRegionFare, defaultFare]);

  return {
    regionFares,
    isLoading,
    error,
    getRegionFare,
    defaultFare,
    calculateFareEstimate,
    calculateFareWithWaiting,
  };
}
