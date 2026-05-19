/**
 * RouteCache (from useAdaptiveRouting) — Unit Tests
 * يتحقق من: TTL, LRU eviction, hit/miss stats
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RouteCache } from './useAdaptiveRouting';
import type { RouteResult, Coordinate } from '@/lib/adapters';

const makeRoute = (distance = 1000): RouteResult => ({
  distance,
  duration: distance / 14,
  path: [],
  steps: [],
});

describe('RouteCache', () => {
  let cache: RouteCache;
  const A: Coordinate = { lat: 33.4233, lng: 43.2974 };
  const B: Coordinate = { lat: 33.5, lng: 43.4 };
  const C: Coordinate = { lat: 36.19, lng: 44.00 };

  beforeEach(() => {
    cache = new RouteCache(3, 60_000); // size=3, TTL=1min
  });

  it('should miss on empty cache', () => {
    expect(cache.get(A, B)).toBeNull();
    expect(cache.getStats().misses).toBe(1);
    expect(cache.getStats().hits).toBe(0);
  });

  it('should hit after set', () => {
    cache.set(A, B, makeRoute(5000));
    const result = cache.get(A, B);
    expect(result).not.toBeNull();
    expect(result?.distance).toBe(5000);
    expect(cache.getStats().hits).toBe(1);
  });

  it('should differentiate by coordinates', () => {
    cache.set(A, B, makeRoute(5000));
    expect(cache.get(A, C)).toBeNull(); // different destination
    expect(cache.get(B, A)).toBeNull(); // reversed
  });

  it('should evict oldest when full (LRU)', () => {
    const D: Coordinate = { lat: 30, lng: 40 };
    const E: Coordinate = { lat: 31, lng: 41 };
    const F: Coordinate = { lat: 32, lng: 42 };

    cache.set(A, D, makeRoute(100));
    cache.set(A, E, makeRoute(200));
    cache.set(A, F, makeRoute(300));
    // Cache full (size=3); next set evicts A→D
    cache.set(A, C, makeRoute(400));

    expect(cache.get(A, D)).toBeNull(); // evicted
    expect(cache.get(A, F)).not.toBeNull();
    expect(cache.get(A, C)).not.toBeNull();
  });

  it('should expire entries past TTL', async () => {
    const shortCache = new RouteCache(10, 50); // 50ms TTL
    shortCache.set(A, B, makeRoute(1000));
    expect(shortCache.get(A, B)).not.toBeNull();

    await new Promise((r) => setTimeout(r, 80));
    expect(shortCache.get(A, B)).toBeNull();
  });

  it('clear() should reset cache and stats', () => {
    cache.set(A, B, makeRoute(1000));
    cache.get(A, B); // hit
    cache.get(A, C); // miss
    cache.clear();

    const stats = cache.getStats();
    expect(stats.size).toBe(0);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(cache.get(A, B)).toBeNull();
  });
});
