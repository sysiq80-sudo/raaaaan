/**
 * Event Deduplication Module
 * Prevents duplicate ride events from reaching Rider/Driver simultaneously
 * Uses Lamport timestamps for distributed event ordering
 */

export { EventDeduplicator, globalEventDeduplicator } from './EventDeduplicator';
export type { RideEvent, EventDeduplicatorState, ProcessedEvent } from './types';
