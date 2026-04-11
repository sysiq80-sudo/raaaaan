/**
 * Static Map Component for Ride History
 * Uses Google Maps Static Images API
 */

import React, { useState, useMemo } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { type Coordinates } from '@/lib/mapUtils';
import { getGoogleMapsApiKey } from '@/hooks/useGoogleMapsApiKey';

interface StaticRideMapProps {
  pickupLocation: Coordinates;
  dropoffLocation: Coordinates;
  routeCoordinates?: Coordinates[];
  width?: number;
  height?: number;
  className?: string;
  showLoadingState?: boolean;
}

function buildGoogleStaticMapUrl(
  pickupLocation: Coordinates,
  dropoffLocation: Coordinates,
  width: number,
  height: number,
  routeCoordinates?: Coordinates[]
): string | null {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return null;

  const base = 'https://maps.googleapis.com/maps/api/staticmap';
  const parts: string[] = [
    `size=${width}x${height}`,
    `scale=2`,
    `language=ar`,
    `markers=color:green%7Clabel:A%7C${pickupLocation.lat},${pickupLocation.lng}`,
    `markers=color:red%7Clabel:B%7C${dropoffLocation.lat},${dropoffLocation.lng}`,
    `maptype=roadmap`,
    `key=${apiKey}`,
  ];

  if (routeCoordinates && routeCoordinates.length > 1) {
    const pathPoints = routeCoordinates.map(c => `${c.lat},${c.lng}`).join('%7C');
    parts.push(`path=color:0x3b82f6cc%7Cweight:4%7C${pathPoints}`);
  }

  return `${base}?${parts.join('&')}`;
}

export function StaticRideMap({
  pickupLocation,
  dropoffLocation,
  routeCoordinates,
  width = 600,
  height = 200,
  className = '',
  showLoadingState = true
}: StaticRideMapProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const imageUrl = useMemo(
    () => buildGoogleStaticMapUrl(pickupLocation, dropoffLocation, width, height, routeCoordinates),
    [pickupLocation, dropoffLocation, width, height, routeCoordinates]
  );

  if (!imageUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-lg ${className}`}
        style={{ height }}
      >
        <div className="text-center text-muted-foreground">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">مفتاح Google Maps غير متاح</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-lg ${className}`}
        style={{ height }}
      >
        <div className="text-center text-muted-foreground">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">تعذر تحميل الخريطة</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`} style={{ height }}>
      {isLoading && showLoadingState && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse" style={{ borderRadius: 'inherit' }}>
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      )}
      <img
        src={imageUrl}
        alt="خريطة الرحلة"
        className={`w-full h-full object-cover transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        onLoad={() => setIsLoading(false)}
        onError={() => { setIsLoading(false); setHasError(true); }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}

export default StaticRideMap;
