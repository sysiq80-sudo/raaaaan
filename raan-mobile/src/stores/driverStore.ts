/**
 * ران - Driver Store (React Native - Zustand)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Location, VehicleType, DriverStatus, RideStatus } from '../types';

interface DriverInfo {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  vehicleType: VehicleType;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  vehicleColor: string | null;
  status: DriverStatus;
  rating: number;
  totalRides: number;
  totalEarnings: number;
}

interface ActiveRide {
  id: string;
  status: RideStatus;
  pickupLocation: Location;
  pickupAddress: string | null;
  dropoffLocation: Location;
  dropoffAddress: string | null;
  riderId: string;
  riderName: string | null;
  riderPhone: string | null;
  estimatedFare: number | null;
  distanceKm: number | null;
  paymentMethod: string | null;
  startedAt: string | null;
}

interface TodayStats {
  rides: number;
  earnings: number;
  onlineHours: number;
}

interface DriverState {
  driver: DriverInfo | null;
  currentLocation: Location | null;
  isOnline: boolean;
  isAvailable: boolean;
  activeRide: ActiveRide | null;
  todayStats: TodayStats;

  setDriver: (driver: DriverInfo | null) => void;
  setCurrentLocation: (location: Location | null) => void;
  setOnline: (online: boolean) => void;
  setAvailable: (available: boolean) => void;
  setActiveRide: (ride: ActiveRide | null) => void;
  updateTodayStats: (stats: Partial<TodayStats>) => void;
  reset: () => void;
}

const initialState = {
  driver: null,
  currentLocation: null,
  isOnline: false,
  isAvailable: false,
  activeRide: null,
  todayStats: { rides: 0, earnings: 0, onlineHours: 0 },
};

export const useDriverStore = create<DriverState>()(
  persist(
    (set) => ({
      ...initialState,
      setDriver: (driver) => set({ driver }),
      setCurrentLocation: (currentLocation) => set({ currentLocation }),
      setOnline: (isOnline) => set({ isOnline }),
      setAvailable: (isAvailable) => set({ isAvailable }),
      setActiveRide: (activeRide) => set({ activeRide }),
      updateTodayStats: (stats) =>
        set((state) => ({ todayStats: { ...state.todayStats, ...stats } })),
      reset: () => set(initialState),
    }),
    {
      name: 'raan-driver-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        driver: state.driver,
        isOnline: state.isOnline,
      }),
    },
  ),
);
