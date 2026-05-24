/**
 * EventDeduplicator — Unit Tests
 * يتحقق من: dedup-by-id, dedup-by-hash, dedup-by-content (location),
 *           Lamport ordering, queue management, stats
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventDeduplicator } from './EventDeduplicator';
import type { RideEvent } from './types';

const makeEvent = (overrides: Partial<RideEvent> = {}): RideEvent => ({
  eventId: crypto.randomUUID(),
  lamportTimestamp: 0,
  eventType: 'ride-accepted',
  source: 'driver',
  destination: 'rider',
  rideId: 'ride-1',
  payload: { driverId: 'driver-1' },
  timestamp: Date.now(),
  ...overrides,
});

describe('EventDeduplicator', () => {
  let dedup: EventDeduplicator;

  beforeEach(() => {
    dedup = new EventDeduplicator();
  });

  describe('Strategy 1: ID-based dedup', () => {
    it('should process unique events', async () => {
      const ev = makeEvent();
      const result = await dedup.processEvent(ev);
      expect(result).not.toBeNull();
      expect(result?.eventId).toBe(ev.eventId);
    });

    it('should filter duplicates by event ID', async () => {
      const ev = makeEvent({ eventId: 'fixed-id-1' });
      const first = await dedup.processEvent(ev);
      const second = await dedup.processEvent({ ...ev });
      expect(first).not.toBeNull();
      expect(second).toBeNull();
      expect(dedup.getStats().duplicatesFiltered).toBe(1);
    });
  });

  describe('Strategy 2: Hash-based dedup', () => {
    it('should filter same content with different IDs', async () => {
      const ev1 = makeEvent({ eventId: 'id-1' });
      const ev2 = makeEvent({ eventId: 'id-2' }); // same content, different ID
      const r1 = await dedup.processEvent(ev1);
      const r2 = await dedup.processEvent(ev2);
      expect(r1).not.toBeNull();
      expect(r2).toBeNull();
      expect(dedup.getStats().duplicatesFiltered).toBe(1);
    });
  });

  describe('Strategy 3: Location-based dedup (within 5m and 2s)', () => {
    it('should filter close-distance location updates', async () => {
      const baseTime = Date.now();
      const ev1 = makeEvent({
        eventType: 'location-update',
        payload: { lat: 33.4233, lng: 43.2974 },
        timestamp: baseTime,
        eventId: 'loc-1',
      });
      const ev2 = makeEvent({
        eventType: 'location-update',
        payload: { lat: 33.4233001, lng: 43.2974001 }, // ~0.1m away
        timestamp: baseTime + 500,
        eventId: 'loc-2',
      });

      const r1 = await dedup.processEvent(ev1);
      const r2 = await dedup.processEvent(ev2);

      expect(r1).not.toBeNull();
      expect(r2).toBeNull();
    });

    it('should NOT filter far-distance location updates', async () => {
      const baseTime = Date.now();
      const ev1 = makeEvent({
        eventType: 'location-update',
        payload: { lat: 33.4233, lng: 43.2974 },
        timestamp: baseTime,
        eventId: 'far-1',
      });
      const ev2 = makeEvent({
        eventType: 'location-update',
        payload: { lat: 33.4500, lng: 43.3100 }, // > 1km
        timestamp: baseTime + 500,
        eventId: 'far-2',
      });

      const r1 = await dedup.processEvent(ev1);
      const r2 = await dedup.processEvent(ev2);

      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
    });

    it('should NOT filter location updates more than 2s apart', async () => {
      const baseTime = Date.now();
      const ev1 = makeEvent({
        eventType: 'location-update',
        payload: { lat: 33.4233, lng: 43.2974 },
        timestamp: baseTime,
        eventId: 'time-1',
      });
      const ev2 = makeEvent({
        eventType: 'location-update',
        payload: { lat: 33.4233001, lng: 43.2974001 }, // close in space
        timestamp: baseTime + 3000, // but 3s later
        eventId: 'time-2',
      });

      const r1 = await dedup.processEvent(ev1);
      const r2 = await dedup.processEvent(ev2);

      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
    });
  });

  describe('Lamport clock ordering', () => {
    it('should advance lamport clock per event', async () => {
      // أحداث بـ payloads مختلفة لتجنّب فلترة الـ hash
      await dedup.processEvent(makeEvent({ eventId: 'a', lamportTimestamp: 0, payload: { n: 1 } }));
      const second = await dedup.processEvent(
        makeEvent({ eventId: 'b', lamportTimestamp: 5, payload: { n: 2 } })
      );
      const third = await dedup.processEvent(
        makeEvent({ eventId: 'c', lamportTimestamp: 2, payload: { n: 3 } })
      );

      // After receiving lamport=5 → local=6; after lamport=2 → max(6,2)+1=7
      expect(second?.lamportTimestamp).toBe(6);
      expect(third?.lamportTimestamp).toBe(7);
    });

    it('should return events ordered by lamport timestamp', async () => {
      await dedup.processEvent(makeEvent({ eventId: 'e1', lamportTimestamp: 10 }));
      await dedup.processEvent(makeEvent({ eventId: 'e2', lamportTimestamp: 1, eventType: 'ride-cancelled' }));
      await dedup.processEvent(makeEvent({ eventId: 'e3', lamportTimestamp: 5, eventType: 'eta-updated' }));

      const all = dedup.getAllPendingEvents();
      const lamports = all.map((e) => e.lamportTimestamp);
      // Should be sorted ascending
      expect(lamports).toEqual([...lamports].sort((a, b) => a - b));
    });
  });

  describe('Queue management', () => {
    it('should drain queue via getNextEvent', async () => {
      await dedup.processEvent(makeEvent({ eventId: 'q1' }));
      await dedup.processEvent(makeEvent({ eventId: 'q2', eventType: 'ride-cancelled' }));

      const e1 = dedup.getNextEvent();
      const e2 = dedup.getNextEvent();
      const e3 = dedup.getNextEvent();

      expect(e1).not.toBeNull();
      expect(e2).not.toBeNull();
      expect(e3).toBeNull();
    });

    it('clearRideEvents should remove only matching ride', async () => {
      await dedup.processEvent(makeEvent({ eventId: 'r1', rideId: 'ride-A' }));
      await dedup.processEvent(makeEvent({ eventId: 'r2', rideId: 'ride-B' }));

      dedup.clearRideEvents('ride-A');

      const remaining = dedup.getAllPendingEvents();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].rideId).toBe('ride-B');
    });
  });

  describe('Stats', () => {
    it('should track totalEvents, processed, and duplicates', async () => {
      await dedup.processEvent(makeEvent({ eventId: 's1' }));
      await dedup.processEvent(makeEvent({ eventId: 's1' })); // dup by id
      await dedup.processEvent(makeEvent({ eventId: 's2', eventType: 'ride-cancelled' }));

      const stats = dedup.getStats();
      expect(stats.totalEvents).toBe(3);
      expect(stats.eventsProcessed).toBe(2);
      expect(stats.duplicatesFiltered).toBe(1);
    });
  });
});
