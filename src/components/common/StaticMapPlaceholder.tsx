/**
 * ران - خريطة ثابتة كـ Placeholder
 * تعرض صورة خريطة ثابتة أثناء تحميل الخريطة التفاعلية
 */

import React from "react";
import { motion } from "framer-motion";
import { Loader2, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface StaticMapPlaceholderProps {
  lat?: number;
  lng?: number;
  zoom?: number;
  className?: string;
  showLoader?: boolean;
  message?: string;
}

export const StaticMapPlaceholder: React.FC<StaticMapPlaceholderProps> = ({
  lat = 33.3152,
  lng = 44.3661,
  zoom = 12,
  className = "",
  showLoader = true,
  message = "جاري تحميل الخريطة...",
}) => {
  // Generate Google Static Maps URL
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const staticMapUrl = googleApiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=400x300&scale=2&key=${googleApiKey}`
    : null;

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Background gradient or static image */}
      {staticMapUrl ? (
        <motion.img
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 0.5, scale: 1 }}
          transition={{ duration: 0.5 }}
          src={staticMapUrl}
          alt="Map loading..."
          className="absolute inset-0 w-full h-full object-cover filter blur-sm"
          onError={(e) => {
            // Fallback to gradient if image fails
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted-foreground/10" />
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background/80" />

      {/* Skeleton grid overlay */}
      <div className="absolute inset-0 opacity-20">
        <div className="grid grid-cols-4 grid-rows-4 h-full gap-1 p-2">
          {Array.from({ length: 16 }).map((_, i) => (
            <Skeleton key={i} className="w-full h-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Loading indicator */}
      {showLoader && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="bg-card/95 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-border/50">
            <div className="flex flex-col items-center gap-4">
              {/* Animated map pin */}
              <div className="relative">
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                </motion.div>
                {/* Pulse ring */}
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute inset-0 rounded-full border-2 border-primary/30"
                />
              </div>

              {/* Spinner */}
              <Loader2 className="w-6 h-6 animate-spin text-primary" />

              {/* Message */}
              <p className="text-sm font-medium text-muted-foreground">
                {message}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default StaticMapPlaceholder;
