/**
 * Static Map Component for Ride History
 * Uses Mapbox Static Images API - much cheaper than interactive maps
 */

import React, { useState, useEffect } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { generateStaticMapUrl, type Coordinates } from '@/lib/mapUtils';

interface StaticRideMapProps {
  pickupLocation: Coordinates;
  dropoffLocation: Coordinates;
  routeCoordinates?: Coordinates[];
  width?: number;
  height?: number;
  className?: string;
  showLoadingState?: boolean;
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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch(
          'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token',
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          }
        );
        const data = await response.json();
        if (data.token) {
          setAccessToken(data.token);
        } else {
          setError('تعذر تحميل الخريطة');
        }
      } catch (err) {
        console.error('Error fetching Mapbox token:', err);
        setError('خطأ في تحميل الخريطة');
      }
    };

    fetchToken();
  }, []);

  // Generate static map URL when token is available
  useEffect(() => {
    if (!accessToken) return;

    try {
      const url = generateStaticMapUrl(pickupLocation, dropoffLocation, {
        width,
        height,
        accessToken,
        style: 'dark-v11',
        routeCoordinates,
        padding: 40
      });
      setImageUrl(url);
      setIsLoading(false);
    } catch (err) {
      console.error('Error generating static map:', err);
      setError('خطأ في إنشاء الخريطة');
      setIsLoading(false);
    }
  }, [accessToken, pickupLocation, dropoffLocation, routeCoordinates, width, height]);

  if (error) {
    return (
      <div 
        className={`flex items-center justify-center bg-muted rounded-lg ${className}`}
        style={{ width, height }}
      >
        <div className="text-center text-muted-foreground">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading && showLoadingState) {
    return (
      <div 
        className={`flex items-center justify-center bg-muted rounded-lg animate-pulse ${className}`}
        style={{ width, height }}
      >
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div 
        className={`flex items-center justify-center bg-muted rounded-lg ${className}`}
        style={{ width, height }}
      >
        <MapPin className="w-8 h-8 text-muted-foreground opacity-50" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      <img
        src={imageUrl}
        alt="مسار الرحلة"
        className="w-full h-full object-cover"
        style={{ width, height }}
        loading="lazy"
        onError={() => {
          setError('فشل تحميل صورة الخريطة');
        }}
      />
      {/* Overlay gradient for better text visibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}

export default StaticRideMap;
