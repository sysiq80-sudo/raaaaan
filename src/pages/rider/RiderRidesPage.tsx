import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Navigation,
  Calendar,
  Clock,
  Star,
  Car,
  RefreshCw,
  Loader2,
  RotateCcw,
  ChevronLeft,
  Gauge,
  Timer,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import RiderPageHeader from "@/components/rider/RiderPageHeader";
import { getDriverDocumentUrl } from "@/utils/driverDocumentUrl";

interface DriverInfo {
  full_name: string;
  profile_image_url: string | null;
  vehicle_model: string | null;
}

interface RideHistory {
  id: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  status: string;
  final_fare: number | null;
  estimated_fare: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  vehicle_type: string | null;
  driver_id: string | null;
  created_at: string;
  completed_at: string | null;
  driver_rating: number | null;
  driver?: DriverInfo | null;
}

const resolveDriverAvatar = (pathOrUrl: string | null | undefined): string | null => {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http') || pathOrUrl.startsWith('data:')) {
    return pathOrUrl;
  }
  const { data } = supabase.storage.from("avatars").getPublicUrl(pathOrUrl);
  return data?.publicUrl || null;
};

const RiderRidesPage: React.FC = () => {
  const navigate = useNavigate();
  const [rides, setRides] = useState<RideHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "completed" | "cancelled">("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate("/auth?redirect=/rider/rides");
        return;
      }
      setUserId(data.user.id);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (userId) {
      fetchRides();
    }
  }, [userId, filter]);

  const fetchRides = async () => {
    if (!userId) return;
    setLoading(true);

    let query = supabase
      .from("rides")
      .select("*")
      .eq("rider_id", userId)
      .order("created_at", { ascending: false });

    if (filter === "completed") {
      query = query.eq("status", "completed");
    } else if (filter === "cancelled") {
      query = query.eq("status", "cancelled");
    }

    const { data, error } = await query.limit(50);

    if (!error && data) {
      // جلب أسماء السائقين بشكل منفصل
      const driverIds = [...new Set(data.map((r: any) => r.driver_id).filter(Boolean))] as string[];
      let driverMap: Map<string, { full_name: string; profile_image_url: string | null; vehicle_model: string | null }> = new Map();

      if (driverIds.length > 0) {
        console.log("RiderRidesPage: Fetching drivers for IDs:", driverIds);
        const { data: driversData, error: driversError } = await (supabase as any)
          .from("drivers")
          .select("id, full_name, profile_image_url, vehicle_model")
          .in("id", driverIds);

        if (driversError) {
          console.error("RiderRidesPage: Error fetching drivers:", driversError);
        } else {
          console.log("RiderRidesPage: Drivers fetched successfully:", driversData);
        }

        if (driversData) {
          driversData.forEach((d: any) => driverMap.set(d.id, d));
        }
      }
      
      console.log("RiderRidesPage: Final mapped rides with drivers:", data.map((ride: any) => ({
        id: ride.id,
        driver_id: ride.driver_id,
        driver: ride.driver_id ? (driverMap.get(ride.driver_id) ?? null) : null,
      })));

      setRides(
        data.map((ride: any) => ({
          ...ride,
          pickup_location: ride.pickup_location as { lat: number; lng: number },
          dropoff_location: ride.dropoff_location as { lat: number; lng: number },
          driver: ride.driver_id ? (driverMap.get(ride.driver_id) ?? null) : null,
        }))
      );
    }
    setLoading(false);
  };

  // ── حساب الإحصائيات من الرحلات المكتملة ──
  const stats = useMemo(() => {
    const completedRides = rides.filter((r) => r.status === "completed");
    const totalKm = completedRides.reduce((sum, r) => sum + (r.distance_km || 0), 0);
    const totalMinutes = completedRides.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
    const totalHours = Math.round(totalMinutes / 60);
    return {
      totalKm: Math.round(totalKm * 10) / 10,
      totalRides: completedRides.length,
      totalHours,
    };
  }, [rides]);

  // ── حساب الصفحات للرحلات (5 رحلات في الصفحة) ──
  const paginatedRides = useMemo(() => {
    const start = (currentPage - 1) * 5;
    return rides.slice(start, start + 5);
  }, [rides, currentPage]);

  const totalPages = Math.max(1, Math.ceil(rides.length / 5));

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string }> = {
      pending:     { label: "قيد الانتظار", color: "text-amber-400",   bg: "bg-amber-500/15 border-amber-500/30" },
      accepted:    { label: "تم القبول",   color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" },
      arrived:     { label: "وصل السائق",  color: "text-blue-400",    bg: "bg-blue-500/15 border-blue-500/30" },
      in_progress: { label: "جارية",       color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" },
      completed:   { label: "مكتملة",      color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
      cancelled:   { label: "ملغاة",       color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
    };
    return configs[status] || { label: status, color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20" };
  };

  const handleRebook = (ride: RideHistory) => {
    const savedPickup = {
      lat: ride.pickup_location.lat,
      lng: ride.pickup_location.lng,
      address: ride.pickup_address || "موقع الانطلاق",
    };
    const savedDropoff = {
      lat: ride.dropoff_location.lat,
      lng: ride.dropoff_location.lng,
      address: ride.dropoff_address || "الوجهة",
    };
    navigate("/rider/go", {
      state: {
        fromSavedPlace: true,
        preferredMode: "booking",
        savedPickup,
        savedDropoff,
      },
    });
  };

  const getDriverInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return parts[0][0] + parts[1][0];
    return parts[0][0] || "?";
  };

  const FILTERS = [
    { key: "cancelled" as const, label: "ملغاة" },
    { key: "completed" as const, label: "مكتملة" },
    { key: "all" as const, label: "الكل" },
  ];

  return (
    <div 
      className="flex flex-col min-h-full transition-colors duration-300" 
      style={{ 
        background: 'var(--raan-bg)',
        paddingTop: 'calc(4rem + env(safe-area-inset-top, 0px))'
      }} 
      dir="rtl"
    >
      <RiderPageHeader title="رحلاتي" />

      {/* ── التبويبات ── */}
      <div 
        className="pt-3 px-4 pb-3 sticky z-10 backdrop-blur-xl flex-shrink-0 transition-colors duration-300" 
        style={{ 
          background: 'var(--raan-bg)', 
          borderBottom: '1px solid var(--raan-border)',
          top: 'calc(4rem + env(safe-area-inset-top, 0px))'
        }}
      >
        <div className="flex gap-2 p-1 rounded-2xl bg-[#171f33] border border-slate-700/40">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-300 ${
                filter === f.key
                  ? "bg-[#5bdda6] text-[#0b1326] shadow-lg shadow-[#5bdda6]/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── المحتوى ── */}
      <div className="p-4 pb-8 space-y-4">

        {/* ── قسم الإحصائيات ── */}
        {!loading && rides.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-[#171f33] rounded-2xl border border-slate-700/40 p-4"
          >
            <div className="flex items-center justify-around">
              {/* ساعة مع ران */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-[#5bdda6]/10 flex items-center justify-center">
                  <Timer className="w-6 h-6 text-[#5bdda6]" />
                </div>
                <span className="text-white font-bold text-lg">{stats.totalHours}</span>
                <span className="text-slate-400 text-[11px]">ساعة مع ران</span>
              </div>

              {/* خط فاصل */}
              <div className="w-px h-16 bg-slate-700/50" />

              {/* رحلة مع ران */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-[#5bdda6]/10 flex items-center justify-center">
                  <Car className="w-6 h-6 text-[#5bdda6]" />
                </div>
                <span className="text-white font-bold text-lg">{stats.totalRides}</span>
                <span className="text-slate-400 text-[11px]">رحلة مع ران</span>
              </div>

              {/* خط فاصل */}
              <div className="w-px h-16 bg-slate-700/50" />

              {/* كيلومتراً مع ران */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-[#5bdda6]/10 flex items-center justify-center">
                  <Gauge className="w-6 h-6 text-[#5bdda6]" />
                </div>
                <span className="text-white font-bold text-lg">{stats.totalKm}</span>
                <span className="text-slate-400 text-[11px]">كيلومتراً مع ران</span>
              </div>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" />
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Car className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            <p className="text-sm text-slate-400">جاري تحميل الرحلات...</p>
          </div>
        ) : rides.length === 0 ? (
          <div className="text-center py-20 space-y-5">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-[#171f33] border border-slate-700/50 flex items-center justify-center">
              <Car className="w-10 h-10 text-slate-500" />
            </div>
            <div className="space-y-2">
              <p className="text-white font-bold text-lg">لا توجد رحلات سابقة</p>
              <p className="text-slate-400 text-sm">احجز رحلتك الأولى الآن!</p>
            </div>
            <button
              onClick={() => navigate("/rider")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#5bdda6] hover:bg-[#4ecf99] text-[#0b1326] font-bold text-sm rounded-full shadow-lg shadow-[#5bdda6]/25 transition-all"
            >
              <Navigation className="w-4 h-4" />
              احجز رحلة جديدة
            </button>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {paginatedRides.map((ride, idx) => {
              const status = getStatusConfig(ride.status);
              return (
                <motion.div
                  key={ride.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: idx * 0.03, duration: 0.2 }}
                  className="bg-[#171f33] rounded-2xl border border-slate-700/40 overflow-hidden hover:border-[#5bdda6]/30 transition-all duration-300 shadow-md"
                >
                  <div className="p-4 space-y-4">
                    {/* 1. رأس الكارت: تاريخ الرحلة وحالتها */}
                    <div className="flex items-center justify-between pb-1">
                      <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                      <div className="flex items-center gap-2 text-[12px] text-slate-400">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(ride.created_at), "d MMM yyyy", { locale: ar })}
                        <span className="text-slate-600">•</span>
                        <Clock className="w-3.5 h-3.5" />
                        {format(new Date(ride.created_at), "h:mm a", { locale: ar })}
                      </div>
                    </div>

                    {/* 2. خط السير (موقع الانطلاق والوصول) */}
                    <div className="space-y-0 relative pl-1 pr-1" dir="ltr">
                      {/* خط رابط */}
                      <div className="absolute left-[9px] top-[18px] w-px h-[calc(100%-22px)] bg-gradient-to-b from-emerald-500/50 to-blue-500/50" />

                      <div className="flex items-center gap-3 py-1.5">
                        <div className="w-[18px] h-[18px] rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 z-10">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        </div>
                        <p className="text-[13px] text-white/90 leading-snug line-clamp-1">
                          {ride.pickup_address || "موقع الانطلاق"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 py-1.5">
                        <div className="w-[18px] h-[18px] rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 z-10">
                          <div className="w-2 h-2 rounded-full bg-blue-400" />
                        </div>
                        <p className="text-[13px] text-white/90 leading-snug line-clamp-1">
                          {ride.dropoff_address || "الوجهة"}
                        </p>
                      </div>
                    </div>

                    {/* 3. معلومات السائق والسيارة */}
                    {ride.driver ? (
                      <div className="bg-[#1e2942]/60 rounded-xl p-3 flex items-center gap-3 border border-slate-700/20" dir="ltr">
                        {/* صورة السائق */}
                        {ride.driver.profile_image_url ? (
                          <img
                            src={resolveDriverAvatar(ride.driver.profile_image_url) || ""}
                            alt={ride.driver.full_name}
                            className="w-11 h-11 rounded-full object-cover border-2 border-[#5bdda6]/30 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-[#5bdda6]/15 border-2 border-[#5bdda6]/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-[#5bdda6] font-bold text-xs">
                              {getDriverInitials(ride.driver.full_name)}
                            </span>
                          </div>
                        )}
                        {/* اسم السائق وتفاصيل السيارة */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-semibold text-[13px] truncate">{ride.driver.full_name}</p>
                            {ride.vehicle_type && (
                              <span className="text-[10px] text-[#5bdda6] bg-[#5bdda6]/10 px-1.5 py-0.5 rounded">
                                {ride.vehicle_type === "economy" ? "اقتصادي" :
                                 ride.vehicle_type === "comfort" ? "مريح" :
                                 ride.vehicle_type === "premium" ? "مميز" :
                                 ride.vehicle_type === "women_only" ? "نسائي" :
                                 ride.vehicle_type}
                              </span>
                            )}
                          </div>
                          {ride.driver.vehicle_model && (
                            <p className="text-slate-400 text-[11px] truncate mt-0.5">{ride.driver.vehicle_model}</p>
                          )}
                        </div>
                        {/* التقييم */}
                        {ride.driver_rating && (
                          <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 flex-shrink-0">
                            <Star className="w-3 h-3 text-amber-400 fill-current" />
                            <span className="text-amber-400 font-medium text-[11px]">{ride.driver_rating}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* في حال عدم تعيين سائق بعد أو إلغاء الرحلة */
                      <div className="flex items-center justify-between px-1" dir="ltr">
                        <span className="text-[11px] text-slate-500">
                          {ride.status === "cancelled" ? "رحلة ملغاة" : "جاري البحث عن سائق"}
                        </span>
                        {ride.vehicle_type && (
                          <span className="text-[11px] text-slate-400 bg-slate-700/40 px-2 py-0.5 rounded-md flex-shrink-0">
                            {ride.vehicle_type === "economy" ? "اقتصادي" :
                             ride.vehicle_type === "comfort" ? "مريح" :
                             ride.vehicle_type === "premium" ? "مميز" :
                             ride.vehicle_type === "women_only" ? "نسائي" :
                             ride.vehicle_type}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 4. أسفل الكارت: السعر والإحصائيات */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-700/30">
                      <div className="flex items-center gap-3 text-[12px]">
                        {ride.distance_km && (
                          <span className="text-slate-400">
                            {ride.distance_km.toFixed(1)} كم
                          </span>
                        )}
                        {ride.duration_minutes && (
                          <span className="text-slate-400">
                            {ride.duration_minutes} د
                          </span>
                        )}
                      </div>
                      <div className="text-[#5bdda6] font-bold text-base">
                        {(ride.final_fare || ride.estimated_fare || 0).toLocaleString('en-US')}
                        <span className="text-[11px] text-slate-400 mr-1">د.ع</span>
                      </div>
                    </div>

                    {/* 5. زر إعادة الحجز */}
                    {ride.status === "completed" && (
                      <button
                        onClick={() => handleRebook(ride)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#5bdda6]/10 border border-[#5bdda6]/25 text-[#5bdda6] text-[13px] font-semibold hover:bg-[#5bdda6]/20 active:bg-[#5bdda6]/30 transition-all duration-300"
                      >
                        <RotateCcw className="w-4 h-4" />
                        إعادة الحجز
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {/* أدوات التحكم بالصفحات (Pagination Controls) */}
        {!loading && rides.length > 5 && (
          <div className="flex items-center justify-center gap-2 pt-2 pb-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-9 h-9 rounded-xl bg-[#171f33] border border-slate-700/30 flex items-center justify-center text-slate-400 disabled:opacity-30 hover:border-[#5bdda6]/40 transition-all text-sm font-bold"
            >
              ›
            </button>
            <span className="text-xs text-slate-400 min-w-[70px] text-center font-medium">
              الصفحة {currentPage} من {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-9 h-9 rounded-xl bg-[#171f33] border border-slate-700/30 flex items-center justify-center text-slate-400 disabled:opacity-30 hover:border-[#5bdda6]/40 transition-all text-sm font-bold"
            >
              ‹
            </button>
          </div>
        )}

        {/* زر التحديث */}
        {!loading && rides.length > 0 && (
          <button
            onClick={fetchRides}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-slate-400 hover:text-emerald-400 text-[13px] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث القائمة
          </button>
        )}
      </div>
    </div>
  );
};

export default RiderRidesPage;
