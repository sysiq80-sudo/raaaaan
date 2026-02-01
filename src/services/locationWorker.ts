// src/services/locationWorker.ts
// Shared Worker for background location processing

interface WorkerMessage {
  type: 'START' | 'STOP' | 'UPDATE';
  payload?: any;
}

let isActive = false;
let watchId: number | null = null;
let updateInterval = 5000;
let rideId: string | null = null;

// Handle messages from main thread
self.onconnect = (event: any) => {
  const port = event.ports[0];

  port.onmessage = async (message: MessageEvent<WorkerMessage>) => {
    console.log('[LocationWorker] Received:', message.data.type);

    switch (message.data.type) {
      case 'START':
        await handleStart(message.data.payload, port);
        break;

      case 'STOP':
        handleStop();
        break;

      case 'UPDATE':
        // Immediate update request
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }
        startWatching(port);
        break;
    }
  };

  port.start();
};

/**
 * Start location tracking
 */
async function handleStart(
  payload: any,
  port: any
): Promise<void> {
  if (isActive) {
    console.warn('[LocationWorker] Already active');
    return;
  }

  rideId = payload.rideId;
  updateInterval = payload.updateInterval || 5000;
  isActive = true;

  console.log('[LocationWorker] Starting with interval:', updateInterval);

  startWatching(port);
}

/**
 * Watch position with high accuracy
 */
function startWatching(port: any): void {
  if (!navigator.geolocation) {
    console.error('[LocationWorker] Geolocation not available');
    return;
  }

  let lastUpdate = 0;

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const now = Date.now();

      // Rate limiting
      if (now - lastUpdate < updateInterval) {
        return;
      }

      lastUpdate = now;

      const locationData = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp,
      };

      // Send to main thread
      port.postMessage({
        type: 'LOCATION_UPDATE',
        payload: locationData,
      });

      console.log('[LocationWorker] Sent update:', {
        lat: locationData.lat.toFixed(6),
        lng: locationData.lng.toFixed(6),
        accuracy: locationData.accuracy.toFixed(1),
      });
    },
    (error) => {
      console.error('[LocationWorker] Geolocation error:', error);
      port.postMessage({
        type: 'ERROR',
        payload: { error: error.message },
      });
    },
    {
      enableHighAccuracy: true,
      maximumAge: 500, // Very fresh
      timeout: 3000,
    }
  );

  console.log('[LocationWorker] Watching position...');
}

/**
 * Stop tracking
 */
function handleStop(): void {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  isActive = false;
  rideId = null;

  console.log('[LocationWorker] Stopped');
}

// Keep worker alive
self.addEventListener('message', (event) => {
  // Prevent worker from being terminated
});
