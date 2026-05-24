import React, { Suspense, lazy, ComponentProps, forwardRef, useState, useEffect } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import type { MapRef } from './Map';
import { cn } from '@/lib/utils';
import { getGoogleMapsApiKey } from '@/hooks/useGoogleMapsApiKey';
import { generateStaticMapUrl } from '@/lib/googleMapsUtils';

// Lazy load the Map component
const MapComponent = lazy(() => import('./Map'));

// Extract props type from the lazy-loaded component
type MapComponentType = typeof import('./Map').default;
type MapPropsBase = ComponentProps<MapComponentType>;

interface LazyMapProps extends MapPropsBase {
  fallbackHeight?: string;
  /** Center location for static map placeholder */
  centerLocation?: { lat: number; lng: number } | null;
  /** Use static map as placeholder instead of skeleton */
  useStaticPlaceholder?: boolean;
}

// Static Map Placeholder - shows a real map image while interactive map loads
const StaticMapPlaceholder = ({
  height = 'h-64',
  className,
  centerLocation,
}: {
  height?: string;
  className?: string;
  centerLocation?: { lat: number; lng: number } | null;
}) => {
  const [staticUrl, setStaticUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const shouldFillParent = className?.includes('absolute') || className?.includes('inset-0');

  useEffect(() => {
    const loadStaticMap = async () => {
      try {
        const apiKey = getGoogleMapsApiKey();
        if (!apiKey) {
          setIsLoading(false);
          return;
        }

        // Default to Ramadi center if no location provided
        const lat = centerLocation?.lat || 33.4233;
        const lng = centerLocation?.lng || 43.2974;

        // Generate static map URL using Google Maps
        const url = generateStaticMapUrl(
          { lat, lng },
          centerLocation ? 14 : 11,
          800,
          600,
          centerLocation
            ? [{ lat, lng, color: "#00d9a5" }]
            : []
        );
        setStaticUrl(url);
        setIsLoading(false);
      } catch (error) {
        console.error('Static map error:', error);
        setIsLoading(false);
      }
    };

    loadStaticMap();
  }, [centerLocation]);

  return (
    <div
      className={cn(
        'relative rounded-2xl overflow-hidden bg-secondary/30',
        shouldFillParent ? 'absolute inset-0' : height,
        className
      )}
    >
      {/* Static map image as background */}
      {staticUrl && (
        <img
          src={staticUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.7)' }}
        />
      )}

      {/* Loading overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/30 backdrop-blur-[1px]">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/30 rounded-full animate-ping" />
          <div className="relative w-14 h-14 rounded-full bg-primary/20 backdrop-blur-sm flex items-center justify-center border border-primary/30">
            <MapPin className="w-7 h-7 text-primary" />
          </div>
        </div>
        <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm font-medium">جاري تحميل الخريطة التفاعلية...</span>
        </div>
      </div>

      {/* Skeleton tiles fallback if no static image */}
      {isLoading && !staticUrl && (
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-0.5 opacity-20">
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              className="bg-muted animate-pulse"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Simple skeleton fallback (for cases without static map)
const MapLoadingFallback = ({
  height = 'h-64',
  className,
}: {
  height?: string;
  className?: string;
}) => {
  const shouldFillParent = className?.includes('absolute') || className?.includes('inset-0');

  return (
    <div
      className={cn(
        'relative rounded-2xl overflow-hidden bg-secondary/30',
        shouldFillParent ? 'absolute inset-0' : height,
        className
      )}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
          <div className="relative w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-primary animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">جاري تحميل الخريطة...</span>
        </div>
      </div>
      {/* Skeleton map tiles */}
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-0.5 opacity-20">
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className="bg-muted animate-pulse"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
};

const LazyMap = forwardRef<MapRef, LazyMapProps>(({ 
  fallbackHeight = "h-64", 
  className,
  centerLocation,
  useStaticPlaceholder = true,
  pickupLocation,
  ...props 
}, ref) => {
  // Use pickup location or provided center for the static placeholder
  const placeholderCenter = centerLocation || pickupLocation;

  const fallback = useStaticPlaceholder ? (
    <StaticMapPlaceholder 
      height={fallbackHeight} 
      className={className} 
      centerLocation={placeholderCenter}
    />
  ) : (
    <MapLoadingFallback height={fallbackHeight} className={className} />
  );

  return (
    <Suspense fallback={fallback}>
      <MapComponent 
        ref={ref} 
        className={className} 
        pickupLocation={pickupLocation}
        {...props} 
      />
    </Suspense>
  );
});

LazyMap.displayName = 'LazyMap';

export type { MapRef };
export default LazyMap;
