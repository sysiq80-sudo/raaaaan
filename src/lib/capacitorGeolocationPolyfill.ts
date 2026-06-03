import { Capacitor } from '@capacitor/core';

export const initGeolocationPolyfill = () => {
  // Only apply polyfill when running natively inside Capacitor wrapper
  if (!Capacitor.isNativePlatform()) {
    console.log('[GeolocationPolyfill] Web environment detected — using browser default Geolocation');
    return;
  }

  const originalGeolocation = navigator.geolocation;
  if (!originalGeolocation) {
    console.warn('[GeolocationPolyfill] navigator.geolocation is not supported in this browser environment');
    return;
  }

  console.log('[GeolocationPolyfill] Native WebView wrapper detected — installing Geolocation polyfill');

  const originalGetCurrentPosition = originalGeolocation.getCurrentPosition.bind(originalGeolocation);
  const originalWatchPosition = originalGeolocation.watchPosition.bind(originalGeolocation);
  const originalClearWatch = originalGeolocation.clearWatch.bind(originalGeolocation);

  let nextWatchId = 1;
  const activeWatches = new Map<number, { capWatchIdPromise: Promise<string>; cancelled: boolean; webWatchId?: number }>();

  // Lazy load Geolocation plugin and request permissions
  const getCapacitorGeolocation = async () => {
    const { Geolocation } = await import('@capacitor/geolocation');
    
    // Check and request permissions natively
    const checkPerm = await Geolocation.checkPermissions();
    if (checkPerm.location !== 'granted' && checkPerm.coarseLocation !== 'granted') {
      console.log('[GeolocationPolyfill] Requesting native location permissions...');
      const reqPerm = await Geolocation.requestPermissions();
      if (reqPerm.location !== 'granted' && reqPerm.coarseLocation !== 'granted') {
        throw {
          code: 1, // PERMISSION_DENIED
          message: 'Location permission denied by user',
        };
      }
    }
    return Geolocation;
  };

  // 1. Polyfill getCurrentPosition
  navigator.geolocation.getCurrentPosition = (
    successCallback: PositionCallback,
    errorCallback?: PositionErrorCallback | null,
    options?: PositionOptions
  ) => {
    getCapacitorGeolocation()
      .then(async (Geolocation) => {
        try {
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: options?.enableHighAccuracy ?? true,
            timeout: options?.timeout ?? 10000,
            maximumAge: options?.maximumAge ?? 0,
          });
          
          // Map Capacitor Position to web GeolocationPosition format
          const webPosition: GeolocationPosition = {
            coords: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy ?? 0,
              altitude: pos.coords.altitude ?? null,
              altitudeAccuracy: pos.coords.altitudeAccuracy ?? null,
              heading: pos.coords.heading ?? null,
              speed: pos.coords.speed ?? null,
            },
            timestamp: pos.timestamp,
          };
          successCallback(webPosition);
        } catch (err: any) {
          console.warn('[GeolocationPolyfill] Native getCurrentPosition failed, falling back to Web API:', err);
          originalGetCurrentPosition(successCallback, errorCallback, options);
        }
      })
      .catch((err) => {
        console.warn('[GeolocationPolyfill] Native Geolocation permissions failed, falling back to Web API:', err);
        originalGetCurrentPosition(successCallback, errorCallback, options);
      });
  };

  // 2. Polyfill watchPosition (returns watchId number synchronously)
  navigator.geolocation.watchPosition = (
    successCallback: PositionCallback,
    errorCallback?: PositionErrorCallback | null,
    options?: PositionOptions
  ): number => {
    const watchId = nextWatchId++;
    
    const watchObj: { capWatchIdPromise: Promise<string>; cancelled: boolean; webWatchId?: number } = {
      cancelled: false,
      capWatchIdPromise: (async () => {
        const Geolocation = await getCapacitorGeolocation();
        if (watchObj.cancelled) return '';

        const capWatchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: options?.enableHighAccuracy ?? true,
          },
          (pos, err) => {
            if (watchObj.cancelled) return;
            if (err || !pos) {
              if (errorCallback) {
                errorCallback({
                  code: 2, // POSITION_UNAVAILABLE
                  message: err?.message || 'Watch position native error',
                  PERMISSION_DENIED: 1,
                  POSITION_UNAVAILABLE: 2,
                  TIMEOUT: 3,
                });
              }
              return;
            }

            // Map Capacitor Position to web GeolocationPosition format
            const webPosition: GeolocationPosition = {
              coords: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy ?? 0,
                altitude: pos.coords.altitude ?? null,
                altitudeAccuracy: pos.coords.altitudeAccuracy ?? null,
                heading: pos.coords.heading ?? null,
                speed: pos.coords.speed ?? null,
              },
              timestamp: pos.timestamp,
            };
            successCallback(webPosition);
          }
        );
        return capWatchId;
      })().catch((err) => {
        console.warn('[GeolocationPolyfill] Native watchPosition failed, falling back to Web watch:', err);
        if (!watchObj.cancelled) {
          const webWatchId = originalWatchPosition(successCallback, errorCallback, options);
          watchObj.webWatchId = webWatchId;
        }
        return '';
      }),
    };

    activeWatches.set(watchId, watchObj);
    return watchId;
  };

  // 3. Polyfill clearWatch
  navigator.geolocation.clearWatch = (watchId: number) => {
    const watchObj = activeWatches.get(watchId);
    if (!watchObj) {
      originalClearWatch(watchId);
      return;
    }

    watchObj.cancelled = true;
    if (watchObj.webWatchId !== undefined) {
      originalClearWatch(watchObj.webWatchId);
    } else {
      watchObj.capWatchIdPromise.then((capWatchId) => {
        if (capWatchId) {
          import('@capacitor/geolocation').then(({ Geolocation }) => {
            Geolocation.clearWatch({ id: capWatchId });
          }).catch(() => {});
        }
      });
    }
    activeWatches.delete(watchId);
  };

  console.log('📍 Geolocation polyfill installed successfully for native platform');
};
