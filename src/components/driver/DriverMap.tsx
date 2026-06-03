import { useEffect, useRef, useState } from "react";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { getMarkerIcon, getDarkMapStyle } from "@/lib/googleMapService";
import { MapPin, Loader2, AlertCircle, RefreshCw, Zap, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import carIcon from "@/assets/white color car .png";
import { carBase64 } from "@/assets/carBase64";
import { useAutoAccept } from "@/stores/driverStore";
import useDriverStore from "@/stores/driverStore";
import { logger } from "@/lib/logger";
import { onMapContainerReady } from "@/lib/mapContainerReady";

// متغير على مستوى الوحدة — يبقى حتى بعد unmount/remount للمكون
let googleMapsAuthFailedGlobal = false;

interface DriverMapProps {
  driverLocation: { lat: number; lng: number; heading?: number | null } | null;
  isOnline: boolean;
  onLocationUpdate?: () => void;
  hasActiveRide?: boolean;
  currentRideRequest?: any | null;
  isRideRequestMinimized?: boolean;
  isActiveRideMinimized?: boolean;
}

export const DriverMap = ({
  driverLocation,
  isOnline,
  onLocationUpdate,
  hasActiveRide,
  currentRideRequest,
  isRideRequestMinimized,
  isActiveRideMinimized
}: DriverMapProps) => {
  const isMinimized = hasActiveRide ? isActiveRideMinimized : isRideRequestMinimized;
  const bottomPadding = isMinimized ? 160 : 350;
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const driverMarker = useRef<google.maps.Marker | null>(null);
  const pulseCircles = useRef<google.maps.Circle[]>([]);
  const hasLoadedTilesOnceRef = useRef(false);
  const [loading, setLoading] = useState(!googleMapsAuthFailedGlobal);
  const [error, setError] = useState<string | null>(null);
  const [authFailed, setAuthFailed] = useState(googleMapsAuthFailedGlobal);
  const [isMapReady, setIsMapReady] = useState(false);
  const autoAccept = useAutoAccept();
  const toggleAutoAccept = useDriverStore((s) => s.toggleAutoAccept);
  const activeRide = useDriverStore((s) => s.activeRide) as { pickup_location?: { lat: number; lng: number }; dropoff_location?: { lat: number; lng: number }; pickup_address?: string | null; dropoff_address?: string | null; status?: string } | null;
  const { apiKey, isLoading: isApiKeyLoading } = useGoogleMapsApiKey();
  const retryCountRef = useRef(0);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const dropoffMarkerRef = useRef<google.maps.Marker | null>(null);
  const routeLineRef = useRef<google.maps.Polyline | null>(null);
  const lastFitBoundsRideRef = useRef<string | null>(null);
  const pickupPulseRef = useRef<google.maps.Circle | null>(null);
  const pickupPulseAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dropoffPulseRef = useRef<google.maps.Circle | null>(null);
  const dropoffPulseAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // === Premium SVG marker icons ===
  const createPickupMarkerIcon = (): google.maps.Icon => {
    // Beautiful blue balloon pin with text "موقع العميل" (Arabic RTL layout)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="65" viewBox="0 0 140 65">
      <defs>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@900&amp;display=swap');
        </style>
        <filter id="ds" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#1e3a8a" flood-opacity="0.3"/></filter>
        <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d4ed8"/></linearGradient>
      </defs>
      <g filter="url(#ds)">
        <path d="M 22 5 C 12.6 5 5 12.6 5 22 C 5 31.4 12.6 39 22 39 L 58 39 L 70 52 L 82 39 L 118 39 C 127.4 39 135 31.4 135 22 C 135 12.6 127.4 5 118 5 Z" fill="url(#pg)" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
      </g>
      <text x="62" y="24" font-family="'Cairo', system-ui, sans-serif" font-size="15" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="central">موقع العميل</text>
      <circle cx="114" cy="22" r="10" fill="#ffffff" opacity="0.25"/>
      <circle cx="114" cy="19" r="3.5" fill="#ffffff"/>
      <path d="M 108 28 C 108 24 111 22 114 22 S 120 24 120 28" fill="#ffffff" opacity="0.95"/>
    </svg>`;
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(140, 65),
      anchor: new google.maps.Point(70, 52),
    };
  };

  const createDropoffMarkerIcon = (): google.maps.Icon => {
    // Green teardrop pin with flag
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="62" viewBox="0 0 48 62">
      <defs>
        <filter id="ds2" x="-20%" y="-10%" width="140%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#10b981" flood-opacity="0.5"/></filter>
        <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#059669"/></linearGradient>
      </defs>
      <path d="M24 58 C24 58 4 34 4 20 C4 9 13 0 24 0 S44 9 44 20 C44 34 24 58 24 58Z" fill="url(#dg)" filter="url(#ds2)" stroke="#fff" stroke-width="2.5"/>
      <circle cx="24" cy="19" r="13" fill="#fff" opacity="0.2"/>
      <rect x="18" y="11" width="2.5" height="18" rx="1" fill="#fff"/>
      <path d="M20.5 11 L33 15 L33 22 L20.5 18Z" fill="#fff" opacity="0.9"/>
    </svg>`;
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(48, 62),
      anchor: new google.maps.Point(24, 58),
    };
  };

  const calculateHeading = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const l1 = lat1 * Math.PI / 180;
    const l2 = lat2 * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(l2);
    const x = Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };

  const drawCarIcon = (currentHeading: number): google.maps.Icon => {
    const carSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
        <defs>
          <linearGradient id="lightBeam" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.6"/>
            <stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <g transform="rotate(${Math.round(currentHeading)} 40 40)">
          
          
          <!-- Headlight beams (beams of light pointing forward) -->
          <path d="M 32.5,13.3 L 16.7,-13.3 L 38.3,-13.3 Z" fill="url(#lightBeam)" />
          <path d="M 47.5,13.3 L 41.7,-13.3 L 63.3,-13.3 Z" fill="url(#lightBeam)" />

          <!-- Car image (rotated 90deg to face UP) -->
          <image href="${carBase64}" x="6.7" y="13.3" width="66.6" height="38.8" transform="rotate(90 40 40)" />
        </g>
      </svg>
    `;
    return {
      url: "data:image/svg+xml," + encodeURIComponent(carSvg),
      scaledSize: new google.maps.Size(80, 80),
      anchor: new google.maps.Point(40, 40),
    };
  };
  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || isApiKeyLoading) return;
    // إذا فشل سابقاً (متغير عالمي) — لا نحاول مجدداً
    if (googleMapsAuthFailedGlobal) {
      setAuthFailed(true);
      setLoading(false);
      return;
    }
    // لا يوجد مفتاح API — نعرض شاشة خطأ
    if (!apiKey) {
      console.warn("⚠️ Google Maps API key is empty. Check app_settings table or VITE_GOOGLE_MAPS_API_KEY env var.");
      googleMapsAuthFailedGlobal = true;
      setAuthFailed(true);
      setLoading(false);
      return;
    }

    // If map already exists, avoid reinitialization churn
    if (map.current) {
      setLoading(false);
      setIsMapReady(true);
      return;
    }

    let isActive = true;
    let tileTimeout: ReturnType<typeof setTimeout> | null = null;
    let cancelContainerReady: (() => void) | null = null;

    const initMap = () => {
      try {
        setLoading(true);
        setError(null);

        // معالجة أخطاء Google Maps مثل RefererNotAllowedMapError
        window.gm_authFailure = () => {
          if (googleMapsAuthFailedGlobal) return;
          const currentUrl = window.location.href;
          console.error(`❌ Google Maps auth failure — URL rejected: ${currentUrl}`);
          googleMapsAuthFailedGlobal = true;
          setAuthFailed(true);
          setLoading(false);
        };

        const createMap = () => {
          if (!window.google || !mapContainer.current || !isActive) return;
          const container = mapContainer.current;

          cancelContainerReady = onMapContainerReady(container, () => {
            if (!isActive || map.current || !window.google?.maps || !mapContainer.current) return;

            // Default to Ramadi center if no location
            const center = driverLocation || { lat: 33.4279, lng: 43.3070 };

            map.current = new google.maps.Map(mapContainer.current, {
              center: new google.maps.LatLng(center.lat, center.lng),
              zoom: 14,
              mapTypeControl: false,
              fullscreenControl: false,
              streetViewControl: false,
              gestureHandling: "greedy",
            });

            // Detect silent tile failure with timeout
            let tilesLoaded = false;
            google.maps.event.addListenerOnce(map.current, 'tilesloaded', () => {
              if (!isActive || googleMapsAuthFailedGlobal) return;
              tilesLoaded = true;
              hasLoadedTilesOnceRef.current = true;
              if (tileTimeout) {
                clearTimeout(tileTimeout);
                tileTimeout = null;
              }
              setAuthFailed(false);
              setLoading(false);
              setIsMapReady(true);
              console.log('✅ DriverMap: Tiles loaded successfully');
            });

            // If tiles don't load within 15s, show error
            tileTimeout = setTimeout(() => {
              if (!isActive) return;
              if (!tilesLoaded && map.current) {
                const isHidden = typeof document !== 'undefined' && document.hidden;
                const containerVisible = !!mapContainer.current && mapContainer.current.clientWidth > 0 && mapContainer.current.clientHeight > 0;

                if (isHidden || !containerVisible) {
                  setLoading(false);
                  return;
                }

                if (hasLoadedTilesOnceRef.current) {
                  console.warn('⚠️ DriverMap: Tiles timeout ignored (map had loaded before)');
                  setLoading(false);
                  return;
                }

                console.warn('⚠️ DriverMap: Tiles did not load within 15s');
                googleMapsAuthFailedGlobal = true;
                setAuthFailed(true);
                setLoading(false);
              }
            }, 15000);

            console.log('✅ DriverMap: Map created successfully');

            // تأخير بسيط ثم تفعيل resize لضمان ظهور البلاطات
            setTimeout(() => {
              if (map.current && window.google?.maps?.event) {
                google.maps.event.trigger(map.current, 'resize');
                map.current.setCenter(new google.maps.LatLng(center.lat, center.lng));
              }
            }, 300);

            // Add driver marker
            if (driverLocation) {
              addDriverMarker(driverLocation, driverLocation.heading || 0);
            }
          });
        };

        // تحقق من تحميل Google Maps مسبقاً
        if (window.google?.maps?.Map) {
          createMap();
          return;
        }

        // تحميل عبر المحمّل المركزي
        loadGoogleMaps(apiKey).then(() => {
          createMap();
        }).catch((err) => {
          console.error("DriverMap: load error", err);
          setError("عذراً، الخريطة لا تعمل. يرجى التحقق من مفتاح API");
          setLoading(false);
        });

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "فشل في تحميل الخريطة";
        console.error("Map init error:", err);
        setError(message);
        setLoading(false);
      }
    };

    initMap();

    return () => {
      isActive = false;
      if (tileTimeout) {
        clearTimeout(tileTimeout);
      }
      cancelContainerReady?.();
      removePulseCircles();
      // Clean ride markers on unmount
      if (pickupMarkerRef.current) { pickupMarkerRef.current.setMap(null); pickupMarkerRef.current = null; }
      if (dropoffMarkerRef.current) { dropoffMarkerRef.current.setMap(null); dropoffMarkerRef.current = null; }
      if (routeLineRef.current) { routeLineRef.current.setMap(null); routeLineRef.current = null; }
      if (pickupPulseRef.current) { pickupPulseRef.current.setMap(null); pickupPulseRef.current = null; }
      if (pickupPulseAnimRef.current) { clearInterval(pickupPulseAnimRef.current); pickupPulseAnimRef.current = null; }
      if (dropoffPulseRef.current) { dropoffPulseRef.current.setMap(null); dropoffPulseRef.current = null; }
      if (dropoffPulseAnimRef.current) { clearInterval(dropoffPulseAnimRef.current); dropoffPulseAnimRef.current = null; }
      if (map.current) {
        map.current = null;
        setIsMapReady(false);
      }
    };
  }, [apiKey, isApiKeyLoading]);

  // Update driver marker when location changes
  useEffect(() => {
    if (!isMapReady || !map.current || !driverLocation) return;
    if (!window.google?.maps) return;

    try {
      let targetHeading = driverLocation.heading || 0;

      // Fallback: calculate heading if device didn't provide one
      if (!driverLocation.heading && driverMarker.current) {
        const prevPos = driverMarker.current.getPosition();
        if (prevPos) {
          const pLat = prevPos.lat();
          const pLng = prevPos.lng();
          if (pLat !== driverLocation.lat || pLng !== driverLocation.lng) {
            targetHeading = calculateHeading(pLat, pLng, driverLocation.lat, driverLocation.lng);
          }
        }
      }

      if (driverMarker.current) {
        driverMarker.current.setPosition(new google.maps.LatLng(driverLocation.lat, driverLocation.lng));
        driverMarker.current.setIcon(drawCarIcon(targetHeading));
        updatePulseCirclesPosition(driverLocation);
      } else {
        addDriverMarker(driverLocation, targetHeading);
      }

      // Center map on driver only when no active ride (fitBounds handles viewport during rides)
      if (!activeRide?.status) {
        map.current.panTo(new google.maps.LatLng(driverLocation.lat, driverLocation.lng));
      }
    } catch (err) {
      console.error("DriverMap: marker update error", err);
    }
  }, [driverLocation?.lat, driverLocation?.lng, driverLocation?.heading, isMapReady]);

  // ═══ Show pickup/dropoff markers when ride is active ═══
  useEffect(() => {
    if (!isMapReady || !map.current || !window.google?.maps) return;

    const clearRideMarkers = () => {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setMap(null);
        pickupMarkerRef.current = null;
      }
      if (dropoffMarkerRef.current) {
        dropoffMarkerRef.current.setMap(null);
        dropoffMarkerRef.current = null;
      }
      if (routeLineRef.current) {
        routeLineRef.current.setMap(null);
        routeLineRef.current = null;
      }
      if (pickupPulseRef.current) { pickupPulseRef.current.setMap(null); pickupPulseRef.current = null; }
      if (pickupPulseAnimRef.current) { clearInterval(pickupPulseAnimRef.current); pickupPulseAnimRef.current = null; }
      if (dropoffPulseRef.current) { dropoffPulseRef.current.setMap(null); dropoffPulseRef.current = null; }
      if (dropoffPulseAnimRef.current) { clearInterval(dropoffPulseAnimRef.current); dropoffPulseAnimRef.current = null; }
    };

    if ((!activeRide || !activeRide.status) && !currentRideRequest) {
      clearRideMarkers();
      lastFitBoundsRideRef.current = null;
      return;
    }

    const isRequest = !activeRide?.status && currentRideRequest;
    const status = isRequest ? 'accepted' : (activeRide?.status || '');
    const pickupLoc = isRequest ? currentRideRequest.pickup_location : activeRide?.pickup_location;
    const pickupAddr = isRequest ? currentRideRequest.pickup_address : activeRide?.pickup_address;

    // === Pickup marker (accepted / arrived) ===
    if ((status === 'accepted' || status === 'arrived') && pickupLoc) {
      const pos = new google.maps.LatLng(pickupLoc.lat, pickupLoc.lng);

      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = new google.maps.Marker({
          position: pos,
          map: map.current,
          title: pickupAddr || 'موقع العميل',
          icon: createPickupMarkerIcon(),
          zIndex: 15,
          animation: google.maps.Animation.DROP,
        });

        // Draw a dashed line from driver to pickup
        if (driverLocation) {
          routeLineRef.current = new google.maps.Polyline({
            path: [
              new google.maps.LatLng(driverLocation.lat, driverLocation.lng),
              pos,
            ],
            map: map.current,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.7,
            strokeWeight: 3,
            icons: [{
              icon: {
                path: 'M 0,-1 0,1',
                strokeOpacity: 1,
                scale: 3,
              },
              offset: '0',
              repeat: '16px',
            }],
            zIndex: 8,
          });
        }
      } else {
        pickupMarkerRef.current.setPosition(pos);
      }

      // Update route line to follow driver
      if (routeLineRef.current && driverLocation) {
        routeLineRef.current.setPath([
          new google.maps.LatLng(driverLocation.lat, driverLocation.lng),
          pos,
        ]);
      }

      // Remove dropoff marker if present
      if (dropoffMarkerRef.current) {
        dropoffMarkerRef.current.setMap(null);
        dropoffMarkerRef.current = null;
      }
      if (dropoffPulseRef.current) { dropoffPulseRef.current.setMap(null); dropoffPulseRef.current = null; }
      if (dropoffPulseAnimRef.current) { clearInterval(dropoffPulseAnimRef.current); dropoffPulseAnimRef.current = null; }

      // Fit bounds to show both driver and pickup (always updated dynamically)
      if (driverLocation) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(new google.maps.LatLng(driverLocation.lat, driverLocation.lng));
        bounds.extend(pos);
        map.current.fitBounds(bounds, { top: 80, bottom: bottomPadding, left: 40, right: 40 });
      }
    }
    // === Dropoff marker (in_progress) ===
    else if (status === 'in_progress' && activeRide?.dropoff_location) {
      const dLoc = activeRide.dropoff_location;
      const pos = new google.maps.LatLng(dLoc.lat, dLoc.lng);

      // Remove pickup marker
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setMap(null);
        pickupMarkerRef.current = null;
      }

      if (!dropoffMarkerRef.current) {
        dropoffMarkerRef.current = new google.maps.Marker({
          position: pos,
          map: map.current,
          title: activeRide.dropoff_address || 'الوجهة',
          icon: createDropoffMarkerIcon(),
          zIndex: 15,
          animation: google.maps.Animation.DROP,
        });
      } else {
        dropoffMarkerRef.current.setPosition(pos);
      }

      // Update route line: driver → dropoff
      if (driverLocation) {
        if (routeLineRef.current) {
          routeLineRef.current.setPath([
            new google.maps.LatLng(driverLocation.lat, driverLocation.lng),
            pos,
          ]);
          routeLineRef.current.setOptions({ strokeColor: '#5bdda6' });
        } else {
          routeLineRef.current = new google.maps.Polyline({
            path: [
              new google.maps.LatLng(driverLocation.lat, driverLocation.lng),
              pos,
            ],
            map: map.current,
            strokeColor: '#5bdda6',
            strokeOpacity: 0.7,
            strokeWeight: 3,
            icons: [{
              icon: {
                path: 'M 0,-1 0,1',
                strokeOpacity: 1,
                scale: 3,
              },
              offset: '0',
              repeat: '16px',
            }],
            zIndex: 8,
          });
        }
      }

      // Fit bounds (always updated dynamically)
      if (driverLocation) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(new google.maps.LatLng(driverLocation.lat, driverLocation.lng));
        bounds.extend(pos);
        map.current.fitBounds(bounds, { top: 80, bottom: bottomPadding, left: 40, right: 40 });
      }
    } else {
      clearRideMarkers();
      lastFitBoundsRideRef.current = null;
    }

    return () => {
      // Cleanup only if ride ends — markers are managed in the effect body
    };
  }, [
    isMapReady,
    activeRide?.status,
    activeRide?.pickup_location?.lat,
    activeRide?.pickup_location?.lng,
    activeRide?.dropoff_location?.lat,
    activeRide?.dropoff_location?.lng,
    driverLocation?.lat,
    driverLocation?.lng,
    currentRideRequest?.id,
    currentRideRequest?.pickup_location?.lat,
    currentRideRequest?.pickup_location?.lng,
    bottomPadding
  ]);

  const addDriverMarker = (location: { lat: number; lng: number }, heading: number = 0) => {
    if (!map.current || !window.google?.maps) return;

    try {
      driverMarker.current = new google.maps.Marker({
        position: new google.maps.LatLng(location.lat, location.lng),
        map: map.current,
        title: "السائق",
        icon: drawCarIcon(heading),
        zIndex: 10,
      });
    } catch (err) {
      console.error("DriverMap: addDriverMarker error", err);
    }
  };

  const addPulseCircles = (location: { lat: number; lng: number }) => {
    // Disabled to remove pulsing rings around the car marker
  };

  const removePulseCircles = () => {
    // Disabled
  };

  const updatePulseCirclesPosition = (location: { lat: number; lng: number }) => {
    // Disabled
  };

  const handleCenterOnDriver = () => {
    if (!isMapReady || !map.current || !driverLocation || !window.google?.maps) return;
    
    try {
      map.current.panTo(new google.maps.LatLng(driverLocation.lat, driverLocation.lng));
      map.current.setZoom(15);
    } catch (err) {
      console.error("DriverMap: centerOnDriver error", err);
    }
  };


  // عند فشل مصادقة Google Maps — شاشة خطأ أنيقة مع زر إعادة المحاولة
  if (authFailed) {
    return (
      <div className="absolute inset-0 bg-[#0b1326] flex items-center justify-center">
        <div className="text-center p-6 max-w-sm">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800/60 border border-slate-700/50 flex items-center justify-center">
            <WifiOff className="w-9 h-9 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">الخريطة غير متاحة</h3>
          <p className="text-sm text-slate-400 mb-5 leading-relaxed">
            تعذر تحميل خرائط Google. تحقق من اتصالك بالإنترنت أو أعد المحاولة.
          </p>
          <Button
            variant="outline"
            className="bg-[#5bdda6]/10 border-[#5bdda6]/30 text-[#5bdda6] hover:bg-[#5bdda6]/20 font-bold px-6"
            onClick={() => {
              googleMapsAuthFailedGlobal = false;
              setAuthFailed(false);
              setLoading(true);
              retryCountRef.current++;
              window.location.reload();
            }}
          >
            <RefreshCw className="w-4 h-4 ml-2" />
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative h-full bg-secondary/50 flex items-center justify-center">
        <div className="text-center p-4">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => {
              setError(null);
              setLoading(true);
              retryCountRef.current++;
              window.location.reload();
            }}
          >
            <RefreshCw className="w-4 h-4 ml-1" />
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      {loading && (
        <div className="absolute inset-0 z-10 bg-secondary/80 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}
      
      <div ref={mapContainer} className={`absolute inset-0 bg-gray-100 ${isMapReady ? 'visible' : 'invisible'}`} />
      
      {/* Right Controls — Emergency + Auto-Accept + My Location */}
      <div className="absolute top-20 right-4 z-[9999] flex flex-col items-end gap-3">



        {/* My Location */}
        <button
          className="w-12 h-12 flex items-center justify-center rounded-full border border-[#5bdda6]/30 outline-none ring-0 shadow-[0_0_20px_rgba(91,221,166,0.5)] transition-all bg-[#5bdda6] hover:bg-[#34d399] group disabled:opacity-40"
          onClick={handleCenterOnDriver}
          disabled={!driverLocation}
          title="موقعي"
        >
          <MapPin className="w-6 h-6 text-slate-950 group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default DriverMap;
