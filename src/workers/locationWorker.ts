/**
 * ران — Location SharedWorker (locationWorker.ts)
 *
 * Runs as a Vite SharedWorker so all open tabs share ONE geolocation watcher.
 * Usage in backgroundLocationService.ts:
 *   new SharedWorker(new URL('../workers/locationWorker.ts', import.meta.url), { type: 'module' })
 */

// SharedWorker context — self typed as any to avoid lib conflicts (webworker vs DOM)
// At runtime self IS SharedWorkerGlobalScope
declare const self: any;

interface StartPayload {
  rideId:         string;
  updateInterval: number;   // ms between broadcasts
  minAccuracy:    number;   // filter pings worse than this (metres)
}

const ports         = new Set<MessagePort>();
let watchId:        number | null = null;
let currentRideId:  string = '';
let updateInterval: number = 5_000;
let minAccuracy:    number = 50;
let lastBroadcast:  number = 0;

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function broadcast(msg: object): void {
  for (const port of ports) {
    try   { port.postMessage(msg); }
    catch { ports.delete(port); }
  }
}

function startWatcher(): void {
  if (watchId !== null) return;   // already watching
  if (!('geolocation' in self.navigator)) {
    console.warn('[locationWorker] Geolocation not available in SharedWorker');
    return;
  }

  watchId = self.navigator.geolocation.watchPosition(
    (pos) => {
      const now = Date.now();
      if (now - lastBroadcast < updateInterval)  return;
      if (pos.coords.accuracy > minAccuracy)     return;
      lastBroadcast = now;

      broadcast({
        type: 'LOCATION_UPDATE',
        payload: {
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          accuracy:  pos.coords.accuracy,
          heading:   pos.coords.heading,
          speed:     pos.coords.speed,
          timestamp: now,
          rideId:    currentRideId,
        },
      });
    },
    (err) => console.error('[locationWorker] error:', err.message),
    { enableHighAccuracy: true, maximumAge: 1_000, timeout: 5_000 },
  );
}

function stopWatcher(): void {
  if (watchId !== null) {
    self.navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

// ──────────────────────────────────────────────────────────────
// SharedWorker connection handler
// ──────────────────────────────────────────────────────────────

self.onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  ports.add(port);
  port.start();

  port.onmessage = ({ data }: MessageEvent) => {
    if (data.type === 'START') {
      const p         = data.payload as StartPayload;
      currentRideId   = p.rideId;
      updateInterval  = p.updateInterval ?? 5_000;
      minAccuracy     = p.minAccuracy    ?? 50;
      startWatcher();
    }

    if (data.type === 'STOP') {
      ports.delete(port);
      if (ports.size === 0) {
        stopWatcher();
        currentRideId = '';
      }
    }
  };

  port.onmessageerror = () => ports.delete(port);
};
