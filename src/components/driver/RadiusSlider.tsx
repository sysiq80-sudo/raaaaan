/**
 * ران - منزلق نطاق الاستلام مع كثافة العملاء
 * Enhanced Range Slider with Real-time Potential Customer Density
 * Features: Visual density heatmap, driver count, animated range indicator
 */

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { MapPin, Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface RadiusSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  driverLocation?: { lat: number; lng: number } | null;
  workingRegionId?: string | null;
}

interface DensityData {
  pendingRides: number;
  onlineDrivers: number;
  demandRatio: number; // rides / drivers — higher = more demand
}

const RadiusSlider = ({
  value,
  onChange,
  min = 1,
  max = 30,
  step = 1,
  driverLocation,
  workingRegionId,
}: RadiusSliderProps) => {
  const [density, setDensity] = useState<DensityData>({
    pendingRides: 0,
    onlineDrivers: 0,
    demandRatio: 0,
  });
  const [loading, setLoading] = useState(false);

  // جلب بيانات الكثافة عند تغيير النطاق
  useEffect(() => {
    const fetchDensity = async () => {
      if (!driverLocation) return;
      setLoading(true);
      try {
        // عد الطلبات المعلقة في المنطقة
        const [ridesResult, driversResult] = await Promise.all([
          supabase
            .from("rides")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase
            .from("drivers")
            .select("id", { count: "exact", head: true })
            .eq("is_online", true)
            .eq("is_available", true)
            .eq("status", "approved"),
        ]);

        const rides = ridesResult.count || 0;
        const drivers = driversResult.count || 0;
        const ratio = drivers > 0 ? rides / drivers : rides > 0 ? 5 : 0;

        setDensity({
          pendingRides: rides,
          onlineDrivers: drivers,
          demandRatio: ratio,
        });
      } catch {
        // Silently fail — density is supplementary info
      } finally {
        setLoading(false);
      }
    };

    fetchDensity();
    const interval = setInterval(fetchDensity, 30000); // كل 30 ثانية
    return () => clearInterval(interval);
  }, [driverLocation, workingRegionId]);

  // حساب مستوى الكثافة
  const densityLevel = useMemo(() => {
    if (density.demandRatio >= 2) return { label: "طلب عالي جداً", color: "text-[#00E676]", bg: "bg-[#00E676]", icon: TrendingUp, tip: "فرصة ممتازة!" };
    if (density.demandRatio >= 1) return { label: "طلب جيد", color: "text-green-400", bg: "bg-green-500", icon: TrendingUp, tip: "نطاق مناسب" };
    if (density.demandRatio >= 0.5) return { label: "طلب متوسط", color: "text-amber-400", bg: "bg-amber-500", icon: Minus, tip: "وسّع النطاق" };
    return { label: "طلب منخفض", color: "text-red-400", bg: "bg-red-500", icon: TrendingDown, tip: "وسّع النطاق" };
  }, [density.demandRatio]);

  const DensityIcon = densityLevel.icon;

  // حساب مساحة التغطية التقريبية
  const coverageArea = useMemo(() => {
    return (Math.PI * value * value).toFixed(1);
  }, [value]);

  // Density heatmap segments (visual bar)
  const segments = useMemo(() => {
    const total = 10;
    const filled = Math.min(Math.round(density.demandRatio * 3), total);
    return Array.from({ length: total }, (_, i) => i < filled);
  }, [density.demandRatio]);

  return (
    <div className="space-y-4">
      {/* Header: Label + Value */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">نطاق الاستقبال</span>
        </div>
        <motion.div
          key={value}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 rounded-lg border border-primary/20"
        >
          <span className="text-lg font-bold text-primary">{value}</span>
          <span className="text-xs text-primary/70">كم</span>
        </motion.div>
      </div>

      {/* Slider */}
      <div className="relative px-1">
        <Slider
          value={[value]}
          onValueChange={(v) => onChange(v[0])}
          min={min}
          max={max}
          step={step}
          className="w-full"
        />
        {/* Range labels */}
        <div className="flex justify-between mt-1 px-0.5">
          <span className="text-[10px] text-muted-foreground">{min} كم</span>
          <span className="text-[10px] text-muted-foreground">{max} كم</span>
        </div>
      </div>

      {/* Coverage + Density Info Card */}
      <div className="p-3 bg-secondary/30 rounded-xl border border-border/30 space-y-3">
        {/* Coverage Area */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">مساحة التغطية التقريبية</span>
          <span className="font-medium text-foreground">{coverageArea} كم²</span>
        </div>

        {/* Density Bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <DensityIcon className={cn("w-3.5 h-3.5", densityLevel.color)} />
              <span className={cn("text-xs font-semibold", densityLevel.color)}>
                {densityLevel.label}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {densityLevel.tip}
            </span>
          </div>

          {/* Heatmap segments */}
          <div className="flex gap-0.5 h-2">
            {segments.map((filled, i) => (
              <motion.div
                key={i}
                className={cn(
                  "flex-1 rounded-sm transition-colors duration-300",
                  filled ? densityLevel.bg : "bg-secondary/60"
                )}
                initial={false}
                animate={{
                  opacity: filled ? [0.6, 1, 0.6] : 0.3,
                  scale: filled && i === segments.filter(Boolean).length - 1 ? [1, 1.1, 1] : 1,
                }}
                transition={{
                  duration: 2,
                  repeat: filled ? Infinity : 0,
                  ease: "easeInOut",
                  delay: i * 0.1,
                }}
              />
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between pt-1 border-t border-border/20">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{density.pendingRides}</span> طلب معلق
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{density.onlineDrivers}</span> سائق متاح
            </span>
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <AnimatePresence mode="wait">
        {value < 5 && density.pendingRides === 0 && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-[11px] text-amber-400 flex items-center gap-1"
          >
            💡 نوصي بزيادة النطاق إلى 10 كم على الأقل لفرص أفضل
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RadiusSlider;
