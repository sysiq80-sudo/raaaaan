import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/utils.ts";
// In-memory cache for regions (Edge Functions are short-lived, but helps within same instance)
let cachedRegions: any[] = [];
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

// Point-in-Polygon algorithm (Ray Casting)
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

// Get polygon centroid
function getPolygonCentroid(polygon: Array<{ lat: number; lng: number }>): { lat: number; lng: number } {
  if (!polygon || polygon.length === 0) {
    return { lat: 33.4262, lng: 43.2954 }; // Default to Ramadi
  }
  const lat = polygon.reduce((sum, p) => sum + p.lat, 0) / polygon.length;
  const lng = polygon.reduce((sum, p) => sum + p.lng, 0) / polygon.length;
  return { lat, lng };
}

// Calculate polygon area using Shoelace formula
function calculatePolygonArea(polygon: Array<{ lat: number; lng: number }>): number {
  if (!polygon || polygon.length < 3) return 0;
  
  let area = 0;
  const n = polygon.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Using lat/lng approximation (good enough for comparison)
    area += polygon[i].lng * polygon[j].lat;
    area -= polygon[j].lng * polygon[i].lat;
  }
  
  return Math.abs(area / 2) * 111319.9 * 111319.9; // Convert to approximate square meters
}

// Fetch regions with caching
async function getRegions(supabase: any): Promise<any[]> {
  const now = Date.now();
  
  // Return cached if still valid
  if (cachedRegions.length > 0 && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('📦 Using cached regions');
    return cachedRegions;
  }
  
  console.log('🔄 Fetching regions from database');
  const { data: regions, error } = await supabase
    .from('regions')
    .select('id, name_ar, name_en, coordinates, base_fare, per_km_fare, waiting_fare_per_min, priority')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching regions:', error);
    // Return cached data even if stale on error
    if (cachedRegions.length > 0) return cachedRegions;
    return [];
  }

  // Update cache
  cachedRegions = regions || [];
  cacheTimestamp = now;
  
  return cachedRegions;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = performance.now();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const lat = parseFloat(url.searchParams.get('lat') || '0');
    const lng = parseFloat(url.searchParams.get('lng') || '0');

    if (!lat || !lng) {
      return new Response(
        JSON.stringify({ error: 'lat and lng are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get regions (with caching)
    const regions = await getRegions(supabase);

    const point = { lat, lng };
    const matchedRegions: Array<{
      region: any;
      area: number;
      priority: number;
    }> = [];
    let nearestRegion = null;
    let nearestDistance = Infinity;

    // Check each region
    for (const region of regions) {
      const coordinates = region.coordinates as Array<{ lat: number; lng: number }> | null;
      
      if (coordinates && coordinates.length >= 3) {
        // Check if point is inside polygon
        if (isPointInPolygon(point, coordinates)) {
          const area = calculatePolygonArea(coordinates);
          matchedRegions.push({
            region: {
              id: region.id,
              name_ar: region.name_ar,
              name_en: region.name_en,
              base_fare: region.base_fare,
              per_km_fare: region.per_km_fare,
              waiting_fare_per_min: region.waiting_fare_per_min
            },
            area,
            priority: region.priority || 0
          });
        }

        // Calculate distance to region centroid
        const centroid = getPolygonCentroid(coordinates);
        const distance = calculateDistance(lat, lng, centroid.lat, centroid.lng);
        
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestRegion = {
            id: region.id,
            name_ar: region.name_ar,
            name_en: region.name_en,
            distance_km: Math.round(distance * 10) / 10
          };
        }
      }
    }

    // Select the best matching region (highest priority, then smallest area)
    let matchedRegion = null;
    if (matchedRegions.length > 0) {
      matchedRegions.sort((a, b) => {
        // Higher priority first
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        // Smaller area (more specific) first
        return a.area - b.area;
      });
      matchedRegion = matchedRegions[0].region;
      console.log(`📍 Point matched ${matchedRegions.length} regions, selected: ${matchedRegion.name_ar} (priority: ${matchedRegions[0].priority}, area: ${Math.round(matchedRegions[0].area)}m²)`);
    }

    const endTime = performance.now();
    const processingTime = Math.round(endTime - startTime);

    const result = {
      in_service: matchedRegion !== null,
      region: matchedRegion,
      nearest_region: matchedRegion ? null : nearestRegion,
      _meta: {
        processing_time_ms: processingTime,
        cached: (Date.now() - cacheTimestamp) < 1000 // Was cache used?
      }
    };

    console.log(`✅ Service area check: ${result.in_service ? 'IN SERVICE' : 'OUT OF SERVICE'} (${processingTime}ms)`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-service-area:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
