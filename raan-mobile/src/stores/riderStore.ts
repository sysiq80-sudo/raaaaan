/**
 * ران - متجر حالة الراكب (Zustand + AsyncStorage)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Location, VehicleType, PaymentMethod, RideStatus } from '../types';

interface SavedPlace {
  id: string;
  label: string;
  address: string;
  location: Location;
}

interface RiderState {
  // الرحلة الحالية
  activeRideId: string | null;
  activeRideStatus: RideStatus | null;

  // نقاط الرحلة
  pickup: Location | null;
  pickupAddress: string;
  dropoff: Location | null;
  dropoffAddress: string;

  // خيارات
  vehicleType: VehicleType;
  paymentMethod: PaymentMethod;

  // أماكن محفوظة
  savedPlaces: SavedPlace[];

  // Actions
  setPickup: (loc: Location | null, address?: string) => void;
  setDropoff: (loc: Location | null, address?: string) => void;
  setVehicleType: (type: VehicleType) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setActiveRide: (id: string | null, status?: RideStatus | null) => void;
  setSavedPlaces: (places: SavedPlace[]) => void;
  resetTrip: () => void;
}

export const useRiderStore = create<RiderState>()(
  persist(
    (set) => ({
      activeRideId: null,
      activeRideStatus: null,
      pickup: null,
      pickupAddress: '',
      dropoff: null,
      dropoffAddress: '',
      vehicleType: 'economy',
      paymentMethod: 'cash',
      savedPlaces: [],

      setPickup: (loc, address = '') =>
        set({ pickup: loc, pickupAddress: address }),

      setDropoff: (loc, address = '') =>
        set({ dropoff: loc, dropoffAddress: address }),

      setVehicleType: (type) => set({ vehicleType: type }),

      setPaymentMethod: (method) => set({ paymentMethod: method }),

      setActiveRide: (id, status = null) =>
        set({ activeRideId: id, activeRideStatus: status }),

      setSavedPlaces: (places) => set({ savedPlaces: places }),

      resetTrip: () =>
        set({
          pickup: null,
          pickupAddress: '',
          dropoff: null,
          dropoffAddress: '',
          activeRideId: null,
          activeRideStatus: null,
        }),
    }),
    {
      name: 'raan-rider-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        vehicleType: state.vehicleType,
        paymentMethod: state.paymentMethod,
        savedPlaces: state.savedPlaces,
      }),
    },
  ),
);
