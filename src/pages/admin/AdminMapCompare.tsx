/**
 * ران — صفحة مقارنة الخرائط
 * تعرض Google Maps و OpenStreetMap جنباً إلى جنب
 * + تحكم في مزوّد الخريطة الافتراضي للتطبيق
 */

import { useState, useEffect, useRef, useCallback } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Map, ArrowLeft, MapPin, Search, CheckCircle2, Loader2, 
  Layers, Navigation, Globe2, Satellite
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { NominatimGeocodingAdapter } from "@/lib/adapters/NominatimGeocodingAdapter";
import { SERVICE_URLS, RAMADI_CENTER } from "@/lib/adapters/config";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";

// ============================================================
// Types
// ============================================================

type MapProviderChoice = "google" | "osm";

interface GeocodedAddress {
  provider: string;
  address: string;
  time: number;
}

// ============================================================
// Component
// ============================================================

const AdminMapCompare = () => {
  const navigate = useNavigate();

  // Refs
  const googleContainerRef = useRef<HTMLDivElement>(null);
  const osmContainerRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const osmMapRef = useRef<L.Map | null>(null);
  const syncingRef = useRef(false);
  const nominatimRef = useRef<NominatimGeocodingAdapter | null>(null);

  // State
  const [center, setCenter] = useState(RAMADI_CENTER);
  const [zoom, setZoom] = useState(15);
  const [googleReady, setGoogleReady] = useState(false);
  const [osmReady, setOsmReady] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<MapProviderChoice>("osm");
  const [savingProvider, setSavingProvider] = useState(false);

  // Geocoding
  const [googleAddress, setGoogleAddress] = useState<GeocodedAddress | null>(null);
  const [osmAddress, setOsmAddress] = useState<GeocodedAddress | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  // ── تحميل الإعداد الحالي ──
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "map_provider")
          .maybeSingle();
        if (data?.value) {
          setActiveProvider(data.value as MapProviderChoice);
        }
      } catch {}
    })();
  }, []);

  // ── تحميل Nominatim ──
  useEffect(() => {
    const nom = new NominatimGeocodingAdapter();
    nom.load().then(() => { nominatimRef.current = nom; });
  }, []);

  // ── إنشاء خريطة Google ──
  useEffect(() => {
    if (!googleContainerRef.current || googleMapRef.current) return;

    (async () => {
      try {
        // قراءة API key من env أو app_settings
        let apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
        if (!apiKey) {
          try {
            const { data } = await supabase
              .from("app_settings")
              .select("value")
              .eq("key", "google_maps_api_key")
              .maybeSingle();
            apiKey = data?.value || "";
          } catch {}
        }
        if (!apiKey) {
          setGoogleError("مفتاح Google Maps غير متاح");
          return;
        }
        await loadGoogleMaps(apiKey);
        if (!window.google?.maps || !googleContainerRef.current) return;

        const map = new window.google.maps.Map(googleContainerRef.current, {
          center: { lat: center.lat, lng: center.lng },
          zoom,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
        });

        googleMapRef.current = map;
        setGoogleReady(true);

        // مزامنة عند تحريك Google
        map.addListener("idle", () => {
          if (syncingRef.current) return;
          const c = map.getCenter();
          const z = map.getZoom();
          if (!c || !z) return;
          syncingRef.current = true;
          const newCenter = { lat: c.lat(), lng: c.lng() };
          setCenter(newCenter);
          setZoom(z);
          // مزامنة OSM
          if (osmMapRef.current) {
            osmMapRef.current.setView([newCenter.lat, newCenter.lng], z, { animate: false });
          }
          setTimeout(() => { syncingRef.current = false; }, 100);
        });
      } catch (err: any) {
        setGoogleError(err.message || "فشل تحميل Google Maps");
      }
    })();
  }, []);

  // ── إنشاء خريطة OSM ──
  useEffect(() => {
    if (!osmContainerRef.current || osmMapRef.current) return;

    const map = L.map(osmContainerRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer(SERVICE_URLS.CARTODB_VOYAGER, {
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);

    osmMapRef.current = map;
    setOsmReady(true);

    // مزامنة عند تحريك OSM
    map.on("moveend", () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      const c = map.getCenter();
      const z = map.getZoom();
      const newCenter = { lat: c.lat, lng: c.lng };
      setCenter(newCenter);
      setZoom(z);
      // مزامنة Google
      if (googleMapRef.current) {
        googleMapRef.current.setCenter({ lat: newCenter.lat, lng: newCenter.lng });
        googleMapRef.current.setZoom(z);
      }
      setTimeout(() => { syncingRef.current = false; }, 100);
    });

    return () => {
      map.remove();
      osmMapRef.current = null;
    };
  }, []);

  // ── Reverse Geocode لكلتا الخريطتين ──
  const geocodeBoth = useCallback(async () => {
    setGeocoding(true);
    setGoogleAddress(null);
    setOsmAddress(null);

    const lat = center.lat;
    const lng = center.lng;

    // OSM (Nominatim)
    const osmStart = performance.now();
    try {
      const addr = await nominatimRef.current?.reverseGeocode(lat, lng);
      setOsmAddress({
        provider: "Nominatim (OSM)",
        address: addr || "لا يوجد عنوان",
        time: Math.round(performance.now() - osmStart),
      });
    } catch {
      setOsmAddress({ provider: "Nominatim (OSM)", address: "خطأ", time: 0 });
    }

    // Google
    const googleStart = performance.now();
    try {
      if (window.google?.maps) {
        const geocoder = new window.google.maps.Geocoder();
        const result = await geocoder.geocode({
          location: new window.google.maps.LatLng(lat, lng),
          language: "ar",
          region: "IQ",
        });
        const first = result?.results?.[0];
        setGoogleAddress({
          provider: "Google Geocoder",
          address: first?.formatted_address || "لا يوجد عنوان",
          time: Math.round(performance.now() - googleStart),
        });
      } else {
        setGoogleAddress({ provider: "Google Geocoder", address: "غير متاح", time: 0 });
      }
    } catch {
      setGoogleAddress({ provider: "Google Geocoder", address: "خطأ / REQUEST_DENIED", time: 0 });
    }

    setGeocoding(false);
  }, [center]);

  // ── حفظ الاختيار في قاعدة البيانات ──
  const saveProviderChoice = useCallback(async (provider: MapProviderChoice) => {
    setSavingProvider(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          { key: "map_provider", value: provider, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );

      if (error) throw error;

      setActiveProvider(provider);
      toast.success(
        provider === "osm"
          ? "تم اختيار OpenStreetMap كمزوّد الخرائط"
          : "تم اختيار Google Maps كمزوّد الخرائط"
      );
    } catch (err: any) {
      toast.error("فشل حفظ الإعداد: " + (err.message || "خطأ غير معروف"));
    } finally {
      setSavingProvider(false);
    }
  }, []);

  // ── موقعي الحالي ──
  const goToMyLocation = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCenter = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(newCenter);
        googleMapRef.current?.setCenter(newCenter);
        googleMapRef.current?.setZoom(16);
        osmMapRef.current?.setView([newCenter.lat, newCenter.lng], 16);
      },
      () => toast.error("لا يمكن الوصول للموقع"),
      { enableHighAccuracy: true }
    );
  }, []);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/settings")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Layers className="w-5 h-5" />
                مقارنة مزوّدي الخرائط
              </h1>
              <p className="text-xs text-muted-foreground">
                حرّك أي خريطة — الأخرى تتزامن تلقائياً
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToMyLocation} className="gap-1">
              <Navigation className="w-4 h-4" />
              موقعي
            </Button>
            <Button
              variant={geocoding ? "secondary" : "default"}
              size="sm"
              onClick={geocodeBoth}
              disabled={geocoding}
              className="gap-1"
            >
              {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              قارن العناوين
            </Button>
          </div>
        </div>
      </div>

      {/* Maps Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-1 relative" style={{ height: "calc(50vh)" }}>
        {/* Google Maps */}
        <div className="relative">
          <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
            <Badge className={`${googleReady ? 'bg-blue-600' : 'bg-gray-500'} text-white shadow-lg`}>
              <Globe2 className="w-3 h-3 ml-1" />
              Google Maps
            </Badge>
            {googleError && (
              <Badge variant="destructive" className="shadow-lg text-xs">{googleError}</Badge>
            )}
          </div>
          {/* Crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="w-4 h-4 border-2 border-red-500 rounded-full opacity-60" />
          </div>
          <div ref={googleContainerRef} className="w-full h-full bg-gray-100" />
          {!googleReady && !googleError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* OSM */}
        <div className="relative">
          <div className="absolute top-2 left-2 z-[1000] flex items-center gap-2">
            <Badge className="bg-emerald-600 text-white shadow-lg">
              <Map className="w-3 h-3 ml-1" />
              OpenStreetMap (CartoDB)
            </Badge>
          </div>
          {/* Crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
            <div className="w-4 h-4 border-2 border-emerald-500 rounded-full opacity-60" />
          </div>
          <div ref={osmContainerRef} className="w-full h-full" />
        </div>
      </div>

      {/* Comparison Results + Provider Selection */}
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Geocode Comparison */}
        {(googleAddress || osmAddress) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Google Result */}
            <Card className={`border-2 ${activeProvider === 'google' ? 'border-blue-500' : 'border-border'}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe2 className="w-4 h-4 text-blue-600" />
                  {googleAddress?.provider || "Google Geocoder"}
                  {googleAddress && (
                    <Badge variant="outline" className="mr-auto text-xs">
                      {googleAddress.time}ms
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm" dir="rtl">
                  {googleAddress?.address || <span className="text-muted-foreground">اضغط "قارن العناوين"</span>}
                </p>
              </CardContent>
            </Card>

            {/* OSM Result */}
            <Card className={`border-2 ${activeProvider === 'osm' ? 'border-emerald-500' : 'border-border'}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Map className="w-4 h-4 text-emerald-600" />
                  {osmAddress?.provider || "Nominatim (OSM)"}
                  {osmAddress && (
                    <Badge variant="outline" className="mr-auto text-xs">
                      {osmAddress.time}ms
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm" dir="rtl">
                  {osmAddress?.address || <span className="text-muted-foreground">اضغط "قارن العناوين"</span>}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Provider Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Satellite className="w-5 h-5" />
              اختيار مزوّد الخرائط الافتراضي
            </CardTitle>
            <CardDescription>
              هذا الإعداد يحدد أي خريطة تظهر للراكب والسائق في التطبيق
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* OSM */}
              <button
                onClick={() => saveProviderChoice("osm")}
                disabled={savingProvider}
                className={`relative p-4 rounded-xl border-2 transition-all text-right ${
                  activeProvider === "osm"
                    ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/20"
                    : "border-border hover:border-emerald-300"
                }`}
              >
                {activeProvider === "osm" && (
                  <CheckCircle2 className="absolute top-3 left-3 w-5 h-5 text-emerald-500" />
                )}
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Map className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold">OpenStreetMap</p>
                    <p className="text-xs text-muted-foreground">CartoDB Voyager</p>
                  </div>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 mt-3">
                  <li>✅ مجاني 100% — بلا فواتير</li>
                  <li>✅ لا يحتاج API Key</li>
                  <li>✅ Nominatim + OSRM جاهزين</li>
                  <li>⚠️ أسماء أماكن أقل اكتمالاً</li>
                </ul>
              </button>

              {/* Google */}
              <button
                onClick={() => saveProviderChoice("google")}
                disabled={savingProvider}
                className={`relative p-4 rounded-xl border-2 transition-all text-right ${
                  activeProvider === "google"
                    ? "border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/20"
                    : "border-border hover:border-blue-300"
                }`}
              >
                {activeProvider === "google" && (
                  <CheckCircle2 className="absolute top-3 left-3 w-5 h-5 text-blue-500" />
                )}
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Globe2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Google Maps</p>
                    <p className="text-xs text-muted-foreground">Maps JavaScript API</p>
                  </div>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 mt-3">
                  <li>✅ أسماء أماكن أغنى</li>
                  <li>✅ خريطة أجمل بصرياً</li>
                  <li>⚠️ يحتاج API Key مفعّل</li>
                  <li>⚠️ رسوم شهرية ($7+/1000 تحميل)</li>
                </ul>
              </button>
            </div>

            {savingProvider && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري حفظ الإعداد...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coordinates */}
        <div className="text-center text-xs text-muted-foreground pb-4">
          <MapPin className="w-3 h-3 inline ml-1" />
          {center.lat.toFixed(5)}, {center.lng.toFixed(5)} — zoom: {zoom}
        </div>
      </div>
    </div>
  );
};

export default AdminMapCompare;
