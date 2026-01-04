/**
 * DriverETABadge - عرض وقت وصول أقرب سائق
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, Car, Loader2 } from "lucide-react";
import { calculateLocalDistance, estimateArrivalMinutes } from "@/lib/mapUtils";

interface DriverLocation {
  id: string;
  lat: number;
  lng: number;
}

interface DriverETABadgeProps {
  pickupCoords: { lat: number; lng: number } | null;
  nearbyDriverLocations: DriverLocation[];
  isLoading?: boolean;
}

const DriverETABadge = ({
  pickupCoords,
  nearbyDriverLocations,
  isLoading = false
}: DriverETABadgeProps) => {
  // Calculate ETA to nearest driver
  const nearestDriverETA = useMemo(() => {
    if (!pickupCoords || nearbyDriverLocations.length === 0) return null;

    let minDistance = Infinity;
    let nearestDriver: DriverLocation | null = null;

    for (const driver of nearbyDriverLocations) {
      const distance = calculateLocalDistance(
        { lat: pickupCoords.lat, lng: pickupCoords.lng },
        { lat: driver.lat, lng: driver.lng }
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestDriver = driver;
      }
    }

    if (!nearestDriver) return null;

    // Estimate arrival time (average city speed ~25 km/h)
    const eta = estimateArrivalMinutes(
      { lat: pickupCoords.lat, lng: pickupCoords.lng },
      { lat: nearestDriver.lat, lng: nearestDriver.lng },
      25
    );

    return {
      minutes: Math.max(1, Math.round(eta)),
      distance: minDistance
    };
  }, [pickupCoords, nearbyDriverLocations]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-full">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">جاري البحث...</span>
      </div>
    );
  }

  if (!nearestDriverETA) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-full">
        <Car className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">لا سائقين قريبين</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-full"
    >
      <div className="flex items-center gap-1">
        <Clock className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold text-primary">
          {nearestDriverETA.minutes} د
        </span>
      </div>
      <div className="w-px h-4 bg-primary/30" />
      <div className="flex items-center gap-1">
        <Car className="w-4 h-4 text-primary" />
        <span className="text-xs text-primary">
          أقرب سائق
        </span>
      </div>
    </motion.div>
  );
};

export default DriverETABadge;
