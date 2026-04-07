import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVehicleTypes } from '@/hooks/useVehicleTypes';
import { useRegionFares } from '@/hooks/useRegionFares';

type VehicleType = 'economy' | 'comfort' | 'premium' | 'women_only';

export interface FareBreakdown {
  base_fare: number;
  distance_km: number;
  distance_fare: number;
  per_km_rate: number;
  waiting_minutes: number;
  waiting_fare: number;
  vehicle_type: string;
  vehicle_multiplier: number;
  subtotal: number;
  vehicle_adjusted_fare: number;
  service_fee: number;
  total_fare: number;
  region_name: string;
  region_id?: string;
  formatted_fare: string;
}

export const useFareCalculation = (
  pickupCoords: { lat: number; lng: number } | null,
  dropoffCoords: { lat: number; lng: number } | null,
  selectedVehicle: VehicleType,
  routeDistance: number | null
) => {
  const [fareBreakdown, setFareBreakdown] = useState<FareBreakdown | null>(null);
  const [fareLoading, setFareLoading] = useState(false);
  const [fareError, setFareError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSuccessfulFareRef = useRef<FareBreakdown | null>(null);
  // حفظ آخر معامل ذروة من السيرفر لاستخدامه في التقدير المحلي
  const lastSurgeMultiplierRef = useRef<number>(1.0);

  // جلب معاملات أنواع المركبات من DB بدل القيم الثابتة
  const { getMultiplier } = useVehicleTypes();
  // جلب أسعار الأساس من DB (base_fare, per_km_fare) بدل القيم الثابتة
  const { defaultFare } = useRegionFares();

  const estimateFareLocally = (
    distanceKm: number,
    vehicle: VehicleType,
  ): FareBreakdown => {
    // القيم من DB — إذا لم تتوفر تستخدم الـ fallback الموجود في useRegionFares
    const baseFare = defaultFare.base_fare;
    const perKmRate = defaultFare.per_km_fare;
    const perMinuteRate = defaultFare.per_minute_fare || 0;
    // استخدام المعامل من DB (مع fallback تلقائي في الهوك)
    const vehicleMultiplier = getMultiplier(vehicle);
    const distanceFare = distanceKm * perKmRate;
    // تقدير وقت الرحلة: متوسط 30 كم/ساعة في المدن العراقية
    const estimatedMinutes = Math.max(1, Math.round((distanceKm / 30) * 60));
    const timeFare = estimatedMinutes * perMinuteRate;
    const subtotal = Math.max(baseFare, baseFare + distanceFare + timeFare);
    // تطبيق معامل الذروة المحفوظ من آخر استجابة سيرفر (الحد الأقصى 2.0)
    const surgeMultiplier = Math.min(lastSurgeMultiplierRef.current, 2.0);
    const totalFare = Math.round(subtotal * vehicleMultiplier * surgeMultiplier);

    return {
      base_fare: baseFare,
      distance_km: distanceKm,
      distance_fare: distanceFare,
      per_km_rate: perKmRate,
      waiting_minutes: 0,
      waiting_fare: 0,
      vehicle_type: vehicle,
      vehicle_multiplier: vehicleMultiplier,
      subtotal,
      vehicle_adjusted_fare: totalFare,
      service_fee: 0,
      total_fare: totalFare,
      region_name: "تقدير تقريبي",
      formatted_fare: `${totalFare.toLocaleString()} د.ع`,
    };
  };

  useEffect(() => {
    // Clear any previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    let isCancelled = false;

    const calculateFare = async () => {
      // ⚠️ Early return if missing coordinates
      if (!pickupCoords || !dropoffCoords) {
        setFareBreakdown(null);
        setFareError(null);
        return;
      }

      // ⚠️ If route distance is not available, wait a bit longer
      // routeDistance can be 0, so check for null/undefined specifically, not falsy
      if (routeDistance === null || routeDistance === undefined) {
        setFareBreakdown(null);
        return;
      }

      // ✅ التحقق من صحة المسافة
      if (routeDistance < 0.1) {
        setFareError('المسافة قصيرة جداً');
        setFareBreakdown(null);
        return;
      }
      if (routeDistance > 500 || !isFinite(routeDistance)) {
        setFareError('المسافة غير صحيحة');
        setFareBreakdown(null);
        return;
      }

      setFareError(null);

      // ⚡ عرض تقدير محلي فوري حتى يأتي الرد من السيرفر
      const localEstimate = estimateFareLocally(routeDistance, selectedVehicle);
      setFareBreakdown(localEstimate);
      lastSuccessfulFareRef.current = localEstimate;
      setFareLoading(true);

      try {
        // Set a timeout to prevent infinite loading (10 seconds — allows cold-start of edge function)
        const timeoutPromise = new Promise((_, reject) => {
          timeoutRef.current = setTimeout(() => {
            reject(new Error('Fare calculation timeout'));
          }, 10000);
        });

        const invokePromise = (async () => {
          const { data, error } = await supabase.functions.invoke('calculate-fare', {
            body: {
              pickup_lat: pickupCoords.lat,
              pickup_lng: pickupCoords.lng,
              dropoff_lat: dropoffCoords.lat,
              dropoff_lng: dropoffCoords.lng,
              distance_km: routeDistance,
              vehicle_type: selectedVehicle,
              waiting_minutes: 0
            }
          });

          if (error) {
            console.error('❌ Edge Function error:', error);
            throw new Error(`API Error: ${error.message || 'Unknown error'}`);
          }

          if (data?.error) {
            console.error('❌ Fare calculation error:', data.error);
            throw new Error(data.error);
          }

          if (!data) {
            throw new Error('No fare data received');
          }

          return data;
        })();

        const data = await Promise.race([invokePromise, timeoutPromise]);
        
        if (isCancelled) return;

        if (data) {
          setFareBreakdown(data);
          lastSuccessfulFareRef.current = data as FareBreakdown;
          // حفظ معامل الذروة من السيرفر لاستخدامه في التقديرات المحلية القادمة
          if ((data as any).surge_multiplier && (data as any).surge_multiplier > 0) {
            lastSurgeMultiplierRef.current = (data as any).surge_multiplier;
          }
          console.log('✅ Fare calculated successfully:', data.formatted_fare);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.warn('⚠️ Fare from server failed, using local estimate:', errorMsg);
        // التقدير المحلي مُعين مسبقاً — لا داعي لإعادة الحساب
        setFareError(null); // لا تعرض خطأ للمستخدم، التقدير موجود
      } finally {
        setFareLoading(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    };

    calculateFare();

    // Cleanup on unmount
    return () => {
      isCancelled = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [pickupCoords, dropoffCoords, selectedVehicle, routeDistance]);

  return { fareBreakdown, fareLoading, fareError, setFareBreakdown };
};
