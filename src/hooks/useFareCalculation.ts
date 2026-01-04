import { useState, useEffect } from 'react';
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

  useEffect(() => {
    const calculateFare = async () => {
      if (!pickupCoords || !dropoffCoords || !routeDistance) {
        setFareBreakdown(null);
        return;
      }

      setFareLoading(true);
      try {
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
          console.error('Error calculating fare:', error);
          return;
        }

        if (data && !data.error) {
          setFareBreakdown(data);
        }
      } catch (error) {
        console.error('Error calculating fare:', error);
      } finally {
        setFareLoading(false);
      }
    };

    calculateFare();
  }, [pickupCoords, dropoffCoords, selectedVehicle, routeDistance]);

  return { fareBreakdown, fareLoading, setFareBreakdown };
};
