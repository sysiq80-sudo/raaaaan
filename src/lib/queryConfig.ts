/**
 * React Query Configuration for Optimal Caching
 * Reduces database queries and improves performance
 */

// Static data that rarely changes (vehicle types, fare structure)
export const staticDataConfig = {
  staleTime: 24 * 60 * 60 * 1000, // 24 hours - data is fresh for a full day
  gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days - keep in cache for a week
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  retry: 2,
};

// Semi-static data (regions, service areas, landmarks)
export const semiStaticDataConfig = {
  staleTime: 60 * 60 * 1000, // 1 hour
  gcTime: 24 * 60 * 60 * 1000, // 24 hours
  refetchOnWindowFocus: false,
  refetchOnMount: 'always' as const,
  retry: 2,
};

// Frequently updated data (driver locations, ride status)
export const realtimeDataConfig = {
  staleTime: 10 * 1000, // 10 seconds
  gcTime: 5 * 60 * 1000, // 5 minutes
  refetchOnWindowFocus: true,
  refetchOnMount: true,
  retry: 1,
};

// User-specific data (profile, saved places, ride history)
export const userDataConfig = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes
  refetchOnWindowFocus: true,
  refetchOnMount: true,
  retry: 2,
};

// Configuration data from app_settings
export const appSettingsConfig = {
  staleTime: 30 * 60 * 1000, // 30 minutes
  gcTime: 2 * 60 * 60 * 1000, // 2 hours
  refetchOnWindowFocus: false,
  refetchOnMount: 'always' as const,
  retry: 3,
};

// Query Keys for consistent caching
export const queryKeys = {
  // Service areas and regions
  regions: ['regions'] as const,
  activeRegions: ['regions', 'active'] as const,
  serviceAreas: ['serviceAreas'] as const,
  
  // Vehicle and fare data
  vehicleTypes: ['vehicleTypes'] as const,
  regionFares: (regionId?: string) => ['regionFares', regionId] as const,
  
  // App settings
  appSettings: (key: string) => ['appSettings', key] as const,
  mapSettings: ['appSettings', 'maps'] as const,
  
  // Driver data
  nearbyDrivers: (lat: number, lng: number) => ['nearbyDrivers', lat, lng] as const,
  driverLocation: (driverId: string) => ['driverLocation', driverId] as const,
  
  // Ride data
  activeRide: (userId: string) => ['activeRide', userId] as const,
  rideHistory: (userId: string) => ['rideHistory', userId] as const,
  
  // Landmarks
  landmarks: ['landmarks'] as const,
  landmarksByRegion: (regionId: string) => ['landmarks', regionId] as const,
  
  // User data
  profile: (userId: string) => ['profile', userId] as const,
  savedPlaces: (userId: string) => ['savedPlaces', userId] as const,
} as const;
