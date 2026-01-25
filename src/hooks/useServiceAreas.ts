/**
 * Hook for caching and managing service areas
 * Uses React Query for intelligent caching
 * Performs local point-in-polygon checks to reduce API calls
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { semiStaticDataConfig, queryKeys } from '@/lib/queryConfig';
import { isPointInServiceArea, findNearestServiceArea, type Region, type Coordinates } from '@/lib/mapUtils';
import { useMemo, useCallback } from 'react';

interface ServiceAreaResult {
  inService: boolean;
  region: Region | null;
  nearestRegion: { region: Region; distance: number } | null;
}

export function useServiceAreas() {
  // Fetch and cache all active regions with their coordinates
  const { data: regions = [], isLoading, error } = useQuery({
    queryKey: queryKeys.activeRegions,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regions')
        .select('id, name_ar, name_en, coordinates, base_fare, per_km_fare, waiting_fare_per_min, priority')
        .eq('is_active', true);

      if (error) throw error;

      // Parse coordinates from JSON and include priority
      return (data || []).map(region => ({
        ...region,
        coordinates: (region.coordinates as any)?.coordinates || region.coordinates || [],
        priority: region.priority ?? 0
      })) as Region[];
    },
    ...semiStaticDataConfig,
  });

  // Check if a point is in any service area (LOCAL CHECK - no API call)
  const checkServiceArea = useCallback((point: Coordinates): ServiceAreaResult => {
    if (!regions || regions.length === 0) {
      return { inService: false, region: null, nearestRegion: null };
    }

    const result = isPointInServiceArea(point, regions);

    if (result.inService) {
      return {
        inService: true,
        region: result.region,
        nearestRegion: null
      };
    }

    // Find nearest if not in service
    const nearest = findNearestServiceArea(point, regions);

    return {
      inService: false,
      region: null,
      nearestRegion: nearest
    };
  }, [regions]);

  // Get region by ID
  const getRegionById = useCallback((regionId: string): Region | undefined => {
    return regions.find(r => r.id === regionId);
  }, [regions]);

  // Memoized region names map for quick lookup
  const regionNames = useMemo(() => {
    const map = new Map<string, { ar: string; en: string | null }>();
    regions.forEach(r => {
      map.set(r.id, { ar: r.name_ar, en: r.name_en || null });
    });
    return map;
  }, [regions]);

  return {
    regions,
    isLoading,
    error,
    checkServiceArea,
    getRegionById,
    regionNames,
  };
}
