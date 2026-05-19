/**
 * ران — Adapter Types و Interfaces
 * نظام معايير موحد لجميع الـ adapters (خريطة، مسارات، أماكن)
 * يسمح بـ multi-provider support مع fallback chain آمن
 */

// ============================================================
// COORDINATE & BASIC TYPES
// ============================================================

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface BoundsLike {
  north?: number;
  south?: number;
  east?: number;
  west?: number;
  lat?: number;
  lng?: number;
}

// ============================================================
// PROVIDER TYPES
// ============================================================

export type MapProvider = 'openstreetmap' | 'google' | 'static';
export type RoutingProvider = 'osrm' | 'google' | 'haversine';
export type GeocodingProvider = 'nominatim' | 'photon' | 'google';

// ============================================================
// MAP ADAPTER INTERFACES
// ============================================================

export interface MapOptions {
  center: Coordinate;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  style?: 'light' | 'dark' | 'satellite';
}

export interface MarkerOptions {
  id?: string;
  title?: string;
  icon?: any;
  opacity?: number;
  zIndex?: number;
  draggable?: boolean;
  animation?: any;
}

export interface PolylineOptions {
  id?: string;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  clickable?: boolean;
  geodesic?: boolean;
}

export interface IMapAdapter {
  /**
   * تحميل المكتبات المطلوبة (async)
   */
  load(): Promise<void>;

  /**
   * إنشاء instance الخريطة في container HTML
   */
  createMap(container: HTMLElement, options: MapOptions): Promise<any>;

  /**
   * إضافة marker على الخريطة
   */
  addMarker(coord: Coordinate, options?: MarkerOptions): void;

  /**
   * رسم polyline (خط) على الخريطة
   */
  drawPolyline(path: Coordinate[], options?: PolylineOptions): void;

  /**
   * ضبط الخريطة لعرض نطاق معين
   */
  fitBounds(bounds: BoundsLike): void;

  /**
   * تنظيف الـ resources
   */
  destroy(): void;
}

// ============================================================
// ROUTING ADAPTER INTERFACES
// ============================================================

export interface RouteStep {
  name: string;
  distance: number; // meters
  duration: number; // seconds
  instruction?: string;
}

export interface RouteResult {
  distance: number; // meters
  duration: number; // seconds
  path: Coordinate[]; // coordinates along the route
  steps: RouteStep[];
  _timestamp?: number; // لـ caching
}

export interface IRoutingAdapter {
  /**
   * تحميل أي موارد مطلوبة قبل الاستخدام
   */
  load(): Promise<void>;

  /**
   * حساب المسار بين نقطتين
   */
  getRoute(
    origin: Coordinate,
    destination: Coordinate,
    waypoints?: Coordinate[]
  ): Promise<RouteResult>;

  /**
   * حساب المسافة بين نقطتين فقط
   */
  getDistance(origin: Coordinate, destination: Coordinate): Promise<number>;
}

// ============================================================
// GEOCODING ADAPTER INTERFACES
// ============================================================

export interface PlacePrediction {
  place_id: string;
  main_text: string; // اسم المكان الرئيسي
  secondary_text?: string; // معلومات إضافية
  description: string; // العنوان الكامل
  lat: number;
  lng: number;
  distance_meters?: number; // if from center
  distance_text?: string; // formatted distance
  type?: string; // amenity, restaurant, etc.
}

export interface IGeocodingAdapter {
  /**
   * تحميل أي موارد مطلوبة قبل الاستخدام
   */
  load(): Promise<void>;

  /**
   * تحويل عنوان نصي → إحداثيات (Geocoding)
   */
  geocode(address: string, bounds?: BoundsLike): Promise<Coordinate | null>;

  /**
   * تحويل إحداثيات → عنوان نصي (Reverse Geocoding)
   */
  reverseGeocode(lat: number, lng: number): Promise<string | null>;

  /**
   * البحث عن الأماكن (autocomplete search)
   */
  searchPlaces(
    query: string,
    center?: Coordinate,
    bounds?: BoundsLike
  ): Promise<PlacePrediction[]>;
}

// ============================================================
// ADAPTER ERROR TYPES
// ============================================================

export class AdapterError extends Error {
  constructor(
    public provider: string,
    public originalError: Error,
    message?: string
  ) {
    super(message || `${provider} adapter error: ${originalError.message}`);
    this.name = 'AdapterError';
  }
}

export class AdapterTimeoutError extends AdapterError {
  constructor(provider: string, timeout: number) {
    super(provider, new Error('Timeout'), `${provider} timeout after ${timeout}ms`);
    this.name = 'AdapterTimeoutError';
  }
}

export class AdapterChainError extends Error {
  constructor(
    public provider: string,
    public errors: AdapterError[]
  ) {
    super(
      `All ${provider} providers failed:\n${errors.map(e => `  - ${e.message}`).join('\n')}`
    );
    this.name = 'AdapterChainError';
  }
}

// ============================================================
// ADAPTER FACTORY TYPES
// ============================================================

export interface AdapterFactoryConfig {
  maps?: {
    primary: MapProvider;
    fallback: MapProvider[];
    timeout: number;
  };
  routing?: {
    primary: RoutingProvider;
    fallback: RoutingProvider[];
    timeout: number;
  };
  geocoding?: {
    primary: GeocodingProvider;
    fallback: GeocodingProvider[];
    timeout: number;
  };
}

// ============================================================
// EVENT TYPES (للمرحلة 5)
// ============================================================

export type EventType =
  | 'ride-created'
  | 'ride-accepted'
  | 'ride-started'
  | 'ride-completed'
  | 'ride-cancelled'
  | 'driver-arrived'
  | 'payment-processed'
  | 'rating-submitted';

export type EventSource = 'driver' | 'rider' | 'system';

export interface EventMetadata {
  eventId: string;
  eventType: EventType;
  rideId: string;
  timestamp: number;
  lamportClock: number;
  source: EventSource;
  version: number;
}

export interface RideEvent {
  metadata: EventMetadata;
  payload: Record<string, any>;
}
