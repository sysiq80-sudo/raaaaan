/**
 * ران — صفحة حجز الرحلة (نسخة React Web مهاجرة)
 * منطق مأخوذ من riderStore + GoPage + BookingConfirmationView (الموبايل)
 * محوّل إلى React + Tailwind + shadcn/ui
 *
 * التدفق: اختيار الانطلاق → اختيار الوجهة → نوع المركبة → حساب الأجرة → حجز → تتبع
 */

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useFareCalculation } from "@/hooks/useFareCalculation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  MapPin,
  Navigation,
  Car,
  Banknote,
  Phone,
  Star,
  AlertCircle,
  ArrowLeft,
  Search,
  X,
  Check,
  CircleDot,
  Route,
} from "lucide-react";

/* ───────────────── Types (from mobile riderStore) ───────────────── */
type VehicleType = "economy" | "comfort" | "premium" | "women_only";
type PaymentMethod = "cash" | "wallet";
type RideStatus = "pending" | "accepted" | "arrived" | "in_progress" | "completed" | "cancelled";

interface LocationCoords {
  lat: number;
  lng: number;
}

interface ActiveRideInfo {
  id: string;
  status: RideStatus;
  pickup_address: string | null;
  dropoff_address: string | null;
  estimated_fare: number | null;
  distance_km: number | null;
  driver_name: string | null;
  driver_phone: string | null;
  driver_rating: number | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
}

/* ───────────────── Constants ───────────────── */
const VEHICLE_OPTIONS: {
  key: VehicleType;
  label: string;
  icon: string;
  desc: string;
}[] = [
  { key: "economy", label: "اقتصادي", icon: "🚗", desc: "رحلات يومية بأسعار معقولة" },
  { key: "comfort", label: "مريح", icon: "🚙", desc: "سيارات أكثر راحة ومساحة" },
  { key: "premium", label: "فاخر", icon: "🚘", desc: "سيارات فاخرة وتجربة مميزة" },
  { key: "women_only", label: "نسائي", icon: "🚕", desc: "سائقات نساء فقط" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "جاري البحث عن سائق...",
  accepted: "السائق في الطريق إليك",
  arrived: "السائق وصل — انزل الآن",
  in_progress: "الرحلة جارية",
  completed: "تمت الرحلة بنجاح!",
  cancelled: "تم إلغاء الرحلة",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-600",
  accepted: "text-blue-600",
  arrived: "text-violet-600",
  in_progress: "text-emerald-600",
  completed: "text-emerald-700",
  cancelled: "text-red-600",
};

const roundFare = (fare: number): number => Math.round(fare / 250) * 250;

/* ───────────────── Step enum ───────────────── */
type BookingStep = "pickup" | "dropoff" | "confirm" | "tracking";

/* ═══════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */
const RiderGoMigrated: React.FC = () => {
  const navigate = useNavigate();

  /* ── Booking state (mirrors riderStore) ── */
  const [step, setStep] = useState<BookingStep>("pickup");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCoords, setPickupCoords] = useState<LocationCoords | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffCoords, setDropoffCoords] = useState<LocationCoords | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>("economy");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [routeDistance, setRouteDistance] = useState<number | null>(null);

  /* ── UI state ── */
  const [booking, setBooking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cancelDialog, setCancelDialog] = useState(false);

  /* ── Active ride tracking ── */
  const [activeRide, setActiveRide] = useState<ActiveRideInfo | null>(null);

  /* ── Fare calculation (existing hook) ── */
  const { fareBreakdown, fareLoading } = useFareCalculation(
    pickupCoords,
    dropoffCoords,
    vehicleType,
    routeDistance,
  );

  /* ── Geolocation on mount ── */
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPickupCoords(coords);
        setPickupAddress(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
      },
      () => {
        /* ignore — user can enter manually */
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  /* ── Check for existing active ride on mount ── */
  useEffect(() => {
    const checkActiveRide = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ridesTable = supabase.from("rides") as any;

      const { data } = await ridesTable
        .select("id, status, pickup_address, dropoff_address, estimated_fare, distance_km, driver_id")
        .eq("rider_id", user.id)
        .in("status", ["pending", "accepted", "arrived", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const ride = await enrichRideWithDriver(data);
        setActiveRide(ride);
        setStep("tracking");
      }
    };
    checkActiveRide();
  }, []);

  /* ── Enrich ride with driver info ── */
  const enrichRideWithDriver = async (rideData: Record<string, unknown>): Promise<ActiveRideInfo> => {
    let driverName: string | null = null;
    let driverPhone: string | null = null;
    let driverRating: number | null = null;
    let vehicleModel: string | null = null;
    let vehiclePlate: string | null = null;

    if (rideData.driver_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const driversTable = supabase.from("drivers") as any;
      const { data: driverData } = await driversTable
        .select("full_name, phone, rating, vehicle_model, vehicle_plate")
        .eq("user_id", rideData.driver_id)
        .maybeSingle();

      if (driverData) {
        driverName = driverData.full_name;
        driverPhone = driverData.phone;
        driverRating = driverData.rating;
        vehicleModel = driverData.vehicle_model;
        vehiclePlate = driverData.vehicle_plate;
      }
    }

    return {
      id: rideData.id as string,
      status: rideData.status as RideStatus,
      pickup_address: (rideData.pickup_address as string) || null,
      dropoff_address: (rideData.dropoff_address as string) || null,
      estimated_fare: (rideData.estimated_fare as number) || null,
      distance_km: (rideData.distance_km as number) || null,
      driver_name: driverName,
      driver_phone: driverPhone,
      driver_rating: driverRating,
      vehicle_model: vehicleModel,
      vehicle_plate: vehiclePlate,
    };
  };

  /* ── Realtime subscription for ride updates ── */
  useEffect(() => {
    if (!activeRide) return;

    const channel = supabase
      .channel(`ride-track-${activeRide.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rides", filter: `id=eq.${activeRide.id}` },
        async (payload) => {
          const updated = payload.new as Record<string, unknown>;
          const newStatus = updated.status as RideStatus;

          if (newStatus === "completed" || newStatus === "cancelled") {
            setActiveRide(null);
            setStep("pickup");
            resetTrip();
            return;
          }

          const ride = await enrichRideWithDriver(updated);
          setActiveRide(ride);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRide?.id]);

  /* ── Distance estimation (straight-line × 1.4 as road factor) ── */
  useEffect(() => {
    if (!pickupCoords || !dropoffCoords) {
      setRouteDistance(null);
      return;
    }

    const R = 6371;
    const dLat = ((dropoffCoords.lat - pickupCoords.lat) * Math.PI) / 180;
    const dLng = ((dropoffCoords.lng - pickupCoords.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((pickupCoords.lat * Math.PI) / 180) *
        Math.cos((dropoffCoords.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const straightLine = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    setRouteDistance(Math.round(straightLine * 1.4 * 10) / 10);
  }, [pickupCoords, dropoffCoords]);

  /* ── Reset trip ── */
  const resetTrip = useCallback(() => {
    setPickupAddress("");
    setPickupCoords(null);
    setDropoffAddress("");
    setDropoffCoords(null);
    setRouteDistance(null);
    setVehicleType("economy");
    setPaymentMethod("cash");
    setErrorMsg(null);
  }, []);

  /* ── Handle booking ── */
  const handleBookRide = async () => {
    setErrorMsg(null);

    if (!pickupCoords || !dropoffCoords) {
      setErrorMsg("يرجى تحديد نقطة الانطلاق والوجهة");
      return;
    }



    if (!fareBreakdown || fareBreakdown.total_fare <= 0) {
      setErrorMsg("لم يتم حساب الأجرة بعد");
      return;
    }

    setBooking(true);

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      setErrorMsg("يجب تسجيل الدخول أولاً");
      setBooking(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ridesTable = supabase.from("rides") as any;

    // تأكد من عدم وجود رحلة نشطة
    const { data: existing } = await ridesTable
      .select("id")
      .eq("rider_id", user.id)
      .in("status", ["pending", "accepted", "arrived", "in_progress"])
      .limit(1)
      .maybeSingle();

    if (existing) {
      setErrorMsg("لديك رحلة نشطة بالفعل");
      setBooking(false);
      return;
    }

    const { data: newRide, error: insertErr } = await ridesTable.insert({
      rider_id: user.id,
      status: "pending",
      pickup_lat: pickupCoords.lat,
      pickup_lng: pickupCoords.lng,
      pickup_address: pickupAddress || null,
      dropoff_lat: dropoffCoords.lat,
      dropoff_lng: dropoffCoords.lng,
      dropoff_address: dropoffAddress || null,
      vehicle_type: vehicleType,
      payment_method: paymentMethod,
      estimated_fare: fareBreakdown.total_fare,
      distance_km: routeDistance,
    }).select("id, status, pickup_address, dropoff_address, estimated_fare, distance_km").single();

    if (insertErr || !newRide) {
      setErrorMsg("فشل إنشاء الرحلة — حاول مرة أخرى");
      setBooking(false);
      return;
    }

    // استدعاء match-ride edge function
    try {
      await supabase.functions.invoke("match-ride", { body: { ride_id: newRide.id } });
    } catch {
      // لا نوقف — النظام سيطابق لاحقاً
    }

    setActiveRide({
      ...newRide,
      driver_name: null,
      driver_phone: null,
      driver_rating: null,
      vehicle_model: null,
      vehicle_plate: null,
    });
    setStep("tracking");
    setBooking(false);
  };

  /* ── Cancel ride ── */
  const handleCancelRide = async () => {
    if (!activeRide) return;
    setCancelDialog(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ridesTable = supabase.from("rides") as any;

    await ridesTable.update({ status: "cancelled" }).eq("id", activeRide.id);
    setActiveRide(null);
    setStep("pickup");
    resetTrip();
  };

  /* ── Parse coordinate string (user types "lat, lng") ── */
  const parseCoordInput = (val: string): LocationCoords | null => {
    const parts = val.split(",").map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && isFinite(parts[0]) && isFinite(parts[1])) {
      return { lat: parts[0], lng: parts[1] };
    }
    return null;
  };



  /* ── fare display ── */
  const fareDisplay = fareBreakdown
    ? roundFare(fareBreakdown.total_fare).toLocaleString('en-US')
    : null;

  /* ═══════════════ JSX ═══════════════ */
  return (
    <div className="min-h-full bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rider")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">
          {step === "tracking" ? "تتبع الرحلة" : "حجز رحلة (React)"}
        </h1>
      </div>

      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">

        {/* Error */}
        {errorMsg && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>خطأ</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {/* ━━━━━━━━━━ STEP: PICKUP ━━━━━━━━━━ */}
        {step === "pickup" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CircleDot className="h-5 w-5 text-emerald-500" />
                نقطة الانطلاق
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>العنوان أو الإحداثيات (lat, lng)</Label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pr-10"
                    placeholder="مثال: 33.312, 44.366 أو اسم المكان"
                    value={pickupAddress}
                    onChange={(e) => {
                      setPickupAddress(e.target.value);
                      const coords = parseCoordInput(e.target.value);
                      if (coords) setPickupCoords(coords);
                    }}
                  />
                </div>
                {pickupCoords && (
                  <p className="text-xs text-emerald-600">
                    <Check className="inline h-3 w-3 ml-1" />
                    تم تحديد الموقع: {pickupCoords.lat.toFixed(4)}, {pickupCoords.lng.toFixed(4)}
                  </p>
                )}
              </div>
              <Button
                className="w-full"
                disabled={!pickupCoords}
                onClick={() => setStep("dropoff")}
              >
                التالي — تحديد الوجهة
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ━━━━━━━━━━ STEP: DROPOFF ━━━━━━━━━━ */}
        {step === "dropoff" && (
          <>
            {/* ملخص الانطلاق */}
            <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2">
              <CircleDot className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="truncate">{pickupAddress || "نقطة الانطلاق"}</span>
              <Button variant="ghost" size="sm" className="mr-auto" onClick={() => setStep("pickup")}>
                تعديل
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-500" />
                  الوجهة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>العنوان أو الإحداثيات (lat, lng)</Label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pr-10"
                      placeholder="مثال: 33.340, 44.400 أو اسم المكان"
                      value={dropoffAddress}
                      onChange={(e) => {
                        setDropoffAddress(e.target.value);
                        const coords = parseCoordInput(e.target.value);
                        if (coords) setDropoffCoords(coords);
                      }}
                    />
                  </div>
                  {dropoffCoords && (
                    <p className="text-xs text-blue-600">
                      <Check className="inline h-3 w-3 ml-1" />
                      تم تحديد الوجهة: {dropoffCoords.lat.toFixed(4)}, {dropoffCoords.lng.toFixed(4)}
                    </p>
                  )}
                </div>
                <Button
                  className="w-full"
                  disabled={!dropoffCoords}
                  onClick={() => setStep("confirm")}
                >
                  التالي — تأكيد الحجز
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {/* ━━━━━━━━━━ STEP: CONFIRM ━━━━━━━━━━ */}
        {step === "confirm" && (
          <>
            {/* ملخص المسار */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start gap-2">
                  <CircleDot className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">الانطلاق</p>
                    <p className="text-sm font-medium">{pickupAddress || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">الوجهة</p>
                    <p className="text-sm font-medium">{dropoffAddress || "—"}</p>
                  </div>
                </div>
                {routeDistance && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Route className="h-4 w-4" />
                    المسافة التقريبية: {routeDistance} كم
                  </div>
                )}
                <Button variant="ghost" size="sm" onClick={() => setStep("pickup")}>
                  تعديل المسار
                </Button>
              </CardContent>
            </Card>

            {/* اختيار نوع المركبة (من Mobile BookingConfirmation) */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  نوع المركبة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {VEHICLE_OPTIONS.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => setVehicleType(v.key)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-right ${
                      vehicleType === v.key
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-2xl">{v.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{v.label}</p>
                      <p className="text-xs text-muted-foreground">{v.desc}</p>
                    </div>
                    {vehicleType === v.key && (
                      <Check className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* طريقة الدفع */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Banknote className="h-5 w-5" />
                  طريقة الدفع
                </CardTitle>
              </CardHeader>
              <CardContent className="flex gap-3">
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex-1 p-3 rounded-lg border text-center transition-colors ${
                    paymentMethod === "cash"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <Banknote className="h-5 w-5 mx-auto mb-1" />
                  <span className="text-sm font-medium">نقداً</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("wallet")}
                  className={`flex-1 p-3 rounded-lg border text-center transition-colors ${
                    paymentMethod === "wallet"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <Star className="h-5 w-5 mx-auto mb-1" />
                  <span className="text-sm font-medium">المحفظة</span>
                </button>
              </CardContent>
            </Card>

            {/* الأجرة المقدرة */}
            <Card className="border-primary/30">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">الأجرة المقدرة</span>
                  {fareLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : fareDisplay ? (
                    <span className="text-2xl font-bold text-primary">{fareDisplay} د.ع</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                {fareBreakdown && (
                  <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                    <div className="flex justify-between">
                      <span>أجرة الأساس</span>
                      <span>{fareBreakdown.base_fare.toLocaleString('en-US')} د.ع</span>
                    </div>
                    <div className="flex justify-between">
                      <span>أجرة المسافة ({fareBreakdown.distance_km.toFixed(1)} كم)</span>
                      <span>{fareBreakdown.distance_fare.toLocaleString('en-US')} د.ع</span>
                    </div>
                    <div className="flex justify-between">
                      <span>معامل المركبة</span>
                      <span>×{fareBreakdown.vehicle_multiplier}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* زر الحجز */}
            <Button
              className="w-full h-14 text-lg"
              disabled={booking || !fareBreakdown}
              onClick={handleBookRide}
            >
              {booking ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  جاري الحجز...
                </span>
              ) : (
                `احجز الآن — ${fareDisplay || "..."} د.ع`
              )}
            </Button>
          </>
        )}

        {/* ━━━━━━━━━━ STEP: TRACKING ━━━━━━━━━━ */}
        {step === "tracking" && activeRide && (
          <>
            {/* حالة الرحلة */}
            <Card className="border-2 border-primary/30">
              <CardContent className="pt-5 text-center space-y-3">
                {activeRide.status === "pending" && (
                  <Loader2 className="h-10 w-10 mx-auto animate-spin text-amber-500" />
                )}
                {activeRide.status !== "pending" && (
                  <Navigation className="h-10 w-10 mx-auto text-blue-500" />
                )}
                <p className={`text-lg font-bold ${STATUS_COLORS[activeRide.status] || ""}`}>
                  {STATUS_LABELS[activeRide.status] || activeRide.status}
                </p>
              </CardContent>
            </Card>

            {/* معلومات السائق */}
            {activeRide.driver_name && (
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{activeRide.driver_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {activeRide.vehicle_model} • {activeRide.vehicle_plate}
                      </p>
                      {activeRide.driver_rating && (
                        <p className="text-sm flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-amber-500" />
                          {activeRide.driver_rating.toFixed(1)}
                        </p>
                      )}
                    </div>
                    {activeRide.driver_phone && (
                      <a
                        href={`tel:${activeRide.driver_phone}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                      >
                        <Phone className="h-4 w-4" />
                        اتصال
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* تفاصيل الرحلة */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <CircleDot className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                  <span>{activeRide.pickup_address || "نقطة الانطلاق"}</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                  <span>{activeRide.dropoff_address || "الوجهة"}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">الأجرة المقدرة</span>
                  <span className="font-bold text-primary">
                    {activeRide.estimated_fare
                      ? `${roundFare(activeRide.estimated_fare).toLocaleString('en-US')} د.ع`
                      : "—"}
                  </span>
                </div>
                {activeRide.distance_km && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">المسافة</span>
                    <span>{activeRide.distance_km.toFixed(1)} كم</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* إلغاء الرحلة */}
            {(activeRide.status === "pending" || activeRide.status === "accepted") && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setCancelDialog(true)}
              >
                <X className="h-4 w-4 ml-2" />
                إلغاء الرحلة
              </Button>
            )}
          </>
        )}
      </div>

      {/* Cancel dialog */}
      <Dialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إلغاء الرحلة</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من إلغاء الرحلة؟ قد يتم فرض رسوم إلغاء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelDialog(false)}>
              لا، ابقِها
            </Button>
            <Button variant="destructive" onClick={handleCancelRide}>
              نعم، ألغِ الرحلة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RiderGoMigrated;
