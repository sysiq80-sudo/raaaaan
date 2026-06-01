/**
 * ران كابتن — لوحة تحكم السائق (نسخة React Web مهاجرة)
 * منطق مأخوذ من driverStore + ActiveRideCard + RideRequestCard (الموبايل)
 * محوّل إلى React + Tailwind + shadcn/ui
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Power,
  MapPin,
  Navigation,
  Star,
  Car,
  Clock,
  Banknote,
  Phone,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

/* ─── Types ─── */
interface DriverInfo {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  vehicle_type: string;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  status: string;
  is_online: boolean;
  is_available: boolean;
  rating: number | null;
  total_rides: number | null;
}

interface TodayStats {
  rides: number;
  earnings: number;
  onlineMinutes: number;
}

interface ActiveRide {
  id: string;
  status: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  estimated_fare: number | null;
  distance_km: number | null;
  rider_name: string | null;
  rider_phone: string | null;
  started_at: string | null;
}

interface RecentRide {
  id: string;
  status: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  final_fare: number | null;
  completed_at: string | null;
}

/* ─── Constants (من الموبايل) ─── */
const STATUS_LABELS: Record<string, string> = {
  accepted: "متجه للعميل",
  arrived: "في انتظار العميل",
  in_progress: "الرحلة جارية",
};

const STATUS_COLORS: Record<string, string> = {
  accepted: "bg-blue-500",
  arrived: "bg-amber-500",
  in_progress: "bg-emerald-500",
};

const roundFare = (fare: number): number => Math.round(fare / 250) * 250;

/* ─── Component ─── */
const DriverDashboardMigrated: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [todayStats, setTodayStats] = useState<TodayStats>({ rides: 0, earnings: 0, onlineMinutes: 0 });
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [recentRides, setRecentRides] = useState<RecentRide[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState("00:00");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ─── Fetch driver info ─── */
  const fetchDriver = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      setErrorMsg("تعذر جلب بيانات المستخدم.");
      setLoading(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const driversTable = supabase.from("drivers") as any;

    const { data, error } = await driversTable
      .select("id, user_id, full_name, phone, vehicle_type, vehicle_model, vehicle_plate, status, is_online, is_available, rating, total_rides")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) {
      setErrorMsg("لم يتم العثور على حساب سائق لهذا المستخدم.");
      setLoading(false);
      return;
    }

    setDriver(data as DriverInfo);
    await Promise.all([
      fetchTodayStats(data.id),
      fetchActiveRide(data.id),
      fetchRecentRides(data.id),
    ]);
    setLoading(false);
  }, []);

  /* ─── Today stats ─── */
  const fetchTodayStats = async (driverId: string) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ridesTable = supabase.from("rides") as any;

    const { data } = await ridesTable
      .select("final_fare, completed_at")
      .eq("driver_id", driverId)
      .eq("status", "completed")
      .gte("completed_at", todayStart.toISOString());

    if (data && data.length > 0) {
      const earnings = data.reduce((sum: number, r: Record<string, unknown>) => sum + (Number(r.final_fare) || 0), 0);
      setTodayStats({ rides: data.length, earnings, onlineMinutes: 0 });
    }
  };

  /* ─── Active ride ─── */
  const fetchActiveRide = async (driverId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ridesTable = supabase.from("rides") as any;

    const { data } = await ridesTable
      .select("id, status, pickup_address, dropoff_address, estimated_fare, distance_km, rider_id, started_at")
      .eq("driver_id", driverId)
      .in("status", ["accepted", "arrived", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      // جلب اسم وهاتف الراكب
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profilesTable = supabase.from("profiles") as any;
      const { data: riderProfile } = await profilesTable
        .select("full_name, phone")
        .eq("user_id", data.rider_id)
        .maybeSingle();

      setActiveRide({
        ...data,
        rider_name: riderProfile?.full_name || null,
        rider_phone: riderProfile?.phone || null,
      });
    } else {
      setActiveRide(null);
    }
  };

  /* ─── Recent rides ─── */
  const fetchRecentRides = async (driverId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ridesTable = supabase.from("rides") as any;

    const { data } = await ridesTable
      .select("id, status, pickup_address, dropoff_address, final_fare, completed_at")
      .eq("driver_id", driverId)
      .in("status", ["completed", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) setRecentRides(data as RecentRide[]);
  };

  /* ─── Toggle online ─── */
  const handleToggleOnline = async () => {
    if (!driver || toggling) return;
    setToggling(true);
    setErrorMsg(null);

    const newStatus = !driver.is_online;

    if (newStatus) {
      // التحقق من الرصيد والحد الأدنى المسموح للعمل (سقف الديون)
      const [settingsRes, monRes, walletRes] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", "commission").maybeSingle(),
        supabase.from("app_settings").select("value").eq("key", "monetization").maybeSingle(),
        // جلب رصيد محفظة السائق (driver_wallets وليس profiles)
        supabase.from("driver_wallets" as any).select("balance").eq("driver_id", driver.id).maybeSingle(),
      ]);

      // @ts-ignore
      const monetizationMode = monRes.data?.value?.mode || "commission";
      // @ts-ignore
      const debtLimit = monRes.data?.value?.debt_limit ?? -15000;
      // @ts-ignore
      const commissionMinBalance = settingsRes.data?.value?.min_driver_balance ?? -10000;
      
      // اختيار سقف الدين حسب النموذج المالي
      const minBalance = monetizationMode === "daily_subscription" ? debtLimit : commissionMinBalance;
      // @ts-ignore
      const currentBalance = walletRes.data?.balance ?? 0;

      if (currentBalance < minBalance) {
        setToggling(false);
        setErrorMsg(
          monetizationMode === "daily_subscription"
            ? `لا يمكنك العمل. رصيدك الحالي (${currentBalance.toLocaleString('en-US')} د.ع) وصل لسقف الدين المسموح (${minBalance.toLocaleString('en-US')} د.ع). يرجى تسديد المبالغ المستحقة.`
            : `لا يمكنك العمل. رصيدك الحالي (${currentBalance.toLocaleString('en-US')} د.ع) أقل من الحد المسموح للعمل (${minBalance.toLocaleString('en-US')} د.ع). يرجى شحن محفظتك أولاً.`
        );
        return;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const driversTable = supabase.from("drivers") as any;

    const { error } = await driversTable
      .update({ is_online: newStatus, is_available: newStatus })
      .eq("id", driver.id);

    if (!error) {
      setDriver((prev) => prev ? { ...prev, is_online: newStatus, is_available: newStatus } : null);
    }
    setToggling(false);
  };

  /* ─── Update ride status ─── */
  const handleUpdateRideStatus = async (newStatus: string) => {
    if (!activeRide || !driver) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ridesTable = supabase.from("rides") as any;

    const updatePayload: Record<string, unknown> = { status: newStatus };
    if (newStatus === "in_progress") updatePayload.started_at = new Date().toISOString();
    if (newStatus === "completed") updatePayload.completed_at = new Date().toISOString();

    const { error } = await ridesTable
      .update(updatePayload)
      .eq("id", activeRide.id);

    if (!error) {
      if (newStatus === "completed") {
        setActiveRide(null);
        if (driver) {
          fetchTodayStats(driver.id);
          fetchRecentRides(driver.id);
        }
      } else {
        setActiveRide((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    }
  };

  /* ─── Elapsed timer (from mobile ActiveRideCard) ─── */
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (activeRide?.status === "in_progress" && activeRide.started_at) {
      timerRef.current = setInterval(() => {
        const start = new Date(activeRide.started_at!).getTime();
        const diff = Math.floor((Date.now() - start) / 1000);
        const mins = Math.floor(diff / 60).toString().padStart(2, "0");
        const secs = (diff % 60).toString().padStart(2, "0");
        setElapsedTime(`${mins}:${secs}`);
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeRide?.status, activeRide?.started_at]);

  /* ─── Realtime subscription (from mobile) ─── */
  useEffect(() => {
    if (!driver) return;

    const channel = supabase
      .channel(`driver-dash-${driver.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rides", filter: `driver_id=eq.${driver.id}` },
        () => { fetchActiveRide(driver.id); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver?.id]);

  /* ─── Init ─── */
  useEffect(() => { fetchDriver(); }, [fetchDriver]);

  /* ─── Render helpers ─── */
  const statusLabel = activeRide ? (STATUS_LABELS[activeRide.status] || activeRide.status) : "";
  const statusColor = activeRide ? (STATUS_COLORS[activeRide.status] || "bg-slate-500") : "";

  const nextAction = activeRide
    ? activeRide.status === "accepted"
      ? { label: "وصلت للموقع", next: "arrived" }
      : activeRide.status === "arrived"
        ? { label: "بدأ الركوب", next: "in_progress" }
        : activeRide.status === "in_progress"
          ? { label: "تم الوصول - إنهاء", next: "completed" }
          : null
    : null;

  /* ─── JSX ─── */
  return (
    <div className="min-h-full bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/driver")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">لوحة التحكم (React)</h1>
        </div>
        {driver && (
          <div className="flex items-center gap-2">
            <Label htmlFor="online-toggle" className="text-sm">
              {driver.is_online ? "متصل" : "غير متصل"}
            </Label>
            <Switch
              id="online-toggle"
              checked={driver.is_online}
              onCheckedChange={handleToggleOnline}
              disabled={toggling}
            />
          </div>
        )}
      </div>

      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            جاري تحميل بيانات السائق...
          </div>
        )}

        {/* Error */}
        {errorMsg && !loading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>خطأ</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {/* Driver info + status */}
        {driver && !loading && (
          <>
            {/* بطاقة معلومات السائق */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Car className="h-5 w-5" />
                  {driver.full_name}
                </CardTitle>
                <CardDescription className="flex items-center gap-4 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-amber-500" />
                    {driver.rating?.toFixed(1) || "—"}
                  </span>
                  <span>{driver.vehicle_type} • {driver.vehicle_model || "—"}</span>
                  <span>{driver.vehicle_plate || "—"}</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${driver.is_online ? "bg-emerald-500/15 text-emerald-600" : "bg-slate-500/15 text-slate-500"}`}>
                    <Power className="h-3 w-3" />
                    {driver.is_online ? "متصل" : "غير متصل"}
                  </span>
                </CardDescription>
              </CardHeader>
            </Card>

            {/* إحصائيات اليوم (من driverStore الموبايل) */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <Navigation className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                  <p className="text-2xl font-bold">{todayStats.rides}</p>
                  <p className="text-xs text-muted-foreground">رحلات اليوم</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <Banknote className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
                  <p className="text-2xl font-bold">{todayStats.earnings > 0 ? roundFare(todayStats.earnings).toLocaleString('en-US') : "0"}</p>
                  <p className="text-xs text-muted-foreground">أرباح اليوم (د.ع)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <Clock className="h-5 w-5 mx-auto text-violet-500 mb-1" />
                  <p className="text-2xl font-bold">{driver.total_rides || 0}</p>
                  <p className="text-xs text-muted-foreground">إجمالي الرحلات</p>
                </CardContent>
              </Card>
            </div>

            {/* الرحلة النشطة (من ActiveRideCard الموبايل) */}
            {activeRide && (
              <Card className="border-2 border-primary/40">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusColor}`} />
                      {statusLabel}
                    </CardTitle>
                    {activeRide.status === "in_progress" && (
                      <span className="text-lg font-mono font-bold tabular-nums">{elapsedTime}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* معلومات الراكب */}
                  {activeRide.rider_name && (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{activeRide.rider_name}</span>
                      {activeRide.rider_phone && (
                        <a href={`tel:${activeRide.rider_phone}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                          <Phone className="h-3.5 w-3.5" />
                          اتصال
                        </a>
                      )}
                    </div>
                  )}

                  {/* العناوين */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="mt-1 w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>{activeRide.pickup_address || "نقطة الانطلاق"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-1 w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                      <span>{activeRide.dropoff_address || "الوجهة"}</span>
                    </div>
                  </div>

                  {/* السعر والمسافة */}
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                    <span className="text-lg font-bold text-primary">
                      {activeRide.estimated_fare ? `${roundFare(activeRide.estimated_fare).toLocaleString('en-US')} د.ع` : "—"}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {activeRide.distance_km ? `${activeRide.distance_km.toFixed(1)} كم` : ""}
                    </span>
                  </div>

                  {/* زر التقدم */}
                  {nextAction && (
                    <Button className="w-full" size="lg" onClick={() => handleUpdateRideStatus(nextAction.next)}>
                      {nextAction.label}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* لا توجد رحلة نشطة */}
            {!activeRide && driver.is_online && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <MapPin className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">أنت متصل — بانتظار طلبات الرحلات</p>
                  <p className="text-sm mt-1">ستظهر أي رحلة جديدة هنا تلقائياً</p>
                </CardContent>
              </Card>
            )}

            {!activeRide && !driver.is_online && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Power className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">غير متصل</p>
                  <p className="text-sm mt-1">فعّل الاتصال لبدء استقبال طلبات الرحلات</p>
                  <Button className="mt-4" onClick={handleToggleOnline} disabled={toggling}>
                    {toggling ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                    اتصل الآن
                  </Button>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* آخر الرحلات (من RecentRides المشابه في الموبايل) */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">آخر الرحلات</CardTitle>
              </CardHeader>
              <CardContent>
                {recentRides.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد رحلات سابقة بعد</p>
                ) : (
                  <div className="space-y-3">
                    {recentRides.map((ride) => (
                      <div key={ride.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium truncate max-w-[200px]">
                            {ride.pickup_address || "—"} → {ride.dropoff_address || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {ride.completed_at ? new Date(ride.completed_at).toLocaleString("ar-IQ", { dateStyle: "short", timeStyle: "short" }) : "—"}
                          </p>
                        </div>
                        <div className="text-left">
                          <span className={`text-sm font-bold ${ride.status === "completed" ? "text-emerald-600" : "text-red-500"}`}>
                            {ride.status === "completed" && ride.final_fare
                              ? `${roundFare(ride.final_fare).toLocaleString('en-US')} د.ع`
                              : ride.status === "cancelled" ? "ملغاة" : "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* روابط سريعة */}
            <div className="grid grid-cols-2 gap-3 pb-8">
              <Button variant="outline" className="h-12" onClick={() => navigate("/driver/rides")}>
                <Navigation className="h-4 w-4 ml-2" />
                كل الرحلات
              </Button>
              <Button variant="outline" className="h-12" onClick={() => navigate("/driver/finance")}>
                <Banknote className="h-4 w-4 ml-2" />
                المالية
              </Button>
              <Button variant="outline" className="h-12" onClick={() => navigate("/driver/profile")}>
                <Car className="h-4 w-4 ml-2" />
                الملف الشخصي
              </Button>
              <Button variant="outline" className="h-12" onClick={() => navigate("/driver/settings")}>
                <Star className="h-4 w-4 ml-2" />
                الإعدادات
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DriverDashboardMigrated;
