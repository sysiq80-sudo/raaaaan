import { useEffect, useRef, useCallback, useState } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Ride = Database["public"]["Tables"]["rides"]["Row"];

interface UseOptimizedRealtimeOptions {
  enabled?: boolean;
  batchInterval?: number;
  enableCrossTabs?: boolean;
  maxEventsPerMinute?: number;
}

interface RideUpdate {
  id: string;
  changes: Partial<Ride>;
  timestamp: number;
}

export const useOptimizedRealtime = (
  rideId: string | null,
  options: UseOptimizedRealtimeOptions = {},
) => {
  const {
    enabled = true,
    batchInterval = 500,
    enableCrossTabs = true,
    maxEventsPerMinute = 120,
  } = options;

  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const batchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventTimelineRef = useRef<number[]>([]);

  const [isConnected, setIsConnected] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, RideUpdate>>(
    new Map(),
  );
  const [lastUpdate, setLastUpdate] = useState<Partial<Ride> | null>(null);

  const isRateLimited = useCallback(() => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    eventTimelineRef.current = eventTimelineRef.current.filter(
      (time) => time > oneMinuteAgo,
    );

    const isLimited = eventTimelineRef.current.length >= maxEventsPerMinute;

    if (!isLimited) {
      eventTimelineRef.current.push(now);
    }

    return isLimited;
  }, [maxEventsPerMinute]);

  const processBatchUpdates = useCallback(() => {
    if (pendingUpdates.size === 0) return;

    const merged: Partial<Ride> = {};
    pendingUpdates.forEach((update) => {
      Object.assign(merged, update.changes);
    });

    setLastUpdate(merged);

    if (enableCrossTabs && broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: "RIDE_UPDATE",
        rideId,
        updates: merged,
        timestamp: Date.now(),
      });
    }

    setPendingUpdates(new Map());
  }, [pendingUpdates, rideId, enableCrossTabs]);

  useEffect(() => {
    if (!enabled || !rideId) return;

    const setupSubscription = async () => {
      try {
        const channel = supabase.channel(`ride-${rideId}`, {
          config: {
            broadcast: {
              self: false,
              ack: false,
            },
          },
        });

        channel
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "rides",
              filter: `id=eq.${rideId}`,
            },
            (payload) => {
              if (isRateLimited()) {
                console.warn(`[Realtime] Rate limited for ride ${rideId}`);
                return;
              }

              const update: RideUpdate = {
                id: rideId,
                changes: payload.new as Partial<Ride>,
                timestamp: Date.now(),
              };

              setPendingUpdates((prev) => new Map(prev).set(rideId, update));
            },
          )
          .on("system" as any, {} as any, (status: string) => {
            setIsConnected(status === "SUBSCRIBED");
            if (status === "SUBSCRIBED") {
              console.log(`[Realtime] Connected to ride ${rideId}`);
            } else if (status === "CLOSED") {
              console.log(`[Realtime] Disconnected from ride ${rideId}`);
            }
          })
          .subscribe();

        subscriptionRef.current = channel;
      } catch (error) {
        console.error(
          `[Realtime] Failed to setup subscription for ride ${rideId}:`,
          error,
        );
      }
    };

    setupSubscription();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [rideId, enabled, isRateLimited]);

  useEffect(() => {
    if (!enabled || pendingUpdates.size === 0) return;

    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
    }

    batchTimerRef.current = setTimeout(processBatchUpdates, batchInterval);

    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, [pendingUpdates, batchInterval, processBatchUpdates, enabled]);

  useEffect(() => {
    if (!enableCrossTabs || !rideId) return;

    try {
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel(`ride-${rideId}-sync`);

        channel.onmessage = (event) => {
          const { type, updates } = event.data;
          if (type === "RIDE_UPDATE" && updates) {
            setLastUpdate(updates);
          }
        };

        broadcastChannelRef.current = channel;
      }
    } catch (error) {
      console.warn("[BroadcastChannel] Not supported or failed:", error);
    }

    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
        broadcastChannelRef.current = null;
      }
    };
  }, [rideId, enableCrossTabs]);

  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }

      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
        broadcastChannelRef.current = null;
      }

      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, []);

  return {
    isConnected,
    lastUpdate,
    pendingUpdatesCount: pendingUpdates.size,
    _internal: {
      subscription: subscriptionRef.current,
      broadcastChannel: broadcastChannelRef.current,
      eventTimeline: eventTimelineRef.current,
    },
  };
};
