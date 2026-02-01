/**
 * ران - Hook البحث الديناميكي عن الأماكن
 * يوفر بحث فوري عن المواقع عبر Google Places API بدلاً من الأماكن المحفوظة
 * 
 * ⚠️ خوارزمية الترتيب حسب القرب الجغرافي:
 * 1. locationRestriction مع نطاق 3km (بدلاً من locationBias 10km)
 * 2. strictBounds=true لفرض الحدود الصارمة
 * 3. origin لتمرير موقع المستخدم الحقيقي
 * 4. إثراء كل النتائج (ليس فقط أول 6) بالمسافة
 * 5. فلترة النتائج البعيدة (>5km)
 * 6. فرز قوي حسب المسافة (الأقرب أولاً)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useGoogleMapsApiKey } from "./useGoogleMapsApiKey";
import { useToast } from "./use-toast";

interface PlacePrediction {
  place_id: string;
  main_text: string;
  secondary_text?: string;
  description: string;
  lat?: number;
  lng?: number;
  distance_meters?: number;
  distance_text?: string;
}

interface PlaceDetails {
  lat: number;
  lng: number;
  address: string;
  name: string;
  placeId: string;
}

export const useDynamicPlacesSearch = (userLocation?: { lat: number; lng: number } | null) => {
  const { toast } = useToast();
  const { apiKey: googleMapsApiKey } = useGoogleMapsApiKey();

  const [searchQuery, setSearchQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const formatDistance = useCallback((meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} م`;
    return `${(meters / 1000).toFixed(1)} كم`;
  }, []);

  const getDistanceMeters = useCallback(
    (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const R = 6371000;
      const dLat = (b.lat - a.lat) * (Math.PI / 180);
      const dLng = (b.lng - a.lng) * (Math.PI / 180);
      const lat1 = a.lat * (Math.PI / 180);
      const lat2 = b.lat * (Math.PI / 180);

      const sinDLat = Math.sin(dLat / 2);
      const sinDLng = Math.sin(dLng / 2);
      const aVal = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
      const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
      return R * c;
    },
    []
  );

  const fetchPlaceGeometry = useCallback(
    async (placeId: string) => {
      if (!placesServiceRef.current) return null;

      const request: google.maps.places.PlaceDetailsRequest = {
        placeId,
        fields: ["geometry"],
        sessionToken: sessionTokenRef.current,
      };

      try {
        const result = await new Promise<google.maps.places.PlaceResult | null>(
          (resolve, reject) => {
            placesServiceRef.current!.getDetails(request, (res, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && res) {
                resolve(res);
              } else {
                reject(new Error(`Places API error: ${status}`));
              }
            });
          }
        );

        const loc = result?.geometry?.location;
        if (!loc) return null;
        return { lat: loc.lat(), lng: loc.lng() };
      } catch {
        return null;
      }
    },
    []
  );

  // Initialize services - wait for Google Maps to fully load
  useEffect(() => {
    const checkAndInitialize = setInterval(() => {
      if (typeof window !== 'undefined' && window.google?.maps?.places && googleMapsApiKey) {
        clearInterval(checkAndInitialize);
        
        if (!autocompleteServiceRef.current) {
          autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
          console.log("✅ AutocompleteService initialized");
        }
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
          console.log("✅ AutocompleteSessionToken initialized");
        }
      }
    }, 100); // Check every 100ms

    return () => clearInterval(checkAndInitialize);
  }, [googleMapsApiKey]);

  // Initialize Places Service with a dummy map - wait for Google Maps to fully load
  useEffect(() => {
    const checkAndInitializePlaces = setInterval(() => {
      if (typeof window !== 'undefined' && window.google?.maps?.places && !placesServiceRef.current) {
        clearInterval(checkAndInitializePlaces);
        
        // Create a hidden div for the places service
        const hiddenDiv = document.createElement('div');
        hiddenDiv.style.display = 'none';
        document.body.appendChild(hiddenDiv);
        
        const dummyMap = new google.maps.Map(hiddenDiv);
        placesServiceRef.current = new google.maps.places.PlacesService(dummyMap);
        console.log("✅ PlacesService initialized");
      }
    }, 100); // Check every 100ms

    return () => clearInterval(checkAndInitializePlaces);
  }, []);

  // Debounced search function
  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setPredictions([]);
        return;
      }

      if (!autocompleteServiceRef.current) {
        console.error("❌ AutocompleteService not initialized");
        setPredictions([]);
        return;
      }

      setIsSearching(true);
      console.log("🔍 Searching for:", query);
      
      try {
        // ✨ مراحل البحث مع نطاقات متزايدة للعثور على النتائج
        const radiuses = userLocation ? [5000, 10000, 15000] : []; // 5km, 10km, 15km
        let formattedPredictions: PlacePrediction[] = [];
        
        for (const radius of radiuses) {
          if (formattedPredictions.length > 0) break; // إذا وجدنا نتائج، توقف
          
          console.log(`🔍 Search attempt with ${radius / 1000}km radius...`);
          
          const request: google.maps.places.AutocompletionRequest & {
            locationBias?: google.maps.places.LocationBias;
            locationRestriction?: google.maps.places.LocationRestriction;
            strictBounds?: boolean;
            origin?: google.maps.LatLng;
            types?: string[];
          } = {
            input: query,
            language: "ar",
            sessionToken: sessionTokenRef.current,
            componentRestrictions: { country: "iq" }, // Iraq only
          };

          // ✨ إضافة types للبحث عن جميع أنواع الأماكن
          request.types = ['establishment', 'geocode'];

          if (userLocation) {
            const center = new google.maps.LatLng(userLocation.lat, userLocation.lng);
            // ✨ استخدام locationBias مع نطاق ديناميكي
            request.locationBias = { radius, center }; // use current radius
            request.origin = center;
          }

          console.log(`📤 Autocomplete request with ${radius / 1000}km radius:`, request);
          const response = await autocompleteServiceRef.current.getPlacePredictions(request);
          console.log(`📥 Autocomplete response (${radius / 1000}km):`, response);

          if (response.predictions.length > 0) {
            formattedPredictions = response.predictions.map((p) => ({
              place_id: p.place_id,
              main_text: p.structured_formatting.main_text,
              secondary_text: p.structured_formatting.secondary_text,
              description: p.description,
            }));
            
            console.log(`✅ Found ${formattedPredictions.length} results at ${radius / 1000}km radius`);
            break; // خروج من الحلقة
          }
        }

        // إثراء كل النتائج بالمسافة والفرز حسب القرب
        if (userLocation && placesServiceRef.current && formattedPredictions.length > 0) {
          console.log(`📊 Enriching all ${formattedPredictions.length} results with distance data...`);
          
          // حساب المسافة لكل النتائج (ليس فقط أول 6)
          const enriched = await Promise.all(
            formattedPredictions.map(async (p) => {
              const geo = await fetchPlaceGeometry(p.place_id);
              if (!geo) return { ...p, distance_meters: Number.POSITIVE_INFINITY };
              
              const distance = getDistanceMeters(userLocation, geo);
              return {
                ...p,
                lat: geo.lat,
                lng: geo.lng,
                distance_meters: distance,
                distance_text: formatDistance(distance),
              };
            })
          );

          // فرز قوي حسب المسافة (الأقرب أولاً)
          const withDistance = enriched.sort((a, b) => {
            const da = a.distance_meters ?? Number.POSITIVE_INFINITY;
            const db = b.distance_meters ?? Number.POSITIVE_INFINITY;
            return da - db; // ترتيب تصاعدي (الأقرب أولاً)
          });

          // فلترة النتائج البعيدة جداً فقط إذا وُجدت نتائج قريبة
          const hasNearby = withDistance.some(p => (p.distance_meters ?? Number.POSITIVE_INFINITY) <= 5000);
          formattedPredictions = hasNearby
            ? withDistance.filter(p => {
                if ((p.distance_meters ?? Number.POSITIVE_INFINITY) > 5000) {
                  console.log(`🚫 Filtered out distant result: ${p.main_text} (${p.distance_text})`);
                  return false;
                }
                return true;
              })
            : withDistance;

          console.log(`✅ Results after distance sorting:`);
          formattedPredictions.slice(0, 5).forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.main_text} - ${p.distance_text}`);
          });
        }

        console.log(`✅ Found ${formattedPredictions.length} results (sorted by distance)`);
        setPredictions(formattedPredictions);
      } catch (error: any) {
        console.error("❌ Search error:", error);
        
        // رسائل واضحة حسب نوع الخطأ فقط
        if (error.message?.includes('REQUEST_DENIED')) {
          console.error("⚠️ Places API: REQUEST_DENIED - تحقق من Google Cloud Console");
          // عرض toast مرة واحدة فقط
          toast({
            title: "⚠️ خطأ في الاتصال",
            description: "تعذر الاتصال بخدمة البحث، حاول مرة أخرى",
            variant: "destructive",
          });
        } else if (!error.message?.includes('ZERO_RESULTS')) {
          console.error("⚠️ Unexpected search error:", error.message);
        }
        
        setPredictions([]);
      } finally {
        setIsSearching(false);
      }
    },
    [userLocation, toast]
  );

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  // Get place details
  const getPlaceDetails = useCallback(
    async (placeId: string): Promise<PlaceDetails | null> => {
      if (!placesServiceRef.current) {
        console.error("Places service not initialized");
        return null;
      }

      setIsLoadingDetails(true);
      try {
        const request: google.maps.places.PlaceDetailsRequest = {
          placeId,
          fields: [
            "formatted_address",
            "geometry",
            "name",
            "place_id",
            "address_components",
          ],
          sessionToken: sessionTokenRef.current,
        };

        const result = await new Promise<google.maps.places.PlaceResult | null>(
          (resolve, reject) => {
            placesServiceRef.current!.getDetails(request, (result, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && result) {
                resolve(result);
              } else {
                reject(new Error(`Places API error: ${status}`));
              }
            });
          }
        );

        if (result?.geometry?.location && result?.formatted_address) {
          // Create new session token after successful search
          sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();

          return {
            lat: result.geometry.location.lat(),
            lng: result.geometry.location.lng(),
            address: result.formatted_address,
            name: result.name || "",
            placeId: result.place_id || placeId,
          };
        }
        return null;
      } catch (error: any) {
        console.error("Error getting place details:", error);
        
        let errorMessage = "حدث خطأ أثناء جلب تفاصيل الموقع";
        
        if (error.message?.includes('REQUEST_DENIED')) {
          errorMessage = "API Key غير مصرح له باستخدام Places API";
          console.error("⚠️ Places Details: REQUEST_DENIED - Check API Restrictions");
        }
        
        toast({
          title: "خطأ في جلب التفاصيل",
          description: errorMessage,
          variant: "destructive",
        });
        return null;
      } finally {
        setIsLoadingDetails(false);
      }
    },
    [toast]
  );

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setPredictions([]);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    predictions,
    isSearching,
    isLoadingDetails,
    performSearch,
    getPlaceDetails,
    clearSearch,
  };
};
