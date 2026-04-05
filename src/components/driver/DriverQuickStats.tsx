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
      <div className="flex bg-[#171f33]/90 backdrop-blur-xl border-b border-[#5bdda6]/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div className="flex-1 h-[68px] animate-pulse border-l border-white/5" />
        <div className="flex-1 h-[68px] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center z-20 w-full">
      <AnimatePresence initial={false}>
        {isVisible && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="flex w-full bg-[#171f33]/90 backdrop-blur-xl border-b border-[#5bdda6]/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            {/* بطاقة الأرباح */}
            <div className="flex-1 flex flex-col justify-center items-center py-3 border-l border-white/5 relative">
              <div className="absolute top-0 right-1/2 translate-x-1/2 w-10 h-[2px] bg-[#5bdda6] shadow-[0_0_12px_rgba(91,221,166,1)]" />
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-[#5bdda6]" />
                <p className="text-slate-400 text-[10px] font-bold tracking-wider">الأرباح اليوم</p>
              </div>
              <p className="text-xl font-black text-white leading-none" style={{ fontFamily: "Inter, sans-serif" }}>
                {todayEarnings.toLocaleString('en-US')}{" "}
                <span className="text-xs font-bold text-[#5bdda6]" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>د.ع</span>
              </p>
            </div>

            {/* بطاقة الطلبات */}
            <div className="flex-1 flex flex-col justify-center items-center py-3 relative">
              <div className="absolute top-0 right-1/2 translate-x-1/2 w-10 h-[2px] bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,1)]" />
              <div className="flex items-center gap-1.5 mb-1">
                <Car className="w-3.5 h-3.5 text-sky-400" />
                <p className="text-slate-400 text-[10px] font-bold tracking-wider">الطلبات اليوم</p>
              </div>
              <p className="text-xl font-black text-white leading-none" style={{ fontFamily: "Inter, sans-serif" }}>
                {todayRides.toLocaleString('en-US')}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* زر إخفاء وإظهار التفاصيل */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="w-14 h-6 flex items-center justify-center bg-[#171f33]/90 backdrop-blur-xl border border-t-0 border-[#5bdda6]/20 rounded-b-2xl shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:bg-[#1a253c] transition-colors focus:outline-none z-30 pointer-events-auto -translate-y-[1px]"
        aria-label={isVisible ? "إخفاء التفاصيل" : "إظهار التفاصيل"}
      >
        <motion.div
          animate={{ rotate: isVisible ? 0 : 180 }}
          transition={{ duration: 0.3 }}
        >
          {isVisible ? (
            <EyeOff className="w-4 h-4 text-slate-400" />
          ) : (
            <Eye className="w-4 h-4 text-[#5bdda6]" />
          )}
        </motion.div>
      </button>
    </div>
  );
};

export default DriverQuickStats;
