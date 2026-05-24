/**
 * OSRMRoutingAdapter — Unit Tests
 * Mocks fetch to validate URL building & response parsing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OSRMRoutingAdapter } from './OSRMRoutingAdapter';

const mockOsrmResponse = {
  code: 'Ok',
  routes: [
    {
      distance: 110000,
      duration: 5400,
      geometry: {
        coordinates: [
          [43.2974, 33.4233],
          [43.8, 33.37],
          [44.3661, 33.3152],
        ],
      },
      legs: [
        {
          steps: [
            { name: 'طريق بغداد', distance: 50000, duration: 2700 },
            { name: 'طريق الفلوجة', distance: 60000, duration: 2700 },
          ],
        },
      ],
    },
  ],
};

describe('OSRMRoutingAdapter', () => {
  let adapter: OSRMRoutingAdapter;
  let fetchSpy: any;

  beforeEach(() => {
    adapter = new OSRMRoutingAdapter();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('getRoute', () => {
    it('should return parsed route from OSRM response', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockOsrmResponse), { status: 200 })
      );

      const result = await adapter.getRoute(
        { lat: 33.4233, lng: 43.2974 },
        { lat: 33.3152, lng: 44.3661 }
      );

      expect(result.distance).toBe(110000);
      expect(result.duration).toBe(5400);
      expect(result.path).toHaveLength(3);
      expect(result.path[0]).toEqual({ lat: 33.4233, lng: 43.2974 });
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('should build URL with lng,lat order (OSRM convention)', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockOsrmResponse), { status: 200 })
      );

      await adapter.getRoute(
        { lat: 33.4233, lng: 43.2974 },
        { lat: 33.3152, lng: 44.3661 }
      );

      const url = fetchSpy.mock.calls[0][0] as string;
      // OSRM expects lng,lat
      expect(url).toContain('43.297400,33.423300');
      expect(url).toContain('44.366100,33.315200');
      expect(url).toContain('overview=full');
      expect(url).toContain('steps=true');
    });

    it('should include waypoints in request', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockOsrmResponse), { status: 200 })
      );

      await adapter.getRoute(
        { lat: 33.4233, lng: 43.2974 },
        { lat: 33.3152, lng: 44.3661 },
        [{ lat: 33.4, lng: 43.5 }]
      );

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('43.500000,33.400000');
    });

    it('should throw on OSRM error code', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: 'NoRoute', message: 'No route found' }),
          { status: 200 }
        )
      );

      await expect(
        adapter.getRoute(
          { lat: 0, lng: 0 },
          { lat: 90, lng: 180 }
        )
      ).rejects.toThrow(/NoRoute/);
    });

    it('should throw on HTTP error', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('error', { status: 500, statusText: 'Server Error' })
      );

      await expect(
        adapter.getRoute(
          { lat: 33.4, lng: 43.3 },
          { lat: 33.3, lng: 44.3 }
        )
      ).rejects.toThrow(/500/);
    });
  });

  describe('load', () => {
    it('should resolve immediately', async () => {
      await expect(adapter.load()).resolves.toBeUndefined();
    });
  });
});
