import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseRiderLocationOptions {
  enabled?: boolean;
  updateInterval?: number; // milliseconds
}

export const useRiderLocation = (options: UseRiderLocationOptions = {}) => {
  const { enabled = true, updateInterval = 30000 } = options; // Default: update every 30 seconds
  const lastUpdateRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  const updateLocation = useCallback(async (position: GeolocationPosition) => {
    const now = Date.now();
    
    // Throttle updates to avoid too many database writes
    if (now - lastUpdateRef.current < updateInterval) {
      return;
    }
    
    lastUpdateRef.current = now;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const location = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };

    const { error } = await supabase
      .from('profiles')
      .update({ 
        current_location: location,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating rider location:', error);
    } else {
      console.log('Rider location updated:', location);
    }
  }, [updateInterval]);

  const handleError = useCallback((error: GeolocationPositionError) => {
    console.warn('Geolocation error:', error.message);
  }, []);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) {
      return;
    }

    // Get initial position
    navigator.geolocation.getCurrentPosition(updateLocation, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    // Watch position changes
    watchIdRef.current = navigator.geolocation.watchPosition(
      updateLocation,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
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
};
