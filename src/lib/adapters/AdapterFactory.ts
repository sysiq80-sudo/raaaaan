/**
 * ران — Adapter Factory Pattern
 * مصنع الـ adapters يتولى إنشاء instances و إدارة fallback chain
 * يوفر واجهة موحدة للـ map, routing, و geocoding adapters
 */

import type {
  IMapAdapter,
  IRoutingAdapter,
  IGeocodingAdapter,
  MapProvider,
  RoutingProvider,
  GeocodingProvider,
} from './types';
import { AdapterError, AdapterChainError } from './types';
import { ADAPTER_CONFIG, FEATURE_FLAGS } from './config';
import { OpenStreetMapAdapter } from './OpenStreetMapAdapter';
import { GoogleMapsAdapter } from './GoogleMapsAdapter';
import { StaticMapAdapter } from './StaticMapAdapter';
import { OSRMRoutingAdapter } from './OSRMRoutingAdapter';
import { HaversineRoutingAdapter } from './HaversineRoutingAdapter';
import { NominatimGeocodingAdapter } from './NominatimGeocodingAdapter';
import { PhotonGeocodingAdapter } from './PhotonGeocodingAdapter';

// ============================================================
// ADAPTER FACTORY — MAP
// ============================================================

export class MapAdapterFactory {
  /**
   * إنشاء map adapter instance
   */
  static async create(provider: MapProvider): Promise<IMapAdapter> {
    let adapter: IMapAdapter;

    switch (provider) {
      case 'openstreetmap':
        adapter = new OpenStreetMapAdapter();
        break;
      case 'google':
        adapter = new GoogleMapsAdapter();
        break;
      case 'static':
        adapter = new StaticMapAdapter();
        break;
      default:
        throw new Error(`Unknown map provider: ${provider}`);
    }

    // Load adapter
    await adapter.load();
    return adapter;
  }

  /**
   * إنشاء أول adapter متوفر من القائمة (مع fallback)
   */
  static async createWithFallback(
    providers: MapProvider[] = ADAPTER_CONFIG.maps?.fallback || ['google', 'static']
  ): Promise<{ adapter: IMapAdapter; provider: MapProvider }> {
    const errors: AdapterError[] = [];

    for (const provider of providers) {
      try {
        if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
          console.log(`🗺️ Trying map provider: ${provider}`);
        }

        const adapter = await MapAdapterFactory.create(provider);
        console.log(`✅ Map adapter loaded: ${provider}`);
        return { adapter, provider };
      } catch (error) {
        const err = new AdapterError(provider, error as Error);
        errors.push(err);
        console.warn(`❌ Map adapter failed: ${provider}`, error);
      }
    }

    throw new AdapterChainError('map', errors);
  }
}

// ============================================================
// ADAPTER FACTORY — ROUTING
// ============================================================

export class RoutingAdapterFactory {
  /**
   * إنشاء routing adapter instance
   */
  static async create(provider: RoutingProvider): Promise<IRoutingAdapter> {
    let adapter: IRoutingAdapter;

    switch (provider) {
      case 'osrm':
        adapter = new OSRMRoutingAdapter();
        break;
      case 'haversine':
        adapter = new HaversineRoutingAdapter();
        break;
      case 'google':
        // TODO: Implement GoogleDirectionsAdapter in Phase 2
        throw new Error('Google Directions adapter not yet implemented');
      default:
        throw new Error(`Unknown routing provider: ${provider}`);
    }

    // Load adapter
    await adapter.load();
    return adapter;
  }

  /**
   * إنشاء أول adapter متوفر من القائمة (مع fallback)
   */
  static async createWithFallback(
    providers: RoutingProvider[] = ADAPTER_CONFIG.routing?.fallback || ['google', 'haversine']
  ): Promise<{ adapter: IRoutingAdapter; provider: RoutingProvider }> {
    const errors: AdapterError[] = [];

    for (const provider of providers) {
      try {
        if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
          console.log(`🛣️ Trying routing provider: ${provider}`);
        }

        const adapter = await RoutingAdapterFactory.create(provider);
        console.log(`✅ Routing adapter loaded: ${provider}`);
        return { adapter, provider };
      } catch (error) {
        const err = new AdapterError(provider, error as Error);
        errors.push(err);
        console.warn(`❌ Routing adapter failed: ${provider}`, error);
      }
    }

    throw new AdapterChainError('routing', errors);
  }
}

// ============================================================
// ADAPTER FACTORY — GEOCODING
// ============================================================

export class GeocodingAdapterFactory {
  /**
   * إنشاء geocoding adapter instance
   */
  static async create(provider: GeocodingProvider): Promise<IGeocodingAdapter> {
    let adapter: IGeocodingAdapter;

    switch (provider) {
      case 'nominatim':
        adapter = new NominatimGeocodingAdapter();
        break;
      case 'photon':
        adapter = new PhotonGeocodingAdapter();
        break;
      case 'google':
        // TODO: Implement GoogleGeocodingAdapter
        throw new Error('Google Geocoding adapter not yet implemented');
      default:
        throw new Error(`Unknown geocoding provider: ${provider}`);
    }

    // Load adapter
    await adapter.load();
    return adapter;
  }

  /**
   * إنشاء أول adapter متوفر من القائمة (مع fallback)
   */
  static async createWithFallback(
    providers: GeocodingProvider[] = ADAPTER_CONFIG.geocoding?.fallback || ['google']
  ): Promise<{ adapter: IGeocodingAdapter; provider: GeocodingProvider }> {
    const errors: AdapterError[] = [];

    for (const provider of providers) {
      try {
        if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
          console.log(`🔍 Trying geocoding provider: ${provider}`);
        }

        const adapter = await GeocodingAdapterFactory.create(provider);
        console.log(`✅ Geocoding adapter loaded: ${provider}`);
        return { adapter, provider };
      } catch (error) {
        const err = new AdapterError(provider, error as Error);
        errors.push(err);
        console.warn(`❌ Geocoding adapter failed: ${provider}`, error);
      }
    }

    throw new AdapterChainError('geocoding', errors);
  }
}

// ============================================================
// UNIFIED ADAPTER FACTORY
// ============================================================

/**
 * واجهة موحدة لإنشاء جميع أنواع الـ adapters
 * مع تحديد الـ primary و fallback الموحد
 */
export class AdapterFactory {
  /**
   * إنشاء map adapter مع fallback chain
   */
  static async createMapAdapter(): Promise<{ adapter: IMapAdapter; provider: MapProvider }> {
    const primary = ADAPTER_CONFIG.maps?.primary || 'openstreetmap';
    const fallback = ADAPTER_CONFIG.maps?.fallback || ['google', 'static'];

    return MapAdapterFactory.createWithFallback([primary, ...fallback]);
  }

  /**
   * إنشاء routing adapter مع fallback chain
   */
  static async createRoutingAdapter(): Promise<{ adapter: IRoutingAdapter; provider: RoutingProvider }> {
    const primary = ADAPTER_CONFIG.routing?.primary || 'osrm';
    const fallback = ADAPTER_CONFIG.routing?.fallback || ['google', 'haversine'];

    return RoutingAdapterFactory.createWithFallback([primary, ...fallback]);
  }

  /**
   * إنشاء geocoding adapter مع fallback chain
   */
  static async createGeocodingAdapter(): Promise<{
    adapter: IGeocodingAdapter;
    provider: GeocodingProvider;
  }> {
    const primary = ADAPTER_CONFIG.geocoding?.primary || 'nominatim';
    const fallback = ADAPTER_CONFIG.geocoding?.fallback || ['google'];

    return GeocodingAdapterFactory.createWithFallback([primary, ...fallback]);
  }

  /**
   * إنشاء جميع الـ adapters (مللاً في نفس الوقت)
   */
  static async createAll(): Promise<{
    map: { adapter: IMapAdapter; provider: MapProvider };
    routing: { adapter: IRoutingAdapter; provider: RoutingProvider };
    geocoding: { adapter: IGeocodingAdapter; provider: GeocodingProvider };
  }> {
    const [map, routing, geocoding] = await Promise.all([
      AdapterFactory.createMapAdapter(),
      AdapterFactory.createRoutingAdapter(),
      AdapterFactory.createGeocodingAdapter(),
    ]);

    return { map, routing, geocoding };
  }
}

// ============================================================
// EXPORT FACTORIES
// ============================================================
