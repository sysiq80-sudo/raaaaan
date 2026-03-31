import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import RiderPageHeader from "@/components/rider/RiderPageHeader";

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
}

const RiderRidesPage: React.FC = () => {
  const navigate = useNavigate();
  const [rides, setRides] = useState<RideHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "completed" | "cancelled">("all");
  const [userId, setUserId] = useState<string | null>(null);

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
      setRides(
        data.map((ride) => ({
          ...ride,
          pickup_location: ride.pickup_location as { lat: number; lng: number },
          dropoff_location: ride.dropoff_location as { lat: number; lng: number },
        }))
      );
    }
    setLoading(false);
  };

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
    const params = new URLSearchParams({
      pickup_lat: ride.pickup_location.lat.toString(),
      pickup_lng: ride.pickup_location.lng.toString(),
      pickup_address: ride.pickup_address || "",
      dropoff_lat: ride.dropoff_location.lat.toString(),
      dropoff_lng: ride.dropoff_location.lng.toString(),
      dropoff_address: ride.dropoff_address || "",
      vehicle_type: ride.vehicle_type || "economy",
      rebook: "true",
    });
    navigate(`/rider?${params.toString()}`);
  };

  const FILTERS = [
    { key: "all" as const, label: "الكل" },
    { key: "completed" as const, label: "مكتملة" },
    { key: "cancelled" as const, label: "ملغاة" },
  ];

  return (
    <div className="flex flex-col bg-background h-full">
      <RiderPageHeader title="رحلاتي" />

      {/* ── التبويبات ── */}
      <div className="pt-16 px-4 pb-3 sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/40 flex-shrink-0">
        <div className="flex gap-2 p-1 rounded-2xl bg-[#111827]/80 border border-slate-700/40">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-300 ${
                filter === f.key
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
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
            <div className="w-20 h-20 mx-auto rounded-2xl bg-[#151f30] border border-slate-700/50 flex items-center justify-center">
              <Car className="w-10 h-10 text-slate-500" />
            </div>
            <div className="space-y-2">
              <p className="text-white font-bold text-lg">لا توجد رحلات سابقة</p>
              <p className="text-slate-400 text-sm">احجز رحلتك الأولى الآن!</p>
            </div>
            <button
              onClick={() => navigate("/rider")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-bold text-sm rounded-full shadow-lg shadow-emerald-500/25 transition-all"
            >
              <Navigation className="w-4 h-4" />
              احجز رحلة جديدة
            </button>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {rides.map((ride, idx) => {
              const status = getStatusConfig(ride.status);
              return (
                <motion.div
                  key={ride.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: idx * 0.05, duration: 0.35 }}
                  className="bg-[#151f30] rounded-2xl border border-slate-700/50 overflow-hidden"
                >
                  <div className="p-4">
                    {/* التاريخ والحالة */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-[12px] text-slate-400">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(ride.created_at), "d MMM yyyy", { locale: ar })}
                        <span className="text-slate-600">•</span>
                        <Clock className="w-3.5 h-3.5" />
                        {format(new Date(ride.created_at), "h:mm a", { locale: ar })}
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    {/* المواقع */}
                    <div className="space-y-0 mb-4 relative">
                      {/* خط رابط */}
                      <div className="absolute right-[9px] top-[18px] w-px h-[calc(100%-22px)] bg-gradient-to-b from-emerald-500/50 to-red-500/50" />

                      <div className="flex items-center gap-3 py-1.5">
                        <div className="w-[18px] h-[18px] rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 z-10">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        </div>
                        <p className="text-[13px] text-white/85 leading-snug line-clamp-1">
                          {ride.pickup_address || "موقع الانطلاق"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 py-1.5">
                        <div className="w-[18px] h-[18px] rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 z-10">
                          <div className="w-2 h-2 rounded-full bg-red-400" />
                        </div>
                        <p className="text-[13px] text-white/85 leading-snug line-clamp-1">
                          {ride.dropoff_address || "الوجهة"}
                        </p>
                      </div>
                    </div>

                    {/* التفاصيل والسعر */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-700/30">
                      <div className="flex items-center gap-3 text-[12px]">
                        {ride.distance_km && (
                          <span className="text-slate-400">
                            {ride.distance_km.toFixed(1)} كم
                          </span>
                        )}
                        {ride.driver_rating && (
                          <div className="flex items-center gap-1 text-amber-400">
                            <Star className="w-3.5 h-3.5 fill-current" />
                            <span className="font-medium">{ride.driver_rating}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-white font-bold text-base">
                        {(ride.final_fare || ride.estimated_fare || 0).toLocaleString()}
                        <span className="text-[11px] text-slate-400 mr-1">د.ع</span>
                      </div>
                    </div>

                    {/* زر إعادة الحجز */}
                    {ride.status === "completed" && (
                      <button
                        onClick={() => handleRebook(ride)}
                        className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[13px] font-semibold hover:bg-emerald-500/20 active:bg-emerald-500/30 transition-all"
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
