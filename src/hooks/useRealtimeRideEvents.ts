/**
 * React Hook: useRealtimeRideEvents
 * Integrates EventDeduplicator with Supabase Realtime
 * Listens to ride events and deduplicates them
 * Solves: Rider/Driver getting out of sync from duplicate updates
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { RideEvent } from '@/lib/eventDeduplication/types';
import { EventDeduplicator } from '@/lib/eventDeduplication/EventDeduplicator';
const uuidv4 = () => crypto.randomUUID();

interface UseRealtimeRideEventsOptions {
  rideId: string | null;
  nodeId: 'rider' | 'driver'; // Current node type
  onRideAccepted?: (data: any) => void;
  onLocationUpdate?: (data: any) => void;
  onRideCompleted?: (data: any) => void;
  onRideCancelled?: (data: any) => void;
  onETAUpdated?: (data: any) => void;
  onDriverArrived?: (data: any) => void;
  onError?: (error: Error) => void;
}

interface UseRealtimeRideEventsReturn {
  /** Is connected to realtime channel */
  isConnected: boolean;

  /** Current deduplicator stats */
  stats: ReturnType<EventDeduplicator['getStats']>;

  /** Manually emit event (useful for local state changes) */
  emitLocalEvent: (
    eventType: RideEvent['eventType'],
    payload: Record<string, any>
  ) => Promise<void>;

  /** Manually clear events (when ride ends) */
  clearEvents: () => void;
}

export function useRealtimeRideEvents(
  options: UseRealtimeRideEventsOptions
): UseRealtimeRideEventsReturn {
  const {
    rideId,
    nodeId,
    onRideAccepted,
    onLocationUpdate,
    onRideCompleted,
    onRideCancelled,
    onETAUpdated,
    onDriverArrived,
    onError,
  } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const dedupRef = useRef<EventDeduplicator>(new EventDeduplicator());
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState(dedupRef.current.getStats());

  /**
   * Map event callbacks
   */
  const eventCallbacks: Record<string, (data: any) => void> = {
    'ride-accepted': onRideAccepted || (() => {}),
    'location-update': onLocationUpdate || (() => {}),
    'ride-completed': onRideCompleted || (() => {}),
    'ride-cancelled': onRideCancelled || (() => {}),
    'eta-updated': onETAUpdated || (() => {}),
    'driver-arrived': onDriverArrived || (() => {}),
  };

  /**
   * Process incoming event
   */
  const handleIncomingEvent = useCallback(
    async (incomingEvent: RideEvent) => {
      try {
        // Step 1: Deduplicate
        const processedEvent = await dedupRef.current.processEvent(incomingEvent);

        if (!processedEvent) {
          console.debug(
            `[useRealtimeRideEvents] Duplicate event skipped - Type: ${incomingEvent.eventType}`
          );
          return;
        }

        // Step 2: Update stats
        setStats(dedupRef.current.getStats());

        // Step 3: Call appropriate callback
        const callback = eventCallbacks[incomingEvent.eventType];
        if (callback) {
          callback(incomingEvent.payload);
          console.debug(
            `[useRealtimeRideEvents] Event processed on ${nodeId} - Type: ${incomingEvent.eventType}`
          );
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (onError) {
          onError(err);
        }
        console.error('[useRealtimeRideEvents] Error processing event:', err);
      }
    },
    [nodeId, eventCallbacks, onError]
  );

  /**
   * Emit local event (e.g., when rider accepts ride)
   */
  const emitLocalEvent = useCallback(
    async (eventType: RideEvent['eventType'], payload: Record<string, any>) => {
      if (!rideId) {
        console.warn('[useRealtimeRideEvents] Cannot emit event: no rideId');
        return;
      }

      try {
        const event: RideEvent = {
          eventId: uuidv4(),
          lamportTimestamp: dedupRef.current.getLamportClock(),
          eventType,
          source: nodeId,
          destination: nodeId === 'rider' ? 'driver' : 'rider',
          rideId,
          payload,
          timestamp: Date.now(),
        };

        // Process locally first
        await handleIncomingEvent(event);

        // Then broadcast to channel
        await channelRef.current?.send({
          type: 'broadcast',
          event: 'ride_event',
          payload: event,
        });

        console.debug(
          `[useRealtimeRideEvents] Local event emitted - Type: ${eventType}, Destination: ${event.destination}`
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (onError) {
          onError(err);
        }
        console.error('[useRealtimeRideEvents] Error emitting local event:', err);
      }
    },
    [rideId, nodeId, handleIncomingEvent, onError]
  );

  /**
   * Clear events
   */
  const clearEvents = useCallback(() => {
    if (rideId) {
      dedupRef.current.clearRideEvents(rideId);
      setStats(dedupRef.current.getStats());
      console.debug(`[useRealtimeRideEvents] Events cleared for ride ${rideId}`);
    }
  }, [rideId]);

  /**
   * Setup Realtime channel
   */
  useEffect(() => {
    if (!rideId) {
      setIsConnected(false);
      return;
    }

    // Create channel
    const channel = supabase.channel(`ride:${rideId}`, {
      config: {
        broadcast: { self: true },
      },
    });

    // Listen for ride events
    channel.on('broadcast', { event: 'ride_event' }, ({ payload }) => {
      const incomingEvent = payload as RideEvent;

      // Only process if event is for this ride and current node
      if (
        incomingEvent.rideId === rideId &&
        (incomingEvent.destination === nodeId || incomingEvent.destination === 'broadcast')
      ) {
        handleIncomingEvent(incomingEvent);
      }
    });

    // Subscribe
    channel
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          console.debug(
            `[useRealtimeRideEvents] Connected to ride channel - RideID: ${rideId}, Node: ${nodeId}`
          );
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          console.debug(`[useRealtimeRideEvents] Disconnected from ride channel`);
        }
      })
      .catch((error) => {
        console.error('[useRealtimeRideEvents] Channel error:', error);
        if (onError) {
          onError(error);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [rideId, nodeId, handleIncomingEvent, onError]);

  /**
   * Update stats periodically
   */
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(dedupRef.current.getStats());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return {
    isConnected,
    stats,
    emitLocalEvent,
    clearEvents,
  };
}
