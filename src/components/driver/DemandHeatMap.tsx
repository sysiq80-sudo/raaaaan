/**
 * ران — خريطة حرارية لمناطق الطلب
 * DemandHeatMap — Shows ride demand zones for drivers
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Flame, X, Loader2 } from "lucide-react";

interface DemandZone {
  lat: number;
  lng: number;
  weight: number;
  count: number;
}

interface DemandHeatMapProps {
  isOnline: boolean;
}

export const DemandHeatMap = ({ isOnline }: DemandHeatMapProps) => {
  const [zones, setZones] = useState<DemandZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [totalRides, setTotalRides] = useState(0);

  const fetchZones = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-demand-zones");
      if (error) throw error;
      setZones(data?.zones || []);
      setTotalRides(data?.total_rides || 0);
    } catch (err) {
      console.error("[DemandHeatMap] Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && isOnline) {
      fetchZones();
      // تحديث كل 5 دقائق
      const interval = setInterval(fetchZones, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [visible, isOnline, fetchZones]);

  if (!isOnline) return null;

  // Temporarily disable the Demand Heatmap feature based on user request
  return null;

  if (!visible) {
    return (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 z-30">
        <Button
          size="sm"
          variant="secondary"
          className="shadow-lg rounded-none rounded-r-xl border-y border-r border-border/50 bg-background/90 hover:bg-background/100 h-12 px-3 transition-colors"
          onClick={() => setVisible(true)}
        >
          <Flame className="w-5 h-5 ml-1.5 text-orange-500" />
          <span className="font-bold text-sm">مناطق الطلب</span>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 z-30">
        <Button
          size="sm"
          variant="secondary"
          className="shadow-lg rounded-none rounded-r-xl border-y border-r border-border/50 bg-background/90 hover:bg-background/100 h-12 px-3 transition-colors"
          onClick={() => setVisible(false)}
        >
          <X className="w-5 h-5 ml-1.5 text-muted-foreground" />
          <span className="font-bold text-sm">إخفاء</span>
        </Button>
      </div>

      {/* عرض المناطق كدوائر */}
      {loading ? (
        <div className="absolute top-32 left-4 z-30 bg-background/90 backdrop-blur rounded-lg p-3 shadow-lg">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground mt-1">جاري التحميل...</p>
        </div>
      ) : (
        <div className="absolute top-32 left-4 z-30 bg-background/90 backdrop-blur rounded-lg p-3 shadow-lg max-w-[200px]">
          <p className="text-xs font-medium mb-2">
            🔥 مناطق الطلب ({totalRides} رحلة / ساعتين)
          </p>
          {zones.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد بيانات كافية</p>
          ) : (
            <div className="space-y-1.5">
              {zones.slice(0, 5).map((zone, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs"
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{
                      backgroundColor: `rgba(255, ${Math.round(140 * (1 - zone.weight))}, 0, ${0.5 + zone.weight * 0.5})`,
                    }}
                  />
                  <span className="text-muted-foreground truncate">
                    {zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}
                  </span>
                  <span className="font-medium text-orange-500 mr-auto">
                    {zone.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};
