/**
 * Google Maps Service for RAAN Taxi
 * Replaces mapService.ts (Mapbox)
 * Provides unified interface for map operations
 */

import { getGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";

export interface MarkerIcon {
  path?: string;
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWeight: number;
  scale: number;
}

export interface MarkerOptions {
  position: { lat: number; lng: number };
  map?: any;
  title?: string;
  icon?: string | MarkerIcon | any;
  draggable?: boolean;
  animation?: any;
  opacity?: number;
  zIndex?: number;
}

/**
 * Marker Pool for reusing marker instances and improving performance
 * Replaces Mapbox MarkerPool
 */
export class GoogleMarkerPool {
  private pool: Map<string, any> = new Map();
  private active: Map<string, any> = new Map();

  /**
   * Acquire or create a marker
   */
  acquire(id: string, options: MarkerOptions): any {
    let marker = this.pool.get(id);

    if (!marker) {
      marker = new (window as any).google.maps.Marker(options);
    } else {
      // Reuse existing marker
      marker.setPosition(options.position);
      if (options.map) marker.setMap(options.map);
      if (options.title) marker.setTitle(options.title);
      if (options.icon) marker.setIcon(options.icon);
      if (options.draggable !== undefined) marker.setDraggable(options.draggable);
      if (options.opacity !== undefined) marker.setOpacity(options.opacity);
      if (options.zIndex !== undefined) marker.setZIndex(options.zIndex);
    }

    this.active.set(id, marker);
    return marker;
  }

  /**
   * Release a marker back to the pool
   */
  release(id: string): void {
    const marker = this.active.get(id);
    if (marker) {
      marker.setMap(null);
      this.pool.set(id, marker);
      this.active.delete(id);
    }
  }

  /**
   * Get active marker by ID
   */
  getActive(id: string): any | undefined {
    return this.active.get(id);
  }

  /**
   * Check if marker exists
   */
  hasActive(id: string): boolean {
    return this.active.has(id);
  }

  /**
   * Release all markers
   */
  releaseAll(): void {
    for (const marker of this.active.values()) {
      marker.setMap(null);
    }
    this.active.clear();
  }

  /**
   * Get all active marker IDs
   */
  getActiveIds(): Set<string> {
    return new Set(this.active.keys());
  }
}

/**
 * Direction styles for Google Maps polylines
 */
export const ROUTE_STYLES = {
  main: {
    strokeColor: "#00d9a5", // Green
    strokeOpacity: 0.8,
    strokeWeight: 4,
    clickable: false,
    geodesic: true,
  },
  glow: {
    strokeColor: "#00d9a5",
    strokeOpacity: 0.2,
    strokeWeight: 8,
    clickable: false,
    geodesic: true,
  },
  arriving: {
    strokeColor: "#22c55e", // Light green
    strokeOpacity: 0.8,
    strokeWeight: 4,
    clickable: false,
    geodesic: true,
  },
  inProgress: {
    strokeColor: "#ef4444", // Red
    strokeOpacity: 0.8,
    strokeWeight: 4,
    clickable: false,
    geodesic: true,
  },
};

/**
 * Marker colors and styles
 */
export const MARKER_STYLES = {
  pickup: {
    fillColor: "#22c55e",
    strokeColor: "#fff",
    scale: 1.2,
  },
  dropoff: {
    fillColor: "#2A6CD5",
    strokeColor: "#fff",
    scale: 1.2,
  },
  driver: {
    fillColor: "#3b82f6",
    strokeColor: "#fff",
    scale: 1.0,
  },
  user: {
    fillColor: "#8b5cf6",
    strokeColor: "#fff",
    scale: 1.0,
  },
  landmark: {
    fillColor: "#f59e0b",
    strokeColor: "#fff",
    scale: 0.9,
  },
};

/**
 * Create SVG marker icon for Google Maps
 */
export const createSvgIcon = (
  svgString: string,
  scale: number = 1
): google.maps.Icon => {
  const svg = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svg);

  return {
    url: url,
    scaledSize: new google.maps.Size(32 * scale, 32 * scale),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(16 * scale, 32 * scale),
  };
};

/**
 * Get marker icon for different types
 */
export const getMarkerIcon = (type: "pickup" | "dropoff" | "driver" | "user" | "landmark"): google.maps.Symbol => {
  const style = MARKER_STYLES[type];

  // Return Google Maps Symbol (not Icon)
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: style.fillColor,
    fillOpacity: 1,
    strokeColor: style.strokeColor,
    strokeWeight: 2,
    scale: style.scale * 8,
  };
};

/**
 * Calculate map bounds from multiple points
 */
export const calculateBounds = (points: Array<{ lat: number; lng: number }>): google.maps.LatLngBounds => {
  const bounds = new google.maps.LatLngBounds();

  points.forEach((point) => {
    bounds.extend(new google.maps.LatLng(point.lat, point.lng));
  });

  return bounds;
};

/**
 * Fit map to bounds with padding
 */
export const fitMapToBounds = (
  map: google.maps.Map,
  bounds: google.maps.LatLngBounds,
  padding: number = 50
): void => {
  map.fitBounds(bounds, padding);
};

/**
 * Geocode an address using Google Maps API
 */
export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  if (!window.google) return null;

  const geocoder = new google.maps.Geocoder();

  try {
    const result = await geocoder.geocode({ address });

    if (result.results && result.results.length > 0) {
      const location = result.results[0].geometry.location;
      return {
        lat: location.lat(),
        lng: location.lng(),
      };
    }

    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
};

/**
 * Reverse geocode coordinates to address
 * ✨ Enhanced: POI name + full address (no Plus Codes)
 */
export const reverseGeocodeCoordinates = async (
  lat: number,
  lng: number,
  map?: google.maps.Map
): Promise<string | null> => {
  if (!window.google) return null;

  try {
    // Step 1: Get full address from Geocoding API
    const geocoder = new google.maps.Geocoder();
    const result = await geocoder.geocode({
      location: { lat, lng },
      language: 'ar'
    });

    if (!result.results || result.results.length === 0) return null;

    let finalAddress = result.results[0].formatted_address;
    let poiName: string | null = null;

    // Step 2: Try to get POI name using Place.searchNearby (New API)
    if (window.google?.maps?.places?.Place) {
      try {
        const POI_TYPES = [
          'hospital', 'doctor', 'pharmacy',
          'mosque', 'church',
          'school', 'university', 'library',
          'city_hall', 'police', 'fire_station',
          'shopping_mall', 'supermarket', 'store',
          'restaurant', 'cafe', 'bakery',
          'bank', 'atm', 'post_office',
          'gas_station', 'car_repair',
          'park', 'stadium', 'gym',
          'museum', 'tourist_attraction'
        ];

        const { places } = await google.maps.places.Place.searchNearby({
          fields: ['displayName', 'types'],
          locationRestriction: {
            center: { lat, lng },
            radius: 50,
          },
          includedTypes: POI_TYPES,
          maxResultCount: 5,
          languageCode: 'ar',
        });

        if (places && places.length > 0) {
          const nearestPlace = places[0];
          if (nearestPlace.displayName) {
            poiName = nearestPlace.displayName;
            console.log("✅ Valid POI found via Place.searchNearby:", poiName);
          }
        }
      } catch (placeError) {
        console.warn("Places API error (non-critical):", placeError);
      }
    }

    // Step 3: Look for POI in geocoding results if not found
    if (!poiName) {
      const poiResult = result.results.find(r => 
        r.types.includes('point_of_interest') && 
        r.name &&
        !r.types.includes('route') &&
        !r.types.includes('neighborhood')
      );
      
      if (poiResult && poiResult.name) {
        poiName = poiResult.name;
        console.log("✅ POI name from geocoding:", poiName);
      }
    }

    // Step 4: Build final address (POI + address without Plus Code)
    const addressParts = finalAddress.split(',').map(p => p.trim());
    const isPlusCode = /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/.test(addressParts[0]);
    
    if (isPlusCode) {
      addressParts.shift(); // Remove Plus Code
      console.log("⚠️ Removed Plus Code from address");
    }
    
    if (poiName) {
      // POI name + rest of address
      finalAddress = [poiName, ...addressParts].join('، ');
      console.log("✅ Final address with POI:", finalAddress);
    } else if (isPlusCode) {
      // No POI but Plus Code was removed
      finalAddress = addressParts.join('، ');
      
      if (!finalAddress && result.results.length > 1) {
        finalAddress = result.results[1].formatted_address;
      }
    }

    return finalAddress || null;
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return null;
  }
};

/**
 * Get directions between two points
 */
export const getDirections = async (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  waypoints?: Array<{ lat: number; lng: number }>
): Promise<{
  distance: string;
  duration: string;
  distanceMeters: number;
  durationSeconds: number;
  route: Array<{ lat: number; lng: number }>;
} | null> => {
  if (!window.google) return null;

  const directionsService = new google.maps.DirectionsService();

  try {
    const request: google.maps.DirectionsRequest = {
      origin: new google.maps.LatLng(origin.lat, origin.lng),
      destination: new google.maps.LatLng(destination.lat, destination.lng),
      travelMode: google.maps.TravelMode.DRIVING,
      waypoints: waypoints?.map((w) => ({
        location: new google.maps.LatLng(w.lat, w.lng),
        stopover: true,
      })),
    };

    const result = await directionsService.route(request);

    if (result.routes && result.routes.length > 0) {
      const route = result.routes[0];
      const leg = route.legs[0];

      // Extract route coordinates
      const routeCoordinates: Array<{ lat: number; lng: number }> = [];
      route.overview_path.forEach((point) => {
        routeCoordinates.push({
          lat: point.lat(),
          lng: point.lng(),
        });
      });

      return {
        distance: leg.distance?.text || "",
        duration: leg.duration?.text || "",
        distanceMeters: leg.distance?.value || 0,
        durationSeconds: leg.duration?.value || 0,
        route: routeCoordinates,
      };
    }

    return null;
  } catch (error) {
    console.error("Directions error:", error);
    return null;
  }
};

/**
 * Draw polyline on map
 */
export const drawPolyline = (
  map: google.maps.Map,
  path: Array<{ lat: number; lng: number }>,
  options?: google.maps.PolylineOptions
): google.maps.Polyline => {
  if (!map) {
    console.error("❌ No map provided to drawPolyline");
    return null as any;
  }
  
  if (!path || path.length === 0) {
    console.error("❌ No path provided to drawPolyline");
    return null as any;
  }

  console.log(`🎨 Drawing polyline with ${path.length} points`);
  const polyline = new google.maps.Polyline({
    path: path.map((p) => new google.maps.LatLng(p.lat, p.lng)),
    map,
    ...options,
  });
  console.log("✅ Polyline created successfully");
  return polyline;
};

/**
 * Draw polygon on map
 */
export const drawPolygon = (
  map: google.maps.Map,
  path: Array<{ lat: number; lng: number }>,
  options?: google.maps.PolygonOptions
): google.maps.Polygon => {
  return new google.maps.Polygon({
    paths: path.map((p) => new google.maps.LatLng(p.lat, p.lng)),
    map,
    ...options,
  });
};

/**
 * Add info window to map
 */
export const addInfoWindow = (
  map: google.maps.Map,
  position: { lat: number; lng: number },
  content: string
): google.maps.InfoWindow => {
  const infoWindow = new google.maps.InfoWindow({
    content,
    position: new google.maps.LatLng(position.lat, position.lng),
  });

  infoWindow.open(map);
  return infoWindow;
};

/**
 * Create a heatmap layer
 */
export const createHeatmap = (
  map: google.maps.Map,
  points: Array<{ lat: number; lng: number }>
): google.maps.visualization.HeatmapLayer | null => {
  if (!window.google || !google.maps.visualization) {
    console.warn("Google Maps visualization library not loaded");
    return null;
  }

  const heatmap = new google.maps.visualization.HeatmapLayer({
    data: points.map((p) => new google.maps.LatLng(p.lat, p.lng)),
    map,
  });

  return heatmap;
};

/**
 * Get map style for dark mode (used by admin dashboard)
 */
export const getDarkMapStyle = (): google.maps.MapTypeStyle[] => {
  return [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    {
      featureType: "administrative.locality",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#263c3f" }],
    },
    {
      featureType: "poi.park",
      elementType: "labels.text.fill",
      stylers: [{ color: "#6b9080" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#38414e" }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: "#212a37" }],
    },
    {
      featureType: "road",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9ca5b0" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: "#746855" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: "#1f2835" }],
    },
    {
      featureType: "road.highway",
      elementType: "labels.text.fill",
      stylers: [{ color: "#f3751ff" }],
    },
    {
      featureType: "transit",
      elementType: "geometry",
      stylers: [{ color: "#2f3948" }],
    },
    {
      featureType: "transit.station",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#17263c" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: "#515c6d" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.stroke",
      stylers: [{ color: "#17263c" }],
    },
  ];
};
