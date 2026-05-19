/**
 * ران - Hook اختيار الموقع والخريطة
 * يدير logic الخريطة والبحث والتحقق من منطقة الخدمة
 * Google Maps Version
 */

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { useToast } from "./use-toast";
import { getMapStyle, watchThemeChanges } from "@/utils/mapStyles";
import { getGeocoder } from "@/lib/googleMapService";
import { saveLastKnownLocation, getLastKnownLocation } from "@/services/lastKnownLocationService";
import { useMapContext } from "@/contexts/MapContext";
import type { IGeocodingAdapter } from "@/lib/adapters";
import { NominatimGeocodingAdapter } from "@/lib/adapters/NominatimGeocodingAdapter";

interface LocationType {
  lat: number;
  lng: number;
  address: string;
}

interface ServiceAreaCheck {
  in_service: boolean;
  region: {
    id: string;
    name_ar: string;
    name_en: string | null;
  } | null;
  nearest_region: {
    id: string;
    name_ar: string;
    distance_km: number;
  } | null;
}

type ActiveMapProvider = "google" | "osm" | "none";

export const useLocationPicker = (
  mapToken: string | null,
  userLocation: { lat: number; lng: number } | null,
  reloadKey?: number,
  currentMode?: "pickup" | "dropoff" | "booking" | "stop",
) => {
  const { toast } = useToast();
  const { googleMapsApiKey, isGoogleConfigured } = useMapContext();

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const userAccuracyCircleRef = useRef<google.maps.Circle | null>(null);
  const osmMapRef = useRef<any>(null);
  const osmUserMarkerRef = useRef<any>(null);
  const osmAccuracyCircleRef = useRef<any>(null);
  const hasPannedToUserOnce = useRef(false);
  const skipNextReverseGeocodeRef = useRef(false); // ✨ Flag لمنع reverseGeocode بعد البحث
  const lastHandledReloadKeyRef = useRef<number | null>(null);
  const centerAddressRef = useRef<string>(""); // ✨ Ref لتجنب stale closure في idle listener
  const isDraggingRef = useRef(false); // ✨ Ref بدل state لتجنب stale closure في idle listener
  const lastGeocodedLatLngRef = useRef<{ lat: number; lng: number } | null>(null); // ✨ لمنع تكرار geocoding لنفس الإحداثيات
  const geocodingAdaptersRef = useRef<IGeocodingAdapter[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [centerAddress, setCenterAddress] = useState<string>("");
  const [centerLat, setCenterLat] = useState<number | null>(null);
  const [centerLng, setCenterLng] = useState<number | null>(null);
  const [serviceAreaStatus, setServiceAreaStatus] =
    useState<ServiceAreaCheck | null>(null);
  const [isCheckingService, setIsCheckingService] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapProvider, setMapProvider] = useState<ActiveMapProvider>("none");

  // تحميل Geocoding adapters (Nominatim مجاني كـ fallback عن Google)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const nominatim = new NominatimGeocodingAdapter();
        await nominatim.load();

        if (!mounted) return;

        geocodingAdaptersRef.current = [nominatim];
        console.log("✅ Geocoding adapter ready: nominatim");
      } catch (error) {
        console.warn("⚠️ Adaptive geocoding adapter unavailable:", error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Force reinitialization when requested (e.g., after ride end/cancel)
  useEffect(() => {
    if (reloadKey === undefined) return;

    // Skip duplicate effect runs for same key (common in React 18 StrictMode dev behavior)
    if (lastHandledReloadKeyRef.current === reloadKey) return;

    // Ignore the initial key value and only react to explicit increments
    if (lastHandledReloadKeyRef.current === null) {
      lastHandledReloadKeyRef.current = reloadKey;
      return;
    }

    lastHandledReloadKeyRef.current = reloadKey;

    if (map.current) {
      console.warn("🔄 Forcing map reinitialization");
      map.current = null;
    }

    if (osmMapRef.current) {
      osmMapRef.current.remove();
      osmMapRef.current = null;
      osmUserMarkerRef.current = null;
      osmAccuracyCircleRef.current = null;
    }

    lastGeocodedLatLngRef.current = null; // ✨ إعادة تعيين عند إعادة تهيئة الخريطة
    
    // إزالة العلامات السابقة من الخريطة
    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
      userMarkerRef.current = null;
    }
    if (userAccuracyCircleRef.current) {
      userAccuracyCircleRef.current.setMap(null);
      userAccuracyCircleRef.current = null;
    }
    hasPannedToUserOnce.current = false;

    if (mapContainer.current) {
      mapContainer.current.innerHTML = "";
    }

    setIsLoading(true);
  }, [reloadKey]);

  // Memoize Ramadi center coordinates
  const ramadiCenter = useMemo(() => ({ lat: 33.4233, lng: 43.2974 }), []);

  // Check service area
  const checkServiceArea = useCallback(async (lat: number, lng: number) => {
    try {
      setIsCheckingService(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-service-area?lat=${lat}&lng=${lng}`,
      );
      const data = await response.json();
      setServiceAreaStatus(data);
      return data;
    } catch (error) {
      console.error("Service area check error:", error);
      return null;
    } finally {
      setIsCheckingService(false);
    }
  }, []);

  // ✨ حساب المسافة بين نقطتين (بالمتر) لمنع تكرار geocoding
  const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  /**
   * 🏛️ Reverse Geocoding — POI-First with Robust Fallbacks
   *
   * 1️⃣ Geocoding + Place.searchNearby(50م) بالتوازي
   * 2️⃣ مسح جميع نتائج Geocoding (ليس فقط الأول) لاستخراج الشارع/الحي/POI
   * 3️⃣ توسيع POI إلى 150م إذا لم يوجد
   * 4️⃣ بناء عنوان مركّب أو استخدام formatted_address بتنظيف خفيف
   */
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      // ✨ تخطي إذا الإحداثيات لم تتغير (أقل من 5 متر)
      const last = lastGeocodedLatLngRef.current;
      if (last && haversineDistance(lat, lng, last.lat, last.lng) < 5) {
        console.log("⏭️ Skipping reverseGeocode - same location (<5m)");
        return;
      }

      try {
        // 1) محاولة عبر geocoding adapters (مجاني/أرخص) أولاً
        const adapters = geocodingAdaptersRef.current;
        for (const adapter of adapters) {
          try {
            const adapterAddress = await adapter.reverseGeocode(lat, lng);
            if (!adapterAddress || adapterAddress.trim().length === 0) {
              continue;
            }

            centerAddressRef.current = adapterAddress;
            setCenterAddress(adapterAddress);
            setCenterLat(lat);
            setCenterLng(lng);
            lastGeocodedLatLngRef.current = { lat, lng };
            checkServiceArea(lat, lng);

            // إذا Google غير متوفر، نكتفي بعنوان الـ adapter
            if (!window.google?.maps) {
              return;
            }

            // إذا Google متوفر نتابع لتحسين عنوان POI، لكن نحتفظ بالعنوان الحالي كـ fallback
            break;
          } catch (adapterError) {
            console.warn("Adaptive reverse geocode failed, trying next provider:", adapterError);
          }
        }

        // 2) Google-based enrichment (POI first) إذا متوفر
        if (!window.google?.maps) {
          const fallbackAddr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          centerAddressRef.current = fallbackAddr;
          setCenterAddress(fallbackAddr);
          setCenterLat(lat);
          setCenterLng(lng);
          lastGeocodedLatLngRef.current = { lat, lng };
          checkServiceArea(lat, lng);
          return;
        }

        const geocoder = await getGeocoder();
        if (!geocoder) {
          console.warn("Google geocoder not available, keeping adapter/fallback result");
          return;
        }

        const IRAQ_POI_TYPES = [
          'mosque', 'church',
          'school', 'university', 'secondary_school', 'primary_school',
          'hospital', 'doctor', 'pharmacy', 'dentist',
          'shopping_mall', 'store', 'supermarket', 'restaurant', 'cafe', 'bakery', 'bank',
          'gas_station', 'car_repair', 'car_wash', 'parking',
          'local_government_office', 'city_hall', 'courthouse', 'post_office',
          'police', 'fire_station', 'library',
          'museum', 'tourist_attraction', 'park', 'stadium', 'gym',
          'bus_station', 'transit_station',
        ];

        const PRIORITY_GROUPS = [
          ['mosque', 'church'],
          ['hospital', 'doctor', 'pharmacy', 'dentist'],
          ['school', 'university', 'secondary_school', 'primary_school'],
          ['local_government_office', 'city_hall', 'courthouse', 'post_office', 'police', 'fire_station'],
          ['museum', 'tourist_attraction', 'park', 'stadium'],
          ['shopping_mall', 'store', 'supermarket', 'bank'],
          ['restaurant', 'cafe', 'bakery'],
          ['gas_station', 'car_repair', 'car_wash', 'parking'],
          ['bus_station', 'transit_station', 'library', 'gym'],
        ];

        const pickBestPOI = (places: any[]): string | null => {
          if (!places || places.length === 0) return null;
          for (const group of PRIORITY_GROUPS) {
            for (const place of places) {
              if (place.displayName && place.types?.some((t: string) => group.includes(t))) {
                return place.displayName;
              }
            }
          }
          return places[0]?.displayName || null;
        };

        // ═══════════════════ Step 1: بحث بالتوازي ═══════════════════
        const geocodePromise = geocoder.geocode({
          location: new window.google.maps.LatLng(lat, lng),
          language: "ar",
        });

        // 🚫 SearchNearby معطّل — تكلفة $32/1000 طلب
        // POI يُستخرج من نتائج Geocoding بدلاً ($5/1000 طلب)
        const nearbySearch50m = Promise.resolve({ places: [] as any[] });

        const [geocodeResult, nearbyResult50] = await Promise.all([
          geocodePromise,
          nearbySearch50m,
        ]);

        // ═══════════════════ Step 2: مسح جميع نتائج Geocoding ═══════════════════
        const geoResults = geocodeResult?.results || [];

        // استخراج أفضل القيم من كل النتائج (ليس فقط الأول)
        let bestStreet = "";
        let bestNeighborhood = "";
        let bestCity = "";
        let geoPOIName = "";

        for (const result of geoResults) {
          const comps = result.address_components || [];
          const get = (type: string) =>
            comps.find((c) => c.types.includes(type))?.long_name;

          // POI من نتائج Geocoding
          if (
            !geoPOIName &&
            (result.types.includes("point_of_interest") ||
              result.types.includes("establishment") ||
              result.types.includes("premise")) &&
            result.name &&
            !result.types.includes("country") &&
            !result.types.includes("administrative_area_level_1") &&
            !result.types.includes("locality")
          ) {
            geoPOIName = result.name;
          }

          if (!bestStreet) {
            const route = get("route");
            const streetNum = get("street_number");
            bestStreet = [route, streetNum].filter(Boolean).join(" ").trim();
          }

          if (!bestNeighborhood) {
            bestNeighborhood =
              get("neighborhood") ||
              get("sublocality") ||
              get("sublocality_level_1") ||
              "";
          }

          if (!bestCity) {
            bestCity =
              get("locality") ||
              get("administrative_area_level_2") ||
              "";
          }
        }

        console.log("📍 All results scanned:", {
          bestStreet,
          bestNeighborhood,
          bestCity,
          geoPOIName,
          totalResults: geoResults.length,
        });

        // ═══════════════════ Step 3: POI — Places API → 150م → Geocoding ═══════════════════
        let poiName = pickBestPOI(nearbyResult50?.places || []);

        // 🚫 SearchNearby 150م معطّل — تكلفة عالية
        // POI يُستخرج من Geocoding results بدلاً (Step 2 أعلاه)

        // POI من نتائج Geocoding
        if (!poiName && geoPOIName) {
          poiName = geoPOIName;
          console.log("🔍 POI from geocoding:", poiName);
        }

        console.log("🏛️ Best POI:", poiName || "(none)");

        // ═══════════════════ Step 4: بناء العنوان ═══════════════════
        let finalAddress = "";

        if (poiName) {
          // ✅ الأولوية 1: معلم + سياق
          const context = bestStreet || bestNeighborhood || bestCity;
          if (context && context !== poiName) {
            finalAddress = `${poiName}، ${context}`;
          } else {
            finalAddress = poiName;
          }
          console.log("✅ POI address:", finalAddress);

        } else if (bestStreet) {
          // ✅ الأولوية 2: شارع + حي/مدينة
          const parts = [bestStreet, bestNeighborhood, bestCity].filter(Boolean);
          const unique = parts.filter((p, i) => parts.indexOf(p) === i);
          finalAddress = unique.slice(0, 3).join("، ");
          console.log("✅ Street address:", finalAddress);

        } else if (bestNeighborhood) {
          // ✅ الأولوية 3: حي + مدينة
          finalAddress =
            bestCity && bestCity !== bestNeighborhood
              ? `${bestNeighborhood}، ${bestCity}`
              : bestNeighborhood;
          console.log("✅ Neighborhood address:", finalAddress);

        } else if (geoResults[0]?.formatted_address) {
          // ✅ الأولوية 4: formatted_address — تنظيف خفيف فقط (Plus Code + "العراق")
          const plusCodeRegex = /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/;
          const faParts = geoResults[0].formatted_address
            .split(/[،,]/)
            .map((p: string) => p.trim())
            .filter(
              (p: string) =>
                p.length > 0 &&
                !plusCodeRegex.test(p) &&
                p !== "العراق" &&
                p !== "Iraq",
            );

          finalAddress =
            faParts.slice(0, 3).join("، ") ||
            bestCity ||
            `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          console.log("✅ Formatted address:", finalAddress);

        } else {
          finalAddress = bestCity || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          console.log("✅ Fallback:", finalAddress);
        }

        centerAddressRef.current = finalAddress;
        setCenterAddress(finalAddress);
        setCenterLat(lat);
        setCenterLng(lng);
        lastGeocodedLatLngRef.current = { lat, lng }; // ✨ تحديث آخر إحداثيات تم geocode لها
        checkServiceArea(lat, lng);
      } catch (error: any) {
        console.error("Reverse geocode error:", error);

        if (error.message?.includes("REQUEST_DENIED")) {
          console.error(
            "⚠️ Geocoding API: REQUEST_DENIED - Check API Restrictions",
          );
          toast({
            title: "تنبيه: Geocoding API",
            description: "API Key غير مصرح له باستخدام Geocoding API",
            variant: "destructive",
          });
        }

        const fallbackAddr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        centerAddressRef.current = fallbackAddr;
        setCenterAddress(fallbackAddr);
        setCenterLat(lat);
        setCenterLng(lng);
      }
    },
    [checkServiceArea, toast],
  );

  const initOsmFallbackMap = useCallback(
    async (reason: string) => {
      if (!mapContainer.current || osmMapRef.current) return;

      try {
        const L = await import("leaflet");
        const cachedLocation = getLastKnownLocation();
        const initialCenter = userLocation || cachedLocation || ramadiCenter;

        mapContainer.current.innerHTML = "";

        const osmMap = L.map(mapContainer.current, {
          zoomControl: false,
          attributionControl: true,
          dragging: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(osmMap);

        osmMap.setView([initialCenter.lat, initialCenter.lng], 15);

        osmMap.on("movestart", () => {
          setIsDragging(true);
          isDraggingRef.current = true;
          centerAddressRef.current = "جاري تحديد العنوان...";
          setCenterAddress("جاري تحديد العنوان...");
        });

        osmMap.on("moveend", () => {
          setIsDragging(false);
          isDraggingRef.current = false;
          const c = osmMap.getCenter();
          reverseGeocode(c.lat, c.lng);
        });

        osmMapRef.current = osmMap;

        // Shim لأكثر دوال google.maps.Map استخداماً داخل GoPage
        map.current = {
          panTo: ({ lat, lng }: { lat: number; lng: number }) => {
            osmMap.panTo([lat, lng]);
          },
          setZoom: (zoom: number) => {
            osmMap.setZoom(zoom);
          },
          getCenter: () => {
            const c = osmMap.getCenter();
            return {
              lat: () => c.lat,
              lng: () => c.lng,
            };
          },
        } as any;

        setMapProvider("osm");
        setMapError(null);
        setIsLoading(false);

        console.log(`🗺️ OSM fallback initialized (${reason})`);
        reverseGeocode(initialCenter.lat, initialCenter.lng);
      } catch (error) {
        console.error("❌ OSM fallback init failed:", error);
        setMapError("تعذر تحميل Google Maps وOpenStreetMap. حاول مرة أخرى.");
        setIsLoading(false);
      }
    },
    [ramadiCenter, reverseGeocode, userLocation],
  );

  // Load Google Maps API script if not already loaded
  useEffect(() => {
    if (typeof window === "undefined" || window.google) return;

    if (!isGoogleConfigured) {
      initOsmFallbackMap("google_not_configured");
      return;
    }

    if (!googleMapsApiKey) {
      console.warn("No Google Maps API key available");
      initOsmFallbackMap("missing_google_api_key");
      return;
    }

    loadGoogleMaps(googleMapsApiKey).then(() => {
      console.log("✅ Google Maps API loaded via centralized loader");
    }).catch((err) => {
      console.error("❌ Failed to load Google Maps API:", err);
      initOsmFallbackMap("google_script_load_failed");
    });

    // معالجة أخطاء المصادقة مثل RefererNotAllowedMapError
    window.gm_authFailure = () => {
      console.error("❌ Google Maps authentication failure (RefererNotAllowed)");
      initOsmFallbackMap("google_auth_failure");
    };

    return () => {
      // Don't remove the script as it may be used by other components
    };
  }, [googleMapsApiKey, initOsmFallbackMap, isGoogleConfigured]);

  // Initialize map (only once with API key)
  // ⚡ Instant load: always starts with ramadiCenter, then panTo userLocation when available
  useEffect(() => {
    if (!mapContainer.current) {
      console.log("Map initialization waiting:", {
        hasContainer: !!mapContainer.current,
        hasApiKey: !!googleMapsApiKey,
      });
      return;
    }

    if (!googleMapsApiKey || !isGoogleConfigured) {
      return;
    }

    // ✅ عند تغيير reloadKey: دمّر الخريطة القديمة دائماً لإجبار إعادة التهيئة
    if (map.current) {
      console.log("🔄 reloadKey changed - destroying old map instance");
      map.current = null;
    }

    // Prevent duplicate initialization
    if (map.current) {
      console.log("Map already initialized");
      return;
    }

    // Wait for Google Maps API to be available
    let checkAttempts = 0;
    const maxAttempts = 50; // 5 seconds maximum (50 * 100ms)

    const checkGoogleMaps = setInterval(() => {
      checkAttempts++;

      // ⚡ Timeout بعد 5 ثوانٍ
      if (checkAttempts > maxAttempts) {
        clearInterval(checkGoogleMaps);
        console.error("❌ Google Maps API failed to load after 5 seconds");
        initOsmFallbackMap("google_init_timeout");
        return;
      }

      // Check for complete Google Maps API with all required properties
      if (
        typeof window !== "undefined" &&
        window.google?.maps &&
        window.google.maps.MapTypeId &&
        window.google.maps.Map
      ) {
        clearInterval(checkGoogleMaps);

        if (map.current) return; // Already initialized
        if (!mapContainer.current) return;

        console.log("Initializing Google Maps");

        // ✅ استخدام آخر موقع مخزن بدل الرمادي الافتراضي — يعرض الخريطة فوراً عند ضعف النت
        const cachedLocation = getLastKnownLocation();
        const initialCenter = cachedLocation
          ? { lat: cachedLocation.lat, lng: cachedLocation.lng }
          : ramadiCenter;

        try {
          console.log("🗺️ Creating Google Maps instance...");

          // 🌙 استخدام أنماط الخريطة الذكية (تتكيف مع Dark/Light تلقائياً)
          const mapStyle = getMapStyle();

          map.current = new window.google.maps.Map(mapContainer.current, {
            center: initialCenter,
            zoom: 15,
            mapTypeId: window.google.maps.MapTypeId.ROADMAP,
            styles: mapStyle, // 🎨 نمط ذكي يتكيف مع الثيم
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeControl: false,
            scaleControl: false,
            streetViewControl: false,
            rotateControl: false,
            fullscreenControl: false,
            clickableIcons: true, // ✨ Enable clicking on POI markers
            gestureHandling: "greedy", // ✨ اللمس الفوري - يعمل بدون مفتاح modifier
            draggable: true, // ✨ تفعيل السحب
          });

          console.log("✅ Map loaded successfully with adaptive theme styles");
          setMapProvider("google");
          setIsLoading(false);

          // 🎨 مراقبة تغيير الثيم لتحديث نمط الخريطة تلقائياً
          if (map.current) {
            watchThemeChanges(map.current, (isDark) => {
              console.log(`🎨 Map theme updated: ${isDark ? "dark" : "light"}`);
            });
          }

          const center = map.current.getCenter();
          if (center) {
            console.log("⚡ Initial reverseGeocode (one-time)");
            reverseGeocode(center.lat(), center.lng());
          }

          // Handle drag events - update address immediately when drag ends
          map.current.addListener("dragstart", () => {
            setIsDragging(true);
            isDraggingRef.current = true; // ✨ Ref sync
            centerAddressRef.current = "جاري تحديد العنوان...";
            setCenterAddress("جاري تحديد العنوان..."); // Show loading state
          });

          map.current.addListener("dragend", () => {
            setIsDragging(false);
            isDraggingRef.current = false; // ✨ Ref sync
            // ✨ تخطي reverseGeocode إذا كان العنوان تم تعيينه يدوياً من البحث
            if (skipNextReverseGeocodeRef.current) {
              console.log(
                "⏭️ Skipping reverseGeocode after manual address set",
              );
              skipNextReverseGeocodeRef.current = false;
              return;
            }
            const center = map.current?.getCenter();
            if (center) {
              console.log("🔄 Drag ended, reverse geocoding...");
              reverseGeocode(center.lat(), center.lng());
            }
          });

          // Handle cursor changes for better UX
          map.current.addListener("mouseover", () => {
            if (mapContainer.current) {
              mapContainer.current.style.cursor = 'grab';
            }
          });

          map.current.addListener("mouseout", () => {
            if (mapContainer.current) {
              mapContainer.current.style.cursor = 'default';
            }
          });

          map.current.addListener("mousedown", () => {
            if (mapContainer.current) {
              mapContainer.current.style.cursor = 'grabbing';
            }
          });

          map.current.addListener("mouseup", () => {
            if (mapContainer.current) {
              mapContainer.current.style.cursor = 'grab';
            }
          });

          // ⚡ idle listener ذكي - فقط للحالات الخاصة
          map.current.addListener("idle", () => {
            // تخطي إذا كان العنوان تم تعيينه يدوياً
            if (skipNextReverseGeocodeRef.current) {
              console.log(
                "⏭️ Skipping reverseGeocode after manual address set",
              );
              skipNextReverseGeocodeRef.current = false;
              return;
            }

            // ⚡ تشغيل فقط إذا كان العنوان فارغ أو "جاري تحديد"
            if (
              !isDraggingRef.current &&
              (!centerAddressRef.current ||
                centerAddressRef.current === "جاري تحديد العنوان..." ||
                centerAddressRef.current.length < 5)
            ) {
              const center = map.current?.getCenter();
              if (center) {
                console.log("🔄 Idle - getting missing address...");
                reverseGeocode(center.lat(), center.lng());
              }
            }
          });

          // ✨ Handle clicking on POIs (Points of Interest) - only in pickup/dropoff modes
          if (currentMode !== "booking") {
            map.current.addListener(
              "click",
              async (event: google.maps.MapMouseEvent) => {
                if (event.placeId) {
                  // User clicked on a POI - get its name
                  event.stop(); // Prevent default behavior

                  try {
                    const place = new google.maps.places.Place({ id: event.placeId });
                    await place.fetchFields({
                      fields: ["displayName", "location", "formattedAddress"],
                    });

                    if (place.displayName) {
                      console.log("\u2705 Clicked POI:", place.displayName);
                      centerAddressRef.current = place.displayName;
                      setCenterAddress(place.displayName);

                      if (place.location) {
                        map.current?.panTo(place.location);
                        checkServiceArea(
                          place.location.lat(),
                          place.location.lng(),
                        );
                      }
                    }
                  } catch (err) {
                    console.warn("POI details error:", err);
                  }
                }
              },
            );
          }
        } catch (error) {
          console.error("❌ Map initialization error:", error);
          initOsmFallbackMap("google_map_init_exception");
          return;
        }
      }
    }, 100); // Check every 100ms if Google Maps is available

    return () => clearInterval(checkGoogleMaps);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleMapsApiKey, initOsmFallbackMap, isGoogleConfigured, reloadKey]); // Re-run when API key or reload key changes

  // ✅ إصلاح الخريطة البيضاء: trigger resize بعد كل تغيير في reloadKey
  useEffect(() => {
    if (reloadKey === undefined || reloadKey === 0) return;
    const timer = setTimeout(() => {
      if (mapProvider === "google" && map.current && window.google?.maps?.event) {
        window.google.maps.event.trigger(map.current, "resize");
        const center = map.current.getCenter();
        if (center) map.current.setCenter(center);
        console.log("🔄 Map resize triggered after reloadKey change");
      }

      if (mapProvider === "osm" && osmMapRef.current) {
        osmMapRef.current.invalidateSize();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [mapProvider, reloadKey]);

  // (تم نقل userMarkerRef, userAccuracyCircleRef, و hasPannedToUserOnce إلى الأعلى لتسهيل إدارتها عند التحديث)

  useEffect(() => {
    if (!userLocation || isLoading) return;

    if (mapProvider === "osm" && osmMapRef.current) {
      const updateOsmUserMarker = async () => {
        const L = await import("leaflet");

        if (!hasPannedToUserOnce.current) {
          hasPannedToUserOnce.current = true;
          osmMapRef.current.panTo([userLocation.lat, userLocation.lng]);
          osmMapRef.current.setZoom(16);
          saveLastKnownLocation(userLocation.lat, userLocation.lng);
        }

        if (osmUserMarkerRef.current) {
          osmUserMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
        } else {
          osmUserMarkerRef.current = L.circleMarker([userLocation.lat, userLocation.lng], {
            radius: 8,
            color: "#ffffff",
            weight: 2,
            fillColor: "#5bdda6",
            fillOpacity: 0.9,
          }).addTo(osmMapRef.current);
        }

        if (osmAccuracyCircleRef.current) {
          osmAccuracyCircleRef.current.setLatLng([userLocation.lat, userLocation.lng]);
        } else {
          osmAccuracyCircleRef.current = L.circle([userLocation.lat, userLocation.lng], {
            radius: 25,
            color: "#5bdda6",
            weight: 1,
            fillColor: "#5bdda6",
            fillOpacity: 0.08,
          }).addTo(osmMapRef.current);
        }
      };

      updateOsmUserMarker().catch((e) => {
        console.warn("OSM user marker update failed:", e);
      });
      return;
    }

    if (!map.current || !window.google?.maps) return;

    // ✅ Pan لموقع المستخدم مرة واحدة فقط — بعدها المستخدم يتحكم بالسحب
    if (!hasPannedToUserOnce.current) {
      hasPannedToUserOnce.current = true;
      const target = new window.google.maps.LatLng(userLocation.lat, userLocation.lng);
      map.current.panTo(target);
      map.current.setZoom(16);
      // ✅ حفظ موقع المستخدم للاستخدام عند فقدان النت
      saveLastKnownLocation(userLocation.lat, userLocation.lng);
      console.log("🎯 Map panned to user location:", userLocation.lat, userLocation.lng);
    }

    // 🟢 النقطة الخضراء — google.maps.Marker مع SVG
    const svgIcon = {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <!-- هالة شفافة خارجية -->
          <circle cx="16" cy="16" r="15" fill="rgba(91,221,166,0.20)" />
          <!-- حلقة خضراء -->
          <circle cx="16" cy="16" r="10" fill="#5bdda6" stroke="white" stroke-width="3"/>
          <!-- نقطة مركزية بيضاء صغيرة -->
          <circle cx="16" cy="16" r="3.5" fill="white"/>
        </svg>
      `)}`,
      scaledSize: new google.maps.Size(32, 32),
      anchor: new google.maps.Point(16, 16),
    };

    if (userMarkerRef.current) {
      // تحديث الموضع والخريطة
      userMarkerRef.current.setPosition({ lat: userLocation.lat, lng: userLocation.lng });
      userMarkerRef.current.setMap(map.current);
    } else {
      // إنشاء marker جديد
      userMarkerRef.current = new google.maps.Marker({
        position: { lat: userLocation.lat, lng: userLocation.lng },
        map: map.current,
        icon: svgIcon,
        title: 'موقعي الحالي',
        zIndex: 5,
        clickable: false,
        optimized: false,
      });
    }

    // 🟢 دائرة دقة الموقع (نصف قطر صغير شفاف)
    if (userAccuracyCircleRef.current) {
      userAccuracyCircleRef.current.setCenter({ lat: userLocation.lat, lng: userLocation.lng });
      userAccuracyCircleRef.current.setMap(map.current);
    } else {
      userAccuracyCircleRef.current = new google.maps.Circle({
        strokeColor: '#5bdda6',
        strokeOpacity: 0.3,
        strokeWeight: 1,
        fillColor: '#5bdda6',
        fillOpacity: 0.08,
        map: map.current,
        center: { lat: userLocation.lat, lng: userLocation.lng },
        radius: 25, // 25 متر
        clickable: false,
        zIndex: 4,
      });
    }
  }, [userLocation, isLoading, mapProvider]);

  // ✨ دالة لتعيين العنوان يدوياً (من البحث) مع منع reverseGeocode التلقائي
  const setManualAddress = useCallback((address: string) => {
    console.log("✅ Setting manual address:", address);
    centerAddressRef.current = address;
    setCenterAddress(address);
    skipNextReverseGeocodeRef.current = true;

    // إعادة الـ flag بعد 2 ثانية لتجنب منع reverseGeocode المستقبلي
    setTimeout(() => {
      skipNextReverseGeocodeRef.current = false;
      console.log("🔄 Skip flag reset - reverseGeocode re-enabled");
    }, 2000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (osmMapRef.current) {
        osmMapRef.current.remove();
        osmMapRef.current = null;
      }
      if (map.current) {
        // Google Maps doesn't have a remove() method
        // Just nullify the reference to allow garbage collection
        map.current = null;
      }
    };
  }, []);

  return {
    mapContainer,
    map,
    isLoading,
    isDragging,
    centerAddress,
    centerLat,
    centerLng,
    serviceAreaStatus,
    isCheckingService,
    mapProvider,
    mapError, // ✨ خطأ تحميل الخريطة
    setCenterAddress,
    setCenterLat,
    setCenterLng,
    setManualAddress, // ✨ NEW
    checkServiceArea,
    reverseGeocode,
    setIsDragging,
    setIsLoading,
  };
};
