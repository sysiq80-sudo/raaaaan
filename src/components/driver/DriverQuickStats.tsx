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
  const [isVisible, setIsVisible] = useState(false);

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
      <div className="flex flex-col items-start gap-2 shrink-0 pointer-events-auto">
        <div className="h-11 w-11 rounded-l-none rounded-r-2xl bg-[#0d1729]/80 animate-pulse border border-l-0 border-slate-800" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 shrink-0 pointer-events-auto">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="w-11 h-11 flex items-center justify-center rounded-l-none rounded-r-2xl border border-l-0 border-[#5bdda6]/30 outline-none ring-0 shadow-[0_0_20px_rgba(91,221,166,0.5)] transition-all bg-[#5bdda6] hover:bg-[#34d399] group shrink-0 pointer-events-auto"
        aria-label={isVisible ? "إخفاء الإحصائيات" : "إظهار الإحصائيات"}
      >
        <motion.div
          animate={{ rotate: isVisible ? 0 : 180 }}
          transition={{ duration: 0.3 }}
        >
          {isVisible ? (
            <EyeOff className="w-5 h-5 text-slate-950 group-hover:scale-110 transition-transform" />
          ) : (
            <Eye className="w-5 h-5 text-slate-950 group-hover:scale-110 transition-transform" />
          )}
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="flex flex-col gap-2"
          >
            {/* بطاقة الأرباح */}
            <div className="flex items-center gap-2 bg-[#0d1729]/95 backdrop-blur-xl rounded-l-none rounded-r-2xl px-3 py-2.5 border border-l-0 border-[#5bdda6]/20 shadow-[0_4px_20px_rgba(0,0,0,0.45)] w-28">
              <div className="w-7 h-7 rounded-xl bg-[#5bdda6]/12 flex items-center justify-center shrink-0">
                <DollarSign className="w-3.5 h-3.5 text-[#5bdda6]" />
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-[9px] text-slate-500 font-bold tracking-widest uppercase leading-none mb-0.5">الأرباح</p>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-xs font-black text-white leading-none" style={{ fontFamily: "Cairo, sans-serif" }}>
                    {todayEarnings.toLocaleString('en-US')}
                  </span>
                  <span className="text-[8px] font-bold text-[#5bdda6]/70">د.ع</span>
                </div>
              </div>
            </div>

            {/* بطاقة الرحلات */}
            <div className="flex items-center gap-2 bg-[#0d1729]/95 backdrop-blur-xl rounded-l-none rounded-r-2xl px-3 py-2.5 border border-l-0 border-sky-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.45)] w-28">
              <div className="w-7 h-7 rounded-xl bg-sky-500/12 flex items-center justify-center shrink-0">
                <Car className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-[9px] text-slate-500 font-bold tracking-widest uppercase leading-none mb-0.5">الرحلات</p>
                <span className="text-xs font-black text-white leading-none" style={{ fontFamily: "Cairo, sans-serif" }}>
                  {todayRides.toLocaleString('en-US')}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DriverQuickStats;
