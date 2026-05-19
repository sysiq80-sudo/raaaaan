/**
 * ران — Adapters Module Index
 * نقطة الدخول الموحدة لجميع الـ adapters والـ factories
 */

// Export types
export type {
  Coordinate,
  Bounds,
  BoundsLike,
  MapProvider,
  RoutingProvider,
  GeocodingProvider,
  MapOptions,
  MarkerOptions,
  PolylineOptions,
  IMapAdapter,
  RouteStep,
  RouteResult,
  IRoutingAdapter,
  PlacePrediction,
  IGeocodingAdapter,
  AdapterFactoryConfig,
  EventType,
  EventSource,
  EventMetadata,
  RideEvent,
} from './types';

export { AdapterError, AdapterTimeoutError, AdapterChainError } from './types';

// Export config
export {
  FEATURE_FLAGS,
  SERVICE_URLS,
  SERVICE_BOUNDS,
  RAMADI_CENTER,
  FALLUJAH_CENTER,
  ADAPTER_CONFIG,
  PERFORMANCE_CONFIG,
  MARKER_STYLES,
  ROUTE_STYLES,
  updateFeatureFlag,
  updateAdapterConfig,
  getAdapterConfig,
} from './config';

// Export map adapters
export { OpenStreetMapAdapter, createLeafletIcon } from './OpenStreetMapAdapter';
export { GoogleMapsAdapter } from './GoogleMapsAdapter';
export { StaticMapAdapter } from './StaticMapAdapter';

// Export routing adapters
export { OSRMRoutingAdapter } from './OSRMRoutingAdapter';
export { HaversineRoutingAdapter } from './HaversineRoutingAdapter';

// Export geocoding adapters
export { NominatimGeocodingAdapter } from './NominatimGeocodingAdapter';
export { PhotonGeocodingAdapter } from './PhotonGeocodingAdapter';

// Export factories
export {
  AdapterFactory,
  MapAdapterFactory,
  RoutingAdapterFactory,
  GeocodingAdapterFactory,
} from './AdapterFactory';
