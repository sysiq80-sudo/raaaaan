/**
 * ران — مقارنة محركات التوجيه والبحث
 * صفحة أدمن لمقارنة نتائج التوجيه (OSRM/Haversine) والبحث (Nominatim/Photon/Google Places)
 * يسمح للمدير باختبار المسارات والبحث الحقيقي وتبديل المحرك الأساسي
 */

import { useState, useCallback, useRef } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Route,
  MapPin,
  Navigation,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  ArrowLeftRight,
  Star,
  RefreshCw,
  ShieldCheck,
  Info,
  Search,
  Globe,
  Sparkles,
} from "lucide-react";
import {
  OSRMRoutingAdapter,
  HaversineRoutingAdapter,
  NominatimGeocodingAdapter,
  PhotonGeocodingAdapter,
  GooglePlacesGeocodingAdapter,
  ADAPTER_CONFIG,
  RAMADI_CENTER,
  FALLUJAH_CENTER,
  updateAdapterConfig,
} from "@/lib/adapters";
import type { RoutingProvider, RouteResult, Coordinate, PlacePrediction, GeocodingProvider } from "@/lib/adapters";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";

// ════════════════════════════════════════════════════════════
// الوجهات المحفوظة — مسارات شائعة في الأنبار
// ════════════════════════════════════════════════════════════

interface SavedRoute {
  id: string;
  name: string;
  pickup: Coordinate & { label: string };
  dropoff: Coordinate & { label: string };
}

const SAVED_ROUTES: SavedRoute[] = [
  {
    id: "ramadi-fallujah",
    name: "الرمادي → الفلوجة",
    pickup: { ...RAMADI_CENTER, label: "الرمادي" },
    dropoff: { ...FALLUJAH_CENTER, label: "الفلوجة" },
  },
  {
    id: "ramadi-habbaniyah",
    name: "الرمادي → الحبانية",
    pickup: { ...RAMADI_CENTER, label: "الرمادي" },
    dropoff: { lat: 33.3733, lng: 43.5686, label: "الحبانية" },
  },
  {
    id: "ramadi-center",
    name: "رحلة داخلية (الرمادي)",
    pickup: { lat: 33.4281, lng: 43.3119, label: "مركز الرمادي" },
    dropoff: { lat: 33.4155, lng: 43.2841, label: "حي التأميم" },
  },
  {
    id: "fallujah-center",
    name: "رحلة داخلية (الفلوجة)",
    pickup: { lat: 33.3534, lng: 43.7758, label: "مركز الفلوجة" },
    dropoff: { lat: 33.3401, lng: 43.7975, label: "المجمع السكني" },
  },
];

// ════════════════════════════════════════════════════════════
// أنواع البيانات — التوجيه
// ════════════════════════════════════════════════════════════

interface ProviderTestResult {
  provider: RoutingProvider;
  label: string;
  status: "idle" | "loading" | "success" | "error";
  result: RouteResult | null;
  error: string | null;
  durationMs: number | null;
  cost: string;
  description: string;
}

const PROVIDER_INFO: Record<
  RoutingProvider,
  { label: string; cost: string; description: string; color: string; icon: typeof Route }
> = {
  osrm: {
    label: "OSRM",
    cost: "مجاني 100%",
    description: "Open Source Routing Machine — مسارات حقيقية عبر OpenStreetMap",
    color: "text-emerald-600",
    icon: Route,
  },
  haversine: {
    label: "Haversine",
    cost: "مجاني (حساب رياضي)",
    description: "حساب مسافة خط مستقيم × 1.35 — بدون API أو إنترنت",
    color: "text-amber-600",
    icon: Navigation,
  },
  google: {
    label: "Google Directions",
    cost: "$5 / 1000 طلب",
    description: "Google Maps Directions API — الأدق لكن الأغلى",
    color: "text-red-600",
    icon: MapPin,
  },
};

// ════════════════════════════════════════════════════════════
// أنواع البيانات — البحث (Geocoding)
// ════════════════════════════════════════════════════════════

type GeoProvider = 'nominatim' | 'photon' | 'google';

interface GeoTestResult {
  provider: GeoProvider;
  label: string;
  status: "idle" | "loading" | "success" | "error";
  results: PlacePrediction[];
  error: string | null;
  durationMs: number | null;
  cost: string;
  description: string;
}

const GEO_PROVIDER_INFO: Record<
  GeoProvider,
  { label: string; cost: string; description: string; color: string; icon: typeof Route }
> = {
  nominatim: {
    label: "Nominatim (OSM)",
    cost: "مجاني 100%",
    description: "OpenStreetMap — بحث مجاني عربي بدون مفتاح",
    color: "text-emerald-600",
    icon: Globe,
  },
  photon: {
    label: "Photon",
    cost: "مجاني 100%",
    description: "Photon by Komoot — بحث سريع مبني على OSM",
    color: "text-blue-600",
    icon: Search,
  },
  google: {
    label: "Google Places (New)",
    cost: "~$2.83 / 1000 طلب",
    description: "Google Places API (New) — الأدق مع Text Search",
    color: "text-red-600",
    icon: Sparkles,
  },
};

// ════════════════════════════════════════════════════════════
// المكوّن الرئيسي
// ════════════════════════════════════════════════════════════

const AdminRoutingComparison = () => {
  const { toast } = useToast();
  const { loading: authLoading, isAdmin } = useAdminAuth();
  const { apiKey: googleApiKey } = useGoogleMapsApiKey();

  // الإحداثيات
  const [pickupLat, setPickupLat] = useState(RAMADI_CENTER.lat.toString());
  const [pickupLng, setPickupLng] = useState(RAMADI_CENTER.lng.toString());
  const [dropoffLat, setDropoffLat] = useState(FALLUJAH_CENTER.lat.toString());
  const [dropoffLng, setDropoffLng] = useState(FALLUJAH_CENTER.lng.toString());
  const [selectedRoute, setSelectedRoute] = useState("ramadi-fallujah");

  // نتائج التوجيه
  const [results, setResults] = useState<ProviderTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeProvider, setActiveProvider] = useState<RoutingProvider>(
    (ADAPTER_CONFIG.routing?.primary as RoutingProvider) || "osrm"
  );

  // نتائج البحث (Geocoding)
  const [geoQuery, setGeoQuery] = useState("مستشفى الرمادي");
  const [geoResults, setGeoResults] = useState<GeoTestResult[]>([]);
  const [isGeoRunning, setIsGeoRunning] = useState(false);

  // Adapters refs
  const osrmRef = useRef<OSRMRoutingAdapter | null>(null);
  const haversineRef = useRef<HaversineRoutingAdapter | null>(null);
  const nominatimRef = useRef<NominatimGeocodingAdapter | null>(null);
  const photonRef = useRef<PhotonGeocodingAdapter | null>(null);
  const googlePlacesRef = useRef<GooglePlacesGeocodingAdapter | null>(null);

  // ════════════════════════════════════════════════════════════
  // اختيار مسار محفوظ
  // ════════════════════════════════════════════════════════════

  const handleRouteSelect = (routeId: string) => {
    setSelectedRoute(routeId);
    const route = SAVED_ROUTES.find((r) => r.id === routeId);
    if (route) {
      setPickupLat(route.pickup.lat.toString());
      setPickupLng(route.pickup.lng.toString());
      setDropoffLat(route.dropoff.lat.toString());
      setDropoffLng(route.dropoff.lng.toString());
    }
  };

  // ════════════════════════════════════════════════════════════
  // تبديل المحرك الأساسي
  // ════════════════════════════════════════════════════════════

  const handleSetActiveProvider = useCallback(
    (provider: RoutingProvider) => {
      if (provider === "google") {
        toast({
          title: "Google Directions غير متوفر",
          description: "يحتاج API key مفعّل — استخدم OSRM أو Haversine",
          variant: "destructive",
        });
        return;
      }

      updateAdapterConfig({
        routing: {
          primary: provider,
          fallback:
            provider === "osrm"
              ? (["haversine"] as RoutingProvider[])
              : (["osrm", "haversine"] as RoutingProvider[]),
          timeout: ADAPTER_CONFIG.routing?.timeout || 8000,
        },
      });

      setActiveProvider(provider);
      toast({
        title: `✅ تم تبديل المحرك الأساسي إلى ${PROVIDER_INFO[provider].label}`,
        description: "سيُطبّق على جميع الرحلات الجديدة فوراً",
      });
    },
    [toast]
  );

  // ════════════════════════════════════════════════════════════
  // تشغيل المقارنة
  // ════════════════════════════════════════════════════════════

  const runComparison = useCallback(async () => {
    const origin: Coordinate = {
      lat: parseFloat(pickupLat),
      lng: parseFloat(pickupLng),
    };
    const destination: Coordinate = {
      lat: parseFloat(dropoffLat),
      lng: parseFloat(dropoffLng),
    };

    if (isNaN(origin.lat) || isNaN(origin.lng) || isNaN(destination.lat) || isNaN(destination.lng)) {
      toast({ title: "أدخل إحداثيات صحيحة", variant: "destructive" });
      return;
    }

    setIsRunning(true);

    // تهيئة النتائج
    const providers: RoutingProvider[] = ["osrm", "haversine"];
    const initialResults: ProviderTestResult[] = providers.map((p) => ({
      provider: p,
      label: PROVIDER_INFO[p].label,
      status: "loading" as const,
      result: null,
      error: null,
      durationMs: null,
      cost: PROVIDER_INFO[p].cost,
      description: PROVIDER_INFO[p].description,
    }));

    setResults(initialResults);

    // إنشاء adapters إن لم تكن موجودة
    if (!osrmRef.current) {
      osrmRef.current = new OSRMRoutingAdapter();
      await osrmRef.current.load();
    }
    if (!haversineRef.current) {
      haversineRef.current = new HaversineRoutingAdapter();
      await haversineRef.current.load();
    }

    // تشغيل كل adapter بالتوازي
    const testAdapter = async (
      provider: RoutingProvider,
      adapter: { getRoute: (o: Coordinate, d: Coordinate) => Promise<RouteResult> }
    ): Promise<ProviderTestResult> => {
      const info = PROVIDER_INFO[provider];
      const start = performance.now();
      try {
        const result = await adapter.getRoute(origin, destination);
        const elapsed = Math.round(performance.now() - start);
        return {
          provider,
          label: info.label,
          status: "success",
          result,
          error: null,
          durationMs: elapsed,
          cost: info.cost,
          description: info.description,
        };
      } catch (err: any) {
        const elapsed = Math.round(performance.now() - start);
        return {
          provider,
          label: info.label,
          status: "error",
          result: null,
          error: err instanceof Error ? err.message : "Unknown error",
          durationMs: elapsed,
          cost: info.cost,
          description: info.description,
        };
      }
    };

    const settled = await Promise.allSettled([
      testAdapter("osrm", osrmRef.current),
      testAdapter("haversine", haversineRef.current),
    ]);

    const finalResults = settled.map((s, i) => {
      if (s.status === "fulfilled") return s.value;
      return {
        ...initialResults[i],
        status: "error" as const,
        error: s.reason?.message || "Unknown",
        durationMs: 0,
      };
    });

    setResults(finalResults);
    setIsRunning(false);
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, toast]);

  // ════════════════════════════════════════════════════════════
  // تشغيل مقارنة البحث (Geocoding)
  // ════════════════════════════════════════════════════════════

  const runGeoComparison = useCallback(async () => {
    if (!geoQuery.trim()) {
      toast({ title: "أدخل نص بحث", variant: "destructive" });
      return;
    }

    setIsGeoRunning(true);

    const providers: GeoProvider[] = ["nominatim", "photon", "google"];
    const initialGeo: GeoTestResult[] = providers.map((p) => ({
      provider: p,
      label: GEO_PROVIDER_INFO[p].label,
      status: "loading" as const,
      results: [],
      error: null,
      durationMs: null,
      cost: GEO_PROVIDER_INFO[p].cost,
      description: GEO_PROVIDER_INFO[p].description,
    }));

    setGeoResults(initialGeo);

    // إنشاء adapters
    if (!nominatimRef.current) {
      nominatimRef.current = new NominatimGeocodingAdapter();
      await nominatimRef.current.load();
    }
    if (!photonRef.current) {
      photonRef.current = new PhotonGeocodingAdapter();
      await photonRef.current.load();
    }
    if (!googlePlacesRef.current) {
      googlePlacesRef.current = new GooglePlacesGeocodingAdapter(googleApiKey);
      await googlePlacesRef.current.load();
    } else {
      googlePlacesRef.current.setApiKey(googleApiKey);
    }

    const center = RAMADI_CENTER;

    const testGeo = async (
      provider: GeoProvider,
      adapter: { searchPlaces: (q: string, c?: Coordinate) => Promise<PlacePrediction[]> }
    ): Promise<GeoTestResult> => {
      const info = GEO_PROVIDER_INFO[provider];
      const start = performance.now();
      try {
        const places = await adapter.searchPlaces(geoQuery, center);
        const elapsed = Math.round(performance.now() - start);
        return {
          provider,
          label: info.label,
          status: "success",
          results: places,
          error: null,
          durationMs: elapsed,
          cost: info.cost,
          description: info.description,
        };
      } catch (err: any) {
        const elapsed = Math.round(performance.now() - start);
        return {
          provider,
          label: info.label,
          status: "error",
          results: [],
          error: err instanceof Error ? err.message : "Unknown error",
          durationMs: elapsed,
          cost: info.cost,
          description: info.description,
        };
      }
    };

    const settled = await Promise.allSettled([
      testGeo("nominatim", nominatimRef.current),
      testGeo("photon", photonRef.current),
      testGeo("google", googlePlacesRef.current),
    ]);

    const finalGeo = settled.map((s, i) => {
      if (s.status === "fulfilled") return s.value;
      return {
        ...initialGeo[i],
        status: "error" as const,
        error: s.reason?.message || "Unknown",
        durationMs: 0,
      };
    });

    setGeoResults(finalGeo);
    setIsGeoRunning(false);
  }, [geoQuery, googleApiKey, toast]);

  // ════════════════════════════════════════════════════════════
  // حالات التحميل
  // ════════════════════════════════════════════════════════════

  if (authLoading) {
    return (
      <AdminLayout title="مقارنة محركات التوجيه" subtitle="جاري التحقق...">
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLayout title="غير مصرح" subtitle="لا تملك صلاحية الوصول">
        <div className="text-center py-20 text-muted-foreground">
          <ShieldCheck className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <p className="text-lg">هذه الصفحة متاحة فقط للمديرين</p>
        </div>
      </AdminLayout>
    );
  }

  // ════════════════════════════════════════════════════════════
  // حساب الفروقات
  // ════════════════════════════════════════════════════════════

  const successResults = results.filter((r) => r.status === "success" && r.result);
  const bestDistance =
    successResults.length > 0
      ? Math.min(...successResults.map((r) => r.result!.distance))
      : 0;
  const bestDuration =
    successResults.length > 0
      ? Math.min(...successResults.map((r) => r.result!.duration))
      : 0;
  const bestResponseTime =
    successResults.length > 0
      ? Math.min(...successResults.map((r) => r.durationMs || Infinity))
      : 0;

  // ════════════════════════════════════════════════════════════
  // العرض
  // ════════════════════════════════════════════════════════════

  return (
    <AdminLayout
      title="مقارنة محركات التوجيه"
      subtitle="قارن نتائج OSRM و Haversine واختر الأفضل لتطبيقك"
      actions={
        <Badge variant="outline" className="text-xs gap-1">
          <Zap className="w-3 h-3" />
          المحرك الحالي: {PROVIDER_INFO[activeProvider]?.label || activeProvider}
        </Badge>
      }
    >
      {/* ═══════ إعدادات الاختبار ═══════ */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="w-5 h-5 text-primary" />
            إعدادات المسار التجريبي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* اختيار مسار محفوظ */}
            <div>
              <Label className="text-xs font-medium mb-2 block">مسار محفوظ</Label>
              <Select value={selectedRoute} onValueChange={handleRouteSelect}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="اختر مسار..." />
                </SelectTrigger>
                <SelectContent>
                  {SAVED_ROUTES.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* أو إدخال يدوي */}
            <div className="flex items-end">
              <Button
                onClick={runComparison}
                disabled={isRunning}
                className="w-full h-9 gap-2"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري المقارنة...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="w-4 h-4" />
                    شغّل المقارنة
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* إحداثيات */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div>
              <Label className="text-[10px] text-muted-foreground">خط عرض الانطلاق</Label>
              <Input
                className="h-8 text-xs font-mono"
                dir="ltr"
                value={pickupLat}
                onChange={(e) => setPickupLat(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">خط طول الانطلاق</Label>
              <Input
                className="h-8 text-xs font-mono"
                dir="ltr"
                value={pickupLng}
                onChange={(e) => setPickupLng(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">خط عرض الوصول</Label>
              <Input
                className="h-8 text-xs font-mono"
                dir="ltr"
                value={dropoffLat}
                onChange={(e) => setDropoffLat(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">خط طول الوصول</Label>
              <Input
                className="h-8 text-xs font-mono"
                dir="ltr"
                value={dropoffLng}
                onChange={(e) => setDropoffLng(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════ المحرك الأساسي الحالي ═══════ */}
      <Card className="mb-6 border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-sm">المحرك الأساسي النشط</h3>
                <p className="text-xs text-muted-foreground">
                  {PROVIDER_INFO[activeProvider]?.label} — {PROVIDER_INFO[activeProvider]?.cost}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {(["osrm", "haversine"] as RoutingProvider[]).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={activeProvider === p ? "default" : "outline"}
                  className="h-8 text-xs gap-1.5"
                  onClick={() => handleSetActiveProvider(p)}
                >
                  {activeProvider === p && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {PROVIDER_INFO[p].label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════ نتائج المقارنة ═══════ */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {results.map((r) => {
            const info = PROVIDER_INFO[r.provider];
            const isActive = r.provider === activeProvider;
            const distanceKm = r.result ? r.result.distance / 1000 : 0;
            const durationMin = r.result ? Math.ceil(r.result.duration / 60) : 0;
            const isBestDistance = r.result && r.result.distance === bestDistance;
            const isBestDuration = r.result && r.result.duration === bestDuration;
            const isBestResponse = r.durationMs !== null && r.durationMs === bestResponseTime;

            return (
              <Card
                key={r.provider}
                className={`relative overflow-hidden transition-all duration-200 ${
                  isActive
                    ? "border-primary/50 ring-2 ring-primary/20"
                    : "border-border hover:border-primary/30"
                } ${r.status === "error" ? "border-red-300 bg-red-50/30" : ""}`}
              >
                {/* شريط علوي */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${
                    r.status === "success"
                      ? "bg-green-500"
                      : r.status === "error"
                      ? "bg-red-500"
                      : r.status === "loading"
                      ? "bg-yellow-500 animate-pulse"
                      : "bg-gray-300"
                  }`}
                />

                {/* Badge المحرك النشط */}
                {isActive && (
                  <div className="absolute top-3 left-3">
                    <Badge className="text-[9px] px-2 py-0.5 bg-primary gap-1">
                      <Star className="w-2.5 h-2.5" />
                      الأساسي
                    </Badge>
                  </div>
                )}

                <CardContent className="p-5 pt-6">
                  {/* رأس البطاقة */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`p-2.5 rounded-xl ${
                        r.status === "success"
                          ? "bg-green-100 text-green-600"
                          : r.status === "error"
                          ? "bg-red-100 text-red-600"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {r.status === "loading" ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : r.status === "success" ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : r.status === "error" ? (
                        <XCircle className="w-5 h-5" />
                      ) : (
                        <info.icon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-bold text-base ${info.color}`}>{info.label}</h3>
                      <p className="text-[11px] text-muted-foreground">{info.description}</p>
                    </div>
                  </div>

                  {/* التكلفة */}
                  <div className="flex items-center gap-1.5 mb-4">
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                      💰 {info.cost}
                    </Badge>
                    {r.durationMs !== null && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0.5 ${
                          isBestResponse
                            ? "border-green-300 text-green-700 bg-green-50"
                            : ""
                        }`}
                      >
                        ⚡ {r.durationMs}ms
                        {isBestResponse && " 🏆"}
                      </Badge>
                    )}
                  </div>

                  {/* النتائج */}
                  {r.status === "loading" && (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">جاري الحساب...</p>
                    </div>
                  )}

                  {r.status === "error" && (
                    <div className="bg-red-50 rounded-xl p-4 text-center">
                      <XCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
                      <p className="text-sm font-medium text-red-700 mb-1">فشل في الحساب</p>
                      <p className="text-xs text-red-500 font-mono" dir="ltr">
                        {r.error}
                      </p>
                    </div>
                  )}

                  {r.status === "success" && r.result && (
                    <div className="space-y-3">
                      {/* المسافة */}
                      <div
                        className={`flex items-center justify-between p-3 rounded-xl ${
                          isBestDistance
                            ? "bg-green-50 border border-green-200"
                            : "bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Route className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">المسافة</span>
                        </div>
                        <div className="text-left">
                          <span className="font-bold text-lg" dir="ltr">
                            {distanceKm.toFixed(1)}
                          </span>
                          <span className="text-xs text-muted-foreground mr-1">كم</span>
                          {isBestDistance && (
                            <span className="text-green-600 text-xs mr-1">🏆</span>
                          )}
                        </div>
                      </div>

                      {/* المدة */}
                      <div
                        className={`flex items-center justify-between p-3 rounded-xl ${
                          isBestDuration
                            ? "bg-green-50 border border-green-200"
                            : "bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">المدة التقريبية</span>
                        </div>
                        <div className="text-left">
                          <span className="font-bold text-lg">{durationMin}</span>
                          <span className="text-xs text-muted-foreground mr-1">دقيقة</span>
                          {isBestDuration && (
                            <span className="text-green-600 text-xs mr-1">🏆</span>
                          )}
                        </div>
                      </div>

                      {/* نقاط المسار */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                        <div className="flex items-center gap-2">
                          <Navigation className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">نقاط المسار</span>
                        </div>
                        <span className="font-mono text-sm font-medium">
                          {r.result.path.length}
                        </span>
                      </div>

                      {/* زر التفعيل */}
                      {!isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2 h-9 text-xs gap-1.5"
                          onClick={() => handleSetActiveProvider(r.provider)}
                        >
                          <Zap className="w-3.5 h-3.5" />
                          اعتمد {info.label} كمحرك أساسي
                        </Button>
                      )}
                      {isActive && (
                        <div className="flex items-center justify-center gap-1.5 text-primary text-xs font-medium mt-2">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          هذا هو المحرك الأساسي النشط
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══════ جدول المقارنة ═══════ */}
      {successResults.length > 1 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowLeftRight className="w-5 h-5 text-primary" />
              جدول المقارنة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" dir="rtl">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                      المحرك
                    </th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">
                      المسافة
                    </th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">
                      المدة
                    </th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">
                      سرعة الرد
                    </th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">
                      نقاط المسار
                    </th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">
                      التكلفة
                    </th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">
                      الحالة
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const distanceKm = r.result ? (r.result.distance / 1000).toFixed(1) : "—";
                    const durationMin = r.result
                      ? Math.ceil(r.result.duration / 60).toString()
                      : "—";
                    const isActive = r.provider === activeProvider;

                    return (
                      <tr
                        key={r.provider}
                        className={`border-b last:border-0 ${
                          isActive ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-bold ${
                                PROVIDER_INFO[r.provider].color
                              }`}
                            >
                              {PROVIDER_INFO[r.provider].label}
                            </span>
                            {isActive && (
                              <Badge className="text-[8px] px-1.5 py-0 h-4">
                                أساسي
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {distanceKm} كم
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {durationMin} د
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {r.durationMs ?? "—"}ms
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {r.result?.path.length ?? "—"}
                        </td>
                        <td className="py-3 px-3 text-center text-xs">
                          {PROVIDER_INFO[r.provider].cost}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {r.status === "success" ? (
                            <Badge
                              variant="outline"
                              className="text-[9px] border-green-300 text-green-700 bg-green-50"
                            >
                              شغّال ✅
                            </Badge>
                          ) : r.status === "error" ? (
                            <Badge
                              variant="outline"
                              className="text-[9px] border-red-300 text-red-700 bg-red-50"
                            >
                              فاشل ❌
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px]">
                              —
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* فارق المسافة */}
            {successResults.length === 2 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-center gap-2 text-blue-700">
                  <Info className="w-4 h-4 shrink-0" />
                  <p className="text-xs">
                    <strong>فارق المسافة:</strong>{" "}
                    {Math.abs(
                      successResults[0].result!.distance -
                        successResults[1].result!.distance
                    ) / 1000}{" "}
                    كم (
                    {(
                      (Math.abs(
                        successResults[0].result!.distance -
                          successResults[1].result!.distance
                      ) /
                        Math.max(
                          successResults[0].result!.distance,
                          successResults[1].result!.distance
                        )) *
                      100
                    ).toFixed(1)}
                    %)
                    {" · "}
                    <strong>فارق المدة:</strong>{" "}
                    {Math.abs(
                      successResults[0].result!.duration -
                        successResults[1].result!.duration
                    ) / 60}{" "}
                    دقيقة
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ═══════ قسم مقارنة البحث — Google Places API (New) ═══════ */}
      {/* ═══════════════════════════════════════════════════════════ */}

      <div className="border-t border-dashed border-border pt-8 mt-8 mb-6">
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          مقارنة محركات البحث (Geocoding)
        </h2>
        <p className="text-xs text-muted-foreground mb-5">
          قارن نتائج Nominatim و Photon و Google Places API (New) للبحث عن الأماكن
        </p>
      </div>

      {/* إعدادات البحث */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label className="text-xs font-medium mb-2 block">نص البحث</Label>
              <Input
                className="h-9 text-sm"
                placeholder="مثال: مستشفى الرمادي، جامعة الأنبار..."
                value={geoQuery}
                onChange={(e) => setGeoQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runGeoComparison()}
              />
            </div>
            <Button
              onClick={runGeoComparison}
              disabled={isGeoRunning}
              className="h-9 gap-2 shrink-0"
            >
              {isGeoRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري البحث...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  ابحث بالثلاثة
                </>
              )}
            </Button>
          </div>
          {!googleApiKey && (
            <div className="mt-3 p-2 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <p className="text-[11px] text-amber-700">
                مفتاح Google Maps غير متوفر — سيفشل اختبار Google Places. أضف المفتاح من{" "}
                <strong>ران المطور → خرائط جوجل</strong>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* نتائج البحث */}
      {geoResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {geoResults.map((g) => {
            const info = GEO_PROVIDER_INFO[g.provider];
            return (
              <Card
                key={g.provider}
                className={`relative overflow-hidden transition-all duration-200 ${
                  g.status === "error" ? "border-red-300 bg-red-50/30" : "border-border hover:border-primary/30"
                }`}
              >
                {/* شريط علوي */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${
                    g.status === "success"
                      ? "bg-green-500"
                      : g.status === "error"
                      ? "bg-red-500"
                      : g.status === "loading"
                      ? "bg-yellow-500 animate-pulse"
                      : "bg-gray-300"
                  }`}
                />

                <CardContent className="p-4 pt-5">
                  {/* رأس البطاقة */}
                  <div className="flex items-center gap-2.5 mb-3">
                    <div
                      className={`p-2 rounded-lg ${
                        g.status === "success"
                          ? "bg-green-100 text-green-600"
                          : g.status === "error"
                          ? "bg-red-100 text-red-600"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {g.status === "loading" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <info.icon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold text-sm ${info.color}`}>{info.label}</h3>
                      <p className="text-[10px] text-muted-foreground truncate">{info.description}</p>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                      💰 {info.cost}
                    </Badge>
                    {g.durationMs !== null && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                        ⚡ {g.durationMs}ms
                      </Badge>
                    )}
                    {g.status === "success" && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-green-300 text-green-700 bg-green-50">
                        {g.results.length} نتيجة
                      </Badge>
                    )}
                  </div>

                  {/* Loading */}
                  {g.status === "loading" && (
                    <div className="text-center py-6">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">جاري البحث...</p>
                    </div>
                  )}

                  {/* Error */}
                  {g.status === "error" && (
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <XCircle className="w-6 h-6 mx-auto mb-1 text-red-400" />
                      <p className="text-xs font-medium text-red-700 mb-0.5">فشل البحث</p>
                      <p className="text-[10px] text-red-500 font-mono" dir="ltr">
                        {g.error}
                      </p>
                    </div>
                  )}

                  {/* Results */}
                  {g.status === "success" && (
                    <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                      {g.results.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">لا توجد نتائج</p>
                      ) : (
                        g.results.slice(0, 5).map((place, idx) => (
                          <div
                            key={place.place_id + idx}
                            className="p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">{place.main_text}</p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {place.description}
                                </p>
                                {place.distance_meters && (
                                  <p className="text-[9px] text-muted-foreground mt-0.5" dir="ltr">
                                    📍 {(place.distance_meters / 1000).toFixed(1)} كم من المركز
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══════ ملاحظة مساعدة ═══════ */}
      <Card className="border-amber-200/60 bg-amber-50/30">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 space-y-1.5">
              <p className="font-bold">ملاحظات مهمة:</p>
              <ul className="list-disc list-inside space-y-1 text-amber-700">
                <li>
                  <strong>OSRM</strong> يعطي مسارات حقيقية عبر الطرق — الأفضل للسعر والدقة
                </li>
                <li>
                  <strong>Haversine</strong> حساب رياضي تقريبي (خط مستقيم × 1.35) — يعمل
                  بدون إنترنت لكن أقل دقة
                </li>
                <li>
                  <strong>Google Places (New)</strong> الأدق للبحث — ~$2.83/1000 طلب (Autocomplete) أو ~$5/1000 (Text Search)
                </li>
                <li>
                  <strong>Nominatim + Photon</strong> مجانيان 100% لكن دقة أقل في بعض المناطق العراقية
                </li>
                <li>
                  التبديل يُطبّق فوراً على الجلسة الحالية — لن يستمر بعد إعادة تحميل الصفحة
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default AdminRoutingComparison;
