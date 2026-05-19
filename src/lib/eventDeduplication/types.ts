/**
 * Event Deduplication Types
 * Prevents duplicate updates from reaching Rider/Driver simultaneously
 */

export interface RideEvent {
  /** Unique event identifier */
  eventId: string;

  /** Lamport clock timestamp (for ordering across distributed nodes) */
  lamportTimestamp: number;

  /** Event type: ride-accepted, location-update, ride-completed, etc. */
  eventType: 'ride-accepted' | 'location-update' | 'ride-completed' | 'ride-cancelled' | 'eta-updated' | 'driver-arrived';

  /** Source of event: 'rider' | 'driver' | 'system' */
  source: 'rider' | 'driver' | 'system';

  /** Destination: 'rider' | 'driver' | 'broadcast' */
  destination: 'rider' | 'driver' | 'broadcast';

  /** Ride ID this event belongs to */
  rideId: string;

  /** Event payload (varies by type) */
  payload: Record<string, any>;

  /** Unix timestamp when event occurred */
  timestamp: number;

  /** Whether this event has been processed locally */
  processed?: boolean;

  /** Hash of event data for deduplication */
  hash?: string;
}

export interface EventDeduplicatorState {
  /** Lamport clock value for this node */
  lamportClock: number;

  /** Set of processed event IDs (prevents re-processing) */
  processedEventIds: Set<string>;

  /** Map of deduplication hashes for quick lookup */
  dedupHashes: Map<string, boolean>;

  /** Queue of pending events awaiting processing */
  eventQueue: ProcessedEvent[];

  /** Statistics for monitoring */
  stats: {
    totalEvents: number;
    duplicatesFiltered: number;
    eventsProcessed: number;
    lastProcessedTimestamp: number;
  };
}

export interface ProcessedEvent extends RideEvent {
  processed: true;
  hash: string;
}
