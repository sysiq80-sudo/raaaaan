/**
 * React Hook: useRideEventQueue
 * Manages ride events with automatic deduplication
 * Integrates with Supabase Realtime channel
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { RideEvent, ProcessedEvent } from '@/lib/eventDeduplication/types';
import { EventDeduplicator } from '@/lib/eventDeduplication/EventDeduplicator';
const uuidv4 = () => crypto.randomUUID();

interface UseRideEventQueueOptions {
  rideId: string;
  nodeId: string; // 'rider' | 'driver'
  onEventProcessed?: (event: ProcessedEvent) => void;
  onError?: (error: Error) => void;
  maxQueueSize?: number; // Default: 100
}

interface UseRideEventQueueReturn {
  /** Queue next event for processing */
  queueEvent: (event: Omit<RideEvent, 'eventId' | 'lamportTimestamp'>) => Promise<ProcessedEvent | null>;

  /** Get next event in order */
  getNextEvent: () => ProcessedEvent | null;

  /** Get all pending events */
  getAllEvents: () => ProcessedEvent[];

  /** Clear queue when ride completes */
  clearQueue: () => void;

  /** Current queue size */
  queueSize: number;

  /** Deduplication statistics */
  stats: ReturnType<EventDeduplicator['getStats']>;

  /** Is queue processing */
  isProcessing: boolean;
}

export function useRideEventQueue(options: UseRideEventQueueOptions): UseRideEventQueueReturn {
  const {
    rideId,
    nodeId,
    onEventProcessed,
    onError,
  } = options;

  const dedupRef = useRef<EventDeduplicator>(new EventDeduplicator());
  const [queueSize, setQueueSize] = useState(0);
  const [stats, setStats] = useState(dedupRef.current.getStats());
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Queue an incoming event
   * Automatically assigns eventId, lamportTimestamp, timestamp
   */
  const queueEvent = useCallback(
    async (event: Omit<RideEvent, 'eventId' | 'lamportTimestamp'>): Promise<ProcessedEvent | null> => {
      try {
        setIsProcessing(true);

        const completeEvent: RideEvent = {
          ...event,
          eventId: uuidv4(),
          lamportTimestamp: dedupRef.current.getLamportClock(),
          timestamp: Date.now(),
          rideId, // Ensure correct ride context
        };

        const processedEvent = await dedupRef.current.processEvent(completeEvent);

        if (processedEvent) {
          setQueueSize(dedupRef.current.getAllPendingEvents().length);
          setStats(dedupRef.current.getStats());

          if (onEventProcessed) {
            onEventProcessed(processedEvent);
          }

          console.debug(
            `[useRideEventQueue] Event queued for ride ${rideId} on node ${nodeId} - Type: ${event.eventType}`
          );
        }

        return processedEvent;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (onError) {
          onError(err);
        }
        console.error('[useRideEventQueue] Error queuing event:', err);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [rideId, nodeId, onEventProcessed, onError]
  );

  /**
   * Get next event from queue
   */
  const getNextEvent = useCallback((): ProcessedEvent | null => {
    const nextEvent = dedupRef.current.getNextEvent();
    if (nextEvent) {
      setQueueSize(dedupRef.current.getAllPendingEvents().length);
    }
    return nextEvent;
  }, []);

  /**
   * Get all pending events
   */
  const getAllEvents = useCallback((): ProcessedEvent[] => {
    return dedupRef.current.getAllPendingEvents();
  }, []);

  /**
   * Clear queue
   */
  const clearQueue = useCallback((): void => {
    dedupRef.current.clearRideEvents(rideId);
    setQueueSize(0);
    setStats(dedupRef.current.getStats());
    console.debug(`[useRideEventQueue] Queue cleared for ride ${rideId}`);
  }, [rideId]);

  /**
   * Update stats periodically
   */
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(dedupRef.current.getStats());
      setQueueSize(dedupRef.current.getAllPendingEvents().length);
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      dedupRef.current.clearRideEvents(rideId);
    };
  }, [rideId]);

  return {
    queueEvent,
    getNextEvent,
    getAllEvents,
    clearQueue,
    queueSize,
    stats,
    isProcessing,
  };
}
