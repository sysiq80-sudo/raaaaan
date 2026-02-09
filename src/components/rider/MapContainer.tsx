/**
 * ران - MapContainer
 * مكون مذخر (memoized) لحاوية خريطة Google Maps
 * يمنع إعادة التصيير عند تغيير حالات useActiveRide أو حالات الحجز
 */

import React, { memo } from "react";

interface MapContainerProps {
  mapRef: React.RefObject<HTMLDivElement>;
  isLoading: boolean;
  mapToken: string | null;
}

const MapContainer: React.FC<MapContainerProps> = memo(
  ({ mapRef, isLoading, mapToken }) => {
    return (
      <>
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-foreground text-lg font-semibold">جاري تحميل الخريطة...</p>
              <p className="text-muted-foreground text-sm mt-2">
                {!mapToken ? "جاري الاتصال بخادم الخرائط..." : "جاري تحديد موقعك..."}
              </p>
              {isLoading && mapToken && (
                <div className="text-xs text-muted-foreground/70 mt-4">
                  💡 تلميح: تأكد من تفعيل الموقع في متصفحك
                </div>
              )}
            </div>
          </div>
        )}

        {/* Map div - Google Maps renders here natively */}
        <div
          ref={mapRef}
          className="absolute inset-0 z-0"
          style={{
            touchAction: "none",
            pointerEvents: "auto",
          }}
        />
      </>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render when loading state or token actually changes
    return (
      prevProps.isLoading === nextProps.isLoading &&
      prevProps.mapToken === nextProps.mapToken
    );
  }
);

MapContainer.displayName = "MapContainer";

export default MapContainer;
