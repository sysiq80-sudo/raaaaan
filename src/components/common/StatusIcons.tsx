/**
 * ران - مكون أيقونات الحالة
 * يعرض حالة الاتصال والموقع بشكل بصري بسيط
 */

import React from "react";
import { Wifi, WifiOff, MapPin, MapPinOff, Navigation } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

interface StatusIconsProps {
  userLocation: { lat: number; lng: number } | null;
  className?: string;
  onGeolocate?: () => void;
}

export const StatusIcons: React.FC<StatusIconsProps> = ({
  userLocation,
  className = "",
  onGeolocate,
}) => {
  const { isOnline, connectionType } = useNetworkStatus({
    serverCheckEnabled: false,
  });

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* أيقونة الاتصال بالإنترنت */}
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
          isOnline && connectionType !== "offline"
            ? "bg-green-500/20 border border-green-500/40"
            : "bg-red-500/20 border border-red-500/40 animate-pulse"
        }`}
        title={
          isOnline && connectionType !== "offline"
            ? "متصل بالإنترنت"
            : "غير متصل بالإنترنت"
        }
      >
        {isOnline && connectionType !== "offline" ? (
          <Wifi className="w-3.5 h-3.5 text-green-600" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-red-600" />
        )}
      </div>

      {/* أيقونة الموقع الجغرافي */}
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
          userLocation
            ? "bg-green-500/20 border border-green-500/40"
            : "bg-red-500/20 border border-red-500/40 animate-pulse"
        }`}
        title={userLocation ? "الموقع مفعل" : "الموقع غير مفعل"}
      >
        {userLocation ? (
          <MapPin className="w-3.5 h-3.5 text-green-600" />
        ) : (
          <MapPinOff className="w-3.5 h-3.5 text-red-600" />
        )}
      </div>

      {/* زر تحديد الموقع اليدوي إذا لم يتم التحديد تلقائياً */}
      {!userLocation && onGeolocate && (
        <button
          onClick={onGeolocate}
          className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 bg-card/90 border border-border/30 text-primary"
          title="تحديد موقعي"
          aria-label="تحديد موقعي"
        >
          <Navigation className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default StatusIcons;
