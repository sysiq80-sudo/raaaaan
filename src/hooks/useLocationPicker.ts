/**
 * ران - Hook اختيار الموقع والخريطة
 * يدير logic الخريطة والبحث والتحقق من منطقة الخدمة
 * Google Maps Version
 */

import { useCallback, useEffect, useRef, useState, useMemo, type SetStateAction } from "react";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { useToast } from "./use-toast";
import { getMapStyle, watchThemeChanges } from "@/utils/mapStyles";
import { getGeocoder, getOrCreateSharedMap, resetSharedMapCache } from "@/lib/googleMapService";
import { saveLastKnownLocation, getLastKnownLocation } from "@/services/lastKnownLocationService";
import { useMapContext } from "@/contexts/MapContext";
import type { IGeocodingAdapter } from "@/lib/adapters";
import { NominatimGeocodingAdapter } from "@/lib/adapters/NominatimGeocodingAdapter";
import { logger } from "@/lib/logger";
import { isUselessAddress as isAddressUseless } from "@/utils/buildHumanAddress";

interface LocationType {
  lat: number;
  lng: number;
  address: string;
}

export interface ServiceAreaCheck {
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
  nearest_city?: string;
}

type ActiveMapProvider = "google" | "osm" | "none";

export const useLocationPicker = (
  mapToken: string | null,
  userLocation: { lat: number; lng: number } | null,
  reloadKey?: number,
  currentMode?: "pickup" | "dropoff" | "booking" | "stop",
  userAccuracy?: number,
) => {
  const { toast } = useToast();
  const { googleMapsApiKey, isGoogleConfigured } = useMapContext();

  const mapContainer = useRef<HTMLDivElement | null>(null);

  // ✅ إصلاح الخريطة البيضاء: callback ref يُطلق إعادة تشغيل الـ effect عند mount الـ div
  // useRef وحده لا يُطلق re-run عند تغيّر .current — هذا هو سبب البياض
  const [containerMountKey, setContainerMountKey] = useState(0);
  const mapContainerCallback = useCallback((node: HTMLDivElement | null) => {
    mapContainer.current = node;
    if (node) {
      // div صار جاهزاً → أطلق إعادة تشغيل useEffect لتهيئة الخريطة
      setContainerMountKey((k) => k + 1);
    }
  }, []);
  const map = useRef<google.maps.Map | null>(null);
  const googleListenersRef = useRef<google.maps.MapsEventListener[]>([]);
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
  const isGeocodingRef = useRef(false); // ✨ لمنع طلبات geocode متزامنة (حل تكرار idle)
  const pendingGeocodeRef = useRef<{ lat: number; lng: number } | null>(null);
  const geocodingAdaptersRef = useRef<IGeocodingAdapter[]>([]);
  const reverseGeocodeRef = useRef<((lat: number, lng: number) => Promise<void>) | null>(null);

  // ⚡ إذا Google Maps محمّل مسبقاً (من AIVoiceHome) نبدأ بـ false لتجنب شاشة التحميل
  const [isLoading, setIsLoading] = useState(
    !(typeof window !== 'undefined' && window.google?.maps?.Map)
  );
  const [isDragging, setIsDragging] = useState(false);
  const [centerAddress, setCenterAddress] = useState<string>("");
  const [centerLat, setCenterLat] = useState<number | null>(null);
  const [centerLng, setCenterLng] = useState<number | null>(null);
  const [serviceAreaStatus, setServiceAreaStatus] =
    useState<ServiceAreaCheck | null>(null);
  const [isCheckingService, setIsCheckingService] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapProvider, setMapProvider] = useState<ActiveMapProvider>("none");

  const isAddressResolving = (address: string) =>
    !address.trim() || address.includes("جاري تحديد العنوان");

  const setCenterAddressSynced = useCallback((value: SetStateAction<string>) => {
    setCenterAddress((previous) => {
      const next = typeof value === "function"
        ? (value as (previous: string) => string)(previous)
        : value;

      centerAddressRef.current = next;
      return next;
    });
  }, []);

  // تحميل Geocoding adapters (Nominatim مجاني كـ fallback عن Google)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const nominatim = new NominatimGeocodingAdapter();
        await nominatim.load();

        if (!mounted) return;

        geocodingAdaptersRef.current = [nominatim];
        logger.debug("useLocationPicker", "Geocoding adapter ready", {
          provider: "nominatim",
        });
      } catch (error) {
        logger.warn("useLocationPicker", "Adaptive geocoding adapter unavailable", error);
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
      logger.warn("useLocationPicker", "Forcing map reinitialization");
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
      logger.error("useLocationPicker", "Service area check error", error);
      return null;
    } finally {
      setIsCheckingService(false);
    }
  }, []);

  /**
   * @see https://en.wikipedia.org/wiki/Haversine_formula
   */
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

  // 💰 Cache محلي للعناوين — يمنع إعادة طلب Geocoding لنفس المنطقة
  const GEOCODE_CACHE_KEY_PRECISION = 4; // ~11 متر دقة
  const GEOCODE_CACHE_MAX = 100;
  const geocodeCacheRef = useRef<Map<string, string>>(new Map());
  const getGeocodeFromCache = (lat: number, lng: number): string | null => {
    const key = `${lat.toFixed(GEOCODE_CACHE_KEY_PRECISION)},${lng.toFixed(GEOCODE_CACHE_KEY_PRECISION)}`;
    return geocodeCacheRef.current.get(key) || null;
  };
  const setGeocodeCache = (lat: number, lng: number, address: string) => {
    const key = `${lat.toFixed(GEOCODE_CACHE_KEY_PRECISION)},${lng.toFixed(GEOCODE_CACHE_KEY_PRECISION)}`;
    if (geocodeCacheRef.current.size >= GEOCODE_CACHE_MAX) {
      const firstKey = geocodeCacheRef.current.keys().next().value;
      if (firstKey) geocodeCacheRef.current.delete(firstKey);
    }
    geocodeCacheRef.current.set(key, address);
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
      // 💰 تخطي إذا الإحداثيات لم تتغير (أقل من 30 متر) — توفير ~80% من طلبات Geocoding
      const last = lastGeocodedLatLngRef.current;
      if (
        last &&
        !isAddressResolving(centerAddressRef.current) &&
        haversineDistance(lat, lng, last.lat, last.lng) < 30
      ) {
        logger.debug("useLocationPicker", "Skipping reverseGeocode — moved less than 30m");
        return;
      }

      // 💰 فحص الـ cache أولاً — إذا الموقع مخزّن مسبقاً لا نطلب من Google
      const cachedAddress = getGeocodeFromCache(lat, lng);
      // ✅ نرفض العنوان المخزن إذا كان رديئاً (قد حُفظ قبل تطبيق الفلاتر)
      if (cachedAddress && !isAddressResolving(cachedAddress) && !isAddressUseless(cachedAddress)) {
        logger.debug("useLocationPicker", "Using cached geocode result", { cachedAddress });
        centerAddressRef.current = cachedAddress;
        setCenterAddress(cachedAddress);
        setCenterLat(lat);
        setCenterLng(lng);
        lastGeocodedLatLngRef.current = { lat, lng };
        checkServiceArea(lat, lng);
        return;
      }

      // إذا وصلنا هنا، إما لا يوجد cache أو كان العنوان رديئاً — نحذفه ونُعيد الطلب
      if (cachedAddress && isAddressUseless(cachedAddress)) {
        logger.debug("useLocationPicker", "Discarding useless cached address, re-geocoding", { cachedAddress });
        // لا نحتاج حذفه يدوياً — setGeocodeCache سيستبدله عند النجاح
      }

      // ✨ لا نرمي آخر نقطة أثناء السحب: نخزنها لتعمل فور انتهاء الطلب الحالي.
      if (isGeocodingRef.current) {
        pendingGeocodeRef.current = { lat, lng };
        centerAddressRef.current = "جاري تحديد العنوان...";
        setCenterAddress("جاري تحديد العنوان...");
        logger.debug("useLocationPicker", "Queued reverseGeocode while another request is in progress");
        return;
      }
      isGeocodingRef.current = true;
      centerAddressRef.current = "جاري تحديد العنوان...";
      setCenterAddress("جاري تحديد العنوان...");

      const hasNewerPendingGeocode = () => {
        const pending = pendingGeocodeRef.current;
        return Boolean(pending && haversineDistance(lat, lng, pending.lat, pending.lng) >= 30);
      };

      const commitResolvedLocation = (
        address: string,
        resolvedLat = lat,
        resolvedLng = lng,
        // ✅ Fix 2: إذا مُرِرت نتيجة checkServiceArea مسبقاً لا نستدعيها مرة ثانية
        preloadedServiceArea?: Awaited<ReturnType<typeof checkServiceArea>> | null
      ) => {
        if (!address.trim() || hasNewerPendingGeocode()) return false;

        centerAddressRef.current = address;
        setCenterAddress(address);
        setCenterLat(resolvedLat);
        setCenterLng(resolvedLng);
        lastGeocodedLatLngRef.current = { lat: resolvedLat, lng: resolvedLng };

        if (preloadedServiceArea !== undefined) {
          // ✅ نتيجة جاهزة — نحدّث الله state فقط بدون HTTP call
          setServiceAreaStatus(preloadedServiceArea);
        } else {
          // مسار Adapter أو غير متوفر — نطلبه
          checkServiceArea(resolvedLat, resolvedLng);
        }

        // 💰 حفظ في الـ cache — فقط إذا العنوان مفيد (لا نحفظ عناوين رديئة لتتكرر من الـ cache)
        if (!isAddressUseless(address)) {
          setGeocodeCache(resolvedLat, resolvedLng, address);
        }
        return true;
      };

      try {
        // ✅ checkServiceArea يبدأ مبكراً — يُشارَك بين مسار Adapter ومسار Google
        // نفس الـ Promise لا يُنشئ طلبَي HTTP مهما أُعيد await عليه
        const sharedServiceAreaPromise = checkServiceArea(lat, lng);

        // 🏛️ تحميل landmarks مبكراً بالتوازي — مرة واحدة فقط طوال عمر التطبيق
        const { loadLandmarksCache, findNearestLandmark } = await import('@/utils/landmarksCache');
        const sharedLandmarksPromise = loadLandmarksCache(); // يُشارَك — لا يُنشئ HTTP ثانياً

        // 🆓 Nominatim POI يبدأ مبكراً بالتوازي — مجاني ويُعيد أسماء المعالم
        // يُشارَك بين مسار Adapter ومسار Google
        const { extractNominatimComponents: _extractNom } = await import('@/utils/buildHumanAddress');
        const sharedNominatimPOIPromise = (async (): Promise<string | null> => {
          try {
            const nominatimUrl = new URL('https://nominatim.openstreetmap.org/reverse');
            nominatimUrl.searchParams.append('lat', lat.toString());
            nominatimUrl.searchParams.append('lon', lng.toString());
            nominatimUrl.searchParams.append('format', 'json');
            nominatimUrl.searchParams.append('accept-language', 'ar');
            nominatimUrl.searchParams.append('zoom', '18');
            nominatimUrl.searchParams.append('addressdetails', '1');

            const resp = await Promise.race([
              fetch(nominatimUrl.toString()),
              new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Nominatim POI timeout')), 4000)),
            ]);
            const data = await resp.json();
            if (!data?.address) return null;
            const comps = _extractNom(data.name || null, data.address);
            return comps.poiName;
          } catch {
            return null; // Nominatim فشل — لا بأس، Google سيحاول
          }
        })();

        // 1) محاولة عبر geocoding adapters (مجاني/أرخص) أولاً
        const adapters = geocodingAdaptersRef.current;
        for (const adapter of adapters) {
          try {
            const adapterAddress = await adapter.reverseGeocode(lat, lng);
            if (!adapterAddress || adapterAddress.trim().length === 0) {
              continue;
            }

            // ✅ نمرر نتيجة الـ serviceArea الجاهزة — await على نفس الـ Promise (لا HTTP ثانٍ)
            const preloadedArea = await sharedServiceAreaPromise;
            const committed = commitResolvedLocation(adapterAddress, lat, lng, preloadedArea);

            // إذا Google غير متوفر، نكتفي بعنوان الـ adapter
            if (!window.google?.maps) {
              return;
            }

            // إذا Google متوفر نتابع لتحسين عنوان POI، لكن نحتفظ بالعنوان الحالي كـ fallback
            if (committed) break;
          } catch (adapterError) {
            logger.warn("useLocationPicker", "Adaptive reverse geocode failed, trying next provider", adapterError);
          }
        }

        // 2) Google-based enrichment (POI first) إذا متوفر
        if (!window.google?.maps) {
          // إذا لم يكن هناك عنوان من الـ adapter، نستخدم الإحداثيات
          if (isAddressResolving(centerAddressRef.current)) {
            const fallbackAddr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            commitResolvedLocation(fallbackAddr);
          }
          return;
        }

        // ═══════════════════ Google Enrichment (optional) ═══════════════════
        // إذا نجح Nominatim، نحاول تحسين العنوان بـ Google POI
        // لكن إذا فشل Google (بسبب عدم تفعيل الفوترة)، نحتفظ بعنوان Nominatim
        try {

        const geocoder = await getGeocoder();
        if (!geocoder) {
          logger.warn("useLocationPicker", "Google geocoder unavailable; keeping adapter/fallback result");
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
          region: "IQ",
        });

        // 🚫 SearchNearby معطّل — تكلفة $32/1000 طلب
        const nearbySearch50m = Promise.resolve({ places: [] as any[] });

        // ✅ sharedServiceAreaPromise بدأ قبل الـ adapter — await هنا لا يُنشئ HTTP جديد
        // ✅ sharedNominatimPOIPromise بدأ مبكراً — await هنا لا يُنشئ HTTP جديد
        // ✅ sharedLandmarksPromise بدأ مبكراً — يضمن أن الكاش جاهز قبل findNearestLandmark
        const [geocodeResult, nearbyResult50, serviceAreaResult, nominatimPOI] = await Promise.all([
          geocodePromise,
          nearbySearch50m,
          sharedServiceAreaPromise,
          sharedNominatimPOIPromise,
          sharedLandmarksPromise, // 5th — يضمن اكتمال الكاش قبل Step 3
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

          // POI من نتائج Geocoding — استخراج من formatted_address
          // (Geocoder لا يحتوي .name — هذه خاصية Places API فقط)
          // 🔑 إذا النتيجة تحمل اسم منطقة/حي/مؤسسة كأسبقية أعلى من الطريق
          if (
            !geoPOIName &&
            (
              result.types.includes("point_of_interest") ||
              result.types.includes("establishment") ||
              result.types.includes("premise") ||
              result.types.includes("neighborhood") ||
              result.types.includes("sublocality") ||
              result.types.includes("sublocality_level_1") ||
              result.types.includes("administrative_area_level_4") ||
              result.types.includes("administrative_area_level_3")
            ) &&
            !result.types.includes("country") &&
            !result.types.includes("administrative_area_level_1") &&
            !result.types.includes("locality") &&
            !result.types.includes("route") &&
            result.formatted_address
          ) {
            const faParts = result.formatted_address.split(/[،,]/);
            const candidate = faParts[0]?.trim();
            const plusCodeRe = /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/;
            if (candidate && !plusCodeRe.test(candidate) && candidate.length > 2) {
              geoPOIName = candidate;
            }
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
              get("administrative_area_level_1") ||  // محافظة كاربيل وكركوك
              "";
          }
        }

        logger.debug("useLocationPicker", "Geocoding results scanned", {
          bestStreet,
          bestNeighborhood,
          bestCity,
          geoPOIName,
          totalResults: geoResults.length,
        });

        // ═══════════════════ Step 3: POI — Landmarks → Places API → Geocoding → Nominatim ═══════════════════
        let poiName = pickBestPOI(nearbyResult50?.places || []);

        // 🏛️ أولوية 1: Landmarks من قاعدة البيانات (أسرع + أدق + مجاني)
        const landmarkPOI = findNearestLandmark(lat, lng, 200);
        if (!poiName && landmarkPOI) {
          poiName = landmarkPOI;
          logger.debug("useLocationPicker", "POI from local landmarks DB", { poiName });
        }

        // أولوية 2: Google Geocoding POI
        if (!poiName && geoPOIName) {
          poiName = geoPOIName;
          logger.debug("useLocationPicker", "POI from geocoding", { poiName });
        }

        // 🆓 أولوية 3: Nominatim (مجاني) — يُعيد أسماء مبانٍ/جامعات/مساجد من OpenStreetMap
        if (!poiName && nominatimPOI) {
          poiName = nominatimPOI;
          logger.debug("useLocationPicker", "POI from Nominatim", { poiName });
        }

        logger.debug("useLocationPicker", "Best POI selected", {
          poiName: poiName || null,
        });


        // ═══════════════════ Step 4: بناء العنوان — buildHumanAddress() المركزية ═══════════════════
        // الأولوية: POI > حي/منطقة > شارع حقيقي > منطقة الخدمة (DB) > مدينة > formatted > إحداثيات
        const { buildHumanAddress: _buildAddr } = await import('@/utils/buildHumanAddress');

        // ✅ Fix 2: serviceRegionName من نتيجة الفحص المتوازي (إحداثيات الدبوس الحالية تحديداً)
        const serviceRegionName = (serviceAreaResult as any)?.region?.name_ar || null;

        // اختر أفضل formatted_address من نتيجة ذات مستوى مناسب
        // geoResults[0] قد يكون country أو route — نُفضّل locality/neighborhood
        const bestFormattedAddr = (
          geoResults.find(r =>
            r.types.includes('neighborhood') ||
            r.types.includes('sublocality') ||
            r.types.includes('sublocality_level_1') ||
            r.types.includes('administrative_area_level_3') ||
            r.types.includes('administrative_area_level_4')
          ) ||
          geoResults.find(r =>
            r.types.includes('locality') ||
            r.types.includes('administrative_area_level_2')
          ) ||
          geoResults[0]
        )?.formatted_address || null;

        const finalAddress = _buildAddr({
          poiName:           poiName,
          neighborhood:      bestNeighborhood,
          street:            bestStreet,
          city:              bestCity,
          serviceRegionName: serviceRegionName,
          lat,
          lng,
          formattedAddress:  bestFormattedAddr,
        });

        logger.debug("useLocationPicker", "buildHumanAddress INPUTS", {
          city: bestCity,
          neighborhood: bestNeighborhood,
          street: bestStreet,
          poi: poiName,
          serviceRegionName,
          formattedAddress: bestFormattedAddr,
        });

        logger.debug("useLocationPicker", "buildHumanAddress result", {
          finalAddress, poiName, bestNeighborhood, bestStreet, bestCity, serviceRegionName,
        });

        // ✅ Fix 2: تمرير serviceAreaResult الجاهز — يمنع HTTP call مكرر
        commitResolvedLocation(finalAddress, lat, lng, serviceAreaResult);


        } catch (googleError: any) {
          // Google enrichment failed — keep the adapter (Nominatim) result if we have one
          if (googleError.message?.includes("REQUEST_DENIED")) {
            logger.warn("useLocationPicker", "Google Geocoding request denied (billing?). Using Nominatim result.");
          } else {
            logger.warn("useLocationPicker", "Google enrichment failed, keeping adapter result", googleError);
          }
          // إذا Nominatim نجح سابقاً، العنوان محفوظ بالفعل — لا نحتاج تعديل
          // إذا لم ينجح، نضع إحداثيات كـ fallback
          if (isAddressResolving(centerAddressRef.current) || centerAddressRef.current.length < 3) {
            const fallbackAddr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            commitResolvedLocation(fallbackAddr);
          }
        }

      } catch (error: any) {
        logger.error("useLocationPicker", "Reverse geocode error", error);

        const fallbackAddr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        commitResolvedLocation(fallbackAddr);
      } finally {
        isGeocodingRef.current = false; // ✨ إعادة السماح بطلبات جديدة
        const pending = pendingGeocodeRef.current;
        if (pending) {
          pendingGeocodeRef.current = null;
          window.setTimeout(() => {
            reverseGeocodeRef.current?.(pending.lat, pending.lng);
          }, 0);
        }
      }
    },
    [checkServiceArea],
  );

  // Reset geocode cache to allow re-geocoding same coordinates
  // Keep ref in sync with latest reverseGeocode callback
  reverseGeocodeRef.current = reverseGeocode;

  const resetGeocodeCache = useCallback(() => {
    lastGeocodedLatLngRef.current = null;
    isGeocodingRef.current = false;
    pendingGeocodeRef.current = null;
  }, []);

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

        osmMap.on("dragstart", () => {
          setIsDragging(true);
          isDraggingRef.current = true;
          centerAddressRef.current = "جاري تحديد العنوان...";
          setCenterAddress("جاري تحديد العنوان...");
        });

        osmMap.on("dragend", () => {
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

        logger.debug("useLocationPicker", "OSM fallback initialized", { reason });
        reverseGeocode(initialCenter.lat, initialCenter.lng);
      } catch (error) {
        logger.error("useLocationPicker", "OSM fallback init failed", error);
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
      logger.warn("useLocationPicker", "No Google Maps API key available");
      initOsmFallbackMap("missing_google_api_key");
      return;
    }

    loadGoogleMaps(googleMapsApiKey).then(() => {
      logger.debug("useLocationPicker", "Google Maps API loaded via centralized loader");
    }).catch((err) => {
      logger.error("useLocationPicker", "Failed to load Google Maps API", err);
      initOsmFallbackMap("google_script_load_failed");
    });

    // معالجة أخطاء المصادقة مثل RefererNotAllowedMapError
    window.gm_authFailure = () => {
      logger.error("useLocationPicker", "Google Maps authentication failure");
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
      logger.debug("useLocationPicker", "Map initialization waiting", {
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
      logger.debug("useLocationPicker", "reloadKey changed; destroying old map instance");
      map.current = null;
    }

    // ⚡ Helper: إنشاء الخريطة فعلياً
    const isGoogleReady = () =>
      typeof window !== "undefined" &&
      window.google?.maps &&
      window.google.maps.MapTypeId &&
      window.google.maps.Map;

    const createMap = () => {

        if (map.current) return; // Already initialized
        if (!mapContainer.current) return;

        logger.debug("useLocationPicker", "Initializing Google Maps");

        // ✅ استخدام آخر موقع مخزن بدل الرمادي الافتراضي — يعرض الخريطة فوراً عند ضعف النت
        const cachedLocation = getLastKnownLocation();
        const initialCenter = cachedLocation
          ? { lat: cachedLocation.lat, lng: cachedLocation.lng }
          : ramadiCenter;

        try {
          logger.debug("useLocationPicker", "Creating Google Maps instance");

          // ✅ مسح الـ cache لضمان إنشاء خريطة جديدة دائماً
          resetSharedMapCache();

          map.current = getOrCreateSharedMap(mapContainer.current, {
            center: initialCenter,
            zoom: 15,
            mapTypeId: window.google.maps.MapTypeId.ROADMAP,
            // ✅ بدون styles مخصصة — المظهر الافتراضي لـ Google يُظهر أسماء الأماكن
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeControl: false,
            scaleControl: false,
            streetViewControl: false,
            rotateControl: false,
            fullscreenControl: false,
            clickableIcons: true,
            gestureHandling: "greedy",
            draggable: true,
          });

          logger.debug("useLocationPicker", "Map initialized with default styles");
          setMapProvider("google");
          setIsLoading(false);

          // 🎨 مراقبة تغيير الثيم لتحديث نمط الخريطة تلقائياً
          if (map.current) {
            watchThemeChanges(map.current, (isDark) => {
              logger.debug("useLocationPicker", "Map theme updated", {
                theme: isDark ? "dark" : "light",
              });
            });
          }

          const center = map.current.getCenter();
          if (center) {
            logger.debug("useLocationPicker", "Initial reverseGeocode");
            reverseGeocodeRef.current?.(center.lat(), center.lng());
          }

          // Remove existing listeners first to prevent duplicates if re-mounting
          googleListenersRef.current.forEach((l) => window.google.maps.event.removeListener(l));
          googleListenersRef.current = [];

          // ✅ إصلاح Double-Geocoding:
          // dragend يستدعي reverseGeocode فوراً ويُظهر الاسم الصحيح.
          // idle يأتي بعده بـ ~800ms ويُعيد الكتابة بنتيجة مختلفة.
          // الحل: بعد dragend نمنع أول idle تلقائياً.
          let blockIdleAfterDrag = false;

          let idleGeocodeTimer: number | null = null;
          const requestCenterReverseGeocode = (source: string) => {
            if (skipNextReverseGeocodeRef.current) {
              logger.debug("useLocationPicker", `Skipping reverseGeocode after manual address set (${source})`);
              skipNextReverseGeocodeRef.current = false;
              return;
            }

            const center = map.current?.getCenter();
            if (center) {
              logger.debug("useLocationPicker", `Map ${source}; resolving center address`);
              reverseGeocodeRef.current?.(center.lat(), center.lng());
            }
          };

          // Handle drag events - update address immediately when drag ends
          googleListenersRef.current.push(
            map.current.addListener("dragstart", () => {
              setIsDragging(true);
              isDraggingRef.current = true; // ✨ Ref sync
              centerAddressRef.current = "جاري تحديد العنوان...";
              setCenterAddress("جاري تحديد العنوان..."); // Show loading state
            })
          );

          googleListenersRef.current.push(
            map.current.addListener("dragend", () => {
              setIsDragging(false);
              isDraggingRef.current = false; // ✨ Ref sync
              blockIdleAfterDrag = true; // ✅ الطلب الأول من dragend سيكون كافياً
              requestCenterReverseGeocode("dragend");
            })
          );

          googleListenersRef.current.push(
            map.current.addListener("idle", () => {
              if (currentMode === "booking" || isDraggingRef.current) return;

              // ✅ منع idle من إعادة كتابة نتيجة dragend الجيدة
              if (blockIdleAfterDrag) {
                blockIdleAfterDrag = false;
                return;
              }

              if (idleGeocodeTimer) window.clearTimeout(idleGeocodeTimer);

              idleGeocodeTimer = window.setTimeout(() => {
                requestCenterReverseGeocode("idle");
              }, 800);
            })
          );

          // ✨ Handle clicking on POIs (Points of Interest) - only in pickup/dropoff modes
          if (currentMode !== "booking") {
            googleListenersRef.current.push(map.current.addListener(
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
                      logger.debug("useLocationPicker", "Clicked POI", {
                        displayName: place.displayName,
                      });
                      centerAddressRef.current = place.displayName;
                      setCenterAddress(place.displayName);

                      if (place.location) {
                        skipNextReverseGeocodeRef.current = true; // ✨ لمنع الـ idle من إعادة الاستعلام بـ reverseGeocode وتخريب الاسم
                        map.current?.panTo(place.location);
                        
                        const pLat = place.location.lat();
                        const pLng = place.location.lng();
                        
                        setCenterLat(pLat);
                        setCenterLng(pLng);
                        lastGeocodedLatLngRef.current = { lat: pLat, lng: pLng };
                        checkServiceArea(pLat, pLng);
                      }
                    }
                  } catch (err) {
                    logger.warn("useLocationPicker", "POI details error", err);
                  }
                }
              },
            ));
          }
        } catch (error) {
          logger.error("useLocationPicker", "Map initialization error", error);
          initOsmFallbackMap("google_map_init_exception");
          return;
        }
    };

    // ⚡ Fast path: إذا Google Maps محمّل مسبقاً (من AIVoiceHome) → إنشاء فوري بدون انتظار
    if (isGoogleReady()) {
      logger.debug("useLocationPicker", "Google Maps already loaded — instant init");
      createMap();
      return;
    }

    // Slow path: انتظار تحميل SDK
    let checkAttempts = 0;
    const maxAttempts = 50; // 5 seconds maximum (50 * 100ms)

    const checkGoogleMaps = setInterval(() => {
      checkAttempts++;

      if (checkAttempts > maxAttempts) {
        clearInterval(checkGoogleMaps);
        logger.error("useLocationPicker", "Google Maps API failed to load after timeout");
        initOsmFallbackMap("google_init_timeout");
        return;
      }

      if (isGoogleReady()) {
        clearInterval(checkGoogleMaps);
        createMap();
      }
    }, 100); // Check every 100ms if Google Maps is available

    return () => clearInterval(checkGoogleMaps);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleMapsApiKey, initOsmFallbackMap, isGoogleConfigured, reloadKey, containerMountKey]); // Re-run when API key, reload key, OR container div مounts/remounts

  // ✅ إصلاح الخريطة البيضاء: trigger resize بعد كل تغيير في reloadKey
  useEffect(() => {
    if (reloadKey === undefined || reloadKey === 0) return;
    const timer = setTimeout(() => {
      if (mapProvider === "google" && map.current && window.google?.maps?.event) {
        window.google.maps.event.trigger(map.current, "resize");
        const center = map.current.getCenter();
        if (center) map.current.setCenter(center);
        logger.debug("useLocationPicker", "Map resize triggered after reloadKey change");
      }

      if (mapProvider === "osm" && osmMapRef.current) {
        osmMapRef.current.invalidateSize();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [mapProvider, reloadKey]);

  // ✅ Auto-retry geocoding if address didn't load on first attempt
  useEffect(() => {
    if (isLoading) return; // Map not ready yet
    if (centerAddressRef.current && centerAddressRef.current !== "جاري تحديد العنوان...") return; // Already have address
    
    let retries = 0;
    const maxRetries = 5;
    
    const retryGeocode = setInterval(() => {
      retries++;
      if (retries > maxRetries) {
        clearInterval(retryGeocode);
        return;
      }
      // Check again if address appeared
      if (centerAddressRef.current && centerAddressRef.current !== "جاري تحديد العنوان...") {
        clearInterval(retryGeocode);
        return;
      }
      const center = map.current?.getCenter?.();
      if (center) {
        lastGeocodedLatLngRef.current = null; // Reset to bypass same-location check
        isGeocodingRef.current = false;
        logger.debug("useLocationPicker", `Auto-retry geocoding attempt ${retries}`);
        reverseGeocodeRef.current?.(center.lat(), center.lng());
      }
    }, 2000);

    return () => clearInterval(retryGeocode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // ✅ Trigger reverse geocode when mode changes (e.g. pickup → dropoff)
  // بدون هذا، عند الانتقال إلى الوصول لا يظهر العنوان فوق الدبوس تلقائياً
  useEffect(() => {
    if (isLoading) return;
    if (!currentMode || currentMode === "booking") return;

    // تأخير بسيط لضمان اكتمال أي panTo/animation قبل الاستعلام
    const timer = setTimeout(() => {
      const center = map.current?.getCenter?.();
      if (center) {
        // Reset caches to force fresh geocoding
        lastGeocodedLatLngRef.current = null;
        isGeocodingRef.current = false;
        skipNextReverseGeocodeRef.current = false;
        logger.debug("useLocationPicker", `Mode changed to "${currentMode}" — triggering reverseGeocode`);
        reverseGeocodeRef.current?.(center.lat(), center.lng());
      }
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMode, isLoading]);

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
          osmAccuracyCircleRef.current.setRadius(Math.max(10, Math.min(userAccuracy ?? 50, 200)));
        } else {
          osmAccuracyCircleRef.current = L.circle([userLocation.lat, userLocation.lng], {
            radius: Math.max(10, Math.min(userAccuracy ?? 50, 200)),
            color: "#5bdda6",
            weight: 1,
            fillColor: "#5bdda6",
            fillOpacity: 0.08,
          }).addTo(osmMapRef.current);
        }
      };

      updateOsmUserMarker().catch((e) => {
        logger.warn("useLocationPicker", "OSM user marker update failed", e);
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
      logger.debug("useLocationPicker", "Map panned to user location", userLocation);
    }

    // 🟢 نقطة خضراء ديناميكية مع نبض مشع — تمثل الموقع الجغرافي الحقيقي (مثل النقطة الزرقاء في جوجل ماب)
    // إضافة CSS للنبض إلى الصفحة مرة واحدة فقط
    if (!document.getElementById('raan-user-dot-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'raan-user-dot-pulse-style';
      style.textContent = `
        @keyframes raan-pulse-ring {
          0%   { r: 8;  opacity: 0.6; }
          70%  { r: 15; opacity: 0; }
          100% { r: 15; opacity: 0; }
        }
        .raan-pulse-ring {
          animation: raan-pulse-ring 2s ease-out infinite;
          transform-origin: center;
        }
      `;
      document.head.appendChild(style);
    }

    const glowingGreenDotSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
        <defs>
          <radialGradient id="userGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#10b981" stop-opacity="0" />
          </radialGradient>
          <style>
            @keyframes pulse-ring {
              0%   { r: 8;  opacity: 0.6; }
              70%  { r: 18; opacity: 0; }
              100% { r: 18; opacity: 0; }
            }
            .pulse { animation: pulse-ring 2s ease-out infinite; }
          </style>
        </defs>
        <!-- Soft ambient glow -->
        <circle cx="22" cy="22" r="20" fill="url(#userGlow)" />
        <!-- Pulsing ring — expanding outward -->
        <circle class="pulse" cx="22" cy="22" r="8" fill="none" stroke="#10b981" stroke-width="2" opacity="0.6" />
        <!-- Core dot — solid green with crisp white border -->
        <circle cx="22" cy="22" r="7" fill="#10b981" stroke="#ffffff" stroke-width="2.5" />
        <!-- Specular highlight for 3D look -->
        <circle cx="20" cy="20" r="2.5" fill="white" opacity="0.3" />
      </svg>
    `;

    const userPinMarkerIcon = {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(glowingGreenDotSvg),
      scaledSize: new google.maps.Size(44, 44),
      anchor: new google.maps.Point(22, 22),
    };

    if (userMarkerRef.current) {
      // تحديث الموضع والخريطة — التحريك السلس يتم تلقائياً من Google Maps
      userMarkerRef.current.setPosition({ lat: userLocation.lat, lng: userLocation.lng });
      userMarkerRef.current.setIcon(userPinMarkerIcon);
      userMarkerRef.current.setMap(map.current);
    } else {
      // إنشاء marker جديد
      userMarkerRef.current = new google.maps.Marker({
        position: { lat: userLocation.lat, lng: userLocation.lng },
        map: map.current,
        icon: userPinMarkerIcon,
        title: 'موقعي الحالي',
        zIndex: 5,
        clickable: false,
        optimized: false, // مطلوب لتشغيل CSS animations داخل الـ SVG
      });
    }

    // 🟢 دائرة دقة الموقع — نصف القطر يعكس دقة GPS الحقيقية
    const accuracyRadius = Math.max(10, Math.min(userAccuracy ?? 50, 200)); // clamp 10–200 متر
    if (userAccuracyCircleRef.current) {
      userAccuracyCircleRef.current.setCenter({ lat: userLocation.lat, lng: userLocation.lng });
      userAccuracyCircleRef.current.setRadius(accuracyRadius);
      userAccuracyCircleRef.current.setMap(map.current);
    } else {
      userAccuracyCircleRef.current = new google.maps.Circle({
        strokeColor: '#5bdda6',
        strokeOpacity: 0.25,
        strokeWeight: 1,
        fillColor: '#5bdda6',
        fillOpacity: 0.06,
        map: map.current,
        center: { lat: userLocation.lat, lng: userLocation.lng },
        radius: accuracyRadius,
        clickable: false,
        zIndex: 4,
      });
    }
  }, [userLocation, userAccuracy, isLoading, mapProvider]);

  // ✨ دالة لتعيين العنوان يدوياً (من البحث) مع منع reverseGeocode التلقائي
  const skipResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setManualAddress = useCallback((address: string, coords?: { lat: number; lng: number }) => {
    logger.debug("useLocationPicker", "Setting manual address", { address, coords });
    centerAddressRef.current = address;
    setCenterAddress(address);
    if (coords) {
      setCenterLat(coords.lat);
      setCenterLng(coords.lng);
      lastGeocodedLatLngRef.current = coords;
    }
    skipNextReverseGeocodeRef.current = true;

    // إعادة الـ flag بعد 2 ثانية — مع إلغاء أي timer سابق لتجنب memory leak
    if (skipResetTimerRef.current) clearTimeout(skipResetTimerRef.current);
    skipResetTimerRef.current = setTimeout(() => {
      skipNextReverseGeocodeRef.current = false;
      skipResetTimerRef.current = null;
      logger.debug("useLocationPicker", "Skip flag reset; reverseGeocode re-enabled");
    }, 2000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Remove all Google Maps listeners to prevent callback leaks
      if (window.google?.maps?.event) {
        googleListenersRef.current.forEach((l) => window.google.maps.event.removeListener(l));
      }
      googleListenersRef.current = [];

      if (osmMapRef.current) {
        osmMapRef.current.remove();
        osmMapRef.current = null;
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
      if (userAccuracyCircleRef.current) {
        userAccuracyCircleRef.current.setMap(null);
        userAccuracyCircleRef.current = null;
      }
      if (map.current) {
        // Google Maps doesn't have a remove() method
        // Just nullify the reference to allow garbage collection
        map.current = null;
      }
    };
  }, []);

  return {
    mapContainer: mapContainerCallback,
    mapContainerRef: mapContainer,  // للوصول إلى .current عند الحاجة
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
    setCenterAddress: setCenterAddressSynced,
    setCenterLat,
    setCenterLng,
    setManualAddress, // ✨ NEW
    checkServiceArea,
    reverseGeocode,
    resetGeocodeCache,
    setIsDragging,
    setIsLoading,
  };
};
