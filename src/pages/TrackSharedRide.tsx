import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import Map from '@/components/Map';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Clock, DollarSign, AlertCircle } from 'lucide-react';
import NearbyDriversMiniMap from '@/components/rider/NearbyDriversMiniMap';

interface RideShareData {
  ride_id: string;
  driver_location?: { lat: number; lng: number };
  pickup_location: { lat: number; lng: number; address: string };
  dropoff_location: { lat: number; lng: number; address: string };
  estimated_fare?: number;
  expires_at: string;
  view_count: number;
}

export const TrackSharedRide = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [rideShare, setRideShare] = useState<RideShareData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    loadRideShare();
  }, [shareId]);

  const loadRideShare = async () => {
    if (!shareId) return;

    setIsLoading(true);
    try {
      // استخدام ride_share_links بدلاً من ride_shares
      const { data, error } = await supabase
        .from('ride_share_links')
        .select('*, rides(*)')
        .eq('token', shareId)
        .single();

      if (error) throw error;

      // التحقق من انتهاء الصلاحية
      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        setIsExpired(true);
      } else {
        const ride = data.rides as Record<string, unknown>;
        if (ride) {
          setRideShare({
            ride_id: data.ride_id,
            pickup_location: ride.pickup_location as { lat: number; lng: number; address: string },
            dropoff_location: ride.dropoff_location as { lat: number; lng: number; address: string },
            estimated_fare: ride.estimated_fare as number,
            expires_at: data.expires_at,
            view_count: 0
          });
        }
      }
    } catch (error) {
      console.error('Error loading ride share:', error);
      setIsExpired(true);
    } finally {
      setIsLoading(false);
    }
  };

  // حساب الوقت المتبقي
  useEffect(() => {
    if (!rideShare) return;

    const updateTimer = () => {
      const expiresAt = new Date(rideShare.expires_at);
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setIsExpired(true);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [rideShare]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold">جاري تحميل الرحلة...</p>
        </div>
      </div>
    );
  }

  if (isExpired || !rideShare) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              انتهت صلاحية الرابط
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              يعتذر، رابط تتبع الرحلة هذا انتهت صلاحيته (30 دقيقة).
            </p>
            <p className="text-sm text-muted-foreground">
              الرحلة قد تكون انتهت أو تم حذف رابط المشاركة.
            </p>
            <p className="text-xs text-muted-foreground text-center pt-2">
              اطلب من الراكب إرسال رابط جديد لتتبع الرحلة.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-background flex flex-col">
      {/* الخريطة */}
      <div className="flex-1 relative">
        <NearbyDriversMiniMap
          drivers={rideShare.driver_location ? [{ 
            id: 'driver', 
            lat: rideShare.driver_location.lat, 
            lng: rideShare.driver_location.lng 
          }] : []}
          userLocation={{
            lat: rideShare.pickup_location.lat,
            lng: rideShare.pickup_location.lng
          }}
          pickupLocation={{
            lat: rideShare.pickup_location.lat,
            lng: rideShare.pickup_location.lng
          }}
          dropoffLocation={{
            lat: rideShare.dropoff_location.lat,
            lng: rideShare.dropoff_location.lng
          }}
          height="h-full"
        />

        {/* شريط الوقت المتبقي */}
        {!isExpired && (
          <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-mono font-bold text-primary">
                {timeRemaining}
              </span>
              <span className="text-xs text-muted-foreground">متبقي</span>
            </div>
          </div>
        )}
      </div>

      {/* تفاصيل الرحلة */}
      <Card className="rounded-t-3xl border-t-2">
        <CardHeader>
          <CardTitle className="text-lg">تفاصيل الرحلة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* نقطة الالتقاط */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <div className="w-0.5 h-12 bg-gradient-to-b from-primary to-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">نقطة الالتقاط</p>
              <p className="font-medium text-sm">{rideShare.pickup_location.address}</p>
            </div>
          </div>

          {/* الوجهة */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">الوجهة</p>
              <p className="font-medium text-sm">{rideShare.dropoff_location.address}</p>
            </div>
          </div>

          {/* الأسعار */}
          {rideShare.estimated_fare && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm">السعر المتوقع</span>
              </div>
              <span className="font-bold text-foreground">
                {(rideShare.estimated_fare / 1000).toLocaleString('ar-IQ')} د.ع
              </span>
            </div>
          )}

          {/* معلومات السائق */}
          {rideShare.driver_location && (
            <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
              <span>🚗 السائق في الطريق</span>
              <span>تم العرض {rideShare.view_count} مرة</span>
            </div>
          )}

          {/* رسالة تنبيهية */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-600">
            <p className="font-semibold mb-1">⏰ الوقت محدود!</p>
            <p>هذا الرابط ينتهي بعد 30 دقيقة من إنشاؤه. سيكون عليك طلب رابط جديد بعدها.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrackSharedRide;
