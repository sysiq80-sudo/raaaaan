// src/hooks/useAdvancedLocationTracking.ts
// Advanced location tracking with background support

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { backgroundLocationService, type LocationData } from '@/services/backgroundLocationService';

interface UseAdvancedLocationTrackingOptions {
  rideId?: string;
  enabled?: boolean;
  updateInterval?: number;
  minAccuracy?: number;
  onLocationUpdate?: (location: LocationData) => void;
  sendToServer?: boolean;
}

interface TrackingStats {
  totalUpdates: number;
  lastUpdateTime: number;
  averageAccuracy: number;
  bufferSize: number;
}

export const useAdvancedLocationTracking = (
  options: UseAdvancedLocationTrackingOptions = {}
) => {
  const {
    rideId,
    enabled = true,
    updateInterval = 5000,
    minAccuracy = 50,
    onLocationUpdate,
    sendToServer = true,
  } = options;

  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<TrackingStats>({
    totalUpdates: 0,
    lastUpdateTime: 0,
    averageAccuracy: 0,
    bufferSize: 0,
  });

  const statsRef = useRef<TrackingStats>({
    totalUpdates: 0,
    lastUpdateTime: 0,
    averageAccuracy: 0,
    bufferSize: 0,
  });

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Initialize broadcast channel for cross-tab sync
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      let isActive = true;
      broadcastChannelRef.current = new BroadcastChannel('location_sync');

      broadcastChannelRef.current.onmessage = (event) => {
        if (!isActive) return;
        if (event.data.type === 'LOCATION_BATCH') {
          const locations: LocationData[] = event.data.payload;

          locations.forEach((location) => {
            statsRef.current.totalUpdates++;
            statsRef.current.lastUpdateTime = location.timestamp;

            // Update average accuracy
            statsRef.current.averageAccuracy =
              (statsRef.current.averageAccuracy * (statsRef.current.totalUpdates - 1) +
                location.accuracy) /
              statsRef.current.totalUpdates;

            onLocationUpdate?.(location);

            // Send to server
            if (sendToServer && rideId) {
              sendLocationToServer(rideId, location);
            }
          });

          updateStats();
        }
      };

      return () => {
        isActive = false;
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.close();
          broadcastChannelRef.current = null;
        }
      };
    }
  }, [rideId, sendToServer, onLocationUpdate]);

  // Start/stop tracking
  useEffect(() => {
    if (!enabled || !rideId) {
      stopTracking();
      return;
    }

    startTracking();

    return () => {
      stopTracking();
    };
  }, [enabled, rideId, updateInterval, minAccuracy]);

  const startTracking = useCallback(async () => {
    try {
      console.log('[useAdvancedLocationTracking] Starting tracking');

      await backgroundLocationService.startTracking({
        driverId: '', // will be resolved by the service
        rideId: rideId!,
        updateInterval,
        minAccuracy,
      });

      setIsTracking(true);
      setError(null);

      // Request immediate update
      const location = await backgroundLocationService.requestImmediateUpdate();
      if (location) {
        statsRef.current.totalUpdates++;
        statsRef.current.lastUpdateTime = location.timestamp;
        onLocationUpdate?.(location);

        if (sendToServer && rideId) {
          await sendLocationToServer(rideId, location);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useAdvancedLocationTracking] Error:', message);
      setError(message);
      setIsTracking(false);
    }
  }, [rideId, updateInterval, minAccuracy, onLocationUpdate, sendToServer]);

  const stopTracking = useCallback(() => {
    console.log('[useAdvancedLocationTracking] Stopping tracking');
    backgroundLocationService.stopTracking();
    setIsTracking(false);
  }, []);

  const updateStats = useCallback(async () => {
    statsRef.current.bufferSize = await backgroundLocationService.getBufferSize();
    setStats({ ...statsRef.current });
  }, []);

  const requestImmediateUpdate = useCallback(async () => {
    const location = await backgroundLocationService.requestImmediateUpdate();
    if (location) {
      statsRef.current.totalUpdates++;
      statsRef.current.lastUpdateTime = location.timestamp;
      onLocationUpdate?.(location);

      if (sendToServer && rideId) {
        await sendLocationToServer(rideId, location);
      }

      updateStats();
      return location;
    }
    return null;
  }, [rideId, sendToServer, onLocationUpdate, updateStats]);

  return {
    isTracking,
    error,
    stats,
    startTracking,
    stopTracking,
    requestImmediateUpdate,
    getIsActive: () => backgroundLocationService.isActive(),
  };
};

/**
 * Send location to server
 */
async function sendLocationToServer(
  rideId: string,
  location: LocationData
): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();

    if (!data?.user) {
      console.warn('[sendLocationToServer] No user authenticated');
      return;
    }

    // Update current location in profiles
    const { error } = await supabase
      .from('profiles')
      .update({
        current_location: { lat: location.lat, lng: location.lng },
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', data.user.id);

    if (error) {
      console.error('[sendLocationToServer] Error:', error);
    }

    // Broadcast to other tabs
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(`ride_${rideId}`);
      channel.postMessage({
        type: 'LOCATION_UPDATE',
        payload: {
          rideId,
          location: { lat: location.lat, lng: location.lng },
          accuracy: location.accuracy,
          timestamp: location.timestamp,
        },
      });
      channel.close();
    }
  } catch (error) {
    console.error('[sendLocationToServer] Unexpected error:', error);
  }
}

export type { TrackingStats, LocationData };
