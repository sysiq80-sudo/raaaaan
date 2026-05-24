import { useCallback, useEffect, useRef } from "react";

export const GEOLOCATION_SUPERSEDED = "GEOLOCATION_SUPERSEDED";

export const useBestGeolocation = () => {
  const refineWatchIdRef = useRef<number | null>(null);
  const activeRequestIdRef = useRef(0);
  const activeRejectRef = useRef<((reason?: unknown) => void) | null>(null);

  useEffect(() => {
    return () => {
      if (refineWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(refineWatchIdRef.current);
        refineWatchIdRef.current = null;
      }
      activeRequestIdRef.current += 1;
      activeRejectRef.current = null;
    };
  }, []);

  return useCallback((onRefine?: (pos: GeolocationPosition) => void) => {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("NO_GEOLOCATION"));
        return;
      }

      activeRejectRef.current?.(new Error(GEOLOCATION_SUPERSEDED));
      activeRequestIdRef.current += 1;
      const requestId = activeRequestIdRef.current;
      activeRejectRef.current = reject;

      const quickOptions: PositionOptions = {
        enableHighAccuracy: false,
        timeout: 4000,
        maximumAge: 60000,
      };

      const refineOptions: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      };

      if (refineWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(refineWatchIdRef.current);
        refineWatchIdRef.current = null;
      }

      const isCurrentRequest = () => activeRequestIdRef.current === requestId;

      let best: GeolocationPosition | null = null;
      let resolved = false;
      const stopRefineAfterMs = 7000;
      const startedAt = Date.now();

      const tryResolve = (pos: GeolocationPosition) => {
        if (isCurrentRequest() && !resolved) {
          resolved = true;
          activeRejectRef.current = null;
          resolve(pos);
        }
      };

      const watchId = navigator.geolocation.watchPosition(
        (wp) => {
          if (!isCurrentRequest()) return;

          if (!best || wp.coords.accuracy < best.coords.accuracy) {
            best = wp;
            if (resolved) onRefine?.(wp);
          }

          if (
            wp.coords.accuracy <= 30 ||
            Date.now() - startedAt > stopRefineAfterMs
          ) {
            navigator.geolocation.clearWatch(watchId);
            if (refineWatchIdRef.current === watchId) {
              refineWatchIdRef.current = null;
            }
          }
        },
        () => {
          if (!isCurrentRequest()) return;
          navigator.geolocation.clearWatch(watchId);
          if (refineWatchIdRef.current === watchId) {
            refineWatchIdRef.current = null;
          }
        },
        refineOptions,
      );

      refineWatchIdRef.current = watchId;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!isCurrentRequest()) return;
          best = pos;
          tryResolve(pos);
        },
        (err) => {
          if (!isCurrentRequest()) return;

          if (best) {
            tryResolve(best);
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              if (!isCurrentRequest()) return;
              best = fallbackPos;
              tryResolve(fallbackPos);
            },
            (fallbackErr) => {
              if (!isCurrentRequest()) return;
              activeRejectRef.current = null;
              reject(fallbackErr || err);
            },
            quickOptions,
          );
        },
        refineOptions,
      );
    });
  }, []);
};
