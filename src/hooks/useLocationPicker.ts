/**
 * ران - Hook اختيار الموقع والخريطة
 * يدير logic الخريطة والبحث والتحقق من منطقة الخدمة
 * Google Maps Version
 */

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useGoogleMapsApiKey } from "./useGoogleMapsApiKey";
import { useToast } from "./use-toast";
import { getMapStyle, watchThemeChanges } from "@/utils/mapStyles";

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

export const useLocationPicker = (
  mapToken: string | null,
  userLocation: { lat: number; lng: number } | null,
  reloadKey?: number,
) => {
  const { toast } = useToast();
  const { apiKey: googleMapsApiKey } = useGoogleMapsApiKey();

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const skipNextReverseGeocodeRef = useRef(false); // ✨ Flag لمنع reverseGeocode بعد البحث

  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [centerAddress, setCenterAddress] = useState<string>("");
  const [centerLat, setCenterLat] = useState<number | null>(null);
  const [centerLng, setCenterLng] = useState<number | null>(null);
  const [serviceAreaStatus, setServiceAreaStatus] =
    useState<ServiceAreaCheck | null>(null);
  const [isCheckingService, setIsCheckingService] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Force reinitialization when requested (e.g., after ride end/cancel)
  useEffect(() => {
    if (reloadKey === undefined) return;

    if (map.current) {
      console.warn("🔄 Forcing map reinitialization");
      map.current = null;
    }

    if (mapContainer.current) {
      mapContainer.current.innerHTML = "";
    }

    setIsLoading(true);
  }, [reloadKey]);

  // Memoize Ramadi center coordinates
  const ramadiCenter = useMemo(() => ({ lat: 33.4262, lng: 43.2954 }), []);

  // Check service area
  const checkServiceArea = useCallback(async (lat: number, lng: number) => {
    try {
      setIsCheckingService(true);
      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/check-service-area?lat=${lat}&lng=${lng}`,
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
      if (!window.google?.maps) {
        console.warn("Google Maps not yet loaded");
        return;
      }

      try {
        const geocoder = new window.google.maps.Geocoder();

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

        const nearbySearch50m = window.google?.maps?.places?.Place
          ? google.maps.places.Place.searchNearby({
              fields: ['displayName', 'types', 'location'],
              locationRestriction: { center: { lat, lng }, radius: 50 },
              includedTypes: IRAQ_POI_TYPES,
              maxResultCount: 5,
              languageCode: 'ar',
            }).catch(() => ({ places: [] as any[] }))
          : Promise.resolve({ places: [] as any[] });

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

        // توسيع إلى 150م
        if (!poiName && window.google?.maps?.places?.Place) {
          try {
            const nearbyResult150 = await google.maps.places.Place.searchNearby({
              fields: ['displayName', 'types', 'location'],
              locationRestriction: { center: { lat, lng }, radius: 150 },
              includedTypes: IRAQ_POI_TYPES,
              maxResultCount: 5,
              languageCode: 'ar',
            });
            poiName = pickBestPOI(nearbyResult150?.places || []);
            if (poiName) console.log("🔍 POI at 150m:", poiName);
          } catch {
            // non-critical
          }
        }

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

        setCenterAddress(finalAddress);
        setCenterLat(lat);
        setCenterLng(lng);
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

        setCenterAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setCenterLat(lat);
        setCenterLng(lng);
      }
    },
    [checkServiceArea, toast],
  );

  // Load Google Maps API script if not already loaded
  useEffect(() => {
    if (typeof window === "undefined" || window.google) return;

    if (!googleMapsApiKey) {
      console.warn("No Google Maps API key available");
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places,geocoding&language=ar&region=IQ&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log("✅ Google Maps API script loaded");
    };
    script.onerror = () => {
      console.error("❌ Failed to load Google Maps API script");
      setMapError("عذراً، الخريطة لا تعمل. يرجى التحقق من مفتاح API");
      setIsLoading(false);
    };

    // معالجة أخطاء المصادقة مثل RefererNotAllowedMapError
    window.gm_authFailure = () => {
      console.error("❌ Google Maps authentication failure (RefererNotAllowed)");
      setMapError("عذراً، الخريطة لا تعمل. يرجى التحقق من مفتاح API");
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove the script as it may be used by other components
    };
  }, [googleMapsApiKey]);

  // Initialize map (only once with API key)
  // ⚡ Instant load: always starts with ramadiCenter, then panTo userLocation when available
  useEffect(() => {
    if (!mapContainer.current || !googleMapsApiKey) {
      console.log("Map initialization waiting:", {
        hasContainer: !!mapContainer.current,
        hasApiKey: !!googleMapsApiKey,
      });
      return;
    }

    // If map exists but container changed (due to screen switch), reinitialize
    if (map.current && mapContainer.current) {
      try {
        const currentDiv = map.current.getDiv();
        if (currentDiv !== mapContainer.current) {
          console.warn("⚠️ Map container changed - reinitializing map");
          map.current = null;
        }
      } catch {
        map.current = null;
      }
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
        setIsLoading(false);
        setMapError("عذراً، الخريطة لا تعمل. يرجى التحقق من مفتاح API أو إعادة تحميل الصفحة");
        toast({
          title: "⚠️ خطأ في تحميل الخريطة",
          description: "يرجى إعادة تحميل الصفحة",
          variant: "destructive",
        });
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

        // ⚡ Always use default center immediately — don't wait for GPS
        const initialCenter = ramadiCenter;

        try {
          console.log("🗺️ Creating Google Maps instance...");

          // 🌙 استخدام أنماط الخريطة الذكية (تتكيف مع Dark/Light تلقائياً)
          const mapStyle = getMapStyle();

          map.current = new window.google.maps.Map(mapContainer.current, {
            center: initialCenter,
            zoom: 16,
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
            gestureHandling: "greedy", // ✨ اللمس الفوري (greedy = no modifier key needed)
            draggable: true, // ✨ تفعيل السحب
          });

          console.log("✅ Map loaded successfully with adaptive theme styles");
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
            setCenterAddress("جاري تحديد العنوان..."); // Show loading state
          });

          map.current.addListener("dragend", () => {
            setIsDragging(false);
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
              !isDragging &&
              (!centerAddress ||
                centerAddress === "جاري تحديد العنوان..." ||
                centerAddress.length < 5)
            ) {
              const center = map.current?.getCenter();
              if (center) {
                console.log("🔄 Idle - getting missing address...");
                reverseGeocode(center.lat(), center.lng());
              }
            }
          });

          // ✨ Handle clicking on POIs (Points of Interest)
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
        } catch (error) {
          console.error("❌ Map initialization error:", error);
          setIsLoading(false);
          toast({
            title: "⚠️ خطأ في تحميل الخريطة",
            description: "يرجى إعادة تحميل الصفحة",
            variant: "destructive",
          });
          return;
        }
      }
    }, 100); // Check every 100ms if Google Maps is available

    return () => clearInterval(checkGoogleMaps);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleMapsApiKey, reloadKey]); // Re-run when API key or reload key changes

  // Smooth pan to user location when GPS resolves (separate from map init)
  useEffect(() => {
    if (!map.current || !userLocation) return;

    // ⚡ Smooth animated pan to user's real location
    const target = new window.google.maps.LatLng(
      userLocation.lat,
      userLocation.lng,
    );
    map.current.panTo(target);
    map.current.setZoom(16);
    console.log(
      "🎯 Map panned to user location:",
      userLocation.lat,
      userLocation.lng,
    );
  }, [userLocation]);

  // ✨ دالة لتعيين العنوان يدوياً (من البحث) مع منع reverseGeocode التلقائي
  const setManualAddress = useCallback((address: string) => {
    console.log("✅ Setting manual address:", address);
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
