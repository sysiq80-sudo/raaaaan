/**
 * Hook for fetching and caching vehicle types from database
 * Uses React Query with caching
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type VehicleTypeKey = 'economy' | 'comfort' | 'premium' | 'women_only';

export interface VehicleType {
  id: string;
  name_ar: string;
  name_en: string;
  icon: string;
  description_ar: string | null;
  description_en: string | null;
  multiplier: number;
  min_fare: number;
  commission_rate: number;
  is_active: boolean;
  sort_order: number;
}

// Fallback static data in case database is unavailable
const FALLBACK_VEHICLE_TYPES: VehicleType[] = [
  {
    id: 'economy',
    name_ar: 'اقتصادي',
    name_en: 'Economy',
    icon: '🚗',
    description_ar: 'رحلات يومية بأسعار معقولة',
    description_en: 'Affordable everyday rides',
    multiplier: 1.0,
    min_fare: 2000,
    commission_rate: 15,
    is_active: true,
    sort_order: 1
  },
  {
    id: 'comfort',
    name_ar: 'مريح',
    name_en: 'Comfort',
    icon: '🚙',
    description_ar: 'سيارات أكثر راحة ومساحة',
    description_en: 'More comfortable and spacious cars',
    multiplier: 1.3,
    min_fare: 3000,
    commission_rate: 18,
    is_active: true,
    sort_order: 2
  },
  {
    id: 'premium',
    name_ar: 'فاخر',
    name_en: 'Premium',
    icon: '🚘',
    description_ar: 'سيارات فاخرة لتجربة مميزة',
    description_en: 'Luxury cars for a premium experience',
    multiplier: 1.8,
    min_fare: 5000,
    commission_rate: 20,
    is_active: true,
    sort_order: 3
  },
  {
    id: 'women_only',
    name_ar: 'نسائي',
    name_en: 'Women Only',
    icon: '👩',
    description_ar: 'رحلات آمنة للنساء فقط',
    description_en: 'Safe rides for women only',
    multiplier: 1.2,
    min_fare: 2500,
    commission_rate: 15,
    is_active: true,
    sort_order: 4
  }
];

export function useVehicleTypes() {
  const { data: vehicleTypes = FALLBACK_VEHICLE_TYPES, isLoading, error } = useQuery({
    queryKey: ['vehicle-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data as VehicleType[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  const getVehicleType = useMemo(() => {
    return (typeId: string): VehicleType | undefined => {
      return vehicleTypes.find(v => v.id === typeId);
    };
  }, [vehicleTypes]);

  const getVehicleTypeName = useMemo(() => {
    return (typeId: string, lang: 'ar' | 'en' = 'ar'): string => {
      const type = vehicleTypes.find(v => v.id === typeId);
      return lang === 'ar' ? (type?.name_ar || typeId) : (type?.name_en || typeId);
    };
  }, [vehicleTypes]);

  const getVehicleTypeIcon = useMemo(() => {
    return (typeId: string): string => {
      const type = vehicleTypes.find(v => v.id === typeId);
      return type?.icon || '🚗';
    };
  }, [vehicleTypes]);

  const getMultiplier = useMemo(() => {
    return (typeId: string): number => {
      const type = vehicleTypes.find(v => v.id === typeId);
      return type?.multiplier || 1.0;
    };
  }, [vehicleTypes]);

  const getMinFare = useMemo(() => {
    return (typeId: string): number => {
      const type = vehicleTypes.find(v => v.id === typeId);
      return type?.min_fare || 2000;
    };
  }, [vehicleTypes]);

  const getCommissionRate = useMemo(() => {
    return (typeId: string): number => {
      const type = vehicleTypes.find(v => v.id === typeId);
      return type?.commission_rate || 15;
    };
  }, [vehicleTypes]);

  return {
    vehicleTypes,
    getVehicleType,
    getVehicleTypeName,
    getVehicleTypeIcon,
    getMultiplier,
    getMinFare,
    getCommissionRate,
    isLoading,
    error,
  };
}
