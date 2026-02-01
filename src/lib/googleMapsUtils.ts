/**
 * Google Maps Utilities for RAAN Taxi Application
 * Replaces Mapbox-specific functions with Google Maps equivalents
 * Keeps Turf.js for local geometric calculations
 */

import * as turf from "@turf/turf";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Region {
  id: string;
  name_ar: string;
  name_en?: string | null;
  coordinates: Array<{ lat: number; lng: number }>;
  priority?: number;
}

export interface DriverPosition {
  id: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface ServiceAreaCheck {
  in_service: boolean;
  region: Region | null;
  nearest_region: { id: string; name_ar: string; distance_km: number } | null;
}

/**
 * Calculate distance between two points using Haversine formula with Turf.js
 * More accurate than simple lat/lng difference
 */
export const calculateLocalDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const from = turf.point([lng1, lat1]);
  const to = turf.point([lng2, lat2]);
  const distance = turf.distance(from, to, { units: "kilometers" });
  return distance;
};

/**
 * Calculate distance in meters
 */
export const calculateDistanceMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  return calculateLocalDistance(lat1, lng1, lat2, lng2) * 1000;
};

/**
 * Estimate time based on distance and average speed
 */
export const calculateEstimatedTime = (distanceKm: number): number => {
  const AVERAGE_SPEED_KMH = 30; // Average city speed
  return Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60); // Return minutes
};

/**
 * Calculate the area of a polygon (region) using Turf.js
 */
export const calculatePolygonArea = (
  coordinates: Array<{ lat: number; lng: number }>
): number => {
  if (coordinates.length < 3) return 0;

  const polygon = turf.polygon([
    coordinates.map((c) => [c.lng, c.lat]),
  ]);
  const area = turf.area(polygon);
  return area;
};

/**
 * Check if a point is within a service area (polygon)
 */
export const isPointInServiceArea = (
  point: Coordinates,
  region: Region
): boolean => {
  if (!region.coordinates || region.coordinates.length < 3) return false;

  const turfPoint = turf.point([point.lng, point.lat]);
  const turfPolygon = turf.polygon([
    region.coordinates.map((c) => [c.lng, c.lat]),
  ]);

  return turf.booleanPointInPolygon(turfPoint, turfPolygon);
};

/**
 * Find the nearest service area to a point
 */
export const findNearestServiceArea = (
  point: Coordinates,
  regions: Region[]
): Region | null => {
  if (!regions.length) return null;

  const turfPoint = turf.point([point.lng, point.lat]);

  let nearest: Region | null = null;
  let minDistance = Infinity;

  for (const region of regions) {
    if (!region.coordinates || region.coordinates.length < 3) continue;

    // Distance to polygon edge - simplified approach
    let minDistToPolygon = Infinity;
    const coords = region.coordinates.map((c) => [c.lng, c.lat]);
    
    // Check distance from point to each edge of the polygon
    for (let i = 0; i < coords.length; i++) {
      const start = coords[i] as [number, number];
      const end = coords[(i + 1) % coords.length] as [number, number];
      const lineString = turf.lineString([start, end]);
      try {
        const distance = turf.pointToLineDistance(
          turfPoint,
          lineString as any,
          { units: "kilometers" }
        );
        minDistToPolygon = Math.min(minDistToPolygon, distance);
      } catch (e) {
        // Skip if calculation fails
      }
    }

    if (minDistToPolygon < minDistance) {
      minDistance = minDistToPolygon;
      nearest = region;
    }
  }

  return nearest;
};

/**
 * Interpolate driver position smoothly (for animation)
 */
export const interpolateDriverPosition = (
  current: DriverPosition,
  previous: DriverPosition | null,
  progress: number // 0 to 1
): Coordinates => {
  if (!previous) {
    return { lat: current.lat, lng: current.lng };
  }

  // Linear interpolation
  const lat = previous.lat + (current.lat - previous.lat) * progress;
  const lng = previous.lng + (current.lng - previous.lng) * progress;

  return { lat, lng };
};

/**
 * Calculate bearing (direction) between two points
 */
export const calculateBearing = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const from = turf.point([lng1, lat1]);
  const to = turf.point([lng2, lat2]);
  const bearing = turf.bearing(from, to);
  return bearing;
};

/**
 * Generate URL for Google Static Maps API (for static map images)
 */
export const generateStaticMapUrl = (
  center: Coordinates,
  zoom: number = 14,
  width: number = 400,
  height: number = 300,
  markers: Array<{ lat: number; lng: number; color?: string }> = []
): string => {
  const apiKey = getGoogleMapsApiKey();

  // Build markers string
  const markerStrings = markers.map((m) => {
    const color = m.color ? `color:${m.color.replace("#", "0x")}` : "";
    return `${color}|${m.lat},${m.lng}`;
  }).join("&markers=");

  const markerPart = markerStrings ? `&markers=${markerStrings}` : "";

  return `https://maps.googleapis.com/maps/api/staticmap?center=${center.lat},${center.lng}&zoom=${zoom}&size=${width}x${height}${markerPart}&key=${apiKey}`;
};

/**
 * Calculate bounds (viewport) for a set of points
 */
export const calculateBounds = (
  points: Coordinates[]
): { center: Coordinates; zoom: number } => {
  if (!points.length) {
    return { center: { lat: 33.31, lng: 44.36 }, zoom: 6 }; // Iraq default
  }

  if (points.length === 1) {
    return { center: points[0], zoom: 14 };
  }

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);

  const center: Coordinates = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };

  // Estimate zoom based on bounds
  const latRange = Math.max(...lats) - Math.min(...lats);
  const lngRange = Math.max(...lngs) - Math.min(...lngs);
  const maxRange = Math.max(latRange, lngRange);

  let zoom = 14;
  if (maxRange > 0.5) zoom = 12;
  if (maxRange > 1) zoom = 11;
  if (maxRange > 2) zoom = 10;
  if (maxRange > 5) zoom = 8;

  return { center, zoom };
};

/**
 * Simplify a route using Douglas-Peucker algorithm (via Turf.js)
 */
export const simplifyRoute = (
  points: Array<{ lat: number; lng: number }>,
  tolerance: number = 0.001
): Array<{ lat: number; lng: number }> => {
  if (points.length < 3) return points;

  const lineString = turf.lineString(
    points.map((p) => [p.lng, p.lat])
  );

  const simplified = turf.simplify(lineString, { tolerance, highQuality: true });

  return (simplified.geometry.coordinates || []).map((coord: number[]) => ({
    lat: coord[1],
    lng: coord[0],
  }));
};

/**
 * Get a point along a route at a specific distance
 */
export const getPointAlongRoute = (
  points: Array<{ lat: number; lng: number }>,
  distanceAlongKm: number
): { lat: number; lng: number } | null => {
  if (!points.length) return null;

  const lineString = turf.lineString(
    points.map((p) => [p.lng, p.lat])
  );

  const alongPoint = turf.along(lineString, distanceAlongKm, {
    units: "kilometers",
  });

  if (alongPoint) {
    return {
      lat: alongPoint.geometry.coordinates[1],
      lng: alongPoint.geometry.coordinates[0],
    };
  }

  return null;
};

/**
 * Calculate remaining distance on a route
 */
export const getRemainingDistance = (
  currentPoint: Coordinates,
  remainingRoute: Array<{ lat: number; lng: number }>
): number => {
  if (remainingRoute.length < 2) {
    return calculateLocalDistance(
      currentPoint.lat,
      currentPoint.lng,
      remainingRoute[0]?.lat || currentPoint.lat,
      remainingRoute[0]?.lng || currentPoint.lng
    );
  }

  const lineString = turf.lineString(
    remainingRoute.map((p) => [p.lng, p.lat])
  );

  return turf.length(lineString, { units: "kilometers" });
};

/**
 * Check if a point is on/near a route
 */
export const isPointOnRoute = (
  point: Coordinates,
  route: Array<{ lat: number; lng: number }>,
  toleranceMeters: number = 100
): boolean => {
  if (route.length < 2) return false;

  const lineString = turf.lineString(
    route.map((p) => [p.lng, p.lat])
  );

  const turfPoint = turf.point([point.lng, point.lat]);
  
  try {
    const distance = turf.pointToLineDistance(
      turfPoint,
      lineString as any,
      { units: "kilometers" }
    );
    return distance * 1000 <= toleranceMeters; // Convert km to meters
  } catch (e) {
    console.warn('Point to line distance calculation failed:', e);
    return false;
  }
};

/**
 * Calculate detour distance (how much extra distance if we deviate from route)
 */
export const calculateDetourDistance = (
  currentPoint: Coordinates,
  deviationPoint: Coordinates,
  originalRoute: Array<{ lat: number; lng: number }>
): number => {
  const directDistance = calculateLocalDistance(
    currentPoint.lat,
    currentPoint.lng,
    deviationPoint.lat,
    deviationPoint.lng
  );

  const routeDistance = getRemainingDistance(currentPoint, originalRoute);

  return Math.max(0, directDistance - routeDistance);
};

/**
 * Import Google Maps API key from hook
 */
import { getGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
