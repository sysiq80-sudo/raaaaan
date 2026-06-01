/**
 * ران — بطاقات إحصائيات سريعة عائمة
 * Floating mini stats cards for driver home map overlay
 * Matches the Dark Luxury reference design
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Car, Eye, EyeOff } from "lucide-react";
import { startOfDay } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface DriverQuickStatsProps {
  driverId: string;
}

const DriverQuickStats = ({ driverId }: DriverQuickStatsProps) => {
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayRides, setTodayRides] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(true);

  const fetchQuickStats = useCallback(async () => {
    if (!driverId) return;
    try {
      const todayStart = startOfDay(new Date()).toISOString();

      const { data: rides } = await supabase
        .from("rides")
        .select("status, final_fare, estimated_fare")
        .eq("driver_id", driverId)
        .gte("created_at", todayStart);

      if (rides) {
        let earnings = 0;
        let count = 0;
        rides.forEach((r: any) => {
          if (r.status === "completed") {
            earnings += r.final_fare || r.estimated_fare || 0;
            count++;
          }
        });
        setTodayEarnings(earnings);
        setTodayRides(count);
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    fetchQuickStats();
    const interval = setInterval(fetchQuickStats, 60000);
    return () => clearInterval(interval);
  }, [fetchQuickStats]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <div className="h-11 w-36 rounded-2xl bg-[#0d1729]/80 animate-pulse" />
        <div className="h-11 w-28 rounded-2xl bg-[#0d1729]/80 animate-pulse" />
        <div className="h-10 w-10 rounded-2xl bg-[#0d1729]/80 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 pt-3 pb-1 w-full">
      <AnimatePresence initial={false}>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, x: -12, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -12, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="flex gap-2 flex-1"
          >
            {/* بطاقة الأرباح */}
            <div className="flex items-center gap-2 bg-[#0d1729]/90 backdrop-blur-xl rounded-2xl px-3.5 py-2.5 border border-[#5bdda6]/20 shadow-[0_4px_20px_rgba(0,0,0,0.45)]">
              <div className="w-7 h-7 rounded-xl bg-[#5bdda6]/12 flex items-center justify-center shrink-0">
                <DollarSign className="w-3.5 h-3.5 text-[#5bdda6]" />
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-[9px] text-slate-500 font-bold tracking-widest uppercase leading-none mb-0.5">الأرباح</p>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-sm font-black text-white leading-none" style={{ fontFamily: "Cairo, sans-serif" }}>
                    {todayEarnings.toLocaleString('en-US')}
                  </span>
                  <span className="text-[10px] font-bold text-[#5bdda6]/70">د.ع</span>
                </div>
              </div>
            </div>

            {/* بطاقة الرحلات */}
            <div className="flex items-center gap-2 bg-[#0d1729]/90 backdrop-blur-xl rounded-2xl px-3.5 py-2.5 border border-sky-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.45)]">
              <div className="w-7 h-7 rounded-xl bg-sky-500/12 flex items-center justify-center shrink-0">
                <Car className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-[9px] text-slate-500 font-bold tracking-widest uppercase leading-none mb-0.5">الرحلات</p>
                <span className="text-sm font-black text-white leading-none" style={{ fontFamily: "Cairo, sans-serif" }}>
                  {todayRides.toLocaleString('en-US')}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* زر إخفاء وإظهار التفاصيل */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="w-12 h-12 flex items-center justify-center rounded-full border-none outline-none ring-0 shadow-[0_0_15px_rgba(0,0,0,0.3)] transition-all bg-black/80 hover:bg-black/90 backdrop-blur group shrink-0 pointer-events-auto"
        aria-label={isVisible ? "إخفاء الإحصائيات" : "إظهار الإحصائيات"}
      >
        <motion.div
          animate={{ rotate: isVisible ? 0 : 180 }}
          transition={{ duration: 0.3 }}
        >
          {isVisible ? (
            <EyeOff className="w-5 h-5 text-slate-300 group-hover:scale-110 transition-transform" />
          ) : (
            <Eye className="w-5 h-5 text-[#5bdda6] group-hover:scale-110 transition-transform" />
          )}
        </motion.div>
      </button>
    </div>
  );
};

export default DriverQuickStats;
