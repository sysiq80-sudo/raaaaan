/**
 * صفحة تتبع الرحلة المباشرة — Live Ride Tracking Page
 * 
 * صفحة عامة (بدون تسجيل دخول) تُعرض عبر رابط المشاركة
 * تستخدم Supabase Realtime للاشتراك بتحديثات موقع السائق لحظة بلحظة
 * 
 * المسار: /track/:token
 */

import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { MapPin, Navigation, Car, Clock, User, Shield, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Map from "@/components/Map";

// ══════════════════════════════════════════
// Types
// ══════════════════════════════════════════

interface DriverInfo {
  full_name: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_plate: string;
  rating: number | null;
  current_location: { lat: number; lng: number } | null;
}

interface LiveLocation {
  location: { lat: number; lng: number };
  heading: number | null;
  speed: number | null;
  updated_at: string;
}

interface RideData {
  id: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  estimated_fare: number | null;
  vehicle_type: string | null;
  driver: DriverInfo | null;
  live_location: LiveLocation | null;
}

// ══════════════════════════════════════════
// Constants
// ══════════════════════════════════════════

const statusLabels: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: "في انتظار سائق", color: "bg-yellow-500", icon: "⏳" },
  accepted: { label: "الكابتن في الطريق", color: "bg-blue-500", icon: "🚗" },
  arrived: { label: "الكابتن وصل", color: "bg-purple-500", icon: "📍" },
  in_progress: { label: "الرحلة جارية", color: "bg-green-500", icon: "🚀" },
  completed: { label: "الرحلة مكتملة", color: "bg-gray-500", icon: "✅" },
  cancelled: { label: "الرحلة ملغاة", color: "bg-red-500", icon: "❌" },
};

const vehicleTypeLabels: Record<string, string> = {
  economy: "اقتصادي",
  comfort: "مريح",
  premium: "فاخر",
  women_only: "نسائي",
};

// ══════════════════════════════════════════
// Component
// ══════════════════════════════════════════

export default function TrackRide() {
  const { token } = useParams<{ token: string }>();
  const [ride, setRide] = useState<RideData | null>(null);
  const [driverLiveLocation, setDriverLiveLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // ── جلب بيانات الرحلة ──
  const fetchRide = useCallback(async () => {
    if (!token) {
      setError("رابط غير صالح");
      setLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await supabase
        .rpc("get_ride_by_share_token", { p_token: token });

      if (rpcError) {
        console.error("[TrackRide] RPC error:", rpcError);
        setError("حدث خطأ أثناء تحميل بيانات الرحلة");
        setLoading(false);
        return;
      }

      const result = data as { success: boolean; error?: string; ride?: any };

      if (!result?.success) {
        setError(result?.error || "رابط غير صالح أو منتهي الصلاحية");
        setLoading(false);
        return;
      }

      const rideData = result.ride;
      const parsedRide: RideData = {
        id: rideData.id,
        status: rideData.status,
        pickup_address: rideData.pickup_address,
        dropoff_address: rideData.dropoff_address,
        pickup_location: rideData.pickup_location as { lat: number; lng: number },
        dropoff_location: rideData.dropoff_location as { lat: number; lng: number },
        estimated_fare: rideData.estimated_fare,
        vehicle_type: rideData.vehicle_type,
        driver: rideData.driver
          ? {
              full_name: rideData.driver.full_name,
              vehicle_model: rideData.driver.vehicle_model,
              vehicle_color: rideData.driver.vehicle_color,
              vehicle_plate: rideData.driver.vehicle_plate,
              rating: rideData.driver.rating,
              current_location: rideData.driver.current_location as {
                lat: number;
                lng: number;
              } | null,
            }
          : null,
        live_location: rideData.live_location || null,
      };

      setRide(parsedRide);

      // تحديد الموقع الأولي للسائق
      if (parsedRide.live_location?.location) {
        setDriverLiveLocation(parsedRide.live_location.location);
        setLastUpdate(parsedRide.live_location.updated_at);
      }

      setLoading(false);
    } catch (err) {
      console.error("[TrackRide] Fetch error:", err);
      setError("حدث خطأ غير متوقع");
      setLoading(false);
    }
  }, [token]);

  // ── جلب البيانات عند التحميل ──
  useEffect(() => {
    fetchRide();
  }, [fetchRide]);

  // ── تحديث دوري عبر RPCs آمنة (بديل عن Realtime المباشر) ──
  // بعد إغلاق RLS على driver_live_locations، Realtime لن يعمل لزوار /track/:token
  // لذلك نستخدم polling عبر RPCs كل 5 ثوانٍ — أكثر أماناً وأقل تعقيداً
  useEffect(() => {
    if (!token || !ride?.id || ["completed", "cancelled"].includes(ride?.status || "")) return;

    setIsConnected(true); // نعتبر الاتصال نشطاً طالما polling يعمل

    const interval = setInterval(async () => {
      try {
        // 1. تحديث موقع السائق عبر RPC آمن
        const { data: locData } = await supabase
          .rpc("get_live_location_by_token", { p_token: token });

        const locResult = locData as { success: boolean; location?: any; heading?: number; speed?: number; updated_at?: string };
        if (locResult?.success && locResult?.location) {
          const loc = typeof locResult.location === "string"
            ? JSON.parse(locResult.location)
            : locResult.location;
          if (loc?.lat && loc?.lng) {
            setDriverLiveLocation({ lat: loc.lat, lng: loc.lng });
            setLastUpdate(locResult.updated_at || new Date().toISOString());
          }
        }

        // 2. تحديث حالة الرحلة عبر RPC آمن
        const { data: rideData } = await supabase
          .rpc("get_ride_by_share_token", { p_token: token });

        const rideResult = rideData as { success: boolean; ride?: any };
        if (rideResult?.success && rideResult?.ride?.status) {
          setRide((prev) =>
            prev && prev.status !== rideResult.ride.status
              ? { ...prev, status: rideResult.ride.status }
              : prev
          );
        }
      } catch {
        // تجاهل أخطاء الـ polling الفردية
      }
    }, 15000); // ✅ FIX: كان 5000ms (حمل مضاعف) — 15s كافية لمتابعة الموقع

    return () => {
      clearInterval(interval);
      setIsConnected(false);
    };
  }, [token, ride?.id, ride?.status]);


  // ── حساب وقت آخر تحديث ──
  const getTimeSinceUpdate = () => {
    if (!lastUpdate) return null;
    const diff = Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 1000);
    if (diff < 10) return "الآن";
    if (diff < 60) return `منذ ${diff} ثانية`;
    if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
    return "غير متاح";
  };

  // ══════════════════════════════════════════
  // Loading State
  // ══════════════════════════════════════════

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Car className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <Loader2 className="absolute -top-1 -right-1 h-6 w-6 text-primary animate-spin" />
          </div>
          <p className="text-muted-foreground text-sm">جاري تحميل بيانات الرحلة...</p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════
  // Error State
  // ══════════════════════════════════════════

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white dark:from-gray-900 dark:to-gray-800 p-4" dir="rtl">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="text-6xl mb-4">😔</div>
            <h2 className="text-xl font-bold mb-2 text-foreground">عذراً</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-none text-sm font-medium hover:bg-primary/90 transition w-full justify-center h-12"
            >
              <RefreshCw className="h-4 w-4" />
              إعادة المحاولة
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ride) return null;

  const status = statusLabels[ride.status] || { label: ride.status, color: "bg-gray-500", icon: "❓" };
  const timeSinceUpdate = getTimeSinceUpdate();
  const isActiveRide = ["accepted", "arrived", "in_progress"].includes(ride.status);

  // ══════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800" dir="rtl">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-4 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Car className="h-5 w-5" />
              تتبع الرحلة مباشرة
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`${status.color} text-white text-xs`}>
                {status.icon} {status.label}
              </Badge>
              {isActiveRide && isConnected && (
                <span className="flex items-center gap-1 text-xs opacity-80">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  متصل مباشر
                </span>
              )}
            </div>
          </div>
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Shield className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* ── Map ── */}
      <div className="h-[45vh] relative">
        <Map
          pickupLocation={ride.pickup_location}
          dropoffLocation={ride.dropoff_location}
          driverLocation={driverLiveLocation || ride.driver?.current_location || undefined}
          showRoute={true}
          centerOnDriver={isActiveRide}
        />

        {/* مؤشر التحديث المباشر */}
        {isActiveRide && timeSinceUpdate && (
          <div className="absolute bottom-3 right-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`} />
            <span className="text-muted-foreground">آخر تحديث: {timeSinceUpdate}</span>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="max-w-2xl mx-auto p-4 space-y-4 -mt-4 relative z-10">

        {/* ── Driver Info ── */}
        {ride.driver && (
          <Card className="shadow-lg border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg truncate">{ride.driver.full_name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                    <Car className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">
                      {ride.driver.vehicle_color} {ride.driver.vehicle_model}
                    </span>
                  </div>
                  {ride.driver.rating && (
                    <div className="flex items-center gap-1 text-sm text-yellow-600 mt-1">
                      <span>⭐</span>
                      <span>{ride.driver.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <div className="bg-muted rounded-lg px-3 py-2 text-center flex-shrink-0">
                  <p className="text-xs text-muted-foreground">رقم اللوحة</p>
                  <p className="font-mono font-bold text-sm">{ride.driver.vehicle_plate}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Pending Status - No Driver Yet ── */}
        {ride.status === "pending" && (
          <Card className="shadow-lg border-0 border-r-4 border-r-yellow-500">
            <CardContent className="p-4 text-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 text-yellow-500 animate-spin" />
                <div>
                  <p className="font-bold text-base">جاري البحث عن سائق</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    سيتم إشعارك فور قبول سائق لرحلتك
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Ride Locations ── */}
        <Card className="shadow-md border-0">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium">نقطة الانطلاق</p>
                <p className="font-medium text-sm truncate">{ride.pickup_address || "غير محدد"}</p>
              </div>
            </div>

            <div className="border-r-2 border-dashed border-muted mr-4 h-3" />

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Navigation className="h-4 w-4 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium">الوجهة</p>
                <p className="font-medium text-sm truncate">{ride.dropoff_address || "غير محدد"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Trip Details ── */}
        {(ride.estimated_fare || ride.vehicle_type) && (
          <Card className="shadow-md border-0">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {ride.estimated_fare && (
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">الأجرة المتوقعة</p>
                    <p className="font-bold text-primary text-lg">{Math.round(ride.estimated_fare).toLocaleString('en-US')}</p>
                    <p className="text-[10px] text-muted-foreground">دينار عراقي</p>
                  </div>
                )}
                {ride.vehicle_type && (
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">نوع المركبة</p>
                    <p className="font-bold text-sm mt-1">
                      {vehicleTypeLabels[ride.vehicle_type] || ride.vehicle_type}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Completed / Cancelled Message ── */}
        {ride.status === "completed" && (
          <Card className="shadow-lg border-0 border-r-4 border-r-green-500">
            <CardContent className="p-4 text-center">
              <p className="text-4xl mb-2">✅</p>
              <p className="font-bold text-lg">الحمد لله على السلامة!</p>
              <p className="text-sm text-muted-foreground mt-1">تم إكمال الرحلة بنجاح</p>
            </CardContent>
          </Card>
        )}

        {ride.status === "cancelled" && (
          <Card className="shadow-lg border-0 border-r-4 border-r-red-500">
            <CardContent className="p-4 text-center">
              <p className="text-4xl mb-2">❌</p>
              <p className="font-bold text-lg">تم إلغاء الرحلة</p>
            </CardContent>
          </Card>
        )}

        {/* ── Footer ── */}
        <div className="text-center pb-6">
          <p className="text-xs text-muted-foreground">
            {isActiveRide ? "🔴 يتم تحديث الموقع تلقائياً لحظة بلحظة" : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            تطبيق <span className="font-bold">ران</span> — رحلتك أمان 🚕
          </p>
        </div>
      </div>
    </div>
  );
}
