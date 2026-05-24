/**
 * HaversineRoutingAdapter — Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HaversineRoutingAdapter } from './HaversineRoutingAdapter';

describe('HaversineRoutingAdapter', () => {
  let adapter: HaversineRoutingAdapter;

  beforeEach(() => {
    adapter = new HaversineRoutingAdapter();
  });

  describe('getDistance', () => {
    it('should return ~0 for identical coordinates', async () => {
      const d = await adapter.getDistance(
        { lat: 33.4233, lng: 43.2974 },
        { lat: 33.4233, lng: 43.2974 }
      );
      expect(d).toBeCloseTo(0, 3);
    });

    it('should compute distance between Ramadi and Baghdad (~110km)', async () => {
      // Ramadi → Baghdad
      const d = await adapter.getDistance(
        { lat: 33.4233, lng: 43.2974 },
        { lat: 33.3152, lng: 44.3661 }
      );
      const km = d / 1000;
      expect(km).toBeGreaterThan(95);
      expect(km).toBeLessThan(115);
    });

    it('should be symmetric (A→B == B→A)', async () => {
      const a = { lat: 33.4233, lng: 43.2974 };
      const b = { lat: 36.1911, lng: 44.0093 };
      const ab = await adapter.getDistance(a, b);
      const ba = await adapter.getDistance(b, a);
      expect(ab).toBeCloseTo(ba, 5);
    });
  });

  describe('getRoute', () => {
    it('should return RouteResult with distance, duration, path, and steps', async () => {
      const result = await adapter.getRoute(
        { lat: 33.4233, lng: 43.2974 },
        { lat: 33.5, lng: 43.4 }
      );
      expect(result.distance).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(Array.isArray(result.path)).toBe(true);
      expect(result.path.length).toBeGreaterThan(1);
      expect(Array.isArray(result.steps)).toBe(true);
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('should compute duration based on 50 km/h average', async () => {
      const result = await adapter.getRoute(
        { lat: 33.4233, lng: 43.2974 },
        { lat: 33.3152, lng: 44.3661 } // ~110km
      );
      const expectedMin = (result.distance / 1000) / 50 * 60;
      const actualMin = result.duration / 60;
      expect(actualMin).toBeCloseTo(expectedMin, 0);
    });

    it('first and last point in path should match origin and destination approximately', async () => {
      const origin = { lat: 33.4233, lng: 43.2974 };
      const dest = { lat: 33.5, lng: 43.4 };
      const result = await adapter.getRoute(origin, dest);

      expect(result.path[0].lat).toBeCloseTo(origin.lat, 2);
      expect(result.path[0].lng).toBeCloseTo(origin.lng, 2);
      expect(result.path[result.path.length - 1].lat).toBeCloseTo(dest.lat, 2);
      expect(result.path[result.path.length - 1].lng).toBeCloseTo(dest.lng, 2);
    });
  });

  describe('load', () => {
    it('should resolve immediately (no-op)', async () => {
      await expect(adapter.load()).resolves.toBeUndefined();
    });
  });
});
