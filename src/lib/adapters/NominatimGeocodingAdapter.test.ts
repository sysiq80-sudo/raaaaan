/**
 * NominatimGeocodingAdapter — Unit Tests
 * Mocks fetch to validate request structure & response parsing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NominatimGeocodingAdapter } from './NominatimGeocodingAdapter';

describe('NominatimGeocodingAdapter', () => {
  let adapter: NominatimGeocodingAdapter;
  let fetchSpy: any;

  beforeEach(() => {
    adapter = new NominatimGeocodingAdapter();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('geocode', () => {
    it('should return coordinates for valid address', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ lat: '33.4233', lon: '43.2974', display_name: 'Ramadi' }]),
          { status: 200 }
        )
      );

      const result = await adapter.geocode('Ramadi');
      expect(result).toEqual({ lat: 33.4233, lng: 43.2974 });
      expect(fetchSpy).toHaveBeenCalledOnce();

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('/search');
      expect(url).toContain('countrycodes=IQ');
      expect(url).toContain('format=json');
    });

    it('should return null when no results', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 })
      );
      const result = await adapter.geocode('aaaaaaa');
      expect(result).toBeNull();
    });

    it('should throw on network error', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network down'));
      await expect(adapter.geocode('Baghdad')).rejects.toThrow();
    });
  });

  describe('reverseGeocode', () => {
    it('should return Arabic display_name', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ display_name: 'الرمادي، الأنبار، العراق' }),
          { status: 200 }
        )
      );

      const result = await adapter.reverseGeocode(33.4233, 43.2974);
      expect(result).toBe('الرمادي، الأنبار، العراق');

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('/reverse');
      expect(url).toContain('lat=33.4233');
      expect(url).toContain('language=ar');
    });

    it('should strip Plus Code prefix', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ display_name: 'GR4P+H7, الرمادي، العراق' }),
          { status: 200 }
        )
      );
      const result = await adapter.reverseGeocode(33.4233, 43.2974);
      expect(result).not.toContain('GR4P');
      expect(result).toContain('الرمادي');
    });
  });

  describe('load', () => {
    it('should resolve immediately', async () => {
      await expect(adapter.load()).resolves.toBeUndefined();
    });
  });
});
