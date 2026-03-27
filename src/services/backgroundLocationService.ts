/**
 * ران — Background Location Service v2
 *
 * Key changes from v1:
 *  1. Every GPS ping is written to IndexedDB (locationDB) — survives offline.
 *  2. flushLocationBuffer() sends directly to Supabase REST, no BroadcastChannel-only.
 *  3. syncOfflineLocations() bulk-uploads pending IndexedDB entries on reconnection.
 *  4. Listens to window 'online' for automatic re-sync.
 *  5. SharedWorker (locationWorker.ts) used when available; watchPosition fallback.
 *  6. startTracking() now receives driverId as a required option.
 */

import {
  addLocation,
  getPendingLocations,
  markLocationsSynced,
  purgeOldLocations,
} from './locationDB';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface LocationData {
  lat:      number;
  lng:      number;
  accuracy: number;
  heading?: number | null;
  speed?:   number | null;
  timestamp: number;
}

export interface BackgroundLocationOptions {
  driverId:        string;         // REQUIRED — needed for IndexedDB key + Supabase write
  rideId:          string;
  updateInterval?: number;        // ms (default 5 000)
  minAccuracy?:    number;        // metres (default 50)
}

// ─────────────────────────────────────────────────────────────────
// Supabase upsert helper — uses fetch directly to avoid import cycles
// ─────────────────────────────────────────────────────────────────

async function upsertLiveLocation(
  driverId:  string,
  rideId:    string,
  loc:       LocationData,
  isOffline  = false,
): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/driver_live_locations`,
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':         SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer':         'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          ride_id:    rideId,
          driver_id:  driverId,
          location:   { lat: loc.lat, lng: loc.lng },
          heading:    loc.heading  ?? null,
          speed:      loc.speed    ?? null,
          accuracy:   loc.accuracy,
          is_offline: isOffline,
          updated_at: new Date(loc.timestamp).toISOString(),
        }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────
// Service class
// ─────────────────────────────────────────────────────────────────

class BackgroundLocationService {
  private worker:          SharedWorker | null = null;
  private watchId:         number | null = null;
  private updateInterval:  number = 5_000;
  private minAccuracy:     number = 50;
  private isRunning:       boolean = false;
  private lastUpdate:      number = 0;
  private currentDriverId: string = '';
  private currentRideId:   string = '';

  // ── public: start ─────────────────────────────────────────────

  async startTracking(opts: BackgroundLocationOptions): Promise<void> {
    const {
      driverId,
      rideId,
      updateInterval = 5_000,
      minAccuracy    = 50,
    } = opts;

    this.currentDriverId = driverId;
    this.currentRideId   = rideId;
    this.updateInterval  = updateInterval;
    this.minAccuracy     = minAccuracy;
    this.isRunning       = true;

    console.log('[BgLocation] Starting — ride:', rideId, 'driver:', driverId);

    // Prefer SharedWorker (survives tab switches, shared across tabs)
    if (typeof SharedWorker !== 'undefined') {
      try {
        this.worker = new SharedWorker(
          new URL('../workers/locationWorker.ts', import.meta.url),
          { type: 'module' },
        );
        this.worker.port.start();
        this.worker.port.postMessage({
          type: 'START',
          payload: { rideId, updateInterval, minAccuracy },
        });
        this.worker.port.onmessage = (e) => {
          if (e.data.type === 'LOCATION_UPDATE')
            this.handleLocationUpdate(e.data.payload);
        };
      } catch (err) {
        console.warn('[BgLocation] SharedWorker failed, falling back:', err);
        this.startWatchPosition();
      }
    } else {
      this.startWatchPosition();
    }

    // Flush anything buffered from a previous offline session
    void this.syncOfflineLocations();

    // Reconnect handler
    window.addEventListener('online', this.onOnline);

    void this.setupPeriodicSync(rideId);
  }

  // ── public: stop ──────────────────────────────────────────────

  stopTracking(): void {
    console.log('[BgLocation] Stopping');

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.worker) {
      this.worker.port.postMessage({ type: 'STOP' });
      this.worker = null;
    }

    window.removeEventListener('online', this.onOnline);

    // Final flush
    void this.syncOfflineLocations();

    this.isRunning = false;
  }

  // ── watchPosition fallback ────────────────────────────────────

  private startWatchPosition(): void {
    if (!navigator.geolocation) {
      console.error('[BgLocation] Geolocation not available');
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handleLocationUpdate({
        lat:       pos.coords.latitude,
        lng:       pos.coords.longitude,
        accuracy:  pos.coords.accuracy,
        heading:   pos.coords.heading,
        speed:     pos.coords.speed,
        timestamp: Date.now(),
      }),
      (err) => console.error('[BgLocation] watchPosition error:', err),
      { enableHighAccuracy: true, maximumAge: 1_000, timeout: 3_000 },
    );
  }

  // ── core handler: write to IndexedDB then Supabase ────────────

  private async handleLocationUpdate(loc: LocationData): Promise<void> {
    const now = Date.now();
    if (now - this.lastUpdate < this.updateInterval) return;
    if (loc.accuracy > this.minAccuracy) return;

    this.lastUpdate = now;

    console.log(
      `[BgLocation] ${loc.lat.toFixed(5)},${loc.lng.toFixed(5)} ` +
      `±${loc.accuracy.toFixed(0)}m | ${navigator.onLine ? 'online' : 'OFFLINE'}`,
    );

    // 1. Always write to IndexedDB first — durable even if offline
    const localId = await addLocation({
      driver_id: this.currentDriverId,
      ride_id:   this.currentRideId,
      lat:       loc.lat,
      lng:       loc.lng,
      accuracy:  loc.accuracy,
      heading:   loc.heading,
      speed:     loc.speed,
      timestamp: now,
    });

    // 2. Attempt live Supabase write only when online
    if (navigator.onLine) {
      const ok = await upsertLiveLocation(
        this.currentDriverId,
        this.currentRideId,
        loc,
        false,
      );
      if (ok) await markLocationsSynced([localId]);
    }

    // 3. Broadcast to other open tabs (for map updates in the same browser)
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('location_sync');
      ch.postMessage({ type: 'LOCATION_UPDATE', payload: loc });
      ch.close();
    }
  }

  // ── offline re-sync ───────────────────────────────────────────

  /** Bulk-upload all pending IndexedDB pings to Supabase. */
  async syncOfflineLocations(): Promise<void> {
    if (!navigator.onLine)          return;
    if (!this.currentDriverId)      return;

    const pending = await getPendingLocations(this.currentDriverId);
    if (!pending.length) return;

    console.log(`[BgLocation] Syncing ${pending.length} offline pings…`);

    const synced: number[] = [];
    for (const loc of pending) {
      const ok = await upsertLiveLocation(
        loc.driver_id,
        loc.ride_id,
        {
          lat:       loc.lat,
          lng:       loc.lng,
          accuracy:  loc.accuracy,
          heading:   loc.heading,
          speed:     loc.speed,
          timestamp: loc.timestamp,
        },
        true,
      );
      if (ok && loc.id) synced.push(loc.id);
    }

    if (synced.length) {
      await markLocationsSynced(synced);
      console.log(`[BgLocation] Synced ${synced.length}/${pending.length} pings`);
    }

    void purgeOldLocations(); // clean-up old synced records
  }

  // ── event handlers ────────────────────────────────────────────

  private onOnline = (): void => {
    console.log('[BgLocation] Network restored — running offline sync');
    void this.syncOfflineLocations();
  };

  // ── periodic background sync (SW) ────────────────────────────

  private async setupPeriodicSync(rideId: string): Promise<void> {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      await (reg as any).periodicSync.register('sync-location', {
        minInterval: 30_000,
      });
    } catch {
      // periodicSync not supported in all browsers — silent fallback
    }
  }

  // ── misc ──────────────────────────────────────────────────────

  isActive(): boolean { return this.isRunning; }

  async getBufferSize(): Promise<number> {
    return getPendingLocations(this.currentDriverId).then((a) => a.length);
  }

  async requestImmediateUpdate(): Promise<LocationData | null> {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          accuracy:  pos.coords.accuracy,
          heading:   pos.coords.heading,
          speed:     pos.coords.speed,
          timestamp: Date.now(),
        }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5_000, maximumAge: 0 },
      );
    });
  }
}

export const backgroundLocationService = new BackgroundLocationService();
