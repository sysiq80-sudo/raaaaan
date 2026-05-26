/**
 * AdapterFactory — Unit Tests
 * Tests the fallback chain logic without requiring real network/Google Maps API
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MapAdapterFactory,
  RoutingAdapterFactory,
  GeocodingAdapterFactory,
} from './AdapterFactory';
import { AdapterChainError } from './types';
import { GoogleDirectionsAdapter } from './GoogleDirectionsAdapter';
import { GooglePlacesGeocodingAdapter } from './GooglePlacesGeocodingAdapter';

describe('RoutingAdapterFactory', () => {
  describe('create', () => {
    it('should create haversine adapter directly', async () => {
      const adapter = await RoutingAdapterFactory.create('haversine');
      expect(adapter).toBeDefined();
      expect(typeof adapter.getRoute).toBe('function');
    });

    it('should create google adapter directly', async () => {
      const adapter = await RoutingAdapterFactory.create('google');
      expect(adapter).toBeDefined();
      expect(typeof adapter.getRoute).toBe('function');
    });

    it('should throw for unknown provider', async () => {
      await expect(
        RoutingAdapterFactory.create('invalid' as any)
      ).rejects.toThrow(/Unknown routing provider/);
    });
  });

  describe('createWithFallback', () => {
    it('should fall through to haversine when google fails', async () => {
      const spy = vi.spyOn(GoogleDirectionsAdapter.prototype, 'load').mockRejectedValue(new Error('Google Load Error'));
      const result = await RoutingAdapterFactory.createWithFallback([
        'google',
        'haversine',
      ]);
      expect(result.provider).toBe('haversine');
      expect(result.adapter).toBeDefined();
      spy.mockRestore();
    });

    it('should throw AdapterChainError when all providers fail', async () => {
      const spy = vi.spyOn(GoogleDirectionsAdapter.prototype, 'load').mockRejectedValue(new Error('Google Load Error'));
      await expect(
        RoutingAdapterFactory.createWithFallback(['google'])
      ).rejects.toBeInstanceOf(AdapterChainError);
      spy.mockRestore();
    });
  });
});

describe('GeocodingAdapterFactory', () => {
  describe('create', () => {
    it('should create nominatim adapter', async () => {
      const adapter = await GeocodingAdapterFactory.create('nominatim');
      expect(adapter).toBeDefined();
      expect(typeof adapter.geocode).toBe('function');
      expect(typeof adapter.reverseGeocode).toBe('function');
    });

    it('should create photon adapter', async () => {
      const adapter = await GeocodingAdapterFactory.create('photon');
      expect(adapter).toBeDefined();
    });

    it('should create google geocoding adapter directly', async () => {
      const adapter = await GeocodingAdapterFactory.create('google');
      expect(adapter).toBeDefined();
      expect(typeof adapter.geocode).toBe('function');
    });
  });

  describe('createWithFallback', () => {
    it('should pick first working provider in chain', async () => {
      const spy = vi.spyOn(GooglePlacesGeocodingAdapter.prototype, 'load').mockRejectedValue(new Error('Google Geocoding Load Error'));
      const result = await GeocodingAdapterFactory.createWithFallback([
        'google',
        'nominatim',
        'photon',
      ]);
      expect(['nominatim', 'photon']).toContain(result.provider);
      spy.mockRestore();
    });
  });
});

describe('MapAdapterFactory', () => {
  beforeEach(() => {
    // Stub window for adapters that touch DOM/leaflet
    if (typeof window === 'undefined') {
      (globalThis as any).window = {};
    }
  });

  it('should throw for unknown provider', async () => {
    await expect(
      MapAdapterFactory.create('invalid' as any)
    ).rejects.toThrow(/Unknown map provider/);
  });
});
