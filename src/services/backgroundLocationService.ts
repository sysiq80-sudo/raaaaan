// src/services/backgroundLocationService.ts
// Background Location Tracking Service with FusedLocationProvider

interface LocationData {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

interface BackgroundLocationOptions {
  rideId: string;
  updateInterval?: number; // milliseconds
  minAccuracy?: number; // meters
}

class BackgroundLocationService {
  private worker: SharedWorker | Worker | null = null;
  private watchId: number | null = null;
  private updateInterval: number = 5000; // 5 seconds
  private lastLocationUpdate: number = 0;
  private minAccuracy: number = 50; // 50 meters minimum accuracy
  private isRunning: boolean = false;
  private locationBuffer: LocationData[] = [];

  /**
   * Start background location tracking
   */
  async startTracking(options: BackgroundLocationOptions): Promise<void> {
    const { rideId, updateInterval = 5000, minAccuracy = 50 } = options;

    this.updateInterval = updateInterval;
    this.minAccuracy = minAccuracy;

    console.log('[BackgroundLocation] Starting tracking for ride:', rideId);

    // Try to use SharedWorker for true background processing
    if (typeof SharedWorker !== 'undefined') {
      try {
        this.worker = new SharedWorker(
          new URL('./locationWorker.ts', import.meta.url),
          { type: 'module' }
        );
        this.worker.port.start();
        this.worker.port.postMessage({
          type: 'START',
          payload: { rideId, updateInterval },
        });

        this.worker.port.onmessage = (event) => {
          if (event.data.type === 'LOCATION_UPDATE') {
            this.handleLocationUpdate(event.data.payload);
          }
        };
      } catch (error) {
        console.warn('[BackgroundLocation] SharedWorker not available:', error);
        this.startFallbackTracking(rideId);
      }
    } else {
      this.startFallbackTracking(rideId);
    }

    this.isRunning = true;
    this.setupPeriodicSync(rideId);
  }

  /**
   * Fallback tracking using watchPosition + Service Worker
   */
  private startFallbackTracking(rideId: string): void {
    console.log('[BackgroundLocation] Using fallback tracking method');

    if (!navigator.geolocation) {
      console.error('[BackgroundLocation] Geolocation not available');
      return;
    }

    // Use watchPosition for real-time updates
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: LocationData = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
        };

        // Only update if accuracy is good enough
        if (location.accuracy <= this.minAccuracy) {
          this.handleLocationUpdate(location);
        }
      },
      (error) => {
        console.error('[BackgroundLocation] Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000, // 1 second
        timeout: 3000, // 3 second timeout
      }
    );
  }

  /**
   * Handle location updates
   */
  private async handleLocationUpdate(location: LocationData): Promise<void> {
    const now = Date.now();

    // Rate limiting
    if (now - this.lastLocationUpdate < this.updateInterval) {
      return;
    }

    this.lastLocationUpdate = now;

    // Add to buffer
    this.locationBuffer.push(location);

    // Batch updates (send every 3 locations or 15 seconds)
    if (
      this.locationBuffer.length >= 3 ||
      now - this.locationBuffer[0].timestamp > 15000
    ) {
      await this.flushLocationBuffer();
    }

    console.log('[BackgroundLocation] Update:', {
      lat: location.lat.toFixed(6),
      lng: location.lng.toFixed(6),
      accuracy: location.accuracy.toFixed(1),
    });
  }

  /**
   * Send buffered locations to server
   */
  private async flushLocationBuffer(): Promise<void> {
    if (this.locationBuffer.length === 0) {
      return;
    }

    try {
      const locationsToSend = [...this.locationBuffer];
      this.locationBuffer = [];

      // Broadcast to all tabs
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('location_sync');
        channel.postMessage({
          type: 'LOCATION_BATCH',
          payload: locationsToSend,
        });
        channel.close();
      }

      console.log('[BackgroundLocation] Flushed', locationsToSend.length, 'locations');
    } catch (error) {
      console.error('[BackgroundLocation] Error flushing buffer:', error);
      // Add back to buffer on error
      this.locationBuffer.unshift(...this.locationBuffer);
    }
  }

  /**
   * Setup Periodic Background Sync (for when tab is closed)
   */
  private async setupPeriodicSync(rideId: string): Promise<void> {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        // Request periodic sync every 30 seconds
        await (registration as any).periodicSync.register('sync-location', {
          minInterval: 30 * 1000, // 30 seconds
        });
        console.log('[BackgroundLocation] Periodic sync registered');
      } catch (error) {
        console.warn('[BackgroundLocation] Periodic sync not available:', error);
      }
    }
  }

  /**
   * Stop background tracking
   */
  stopTracking(): void {
    console.log('[BackgroundLocation] Stopping tracking');

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.worker) {
      if ('port' in this.worker) {
        this.worker.port.postMessage({ type: 'STOP' });
      }
      this.worker = null;
    }

    // Flush remaining locations
    this.flushLocationBuffer();

    this.isRunning = false;
  }

  /**
   * Check if tracking is active
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.locationBuffer.length;
  }

  /**
   * Manual location request (for immediate update)
   */
  async requestImmediateUpdate(): Promise<LocationData | null> {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: LocationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now(),
          };
          resolve(location);
        },
        (error) => {
          console.error('[BackgroundLocation] Failed to get immediate location:', error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    });
  }
}

export const backgroundLocationService = new BackgroundLocationService();
export type { LocationData, BackgroundLocationOptions };
