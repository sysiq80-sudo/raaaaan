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

describe('RoutingAdapterFactory', () => {
  describe('create', () => {
    it('should create haversine adapter directly', async () => {
      const adapter = await RoutingAdapterFactory.create('haversine');
      expect(adapter).toBeDefined();
      expect(typeof adapter.getRoute).toBe('function');
    });

    it('should throw for unimplemented google provider', async () => {
      await expect(
        RoutingAdapterFactory.create('google')
      ).rejects.toThrow(/not yet implemented/);
    });

    it('should throw for unknown provider', async () => {
      await expect(
        RoutingAdapterFactory.create('invalid' as any)
      ).rejects.toThrow(/Unknown routing provider/);
    });
  });

  describe('createWithFallback', () => {
    it('should fall through to haversine when google fails', async () => {
      const result = await RoutingAdapterFactory.createWithFallback([
        'google',
        'haversine',
      ]);
      expect(result.provider).toBe('haversine');
      expect(result.adapter).toBeDefined();
    });

    it('should throw AdapterChainError when all providers fail', async () => {
      await expect(
        RoutingAdapterFactory.createWithFallback(['google'])
      ).rejects.toBeInstanceOf(AdapterChainError);
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

    it('should throw for google geocoding (not implemented)', async () => {
      await expect(
        GeocodingAdapterFactory.create('google')
      ).rejects.toThrow(/not yet implemented/);
    });
  });

  describe('createWithFallback', () => {
    it('should pick first working provider in chain', async () => {
      const result = await GeocodingAdapterFactory.createWithFallback([
        'google',
        'nominatim',
        'photon',
      ]);
      expect(['nominatim', 'photon']).toContain(result.provider);
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
