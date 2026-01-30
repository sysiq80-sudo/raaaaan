/**
 * ران - Rider Store (Zustand)
 * إدارة حالة الراكب بشكل مركزي
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// أنواع البيانات
interface Location {
    lat: number;
    lng: number;
    address?: string;
}

type VehicleType = 'economy' | 'comfort' | 'premium' | 'women_only';
type PaymentMethod = 'cash' | 'zain_cash' | 'asia_hawala' | 'qi_card';
type RideStatus = 'pending' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
type MapProvider = 'google' | 'mapbox';

interface ActiveRide {
    id: string;
    status: RideStatus;
    pickup: Location;
    dropoff: Location;
    driverId?: string;
    fare?: number;
}

// الحالة
interface RiderState {
    // المستخدم
    userId: string | null;
    userName: string | null;
    userPhone: string | null;

    // الموقع
    userLocation: Location | null;
    pickupLocation: Location | null;
    dropoffLocation: Location | null;

    // الحجز
    selectedVehicle: VehicleType;
    selectedPayment: PaymentMethod;
    routeDistance: number | null;
    routeDuration: number | null;
    estimatedFare: number | null;

    // الرحلة النشطة
    activeRide: ActiveRide | null;

    // الإعدادات
    notificationsEnabled: boolean;
    soundsEnabled: boolean;
    bottomNavEnabled: boolean;  // إظهار شريط التنقل السفلي
    mapProvider: MapProvider;  // مزود الخريطة

    // UI
    isLoading: boolean;
    showWelcomeScreen: boolean;
}

// الإجراءات
interface RiderActions {
    // المستخدم
    setUser: (userId: string | null, userName?: string, userPhone?: string) => void;
    clearUser: () => void;

    // الموقع
    setUserLocation: (location: Location | null) => void;
    setPickupLocation: (location: Location | null) => void;
    setDropoffLocation: (location: Location | null) => void;
    swapLocations: () => void;
    clearLocations: () => void;

    // الحجز
    setVehicle: (vehicle: VehicleType) => void;
    setPayment: (payment: PaymentMethod) => void;
    setRoute: (distance: number, duration: number) => void;
    setFare: (fare: number | null) => void;

    // الرحلة
    setActiveRide: (ride: ActiveRide | null) => void;
    updateRideStatus: (status: RideStatus) => void;
    clearRide: () => void;

    // الإعدادات
    toggleNotifications: () => void;
    toggleSounds: () => void;
    toggleBottomNav: () => void;
    setMapProvider: (provider: MapProvider) => void;

    // UI
    setLoading: (loading: boolean) => void;
    setShowWelcome: (show: boolean) => void;

    // إعادة تعيين
    reset: () => void;
}

// الحالة الافتراضية
const initialState: RiderState = {
    userId: null,
    userName: null,
    userPhone: null,
    userLocation: null,
    pickupLocation: null,
    dropoffLocation: null,
    selectedVehicle: 'economy',
    selectedPayment: 'cash',
    routeDistance: null,
    routeDuration: null,
    estimatedFare: null,
    activeRide: null,
    notificationsEnabled: true,
    soundsEnabled: true,
    bottomNavEnabled: true,  // مُفعَّل افتراضياً لسهولة التنقل
    mapProvider: 'mapbox',  // Mapbox افتراضياً
    isLoading: false,
    showWelcomeScreen: true,
};

// إنشاء المتجر
export const useRiderStore = create<RiderState & RiderActions>()(
    persist(
        (set, get) => ({
            ...initialState,

            // المستخدم
            setUser: (userId, userName, userPhone) =>
                set({ userId, userName: userName || null, userPhone: userPhone || null }),

            clearUser: () =>
                set({ userId: null, userName: null, userPhone: null }),

            // الموقع
            setUserLocation: (location) => set({ userLocation: location }),

            setPickupLocation: (location) => set({ pickupLocation: location }),

            setDropoffLocation: (location) => set({ dropoffLocation: location }),

            swapLocations: () => {
                const { pickupLocation, dropoffLocation } = get();
                set({
                    pickupLocation: dropoffLocation,
                    dropoffLocation: pickupLocation,
                });
            },

            clearLocations: () => set({
                pickupLocation: null,
                dropoffLocation: null,
                routeDistance: null,
                routeDuration: null,
                estimatedFare: null,
            }),

            // الحجز
            setVehicle: (vehicle) => set({ selectedVehicle: vehicle }),

            setPayment: (payment) => set({ selectedPayment: payment }),

            setRoute: (distance, duration) => set({
                routeDistance: distance,
                routeDuration: duration
            }),

            setFare: (fare) => set({ estimatedFare: fare }),

            // الرحلة
            setActiveRide: (ride) => set({ activeRide: ride }),

            updateRideStatus: (status) => {
                const { activeRide } = get();
                if (activeRide) {
                    set({ activeRide: { ...activeRide, status } });
                }
            },

            clearRide: () => set({
                activeRide: null,
                pickupLocation: null,
                dropoffLocation: null,
                routeDistance: null,
                routeDuration: null,
                estimatedFare: null,
            }),

            // الإعدادات
            toggleNotifications: () => set((state) => ({
                notificationsEnabled: !state.notificationsEnabled
            })),

            toggleSounds: () => set((state) => ({
                soundsEnabled: !state.soundsEnabled
            })),

            toggleBottomNav: () => set((state) => ({
                bottomNavEnabled: !state.bottomNavEnabled
            })),

            setMapProvider: (provider) => set({ mapProvider: provider }),

            // UI
            setLoading: (loading) => set({ isLoading: loading }),

            setShowWelcome: (show) => set({ showWelcomeScreen: show }),

            // إعادة تعيين
            reset: () => set(initialState),
        }),
        {
            name: 'raan-rider-store',
            partialize: (state) => ({
                // حفظ فقط الإعدادات والتفضيلات
                selectedVehicle: state.selectedVehicle,
                selectedPayment: state.selectedPayment,
                notificationsEnabled: state.notificationsEnabled,
                soundsEnabled: state.soundsEnabled,
                bottomNavEnabled: state.bottomNavEnabled,
                mapProvider: state.mapProvider,
                showWelcomeScreen: state.showWelcomeScreen,
            }),
        }
    )
);

// Selectors للاستخدام الأمثل
export const useRiderUser = () => useRiderStore((state) => ({
    userId: state.userId,
    userName: state.userName,
    userPhone: state.userPhone,
}));

export const useRiderLocations = () => useRiderStore((state) => ({
    userLocation: state.userLocation,
    pickupLocation: state.pickupLocation,
    dropoffLocation: state.dropoffLocation,
}));

export const useRiderBooking = () => useRiderStore((state) => ({
    selectedVehicle: state.selectedVehicle,
    selectedPayment: state.selectedPayment,
    routeDistance: state.routeDistance,
    routeDuration: state.routeDuration,
    estimatedFare: state.estimatedFare,
}));

export const useActiveRideStore = () => useRiderStore((state) => state.activeRide);

export default useRiderStore;
