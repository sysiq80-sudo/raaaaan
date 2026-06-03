import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isNativePlatform } from '@/lib/capacitorBridge';

interface UseRiderLocationOptions {
  enabled?: boolean;
  updateInterval?: number; // milliseconds
}

interface LocationCoords {
  lat: number;
  lng: number;
}

export const useRiderLocation = (options: UseRiderLocationOptions = {}) => {
  const { enabled = true, updateInterval = 5000 } = options;
  const lastUpdateRef = useRef<number>(0);
  const watchIdRef = useRef<string | number | null>(null);
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dbErrorCountRef = useRef<number>(0);

  const updateLocation = useCallback(async (lat: number, lng: number) => {
    const now = Date.now();
    
    const locationData = { lat, lng };

    // Always update local state (cheap) but throttle DB writes
    setLocation(prev => {
      if (prev && prev.lat === locationData.lat && prev.lng === locationData.lng) return prev;
      return locationData;
    });
    setError(null);

    // Throttle database updates
    if (now - lastUpdateRef.current < updateInterval) {
      return;
    }

    dbErrorCountRef.current = 0;
  }, [updateInterval]);

  const handleError = useCallback((msg: string) => {
    console.warn('Geolocation error:', msg);
    setError(msg);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    const startTracking = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      if (isNativePlatform) {
        try {
          const { Geolocation } = await import('@capacitor/geolocation');
          
          // Check and request permissions natively
          const checkPerm = await Geolocation.checkPermissions();
          if (checkPerm.location !== 'granted' && checkPerm.coarseLocation !== 'granted') {
            const reqPerm = await Geolocation.requestPermissions();
            if (reqPerm.location !== 'granted' && reqPerm.coarseLocation !== 'granted') {
              throw new Error("PERMISSION_DENIED");
            }
          }

          if (!mounted) return;

          // Get initial position natively
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
          });

          if (mounted && position) {
            updateLocation(position.coords.latitude, position.coords.longitude);
          }

          // Watch position changes natively
          const watchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 5000 },
            (pos, err) => {
              if (!mounted) return;
              if (err || !pos) {
                handleError(err?.message || "Watch position native error");
                return;
              }
              updateLocation(pos.coords.latitude, pos.coords.longitude);
            }
          );

          if (mounted) {
            watchIdRef.current = watchId;
          }
        } catch (err: any) {
          console.warn("⚠️ Native Geolocation failed, trying web fallback:", err);
          startWebTracking();
        }
      } else {
        startWebTracking();
      }
    };

    const startWebTracking = () => {
      if (!navigator.geolocation || !mounted) return;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (mounted) {
            updateLocation(position.coords.latitude, position.coords.longitude);
          }
        },
        (err) => handleError(err.message),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (mounted) {
            updateLocation(position.coords.latitude, position.coords.longitude);
          }
        },
        (err) => handleError(err.message),
        { enableHighAccuracy: true, timeout: 3000, maximumAge: 1000 }
      );

      if (mounted) {
        watchIdRef.current = watchId;
      }
    };

    startTracking();

    return () => {
      mounted = false;
      if (watchIdRef.current !== null) {
        if (isNativePlatform && typeof watchIdRef.current === 'string') {
          import('@capacitor/geolocation').then(({ Geolocation }) => {
            Geolocation.clearWatch({ id: watchIdRef.current as string });
          }).catch(() => {});
        } else if (typeof watchIdRef.current === 'number') {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        watchIdRef.current = null;
      }
    };
  }, [enabled, updateLocation, handleError]);

  // Clear location when user closes the app
  useEffect(() => {
    const clearLocation = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ current_location: null })
          .eq('user_id', user.id);
      }
    };

    window.addEventListener('beforeunload', clearLocation);

    return () => {
      window.removeEventListener('beforeunload', clearLocation);
    };
  }, []);

  return { location, error, isLoading: !location && !error };
};
