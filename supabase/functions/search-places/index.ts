import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";
import { corsHeaders, getCorsHeaders } from "../_shared/utils.ts";

let MAPBOX_TOKEN = "";
let _configLoaded = false;

async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, ["MAPBOX_PUBLIC_TOKEN"]);
    MAPBOX_TOKEN = cfg["MAPBOX_PUBLIC_TOKEN"] || Deno.env.get('MAPBOX_PUBLIC_TOKEN') || "";
    _configLoaded = true;
    console.log("[search-places] ✅ Dynamic config loaded");
  } catch (e) {
    console.warn("[search-places] ⚠️ Config load failed, using env fallback:", e);
    MAPBOX_TOKEN = Deno.env.get('MAPBOX_PUBLIC_TOKEN') || "";
  }
}
// Point-in-Polygon algorithm
function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>
): boolean {
  if (!polygon || polygon.length < 3) return false;
  
  let inside = false;
  const n = polygon.length;
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    
    if (((yi > point.lat) !== (yj > point.lat)) &&
        (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

// Haversine distance in km
function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  await loadDynamicConfig();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!MAPBOX_TOKEN) {
      throw new Error('MAPBOX_PUBLIC_TOKEN not configured');
    }

    const url = new URL(req.url);
    const query = url.searchParams.get('q')?.trim();
    const userLng = parseFloat(url.searchParams.get('lng') || '43.2954');
    const userLat = parseFloat(url.searchParams.get('lat') || '33.4262');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching for:', query, 'from:', userLat, userLng);

    // Fetch all active regions with coordinates for service area check
    const regionsWithCoords = await supabase
      .from('regions')
      .select('id, name_ar, name_en, coordinates')
      .eq('is_active', true);

    const activeRegions = (regionsWithCoords.data || []).filter(
      (r: any) => r.coordinates && Array.isArray(r.coordinates) && r.coordinates.length >= 3
    );

    // Check if a point is in any service area
    const checkServiceArea = (lat: number, lng: number): { inService: boolean; regionName?: string } => {
      for (const region of activeRegions) {
        if (isPointInPolygon({ lat, lng }, region.coordinates)) {
          return { inService: true, regionName: region.name_ar };
        }
      }
      return { inService: false };
    };

    // Parallel search
    const [landmarksResult, regionsResult, mapboxResult] = await Promise.all([
      supabase
        .from('landmarks')
        .select('id, name_ar, name_en, category, location, region_id')
        .eq('is_active', true)
        .or(`name_ar.ilike.%${query}%,name_en.ilike.%${query}%`)
        .limit(10),
      
      supabase
        .from('regions')
        .select('id, name_ar, name_en, coordinates')
        .eq('is_active', true)
        .or(`name_ar.ilike.%${query}%,name_en.ilike.%${query}%`)
        .limit(5),
      
      fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=iq&language=ar&proximity=${userLng},${userLat}&limit=8`
      ).then(res => res.json())
    ]);

    const results: any[] = [];

    // Process landmarks
    if (landmarksResult.data) {
      landmarksResult.data.forEach((landmark: any) => {
        const location = landmark.location as { lat: number; lng: number };
        const distance = calculateDistance(userLat, userLng, location.lat, location.lng);
        const serviceCheck = checkServiceArea(location.lat, location.lng);
        
        results.push({
          id: `landmark_${landmark.id}`,
          type: 'landmark',
          name: landmark.name_ar,
          name_secondary: landmark.name_en,
          category: landmark.category || 'معلم',
          lat: location.lat,
          lng: location.lng,
          icon: '📍',
          distance_km: Math.round(distance * 10) / 10,
          in_service: serviceCheck.inService,
          region_name: serviceCheck.regionName
        });
      });
    }

    // Process regions
    if (regionsResult.data) {
      regionsResult.data.forEach((region: any) => {
        let lat = 33.4262;
        let lng = 43.2954;
        let inService = false;
        
        if (region.coordinates && Array.isArray(region.coordinates) && region.coordinates.length > 0) {
          lat = region.coordinates.reduce((sum: number, c: any) => sum + c.lat, 0) / region.coordinates.length;
          lng = region.coordinates.reduce((sum: number, c: any) => sum + c.lng, 0) / region.coordinates.length;
          inService = region.coordinates.length >= 3;
        }

        const distance = calculateDistance(userLat, userLng, lat, lng);

        results.push({
          id: `region_${region.id}`,
          type: 'region',
          name: region.name_ar,
          name_secondary: region.name_en,
          category: 'منطقة',
          lat,
          lng,
          icon: '🏘️',
          distance_km: Math.round(distance * 10) / 10,
          in_service: inService,
          region_name: region.name_ar
        });
      });
    }

    // Process Mapbox results
    if (mapboxResult.features) {
      mapboxResult.features.forEach((feature: any) => {
        const lat = feature.center[1];
        const lng = feature.center[0];
        const distance = calculateDistance(userLat, userLng, lat, lng);
        const serviceCheck = checkServiceArea(lat, lng);

        results.push({
          id: `mapbox_${feature.id}`,
          type: 'address',
          name: feature.text || feature.place_name,
          name_secondary: feature.context?.[0]?.text || '',
          category: getCategoryFromPlaceType(feature.place_type?.[0]),
          lat,
          lng,
          full_address: feature.place_name,
          icon: getIconFromPlaceType(feature.place_type?.[0]),
          distance_km: Math.round(distance * 10) / 10,
          in_service: serviceCheck.inService,
          region_name: serviceCheck.regionName
        });
      });
    }

    // Sort by: 1) in_service first, 2) by distance
    results.sort((a, b) => {
      // First priority: in service vs out of service
      if (a.in_service && !b.in_service) return -1;
      if (!a.in_service && b.in_service) return 1;
      
      // Second priority: type (landmarks > regions > addresses)
      const typeOrder = { landmark: 0, region: 1, address: 2 };
      const typeA = typeOrder[a.type as keyof typeof typeOrder] ?? 3;
      const typeB = typeOrder[b.type as keyof typeof typeOrder] ?? 3;
      if (typeA !== typeB) return typeA - typeB;
      
      // Third priority: distance
      return a.distance_km - b.distance_km;
    });

    // Find nearest service region for out-of-service results
    const nearestServiceRegion = activeRegions.length > 0 ? (() => {
      let nearest = null;
      let minDist = Infinity;
      for (const region of activeRegions) {
        const centroid = {
          lat: region.coordinates.reduce((sum: number, c: any) => sum + c.lat, 0) / region.coordinates.length,
          lng: region.coordinates.reduce((sum: number, c: any) => sum + c.lng, 0) / region.coordinates.length
        };
        const dist = calculateDistance(userLat, userLng, centroid.lat, centroid.lng);
        if (dist < minDist) {
          minDist = dist;
          nearest = { name: region.name_ar, distance_km: Math.round(dist * 10) / 10 };
        }
      }
      return nearest;
    })() : null;

    console.log(`Found ${results.length} results for "${query}"`);

    return new Response(
      JSON.stringify({ 
        results: results.slice(0, limit),
        nearest_service_region: nearestServiceRegion
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-places:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', results: [] }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getCategoryFromPlaceType(placeType: string): string {
  const categories: Record<string, string> = {
    'poi': 'مكان',
    'address': 'عنوان',
    'place': 'مدينة',
    'locality': 'حي',
    'neighborhood': 'حي',
    'district': 'منطقة',
    'region': 'محافظة',
    'country': 'دولة'
  };
  return categories[placeType] || 'موقع';
}

function getIconFromPlaceType(placeType: string): string {
  const icons: Record<string, string> = {
    'poi': '📍',
    'address': '🏠',
    'place': '🏙️',
    'locality': '🏘️',
    'neighborhood': '🏘️',
    'district': '🗺️',
    'region': '🗺️'
  };
  return icons[placeType] || '📍';
}
