import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseRiderLocationOptions {
  enabled?: boolean;
  updateInterval?: number; // milliseconds
}

interface LocationCoords {
  lat: number;
  lng: number;
}

export const useRiderLocation = (options: UseRiderLocationOptions = {}) => {
  const { enabled = true, updateInterval = 5000 } = options; // Default: update every 5 seconds (reduced from 30s)
  const lastUpdateRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateLocation = useCallback(async (position: GeolocationPosition) => {
    const now = Date.now();
    
    // Throttle updates to avoid too many database writes
    if (now - lastUpdateRef.current < updateInterval) {
      return;
    }
    
    lastUpdateRef.current = now;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const locationData = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };

    // Update state
    setLocation(locationData);
    setError(null);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        current_location: locationData,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating rider location:', updateError);
    } else {
      console.log('Rider location updated:', locationData);
    }
  }, [updateInterval]);

  const handleError = useCallback((err: GeolocationPositionError) => {
    console.warn('Geolocation error:', err.message);
    setError(err.message);
  }, []);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) {
      return;
    }

    // Get initial position
    navigator.geolocation.getCurrentPosition(updateLocation, handleError, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    });

    // Watch position changes - fires every 1-2 seconds when moving
    watchIdRef.current = navigator.geolocation.watchPosition(
      updateLocation,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 3000,
        maximumAge: 1000, // Max 1 second old (reduced from 5s)
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, updateLocation, handleError]);

  // Clear location when component unmounts or user leaves
  useEffect(() => {
    return () => {
      // Optionally clear location when user closes the app
      const clearLocation = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('profiles')
            .update({ current_location: null })
            .eq('user_id', user.id);
        }
      };
      
      // Only clear on actual page unload, not on re-renders
      window.addEventListener('beforeunload', clearLocation);
    };
  }, []);

  return { location, error, isLoading: !location && !error };
};
