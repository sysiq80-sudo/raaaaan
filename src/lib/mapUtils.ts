/**
 * Map Utilities with Turf.js for Local Calculations
 * Reduces Mapbox API calls and costs
 */

import * as turf from '@turf/turf';

// Types
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Region {
  id: string;
  name_ar: string;
  name_en?: string | null;
  coordinates: Array<{ lat: number; lng: number }>;
}

export interface DriverPosition {
  id: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

/**
 * Calculate distance between two points locally (no API call)
 * Uses Turf.js Haversine formula
 */
export function calculateLocalDistance(from: Coordinates, to: Coordinates): number {
  const fromPoint = turf.point([from.lng, from.lat]);
  const toPoint = turf.point([to.lng, to.lat]);
  
  // Returns distance in kilometers
  return turf.distance(fromPoint, toPoint, { units: 'kilometers' });
}

/**
 * Calculate distance in meters
 */
export function calculateDistanceMeters(from: Coordinates, to: Coordinates): number {
  return calculateLocalDistance(from, to) * 1000;
}

/**
 * Check if a point is within a service area polygon locally
 * No need for Edge Function call
 */
export function isPointInServiceArea(
  point: Coordinates,
  regions: Region[]
): { inService: boolean; region: Region | null } {
  const pt = turf.point([point.lng, point.lat]);

  for (const region of regions) {
    if (!region.coordinates || region.coordinates.length < 3) continue;

    // Convert to GeoJSON polygon format (must close the ring)
    const coords = region.coordinates.map(c => [c.lng, c.lat]);
    // Close the polygon if not closed
    if (coords[0][0] !== coords[coords.length - 1][0] || 
        coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push(coords[0]);
    }

    try {
      const polygon = turf.polygon([coords]);
      
      if (turf.booleanPointInPolygon(pt, polygon)) {
        return { inService: true, region };
      }
    } catch (error) {
      console.warn('Invalid polygon for region:', region.id, error);
    }
  }

  return { inService: false, region: null };
}

/**
 * Find the nearest service area to a point
 */
export function findNearestServiceArea(
  point: Coordinates,
  regions: Region[]
): { region: Region; distance: number } | null {
  const pt = turf.point([point.lng, point.lat]);
  let nearest: { region: Region; distance: number } | null = null;

  for (const region of regions) {
    if (!region.coordinates || region.coordinates.length < 3) continue;

    // Calculate centroid of the polygon
    const coords = region.coordinates.map(c => [c.lng, c.lat]);
    if (coords[0][0] !== coords[coords.length - 1][0] || 
        coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push(coords[0]);
    }

    try {
      const polygon = turf.polygon([coords]);
      const centroid = turf.centroid(polygon);
      const distance = turf.distance(pt, centroid, { units: 'kilometers' });

      if (!nearest || distance < nearest.distance) {
        nearest = { region, distance };
      }
    } catch (error) {
      console.warn('Error calculating distance to region:', region.id);
    }
  }

  return nearest;
}

/**
 * Interpolate driver position for smooth animation
 * Uses client-side calculation instead of API calls
 */
export function interpolateDriverPosition(
  previousPosition: DriverPosition,
  currentPosition: DriverPosition,
  progress: number // 0 to 1
): Coordinates {
  // Clamp progress between 0 and 1
  const t = Math.max(0, Math.min(1, progress));

  // Linear interpolation (lerp)
  const lat = previousPosition.lat + (currentPosition.lat - previousPosition.lat) * t;
  const lng = previousPosition.lng + (currentPosition.lng - previousPosition.lng) * t;

  return { lat, lng };
}

/**
 * Calculate bearing between two points (for driver heading)
 */
export function calculateBearing(from: Coordinates, to: Coordinates): number {
  const fromPoint = turf.point([from.lng, from.lat]);
  const toPoint = turf.point([to.lng, to.lat]);
  
  return turf.bearing(fromPoint, toPoint);
}

/**
 * Estimate arrival time based on distance and average speed
 * Reduces need for Directions API calls for ETA
 */
export function estimateArrivalMinutes(
  from: Coordinates,
  to: Coordinates,
  averageSpeedKmh: number = 30 // Default city driving speed
): number {
  const distance = calculateLocalDistance(from, to);
  const hours = distance / averageSpeedKmh;
  return Math.ceil(hours * 60); // Convert to minutes, round up
}

/**
 * Generate Mapbox Static Image URL for ride history
 * Much cheaper than interactive map loads
 */
export function generateStaticMapUrl(
  pickupLocation: Coordinates,
  dropoffLocation: Coordinates,
  options: {
    width?: number;
    height?: number;
    accessToken: string;
    style?: string;
    routeCoordinates?: Coordinates[];
    padding?: number;
  }
): string {
  const {
    width = 600,
    height = 300,
    accessToken,
    style = 'dark-v11',
    routeCoordinates,
    padding = 50
  } = options;

  // Build markers
  const pickupMarker = `pin-s-a+22c55e(${pickupLocation.lng},${pickupLocation.lat})`;
  const dropoffMarker = `pin-s-b+ef4444(${dropoffLocation.lng},${dropoffLocation.lat})`;

  // Build route path if coordinates are provided
  let pathOverlay = '';
  if (routeCoordinates && routeCoordinates.length > 1) {
    const routeString = routeCoordinates
      .map(c => `${c.lng},${c.lat}`)
      .join(',');
    pathOverlay = `path-4+3b82f6-0.7(${encodeURIComponent(routeString)}),`;
  }

  // Calculate auto bounds
  const bounds = calculateBounds([pickupLocation, dropoffLocation, ...(routeCoordinates || [])]);
  const boundsString = `[${bounds.west},${bounds.south},${bounds.east},${bounds.north}]`;

  return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${pathOverlay}${pickupMarker},${dropoffMarker}/auto/${width}x${height}@2x?padding=${padding}&access_token=${accessToken}`;
}

/**
 * Calculate bounding box for coordinates
 */
export function calculateBounds(coordinates: Coordinates[]): {
  north: number;
  south: number;
  east: number;
  west: number;
} {
  if (coordinates.length === 0) {
    return { north: 0, south: 0, east: 0, west: 0 };
  }

  let north = -90, south = 90, east = -180, west = 180;

  for (const coord of coordinates) {
    if (coord.lat > north) north = coord.lat;
    if (coord.lat < south) south = coord.lat;
    if (coord.lng > east) east = coord.lng;
    if (coord.lng < west) west = coord.lng;
  }

  // Add small padding
  const latPadding = (north - south) * 0.1;
  const lngPadding = (east - west) * 0.1;

  return {
    north: north + latPadding,
    south: south - latPadding,
    east: east + lngPadding,
    west: west - lngPadding
  };
}

/**
 * Simplify route coordinates to reduce data size
 * Uses Douglas-Peucker algorithm via Turf.js
 */
export function simplifyRoute(
  coordinates: Coordinates[],
  tolerance: number = 0.001 // ~100m tolerance
): Coordinates[] {
  if (coordinates.length < 3) return coordinates;

  const lineCoords = coordinates.map(c => [c.lng, c.lat]);
  const line = turf.lineString(lineCoords);
  const simplified = turf.simplify(line, { tolerance, highQuality: true });

  return simplified.geometry.coordinates.map(([lng, lat]) => ({
    lat: lat as number,
    lng: lng as number
  }));
}

/**
 * Get point along a route at a specific percentage
 */
export function getPointAlongRoute(
  routeCoordinates: Coordinates[],
  percentage: number // 0 to 1
): Coordinates {
  if (routeCoordinates.length < 2) {
    return routeCoordinates[0] || { lat: 0, lng: 0 };
  }

  const lineCoords = routeCoordinates.map(c => [c.lng, c.lat]);
  const line = turf.lineString(lineCoords);
  const totalLength = turf.length(line, { units: 'kilometers' });
  const targetLength = totalLength * Math.max(0, Math.min(1, percentage));

  const point = turf.along(line, targetLength, { units: 'kilometers' });
  
  return {
    lng: point.geometry.coordinates[0],
    lat: point.geometry.coordinates[1]
  };
}

/**
 * Calculate remaining distance along a route from a point
 */
export function getRemainingDistance(
  currentPosition: Coordinates,
  routeCoordinates: Coordinates[]
): number {
  if (routeCoordinates.length < 2) return 0;

  const lineCoords = routeCoordinates.map(c => [c.lng, c.lat]);
  const line = turf.lineString(lineCoords);
  const point = turf.point([currentPosition.lng, currentPosition.lat]);

  // Find nearest point on route
  const snapped = turf.nearestPointOnLine(line, point);
  const locationOnLine = snapped.properties.location || 0;
  const totalLength = turf.length(line, { units: 'kilometers' });

  return Math.max(0, totalLength - locationOnLine);
}

/**
 * Check if a point is on or near a route
 * Used to determine if a stop is on the existing route
 */
export function isPointOnRoute(
  point: Coordinates,
  routeCoordinates: Coordinates[],
  toleranceKm: number = 0.2 // 200 meters default
): boolean {
  if (routeCoordinates.length < 2) return false;

  const lineCoords = routeCoordinates.map(c => [c.lng, c.lat]);
  const line = turf.lineString(lineCoords);
  const pt = turf.point([point.lng, point.lat]);

  // Find nearest point on line
  const snapped = turf.nearestPointOnLine(line, pt);
  const distanceToLine = snapped.properties.dist || 0; // Distance in km

  return distanceToLine <= toleranceKm;
}

/**
 * Calculate the detour distance if adding a stop
 */
export function calculateDetourDistance(
  currentPosition: Coordinates,
  stopLocation: Coordinates,
  finalDestination: Coordinates
): number {
  // Direct distance from current to final
  const directDistance = calculateLocalDistance(currentPosition, finalDestination);
  
  // Distance via stop
  const viaStopDistance = 
    calculateLocalDistance(currentPosition, stopLocation) + 
    calculateLocalDistance(stopLocation, finalDestination);
  
  // Detour is the additional distance
  return Math.max(0, viaStopDistance - directDistance);
}
