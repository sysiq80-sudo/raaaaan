/**
 * ران — Adapter Configuration
 * إعدادات مركزية لجميع الـ adapters، feature flags، و service URLs
 * يمكن تعديله بدون إعادة رمز
 */

import type {
  MapProvider,
  RoutingProvider,
  GeocodingProvider,
  AdapterFactoryConfig,
} from './types';

const env = (import.meta as ImportMeta).env as Record<string, string | undefined>;

function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function readEnvBool(...keys: string[]): boolean {
  return readEnv(...keys) === 'true';
}

// ============================================================
// FEATURE FLAGS
// ============================================================

/**
 * Feature flags للتحكم في الـ adapters
 * يمكن تفعيلها/تعطيلها من البيئة أو console
 */
export const FEATURE_FLAGS = {
  // Map providers
  USE_OPENSTREETMAP: true,
  USE_GOOGLE_MAPS: true,
  USE_STATIC_FALLBACK: true,

  // Routing providers
  USE_OSRM_ROUTING: true,
  USE_GOOGLE_DIRECTIONS: true,
  USE_HAVERSINE_FALLBACK: true,

  // Geocoding providers
  USE_NOMINATIM_GEOCODING: true,
  USE_PHOTON_SEARCH: true,
  USE_GOOGLE_GEOCODING: true,

  // Features
  EVENT_DEDUPLICATION: true,
  NOTIFICATION_ROUTER: true,
  GRACEFUL_DEGRADATION: true,
  ADAPTIVE_PROVIDER_SWITCHING: true,
  ROUTE_CACHING: true,

  // Debug
  DEBUG_ADAPTERS: readEnvBool('VITE_DEBUG_ADAPTERS', 'REACT_APP_DEBUG_ADAPTERS'),
  DEBUG_EVENTS: readEnvBool('VITE_DEBUG_EVENTS', 'REACT_APP_DEBUG_EVENTS'),
  LOG_PROVIDER_SWITCHES: readEnvBool('VITE_LOG_SWITCHES', 'REACT_APP_LOG_SWITCHES'),
};

// ============================================================
// SERVICE URLs
// ============================================================

export const SERVICE_URLS = {
  // OSRM — Open Source Routing Machine
  OSRM: readEnv('VITE_OSRM_URL', 'REACT_APP_OSRM_URL') || 'https://router.project-osrm.org/route/v1',

  // Nominatim — OpenStreetMap Geocoding
  NOMINATIM: readEnv('VITE_NOMINATIM_URL', 'REACT_APP_NOMINATIM_URL') || 'https://nominatim.openstreetmap.org',

  // Photon — Nominatim Autocomplete (faster)
  PHOTON: readEnv('VITE_PHOTON_URL', 'REACT_APP_PHOTON_URL') || 'https://photon.komoot.io/api',

  // Google — Backup providers
  GOOGLE_MAPS_API_BASE: 'https://maps.google.com',
  GOOGLE_DIRECTIONS_API: 'https://maps.googleapis.com/maps/api/directions/json',
  GOOGLE_GEOCODING_API: 'https://maps.googleapis.com/maps/api/geocode/json',

  // Tile layers — CartoDB Voyager (أجمل وأنعم من OSM الافتراضي)
  CARTODB_VOYAGER: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  CARTODB_DARK: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  OPENSTREETMAP_TILES: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  OPENSTREETMAP_DE_TILES: 'https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png',
  MAPBOX_STATIC: readEnv('VITE_MAPBOX_STATIC_URL', 'REACT_APP_MAPBOX_STATIC_URL') || 'https://api.mapbox.com/styles/v1/mapbox/streets-v11/static',
};

// ============================================================
// GEOFENCING BOUNDS
// ============================================================

/**
 * حدود الخدمة — منطقة الأنبار، العراق
 * تُستخدم لتصفية البحث وتحديد منطقة الخدمة
 */
export const SERVICE_BOUNDS = {
  north: 34.5,
  south: 32.0,
  east: 44.5,
  west: 38.5,
};

export const RAMADI_CENTER = {
  lat: 33.4233,
  lng: 43.2974,
};

export const FALLUJAH_CENTER = {
  lat: 33.3500,
  lng: 43.7833,
};

// ============================================================
// ADAPTER CONFIGURATION
// ============================================================

/**
 * إعدادات الـ adapters
 * - primary: الـ provider الأساسي المفضل
 * - fallback: قائمة الـ providers البديلة بالترتيب
 * - timeout: المدة القصوى لانتظار الـ response
 */
export const ADAPTER_CONFIG: AdapterFactoryConfig = {
  maps: {
    primary: 'openstreetmap' as MapProvider,
    fallback: ['google', 'static'] as MapProvider[],
    timeout: 5000, // 5 seconds
  },

  routing: {
    primary: 'osrm' as RoutingProvider,
    fallback: ['haversine'] as RoutingProvider[],
    timeout: 8000, // 8 seconds
  },

  geocoding: {
    primary: 'nominatim' as GeocodingProvider,
    fallback: ['photon', 'google'] as GeocodingProvider[],
    timeout: 5000, // 5 seconds
  },
};

// ============================================================
// PERFORMANCE TUNING
// ============================================================

export const PERFORMANCE_CONFIG = {
  // Caching
  ROUTE_CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  ROUTE_CACHE_MAX_SIZE: 100,
  GEOCODE_CACHE_TTL: 10 * 60 * 1000, // 10 minutes
  GEOCODE_CACHE_MAX_SIZE: 500,

  // Debouncing
  SEARCH_DEBOUNCE_MS: 300,
  LOCATION_UPDATE_DEBOUNCE_MS: 500,

  // Polling
  LOCATION_POLLING_INTERVAL_IDLE: 10000, // 10 seconds
  LOCATION_POLLING_INTERVAL_ACTIVE: 2000, // 2 seconds

  // Rate limiting
  MAX_REQUESTS_PER_MINUTE: 120,
  MAX_DUPLICATE_EVENTS_TTL: 5 * 60 * 1000, // 5 minutes
};

// ============================================================
// MARKER STYLES
// ============================================================

export const MARKER_STYLES = {
  pickup: {
    fillColor: '#22c55e',
    strokeColor: '#fff',
    scale: 1.2,
  },
  dropoff: {
    fillColor: '#2A6CD5',
    strokeColor: '#fff',
    scale: 1.2,
  },
  driver: {
    fillColor: '#3b82f6',
    strokeColor: '#fff',
    scale: 1.0,
  },
  user: {
    fillColor: '#8b5cf6',
    strokeColor: '#fff',
    scale: 1.0,
  },
  landmark: {
    fillColor: '#f59e0b',
    strokeColor: '#fff',
    scale: 0.9,
  },
};

// ============================================================
// ROUTE STYLES
// ============================================================

export const ROUTE_STYLES = {
  main: {
    strokeColor: '#00d9a5',
    strokeOpacity: 0.8,
    strokeWeight: 4,
    clickable: false,
    geodesic: true,
  },
  glow: {
    strokeColor: '#00d9a5',
    strokeOpacity: 0.2,
    strokeWeight: 8,
    clickable: false,
    geodesic: true,
  },
  arriving: {
    strokeColor: '#22c55e',
    strokeOpacity: 0.8,
    strokeWeight: 4,
    clickable: false,
    geodesic: true,
  },
  inProgress: {
    strokeColor: '#ef4444',
    strokeOpacity: 0.8,
    strokeWeight: 4,
    clickable: false,
    geodesic: true,
  },
};

// ============================================================
// RUNTIME CONFIGURATION
// ============================================================

/**
 * تحديث Feature Flags في Runtime (من console أو API)
 */
export const updateFeatureFlag = (flag: keyof typeof FEATURE_FLAGS, value: boolean) => {
  (FEATURE_FLAGS as any)[flag] = value;

  if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
    console.log(`🚩 Feature flag updated: ${flag} = ${value}`);
  }
};

/**
 * تحديث Adapter Config في Runtime
 */
export const updateAdapterConfig = (partial: Partial<AdapterFactoryConfig>) => {
  Object.assign(ADAPTER_CONFIG, partial);

  if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
    console.log('⚙️ Adapter config updated:', ADAPTER_CONFIG);
  }
};

/**
 * الحصول على Config الكامل (للـ debugging)
 */
export const getAdapterConfig = () => ({
  flags: FEATURE_FLAGS,
  adapters: ADAPTER_CONFIG,
  services: SERVICE_URLS,
  bounds: SERVICE_BOUNDS,
  performance: PERFORMANCE_CONFIG,
});

// Export as window global for debugging (في development فقط)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).__RAAN_ADAPTER_CONFIG__ = {
    updateFeatureFlag,
    updateAdapterConfig,
    getAdapterConfig,
    FLAGS: FEATURE_FLAGS,
  };

  console.log('✅ RAAN Adapter Config loaded (dev mode)');
  console.log('💡 Use window.__RAAN_ADAPTER_CONFIG__.updateFeatureFlag("flag", true) to toggle');
}
