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
        const { data: drivers, error } = await supabase
          .from('available_drivers_safe')
          .select('id, vehicle_type, current_location')
          .not('current_location', 'is', null);

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
          
          drivers.forEach(driver => {
            const type = driver.vehicle_type as VehicleType;
            if (type && countsByType[type] !== undefined) {
              countsByType[type]++;
            }
            
            const loc = driver.current_location as { lat: number; lng: number } | null;
            if (loc && loc.lat && loc.lng) {
              locations.push({ id: driver.id, lat: loc.lat, lng: loc.lng });
            }
          });
          
          setAvailableDriversByType(countsByType);
          setNearbyDriversCount(countsByType[selectedVehicle] || 0);
          setNearbyDriverLocations(locations);
        }
      } catch (error) {
        consecutiveErrors++;
        console.error('Error fetching nearby drivers:', error);
        if (consecutiveErrors >= 3) {
          setDriversError('تعذر جلب بيانات السائقين');
        }
      }
    };

    fetchNearbyDrivers();
    
    const interval = setInterval(fetchNearbyDrivers, 15000);
    return () => clearInterval(interval);
  }, [pickupCoords, selectedVehicle]);

  return {
    nearbyDriversCount,
    availableDriversByType,
    nearbyDriverLocations,
    driversError
  };
};
