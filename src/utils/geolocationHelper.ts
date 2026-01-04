/**
 * Geolocation Helper
 * Provides utilities for handling geolocation with improved error handling and retry logic
 */

export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  retryOnTimeout?: boolean;
  maxRetries?: number;
}

export interface GeolocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GeolocationError {
  code: number;
  message: string;
  messageAr: string;
}

/**
 * Get user's current position with retry logic
 */
export const getCurrentPosition = (
  options: GeolocationOptions = {}
): Promise<GeolocationResult> => {
  const {
    enableHighAccuracy = true,
    timeout = 15000,
    maximumAge = 0,
    retryOnTimeout = true,
    maxRetries = 1
  } = options;

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({
        code: 0,
        message: 'Geolocation is not supported by this browser',
        messageAr: 'المتصفح لا يدعم تحديد الموقع'
      });
      return;
    }

    let retryCount = 0;

    const attemptGetPosition = (isRetry: boolean = false) => {
      const posOptions: PositionOptions = {
        enableHighAccuracy: isRetry ? false : enableHighAccuracy,
        timeout: isRetry ? timeout + 5000 : timeout,
        maximumAge: isRetry ? 60000 : maximumAge
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          });
        },
        (error) => {
          console.error('Geolocation error:', error);

          // Retry with lower accuracy on timeout
          if (retryOnTimeout && error.code === error.TIMEOUT && retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying geolocation (attempt ${retryCount + 1})...`);
            attemptGetPosition(true);
            return;
          }

          reject(getGeolocationError(error));
        },
        posOptions
      );
    };

    attemptGetPosition();
  });
};

/**
 * Watch user's position with improved error handling
 */
export const watchPosition = (
  onSuccess: (result: GeolocationResult) => void,
  onError: (error: GeolocationError) => void,
  options: GeolocationOptions = {}
): number | null => {
  const {
    enableHighAccuracy = true,
    timeout = 15000,
    maximumAge = 10000
  } = options;

  if (!navigator.geolocation) {
    onError({
      code: 0,
      message: 'Geolocation is not supported',
      messageAr: 'المتصفح لا يدعم تحديد الموقع'
    });
    return null;
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      onSuccess({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      });
    },
    (error) => {
      onError(getGeolocationError(error));
    },
    {
      enableHighAccuracy,
      timeout,
      maximumAge
    }
  );

  return watchId;
};

/**
 * Clear position watch
 */
export const clearWatch = (watchId: number): void => {
  if (navigator.geolocation && watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
  }
};

/**
 * Get formatted error message
 */
export const getGeolocationError = (error: GeolocationPositionError): GeolocationError => {
  let messageAr = 'حدث خطأ في تحديد الموقع';

  switch (error.code) {
    case error.PERMISSION_DENIED:
      messageAr = 'تم رفض الوصول للموقع. يرجى تفعيل الموقع من إعدادات المتصفح';
      break;
    case error.POSITION_UNAVAILABLE:
      messageAr = 'معلومات الموقع غير متاحة حالياً';
      break;
    case error.TIMEOUT:
      messageAr = 'انتهت مهلة تحديد الموقع. يرجى المحاولة مرة أخرى';
      break;
  }

  return {
    code: error.code,
    message: error.message,
    messageAr
  };
};

/**
 * Check if geolocation is available
 */
export const isGeolocationAvailable = (): boolean => {
  return 'geolocation' in navigator;
};

/**
 * Request geolocation permission (for browsers that support it)
 */
export const requestGeolocationPermission = async (): Promise<PermissionState | null> => {
  if (!('permissions' in navigator)) {
    return null;
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch (error) {
    console.error('Error checking geolocation permission:', error);
    return null;
  }
};
