import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";
import { getCorsHeaders, getAuthUser } from "../_shared/utils.ts";

let GOOGLE_MAPS_API_KEY = "";
let _configLoaded = false;

async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, ["GOOGLE_MAPS_API_KEY"]);
    GOOGLE_MAPS_API_KEY = cfg["GOOGLE_MAPS_API_KEY"] || Deno.env.get('GOOGLE_MAPS_API_KEY') || "";
    _configLoaded = true;
    console.log("[google-maps-proxy] ✅ Dynamic config loaded");
  } catch (e) {
    console.warn("[google-maps-proxy] ⚠️ Config load failed, using env fallback:", e);
    GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') || "";
  }
}
// Log API usage to database
async function logApiUsage(apiType: string, endpoint?: string, metadata?: Record<string, any>) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) return;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.from('api_usage_logs').insert({
      api_type: apiType,
      endpoint: endpoint,
      request_count: 1,
      metadata: metadata || {},
    });
  } catch (error) {
    console.error('Error logging API usage:', error);
  }
}

// ═══════════════════════════════════════════════════════════════
// Geocoding Cache — يوفر 60-80% من تكلفة Google Maps API
// ═══════════════════════════════════════════════════════════════

function hashQuery(action: string, query: string): string {
  // Simple hash — deterministic for same inputs
  let hash = 0;
  const str = `${action}:${query}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `${action}_${Math.abs(hash).toString(36)}`;
}

// تقريب الإحداثيات لزيادة نسبة الـ cache hit
// 4 أرقام عشرية = دقة ~11 متر (كافية للعناوين)
function roundCoords(lat: string, lng: string): string {
  return `${parseFloat(lat).toFixed(4)},${parseFloat(lng).toFixed(4)}`;
}

async function getCachedGeocode(supabase: any, queryHash: string): Promise<any | null> {
  try {
    const { data } = await supabase
      .from('geocode_cache')
      .select('results')
      .eq('query_hash', queryHash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    
    if (data?.results) {
      // تحديث عداد الاستخدام (fire-and-forget)
      supabase.from('geocode_cache')
        .update({ hit_count: supabase.rpc ? undefined : 1 }) // fallback
        .eq('query_hash', queryHash)
        .then(() => {})
        .catch(() => {});
      
      console.log(`[geocode-cache] ✅ HIT: ${queryHash}`);
      return data.results;
    }
    return null;
  } catch {
    return null; // fail-open: إذا فشل الكاش نكمل مع Google
  }
}

async function setCachedGeocode(
  supabase: any, 
  queryHash: string, 
  queryText: string, 
  action: string, 
  results: any
): Promise<void> {
  try {
    await supabase.from('geocode_cache').upsert({
      query_hash: queryHash,
      query_text: queryText,
      action: action,
      results: results,
      hit_count: 1,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 أيام
    });
    console.log(`[geocode-cache] 💾 STORED: ${queryHash}`);
  } catch (e) {
    console.warn('[geocode-cache] Failed to store:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  await loadDynamicConfig();

  try {
    const dynamicCors = getCorsHeaders(req);

    if (!GOOGLE_MAPS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_MAPS_API_KEY not configured', configured: false }),
        { headers: { ...dynamicCors, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Check if Google Maps is configured (public — no auth needed)
    if (action === 'check') {
      return new Response(
        JSON.stringify({ configured: true }),
        { headers: { ...dynamicCors, 'Content-Type': 'application/json' } }
      );
    }

    // Require authentication for all data-access actions
    const PROTECTED_ACTIONS = new Set(['directions', 'geocode', 'reverse-geocode']);
    if (PROTECTED_ACTIONS.has(action ?? '')) {
      const caller = await getAuthUser(req);
      if (!caller) {
        return new Response(
          JSON.stringify({ error: 'unauthorized' }),
          { status: 401, headers: { ...dynamicCors, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get directions between two points
    if (action === 'directions') {
      const origin = url.searchParams.get('origin');
      const destination = url.searchParams.get('destination');

      if (!origin || !destination) {
        throw new Error('Missing origin or destination coordinates');
      }

      const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&language=ar&key=${GOOGLE_MAPS_API_KEY}`;
      
      console.log('Fetching Google directions');
      
      const response = await fetch(directionsUrl);
      const data = await response.json();

      if (data.status !== 'OK') {
        console.error('Google Directions API error:', data.status, data.error_message);
        throw new Error(data.error_message || `Directions API error: ${data.status}`);
      }

      // Log API usage
      logApiUsage('google_directions', '/directions', { origin, destination });

      // Convert Google format to a more usable format
      const route = data.routes[0];
      const leg = route.legs[0];
      
      // Decode polyline to coordinates
      const decodedPath = decodePolyline(route.overview_polyline.points);

      return new Response(
        JSON.stringify({
          routes: [{
            distance: leg.distance.value,
            duration: leg.duration.value,
            geometry: {
              coordinates: decodedPath
            },
            start_address: leg.start_address,
            end_address: leg.end_address,
          }]
        }),
        { headers: { ...dynamicCors, 'Content-Type': 'application/json' } }
      );
    }

    // Forward geocoding - search for places by text
    if (action === 'geocode') {
      const query = url.searchParams.get('q');
      const proximity = url.searchParams.get('proximity'); // format: lat,lng

      if (!query) {
        throw new Error('Missing search query');
      }

      // ── كاش: تحقق أولاً ──
      const cacheKey = hashQuery('geocode', query.toLowerCase().trim());
      const svc = createServiceClient();
      const cached = await getCachedGeocode(svc, cacheKey);
      if (cached) {
        logApiUsage('google_geocode_cached', '/geocode', { query, cached: true });
        return new Response(
          JSON.stringify(cached),
          { headers: { ...dynamicCors, 'Content-Type': 'application/json' } }
        );
      }

      let geocodeUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=ar&region=iq&key=${GOOGLE_MAPS_API_KEY}`;
      
      if (proximity) {
        geocodeUrl += `&location=${proximity}&radius=50000`;
      }
      
      console.log('Google forward geocoding:', query);
      
      const response = await fetch(geocodeUrl);
      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('Google Places error:', data.status, data.error_message);
        throw new Error(data.error_message || `Places API error: ${data.status}`);
      }

      // Convert to Mapbox-like format for compatibility
      const features = (data.results || []).slice(0, 5).map((place: any) => ({
        id: place.place_id,
        type: 'Feature',
        place_name: place.formatted_address,
        text: place.name,
        center: [place.geometry.location.lng, place.geometry.location.lat],
        geometry: {
          type: 'Point',
          coordinates: [place.geometry.location.lng, place.geometry.location.lat]
        },
        properties: {
          name: place.name,
          address: place.formatted_address,
        }
      }));

      // Log API usage
      logApiUsage('google_geocode', '/geocode', { query, results: features.length });

      const geocodeResult = { features };

      // ── كاش: تخزين النتيجة ──
      if (features.length > 0) {
        setCachedGeocode(svc, cacheKey, query, 'geocode', geocodeResult);
      }

      return new Response(
        JSON.stringify(geocodeResult),
        { headers: { ...dynamicCors, 'Content-Type': 'application/json' } }
      );
    }

    // Reverse geocoding - get address from coordinates
    if (action === 'reverse-geocode') {
      const lat = url.searchParams.get('lat');
      const lng = url.searchParams.get('lng');

      if (!lng || !lat) {
        throw new Error('Missing coordinates');
      }

      // ── كاش: تقريب الإحداثيات + تحقق ──
      const roundedKey = roundCoords(lat, lng);
      const revCacheKey = hashQuery('reverse-geocode', roundedKey);
      const svc2 = createServiceClient();
      const cachedRev = await getCachedGeocode(svc2, revCacheKey);
      if (cachedRev) {
        logApiUsage('google_reverse_geocode_cached', '/reverse-geocode', { lat, lng, cached: true });
        return new Response(
          JSON.stringify(cachedRev),
          { headers: { ...dynamicCors, 'Content-Type': 'application/json' } }
        );
      }

      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=ar&key=${GOOGLE_MAPS_API_KEY}`;
      
      console.log('Google reverse geocoding:', { lat, lng });
      
      const response = await fetch(geocodeUrl);
      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('Google Geocode error:', data.status, data.error_message);
        throw new Error(data.error_message || `Geocode API error: ${data.status}`);
      }

      // Convert to Mapbox-like format for compatibility
      const features = (data.results || []).slice(0, 1).map((result: any) => ({
        id: result.place_id,
        type: 'Feature',
        place_name: result.formatted_address,
        center: [result.geometry.location.lng, result.geometry.location.lat],
        geometry: {
          type: 'Point',
          coordinates: [result.geometry.location.lng, result.geometry.location.lat]
        },
        properties: {
          accuracy: 'google'
        }
      }));

      // Fallback if no results
      if (features.length === 0) {
        features.push({
          id: 'fallback',
          type: 'Feature',
          place_name: `العراق (${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)})`,
          center: [parseFloat(lng), parseFloat(lat)],
          geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          properties: {
            accuracy: 'fallback'
          }
        });
      }

      // Log API usage
      logApiUsage('google_reverse_geocode', '/reverse-geocode', { lat, lng });

      const revResult = { features };

      // ── كاش: تخزين النتيجة ──
      setCachedGeocode(svc2, revCacheKey, roundedKey, 'reverse-geocode', revResult);

      return new Response(
        JSON.stringify(revResult),
        { headers: { ...dynamicCors, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error in google-maps-proxy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      }
    );
  }
});

// Decode Google's encoded polyline format
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lng / 1e5, lat / 1e5]); // [lng, lat] format for consistency
  }

  return points;
}
