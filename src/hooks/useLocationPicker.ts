/**
 * ران - Hook اختيار الموقع والخريطة
 * يدير logic الخريطة والبحث والتحقق من منطقة الخدمة
 * Google Maps Version
 */

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useGoogleMapsApiKey } from "./useGoogleMapsApiKey";
import { useToast } from "./use-toast";

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
  reloadKey?: number
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
  const ramadiCenter = useMemo(
    () => ({ lat: 33.4262, lng: 43.2954 }),
    []
  );

  // Check service area
  const checkServiceArea = useCallback(async (lat: number, lng: number) => {
    try {
      setIsCheckingService(true);
      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/check-service-area?lat=${lat}&lng=${lng}`
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
   * Reverse Geocode مع دمج اسم POI مع العنوان الكامل
   * 
   * خوارزمية العمل:
   * 1️⃣ Geocoding API - جلب العنوان الكامل
   * 2️⃣ PlacesService.nearbySearch - البحث عن اسم POI قريب
   * 3️⃣ حذف Plus Code (C7GX+9C8) من العنوان
   * 4️⃣ دمج: اسم POI + باقي العنوان
   * 
   * مثال: "دائرة صحة الأنبار، مدحت باشا، الرمادي"
   * بدلاً من: "C7GX+9C8، مدحت باشا، الرمادي"
   */
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      // Wait for Google Maps to be available
      if (!window.google?.maps) {
        console.warn("Google Maps not yet loaded");
        return;
      }

      try {
        // Step 1: Get full address from Geocoding API first
        const geocoder = new window.google.maps.Geocoder();
        const result = await geocoder.geocode({ 
          location: new window.google.maps.LatLng(lat, lng),
          language: 'ar'
        });
        
        if (!result.results || result.results.length === 0) {
          console.warn("No geocoding results found");
          setCenterAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          checkServiceArea(lat, lng);
          return;
        }

        let finalAddress = result.results[0].formatted_address;
        console.log("📍 Raw formatted_address from Google:", finalAddress);
        
        // Step 2: Try to get POI name (المعالم لها الأولوية القصوى!)
        let poiName: string | null = null;
        
        // ⚠️ NOTE: Using PlacesService - Google recommends migrating to google.maps.places.Place
        // Timeline: 12+ months until deprecation - see https://developers.google.com/maps/legacy
        if (map.current) {
          try {
            const placesService = new window.google.maps.places.PlacesService(map.current);
            const request = {
              location: new window.google.maps.LatLng(lat, lng),
              radius: 50, // نطاق معقول (50م)
              language: 'ar'
            };
            
            await new Promise<void>((resolve) => {
              placesService.nearbySearch(request, (results, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                  // ✅ الأولوية القصوى: المعالم الحقيقية (POI, Establishments)
                  const priorityTypes = [
                    // أولوية عالية جداً (معالم دينية وتعليمية)
                    ['mosque', 'place_of_worship', 'church'],
                    ['school', 'university', 'secondary_school'],
                    // أولوية عالية (صحة وخدمات)
                    ['hospital', 'health', 'doctor', 'pharmacy'],
                    // أولوية متوسطة (تجاري)
                    ['shopping_mall', 'store', 'supermarket', 'restaurant', 'cafe', 'bank'],
                    ['gas_station', 'car_repair', 'parking'],
                    // أولوية منخفضة (معالم عامة)
                    ['establishment', 'point_of_interest', 'premise'],
                    // أقل أولوية (شوارع وأحياء)
                    ['route', 'neighborhood']
                  ];
                  
                  let foundPOI = false;
                  
                  // البحث بالترتيب في كل النتائج (ليس فقط أول 3)
                  for (const typesGroup of priorityTypes) {
                    for (const place of results) {
                      const hasType = place.types?.some(t => typesGroup.includes(t));
                      const isNotGeneric = !place.types?.includes('country') && 
                                          !place.types?.includes('administrative_area_level_1') &&
                                          !place.types?.includes('locality');
                      
                      if (place.name && hasType && isNotGeneric) {
                        poiName = place.name;
                        console.log("✅ POI found (priority):", poiName, "types:", place.types);
                        foundPOI = true;
                        break;
                      }
                    }
                    if (foundPOI) break;
                  }
                  
                  if (!foundPOI && results[0]?.name) {
                    poiName = results[0].name;
                    console.log("✅ Fallback to nearest:", poiName);
                  }
                }
                resolve();
              });
            });
          } catch (placeError) {
            console.warn("Places API error (non-critical):", placeError);
          }
        }

        // Step 3: Look for point_of_interest in geocoding results if no nearby POI
        if (!poiName) {
          // ✅ البحث بالأولوية: معالم > شوارع > أحياء
          const prioritySearchOrder = [
            ['point_of_interest', 'establishment', 'premise'],
            ['route'],
            ['neighborhood', 'sublocality']
          ];
          
          for (const typeGroup of prioritySearchOrder) {
            const poiResult = result.results.find(r => 
              typeGroup.some(type => r.types.includes(type)) &&
              r.name &&
              !r.types.includes('country') &&
              !r.types.includes('administrative_area_level_1') &&
              !r.types.includes('locality')
            );
            
            if (poiResult && poiResult.name) {
              poiName = poiResult.name;
              console.log("✅ Place name from geocoding:", poiName, "types:", poiResult.types);
              break;
            }
          }
        }

        // Step 4: Build descriptive final address with priority logic
        // منطق الأولويات: معلم > شارع + حي > المدينة (آخر العنوان)
        const components = result.results[0]?.address_components || [];
        const getComponent = (type: string) =>
          components.find(c => c.types.includes(type))?.long_name;
        
        // 🔍 DEBUG: Log all address components
        console.log("📍 All address_components:", components.map(c => ({ name: c.long_name, types: c.types })));
        
        const streetNumber = getComponent('street_number');
        const route = getComponent('route');
        const neighborhood =
          getComponent('neighborhood') ||
          getComponent('sublocality') ||
          getComponent('sublocality_level_1') ||
          getComponent('sublocality_level_2');
        const locality = getComponent('locality') || getComponent('administrative_area_level_2');
        const admin1 = getComponent('administrative_area_level_1');
        
        // 🔍 DEBUG: Log extracted components
        console.log("📍 Extracted:", { route, streetNumber, neighborhood, locality, admin1 });
        
        const street = [route, streetNumber].filter(Boolean).join(' ').trim();
        const city = locality || admin1;
        
        // ✅ إصلاح: إذا لم نجد POI، نستخدم الشارع من address_components أو من formatted_address
        let mainPart = poiName?.trim() || '';
        
        // إذا لم يكن هناك POI، استخدم الشارع (route) مباشرة
        if (!mainPart && route) {
          mainPart = street || route;
          console.log("✅ Using street as main part:", mainPart);
        }
        
        const componentParts = [
          mainPart,
          neighborhood || '',
          city || ''
        ].filter(p => p && p.length > 0)
         .filter((p, idx, arr) => arr.indexOf(p) === idx); // إزالة التكرار
        
        console.log("📍 Component parts after build:", componentParts);
        
        let addressParts = finalAddress
          .split(/[،,]/)
          .map(p => p.trim())
          .filter(p => p.length > 0);
        
        // فحص وحذف Plus Code من البداية
        const plusCodeRegex = /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/;
        const isPlusCode = plusCodeRegex.test(addressParts[0]);
        if (isPlusCode) {
          addressParts.shift();
          console.log("⚠️ Removed Plus Code from address");
        }
        
        // ✅ إصلاح جديد: استخدم formatted_address إذا كان يحتوي على معلومات أكثر من address_components
        // الأولوية 1: إذا وجدنا شارع أو معلم في componentParts (ليس فقط المدينة)
        let priorityAddress = '';
        const hasDetailedInfo = componentParts.length >= 2 || (componentParts.length === 1 && componentParts[0] !== city);
        
        if (hasDetailedInfo && componentParts.length > 0) {
          priorityAddress = componentParts.join('، ');
          console.log("✅ Priority 1 - Detailed address components:", priorityAddress);
        }
        
        // الأولوية 2: استخدم formatted_address بدون Plus Code (شارع + حي + مدينة)
        if (!priorityAddress && addressParts.length >= 1) {
          // فلترة محافظة + حافظ على أول 3 أجزاء مفيدة
          const usefulParts = addressParts
            .filter(p => !p.includes('محافظة') && !p.includes('العراق') && p.length > 0)
            .slice(0, 3);
          
          // ⚡ قبول حتى جزء واحد إذا كان مفيداً (ليس فقط إذا >= 2)
          if (usefulParts.length >= 1) {
            priorityAddress = usefulParts.join('، ');
            console.log("✅ Priority 2 - Formatted address parts:", priorityAddress);
          }
        }
        
        // الأولوية 3: إذا لم نجد شيء مفيد، استخدم componentParts حتى لو فقط المدينة
        if (!priorityAddress && componentParts.length > 0) {
          priorityAddress = componentParts.join('، ');
          console.log("✅ Priority 3 - Basic address components:", priorityAddress);
        }
        
        // الأولوية 4: إذا بقيت مشكلة في Plus Code، جرب النتيجة الثانية
        if (!priorityAddress && isPlusCode && result.results.length > 1) {
          const altAddress = result.results[1].formatted_address;
          const altParts = altAddress
            .split(/[،,]/)
            .map(p => p.trim())
            .filter(p => p.length > 0 && !plusCodeRegex.test(p) && !p.includes('محافظة'));
          priorityAddress = altParts.length > 0 ? altParts.slice(0, 3).join('، ') : altAddress;
          console.log("✅ Priority 4 - Second geocoding result:", priorityAddress);
        }
        
        // الخيار الأخير: احتفظ بأي عنوان متاح أو استخدم الإحداثيات
        if (!priorityAddress) {
          // آخر محاولة: استخدم العنوان الأصلي إذا كان موجوداً
          if (finalAddress && finalAddress.trim()) {
            priorityAddress = finalAddress;
            console.log("✅ Fallback - Using original address:", priorityAddress);
          } else {
            // إذا لم يكن هناك عنوان أصلاً، استخدم الإحداثيات
            priorityAddress = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            console.log("✅ Fallback - Using coordinates:", priorityAddress);
          }
        }
        
        setCenterAddress(priorityAddress);
        setCenterLat(lat);
        setCenterLng(lng);
        checkServiceArea(lat, lng);
      } catch (error: any) {
        console.error("Reverse geocode error:", error);
        
        if (error.message?.includes('REQUEST_DENIED')) {
          console.error("⚠️ Geocoding API: REQUEST_DENIED - Check API Restrictions in Google Cloud Console");
          toast({
            title: "تنبيه: Geocoding API",
            description: "API Key غير مصرح له باستخدام Geocoding API",
            variant: "destructive"
          });
        }
        
        setCenterAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setCenterLat(lat);
        setCenterLng(lng);
      }
    },
    [checkServiceArea, toast]
  );

  // Load Google Maps API script if not already loaded
  useEffect(() => {
    if (typeof window === 'undefined' || window.google) return;
    
    if (!googleMapsApiKey) {
      console.warn("No Google Maps API key available");
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places,geocoding&language=ar&region=IQ&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log("✅ Google Maps API script loaded");
    };
    script.onerror = () => {
      console.error("❌ Failed to load Google Maps API script");
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
        toast({
          title: "⚠️ خطأ في تحميل الخريطة",
          description: "يرجى إعادة تحميل الصفحة",
          variant: "destructive",
        });
        return;
      }
      
      // Check for complete Google Maps API with all required properties
      if (typeof window !== 'undefined' && 
          window.google?.maps && 
          window.google.maps.MapTypeId &&
          window.google.maps.Map) {
        clearInterval(checkGoogleMaps);
        
        if (map.current) return; // Already initialized
        if (!mapContainer.current) return;

        console.log("Initializing Google Maps");

        // ⚡ Always use default center immediately — don't wait for GPS
        const initialCenter = ramadiCenter;

        try {
          console.log("🗺️ Creating Google Maps instance...");
          
          // 🌙 Dark Mode Styling for RAAN Brand Identity
          const darkModeStyles = [
            // Water (نهر دجلة والفرات)
            { elementType: "geometry", stylers: [{ color: "#212121" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#10b981" }] }, // Primary green
            
            // Roads (الطرق)
            {
              featureType: "road",
              elementType: "geometry",
              stylers: [{ color: "#2c2c2c" }]
            },
            {
              featureType: "road",
              elementType: "geometry.stroke",
              stylers: [{ color: "#1a1a1a" }]
            },
            {
              featureType: "road",
              elementType: "labels.text.fill",
              stylers: [{ color: "#10b981" }] // Green for road names
            },
            {
              featureType: "road.highway",
              elementType: "geometry",
              stylers: [{ color: "#3c3c3c" }]
            },
            {
              featureType: "road.highway",
              elementType: "geometry.stroke",
              stylers: [{ color: "#1f2937" }]
            },
            
            // POIs (المعالم) - أهم شيء للوضوح
            {
              featureType: "poi",
              elementType: "labels.text.fill",
              stylers: [{ color: "#10b981" }] // Primary green
            },
            {
              featureType: "poi",
              elementType: "labels.text.stroke",
              stylers: [{ color: "#1a1a1a" }]
            },
            {
              featureType: "poi.park",
              elementType: "geometry",
              stylers: [{ color: "#263c3f" }]
            },
            {
              featureType: "poi.park",
              elementType: "labels.text.fill",
              stylers: [{ color: "#6b9a76" }]
            },
            
            // Transit (محطات)
            {
              featureType: "transit",
              elementType: "geometry",
              stylers: [{ color: "#2c2c2c" }]
            },
            {
              featureType: "transit.station",
              elementType: "labels.text.fill",
              stylers: [{ color: "#10b981" }]
            },
            
            // Water
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#1a1a2e" }]
            },
            {
              featureType: "water",
              elementType: "labels.text.fill",
              stylers: [{ color: "#3b82f6" }]
            },
            
            // Buildings (المباني)
            {
              featureType: "poi.business",
              elementType: "labels.text.fill",
              stylers: [{ color: "#10b981" }]
            }
          ];
          
          map.current = new window.google.maps.Map(mapContainer.current, {
            center: initialCenter,
            zoom: 16,
            mapTypeId: window.google.maps.MapTypeId.ROADMAP,
            styles: darkModeStyles, // 🌙 تطبيق النمط الداكن
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeControl: false,
            scaleControl: false,
            streetViewControl: false,
            rotateControl: false,
            fullscreenControl: false,
            clickableIcons: true, // ✨ Enable clicking on POI markers
            gestureHandling: 'greedy', // ✨ اللمس الفوري (greedy = no modifier key needed)
            draggable: true, // ✨ تفعيل السحب
          });

          console.log("✅ Map loaded successfully with dark mode");
          setIsLoading(false);
          
          const center = map.current.getCenter();
          if (center) {
            console.log("⚡ Initial reverseGeocode (one-time)");
            reverseGeocode(center.lat(), center.lng());
          }

          // Handle drag events - update address immediately when drag ends
          map.current.addListener('dragstart', () => {
            setIsDragging(true);
            setCenterAddress("جاري تحديد العنوان..."); // Show loading state
          });
          
          map.current.addListener('dragend', () => {
            setIsDragging(false);
            // ✨ تخطي reverseGeocode إذا كان العنوان تم تعيينه يدوياً من البحث
            if (skipNextReverseGeocodeRef.current) {
              console.log("⏭️ Skipping reverseGeocode after manual address set");
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
          map.current.addListener('idle', () => {
            // تخطي إذا كان العنوان تم تعيينه يدوياً
            if (skipNextReverseGeocodeRef.current) {
              console.log("⏭️ Skipping reverseGeocode after manual address set");
              skipNextReverseGeocodeRef.current = false;
              return;
            }
            
            // ⚡ تشغيل فقط إذا كان العنوان فارغ أو "جاري تحديد"
            if (!isDragging && (
              !centerAddress || 
              centerAddress === "جاري تحديد العنوان..." ||
              centerAddress.length < 5
            )) {
              const center = map.current?.getCenter();
              if (center) {
                console.log("🔄 Idle - getting missing address...");
                reverseGeocode(center.lat(), center.lng());
              }
            }
          });


          // ✨ Handle clicking on POIs (Points of Interest)
          map.current.addListener('click', (event: google.maps.MapMouseEvent) => {
            if (event.placeId) {
              // User clicked on a POI - get its name
              event.stop(); // Prevent default behavior
              
              const placesService = new window.google.maps.places.PlacesService(map.current!);
              placesService.getDetails(
                { placeId: event.placeId, fields: ['name', 'geometry', 'formatted_address'] },
                (place, status) => {
                  if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
                    console.log("✅ Clicked POI:", place.name);
                    
                    // Use POI name directly
                    if (place.name) {
                      setCenterAddress(place.name);
                      
                      // Pan to POI location if available
                      if (place.geometry?.location) {
                        map.current?.panTo(place.geometry.location);
                        checkServiceArea(place.geometry.location.lat(), place.geometry.location.lng());
                      }
                    }
                  }
                }
              );
            }
          });
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
    const target = new window.google.maps.LatLng(userLocation.lat, userLocation.lng);
    map.current.panTo(target);
    map.current.setZoom(16);
    console.log("🎯 Map panned to user location:", userLocation.lat, userLocation.lng);
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
