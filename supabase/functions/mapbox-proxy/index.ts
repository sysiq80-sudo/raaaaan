/// <reference types="https://deno.land/x/types/index.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Iraqi governorates/cities for fallback address
const iraqLocations: { [key: string]: { name_ar: string; name_en: string } } = {
  'anbar': { name_ar: 'محافظة الأنبار', name_en: 'Anbar Governorate' },
  'ramadi': { name_ar: 'الرمادي', name_en: 'Ramadi' },
  'fallujah': { name_ar: 'الفلوجة', name_en: 'Fallujah' },
  'baghdad': { name_ar: 'بغداد', name_en: 'Baghdad' },
  'erbil': { name_ar: 'أربيل', name_en: 'Erbil' },
  'basra': { name_ar: 'البصرة', name_en: 'Basra' },
  'mosul': { name_ar: 'الموصل', name_en: 'Mosul' },
  'kirkuk': { name_ar: 'كركوك', name_en: 'Kirkuk' },
  'sulaymaniyah': { name_ar: 'السليمانية', name_en: 'Sulaymaniyah' },
  'najaf': { name_ar: 'النجف', name_en: 'Najaf' },
  'karbala': { name_ar: 'كربلاء', name_en: 'Karbala' },
};

// Generate fallback address based on coordinates
function generateFallbackAddress(lat: number, lng: number): string {
  if (lat >= 33.0 && lat <= 34.5 && lng >= 42.5 && lng <= 44.5) {
    return `الأنبار، العراق (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  } else if (lat >= 33.2 && lat <= 33.5 && lng >= 44.2 && lng <= 44.6) {
    return `بغداد، العراق (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  } else if (lat >= 35.5 && lat <= 37.0 && lng >= 43.5 && lng <= 45.5) {
    return `كردستان، العراق (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
  return `العراق (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    
    if (!MAPBOX_TOKEN) {
      throw new Error('MAPBOX_PUBLIC_TOKEN not configured');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Return the token for map initialization
    if (action === 'token') {
      // Log token request (free, but track for analytics)
      logApiUsage('mapbox_token', '/token');
      
      return new Response(
        JSON.stringify({ token: MAPBOX_TOKEN }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get directions between two points
    if (action === 'directions') {
      const start = url.searchParams.get('start');
      const end = url.searchParams.get('end');

      if (!start || !end) {
        throw new Error('Missing start or end coordinates');
      }

      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${start};${end}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
      
      console.log('Fetching directions:', directionsUrl.replace(MAPBOX_TOKEN, '***'));
      
      const response = await fetch(directionsUrl);
      const data = await response.json();

      if (!response.ok) {
        console.error('Mapbox API error:', data);
        throw new Error(data.message || 'Failed to get directions');
      }

      // Log API usage
      logApiUsage('mapbox_directions', '/directions', { start, end });

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Forward geocoding - search for places by text
    if (action === 'geocode') {
      const query = url.searchParams.get('q');
      const proximity = url.searchParams.get('proximity');

      if (!query) {
        throw new Error('Missing search query');
      }

      let geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&language=ar&country=IQ&limit=5&types=address,poi,locality,neighborhood,place`;
      
      if (proximity) {
        geocodeUrl += `&proximity=${proximity}`;
      }
      
      console.log('Forward geocoding:', query);
      
      const response = await fetch(geocodeUrl);
      const data = await response.json();

      if (!response.ok) {
        console.error('Mapbox geocode error:', data);
        throw new Error(data.message || 'Failed to geocode');
      }

      console.log('Forward geocode results:', data.features?.length || 0);

      // Log API usage
      logApiUsage('mapbox_geocode', '/geocode', { query, results: data.features?.length || 0 });

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Reverse geocoding - get address from coordinates with landmark priority
    if (action === 'reverse-geocode') {
      const lng = url.searchParams.get('lng');
      const lat = url.searchParams.get('lat');

      if (!lng || !lat) {
        throw new Error('Missing coordinates');
      }

      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);

      console.log('Reverse geocoding with landmark priority:', { lat, lng });

      // First, check for nearby landmarks in the database (within 500m)
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      let nearestLandmark: { name_ar: string; distance: number } | null = null;

      if (supabaseUrl && supabaseKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          // Fetch active landmarks
          const { data: landmarks } = await supabase
            .from('landmarks')
            .select('name_ar, name_en, location')
            .eq('is_active', true);

          if (landmarks && landmarks.length > 0) {
            // Calculate distance to each landmark using Haversine formula
            const R = 6371; // Earth's radius in km
            
            for (const landmark of landmarks) {
              const loc = landmark.location as { lat: number; lng: number };
              if (!loc?.lat || !loc?.lng) continue;

              const dLat = (loc.lat - parsedLat) * Math.PI / 180;
              const dLng = (loc.lng - parsedLng) * Math.PI / 180;
              const a = 
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(parsedLat * Math.PI / 180) * Math.cos(loc.lat * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const distance = R * c * 1000; // Convert to meters

              // If within 500m and closer than current nearest
              if (distance <= 500 && (!nearestLandmark || distance < nearestLandmark.distance)) {
                nearestLandmark = {
                  name_ar: landmark.name_ar,
                  distance: distance
                };
              }
            }

            if (nearestLandmark) {
              console.log('Found nearby landmark:', nearestLandmark.name_ar, 'at', Math.round(nearestLandmark.distance), 'm');
            }
          }
        } catch (error) {
          console.error('Error fetching landmarks:', error);
        }
      }

      // If we found a nearby landmark, use it as the address
      if (nearestLandmark) {
        logApiUsage('mapbox_reverse_geocode', '/reverse-geocode', { lat, lng, source: 'landmark' });
        
        return new Response(
          JSON.stringify({
            features: [{
              id: 'landmark',
              type: 'Feature',
              place_name: `قرب ${nearestLandmark.name_ar}`,
              center: [parsedLng, parsedLat],
              geometry: {
                type: 'Point',
                coordinates: [parsedLng, parsedLat]
              },
              properties: {
                accuracy: 'landmark',
                landmark_name: nearestLandmark.name_ar,
                distance_m: Math.round(nearestLandmark.distance)
              }
            }]
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // No nearby landmark found, fall back to Mapbox reverse geocoding
      const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=ar&types=address,poi,locality,neighborhood,place&limit=1`;
      
      const response = await fetch(geocodeUrl);
      const data = await response.json();

      if (!response.ok) {
        console.error('Mapbox geocode error:', data);
        throw new Error(data.message || 'Failed to reverse geocode');
      }

      // Log API usage
      logApiUsage('mapbox_reverse_geocode', '/reverse-geocode', { lat, lng, source: 'mapbox' });

      // If no results from Mapbox, generate a fallback address
      if (!data.features || data.features.length === 0) {
        const fallbackAddress = generateFallbackAddress(parsedLat, parsedLng);
        console.log('Using fallback address:', fallbackAddress);
        
        return new Response(
          JSON.stringify({
            features: [{
              id: 'fallback',
              type: 'Feature',
              place_name: fallbackAddress,
              center: [parsedLng, parsedLat],
              geometry: {
                type: 'Point',
                coordinates: [parsedLng, parsedLat]
              },
              properties: {
                accuracy: 'fallback'
              }
            }]
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Geocode result:', data.features?.[0]?.place_name);

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Country check for geofencing - get country from coordinates
    if (action === 'country-check') {
      const lng = url.searchParams.get('lng');
      const lat = url.searchParams.get('lat');

      if (!lng || !lat) {
        throw new Error('Missing coordinates');
      }

      console.log('Country check for geofencing:', { lat, lng });

      // Use Mapbox reverse geocoding with country type
      const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=country&access_token=${MAPBOX_TOKEN}`;
      
      const response = await fetch(geocodeUrl);
      const data = await response.json();

      if (!response.ok) {
        console.error('Mapbox country check error:', data);
        throw new Error(data.message || 'Failed to check country');
      }

      // Log API usage
      logApiUsage('mapbox_country_check', '/country-check', { lat, lng });

      console.log('Country check result:', data.features?.[0]?.properties?.short_code || 'unknown');

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error in mapbox-proxy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});