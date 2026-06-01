import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type VehicleType = 'economy' | 'comfort' | 'premium' | 'women_only';

interface DriverLocation {
  id: string;
  lat: number;
  lng: number;
}

export const useNearbyDrivers = (
  pickupCoords: { lat: number; lng: number } | null,
  selectedVehicle: VehicleType
) => {
  const [nearbyDriversCount, setNearbyDriversCount] = useState<number | null>(null);
  const [availableDriversByType, setAvailableDriversByType] = useState<Record<VehicleType, number> | undefined>(undefined);
  const [nearbyDriverLocations, setNearbyDriverLocations] = useState<DriverLocation[]>([]);
  const [driversError, setDriversError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let consecutiveErrors = 0;

    const fetchNearbyDrivers = async () => {
      if (!pickupCoords) {
        setNearbyDriversCount(null);
        setAvailableDriversByType(undefined);
        setNearbyDriverLocations([]);
        setDriversError(null);
        return;
      }

      try {
        // ✅ FIX: استخدام PostGIS RPC بدل تحميل كل السائقين + فلتر JS
        // كان: supabase.from('available_drivers_safe').select('*') → filter in JS
        // الآن: get_nearby_drivers يُفلتر جغرافياً في PostgreSQL
        const { data: drivers, error } = await supabase
          .rpc('get_nearby_drivers', {
            p_lat: pickupCoords.lat,
            p_lng: pickupCoords.lng,
            p_radius_km: 15 // نطاق البحث 15 كم
          });

        if (isCancelled) return;

        if (error) {
          consecutiveErrors++;
          console.error('Error fetching nearby drivers:', error);
          if (consecutiveErrors >= 3) {
            setDriversError('تعذر جلب بيانات السائقين');
          }
          return;
        }

        consecutiveErrors = 0;
        setDriversError(null);

        if (drivers) {
          const countsByType: Record<VehicleType, number> = {
            economy: 0,
            comfort: 0,
            premium: 0,
            women_only: 0
          };
          
          const locations: DriverLocation[] = [];
          
          drivers.forEach((driver: any) => {
            const type = driver.vehicle_type as VehicleType;
            if (type && countsByType[type] !== undefined) {
              countsByType[type]++;
            }
            
            if (driver.lat && driver.lng) {
              locations.push({ id: driver.id, lat: driver.lat, lng: driver.lng });
            }
          });
          
          setAvailableDriversByType(countsByType);
          setNearbyDriversCount(countsByType[selectedVehicle] || 0);
          setNearbyDriverLocations(locations);
        }
      } catch (error) {
        if (isCancelled) return;
        consecutiveErrors++;
        console.error('Error fetching nearby drivers:', error);
        if (consecutiveErrors >= 3) {
          setDriversError('تعذر جلب بيانات السائقين');
        }
      }
    };

    fetchNearbyDrivers();
    
    const interval = setInterval(fetchNearbyDrivers, 45000); // كان 15 ثانية — رُفع لتقليل Disk IO
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [pickupCoords, selectedVehicle]);

  return {
    nearbyDriversCount,
    availableDriversByType,
    nearbyDriverLocations,
    driversError
  };
};
