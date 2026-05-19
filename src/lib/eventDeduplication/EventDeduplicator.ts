/**
 * Event Deduplicator - Prevents duplicate event processing
 * Uses Lamport timestamps for distributed ordering
 * Solves: Rider/Driver receiving duplicate "ride-accepted" updates
 */

import { RideEvent, EventDeduplicatorState, ProcessedEvent } from './types';

/** Simple FNV-1a 32-bit hash — browser-compatible, no dependencies */
function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // unsigned 32-bit
  }
  return hash.toString(16).padStart(8, '0');
}

export class EventDeduplicator {
  private state: EventDeduplicatorState;

  constructor() {
    this.state = {
      lamportClock: 0,
      processedEventIds: new Set(),
      dedupHashes: new Map(),
      eventQueue: [],
      stats: {
        totalEvents: 0,
        duplicatesFiltered: 0,
        eventsProcessed: 0,
        lastProcessedTimestamp: 0,
      },
    };
  }

  /**
   * Update local Lamport clock based on received event
   * Rule: max(localClock, receivedClock) + 1
   */
  private updateLamportClock(receivedTimestamp: number): number {
    this.state.lamportClock = Math.max(this.state.lamportClock, receivedTimestamp) + 1;
    return this.state.lamportClock;
  }

  /**
   * Generate hash of event data for quick deduplication
   * Hash = SHA256(rideId + eventType + source + payload_json)
   */
  private generateEventHash(event: RideEvent): string {
    const hashInput = `${event.rideId}|${event.eventType}|${event.source}|${JSON.stringify(event.payload)}`;
    return fnv1a(hashInput);
  }

  /**
   * Check if event is a duplicate using multiple strategies:
   * 1. Event ID lookup (primary)
   * 2. Hash lookup (catches same event sent twice)
   * 3. Content-based dedup (catches similar events)
   */
  private isDuplicate(event: RideEvent, hash: string): boolean {
    // Strategy 1: Direct ID match
    if (this.state.processedEventIds.has(event.eventId)) {
      this.state.stats.duplicatesFiltered++;
      return true;
    }

    // Strategy 2: Hash match (same event content)
    if (this.state.dedupHashes.has(hash)) {
      this.state.stats.duplicatesFiltered++;
      return true;
    }

    // Strategy 3: For location-updates, check if within 2 seconds + 5 meters
    if (event.eventType === 'location-update') {
      const recentLocationEvents = this.state.eventQueue.filter(
        (e) =>
          e.eventType === 'location-update' &&
          e.rideId === event.rideId &&
          e.source === event.source &&
          event.timestamp - e.timestamp < 2000 // Within 2 seconds
      );

      for (const recentEvent of recentLocationEvents) {
        const distance = this.calculateDistance(event.payload, recentEvent.payload);
        if (distance < 5) {
          // Less than 5 meters
          this.state.stats.duplicatesFiltered++;
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculate distance between two coordinates (Haversine)
   */
  private calculateDistance(
    point1: Record<string, any>,
    point2: Record<string, any>
  ): number {
    const lat1 = point1.latitude || point1.lat || 0;
    const lon1 = point1.longitude || point1.lng || 0;
    const lat2 = point2.latitude || point2.lat || 0;
    const lon2 = point2.longitude || point2.lng || 0;

    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance * 1000; // Convert to meters
  }

  /**
   * Process incoming event with deduplication
   * Returns the deduplicated event or null if duplicate
   */
  async processEvent(incomingEvent: RideEvent): Promise<ProcessedEvent | null> {
    this.state.stats.totalEvents++;

    // Step 1: Update Lamport clock
    const lamportTimestamp = this.updateLamportClock(incomingEvent.lamportTimestamp || 0);
    incomingEvent.lamportTimestamp = lamportTimestamp;

    // Step 2: Generate hash
    const hash = this.generateEventHash(incomingEvent);

    // Step 3: Check for duplicates
    if (this.isDuplicate(incomingEvent, hash)) {
      console.debug(
        `[EventDeduplicator] Duplicate event filtered - ID: ${incomingEvent.eventId}, Type: ${incomingEvent.eventType}`
      );
      return null;
    }

    // Step 4: Mark as processed
    this.state.processedEventIds.add(incomingEvent.eventId);
    this.state.dedupHashes.set(hash, true);

    // Step 5: Add to queue
    const processedEvent: ProcessedEvent = {
      ...incomingEvent,
      processed: true,
      hash,
    };

    this.state.eventQueue.push(processedEvent);
    this.state.stats.eventsProcessed++;
    this.state.stats.lastProcessedTimestamp = Date.now();

    console.debug(
      `[EventDeduplicator] Event processed - ID: ${incomingEvent.eventId}, LamportTS: ${lamportTimestamp}`
    );

    return processedEvent;
  }

  /**
   * Get next event from queue in order (FIFO + Lamport ordering)
   */
  getNextEvent(): ProcessedEvent | null {
    if (this.state.eventQueue.length === 0) {
      return null;
    }

    // Sort by Lamport timestamp (ensures ordering across nodes)
    this.state.eventQueue.sort((a, b) => a.lamportTimestamp - b.lamportTimestamp);

    const nextEvent = this.state.eventQueue.shift();
    return nextEvent || null;
  }

  /**
   * Get all pending events ordered by Lamport timestamp
   */
  getAllPendingEvents(): ProcessedEvent[] {
    return this.state.eventQueue.sort((a, b) => a.lamportTimestamp - b.lamportTimestamp);
  }

  /**
   * Clear events for a specific ride (when ride completes)
   */
  clearRideEvents(rideId: string): void {
    this.state.eventQueue = this.state.eventQueue.filter((e) => e.rideId !== rideId);

    // Clean up old IDs to prevent memory leak
    const remainingEventIds = new Set(this.state.eventQueue.map((e) => e.eventId));
    const oldIds = Array.from(this.state.processedEventIds).filter((id) => !remainingEventIds.has(id));

    oldIds.slice(-1000).forEach((id) => {
      // Keep last 1000
      if (!remainingEventIds.has(id)) {
        this.state.processedEventIds.delete(id);
      }
    });

    console.debug(`[EventDeduplicator] Cleared ${this.state.eventQueue.length} events for ride ${rideId}`);
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.state.stats,
      queueSize: this.state.eventQueue.length,
      processedIdsCacheSize: this.state.processedEventIds.size,
      dedupHashesCacheSize: this.state.dedupHashes.size,
    };
  }

  /**
   * Reset deduplicator (for testing or when switching rides)
   */
  reset(): void {
    this.state = {
      lamportClock: 0,
      processedEventIds: new Set(),
      dedupHashes: new Map(),
      eventQueue: [],
      stats: {
        totalEvents: 0,
        duplicatesFiltered: 0,
        eventsProcessed: 0,
        lastProcessedTimestamp: 0,
      },
    };
  }

  /**
   * Get Lamport clock value (for sending to other nodes)
   */
  getLamportClock(): number {
    return this.state.lamportClock;
  }

  /**
   * Set Lamport clock (useful for initialization from remote)
   */
  setLamportClock(value: number): void {
    this.state.lamportClock = Math.max(this.state.lamportClock, value);
  }
}

// Singleton instance for the app
export const globalEventDeduplicator = new EventDeduplicator();
