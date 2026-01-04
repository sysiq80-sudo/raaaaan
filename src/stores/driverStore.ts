/**
 * ران - Driver Store (Zustand)
 * إدارة حالة السائق بشكل مركزي
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// أنواع البيانات
interface Location {
    lat: number;
    lng: number;
}

type DriverStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
type RideStatus = 'pending' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
type VehicleType = 'economy' | 'comfort' | 'premium' | 'women_only';

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
    durationMinutes: number | null;
    paymentMethod: string | null;
    startedAt: string | null;
}

interface TodayStats {
    rides: number;
    earnings: number;
    onlineHours: number;
}

// الحالة
interface DriverState {
    // معلومات السائق
    driver: DriverInfo | null;

    // الموقع
    currentLocation: Location | null;

    // الحالة
    isOnline: boolean;
    isAvailable: boolean;

    // الرحلة النشطة
    activeRide: ActiveRide | null;

    // إحصائيات اليوم
    todayStats: TodayStats;

    // طلبات الرحلات المعلقة
    pendingRequests: any[];

    // الإعدادات
    autoAccept: boolean;
    soundsEnabled: boolean;
    vibrationEnabled: boolean;

    // UI
    isLoading: boolean;
}

// الإجراءات
interface DriverActions {
    // السائق
    setDriver: (driver: DriverInfo | null) => void;
    updateDriverRating: (rating: number) => void;

    // الموقع
    setLocation: (location: Location | null) => void;

    // الحالة
    setOnline: (online: boolean) => void;
    setAvailable: (available: boolean) => void;
    goOnline: () => void;
    goOffline: () => void;

    // الرحلة
    setActiveRide: (ride: ActiveRide | null) => void;
    updateRideStatus: (status: RideStatus) => void;
    clearRide: () => void;

    // الإحصائيات
    updateTodayStats: (stats: Partial<TodayStats>) => void;
    incrementRides: () => void;
    addEarnings: (amount: number) => void;
    resetDailyStats: () => void;

    // الطلبات
    addPendingRequest: (request: any) => void;
    removePendingRequest: (requestId: string) => void;
    clearPendingRequests: () => void;

    // الإعدادات
    toggleAutoAccept: () => void;
    toggleSounds: () => void;
    toggleVibration: () => void;

    // UI
    setLoading: (loading: boolean) => void;

    // إعادة تعيين
    reset: () => void;
}

// الحالة الافتراضية
const initialState: DriverState = {
    driver: null,
    currentLocation: null,
    isOnline: false,
    isAvailable: true,
    activeRide: null,
    todayStats: {
        rides: 0,
        earnings: 0,
        onlineHours: 0,
    },
    pendingRequests: [],
    autoAccept: false,
    soundsEnabled: true,
    vibrationEnabled: true,
    isLoading: false,
};

// إنشاء المتجر
export const useDriverStore = create<DriverState & DriverActions>()(
    persist(
        (set, get) => ({
            ...initialState,

            // السائق
            setDriver: (driver) => set({ driver }),

            updateDriverRating: (rating) => {
                const { driver } = get();
                if (driver) {
                    set({ driver: { ...driver, rating } });
                }
            },

            // الموقع
            setLocation: (location) => set({ currentLocation: location }),

            // الحالة
            setOnline: (online) => set({ isOnline: online }),
            setAvailable: (available) => set({ isAvailable: available }),

            goOnline: () => set({ isOnline: true, isAvailable: true }),

            goOffline: () => set({
                isOnline: false,
                isAvailable: false,
                pendingRequests: [],
            }),

            // الرحلة
            setActiveRide: (ride) => set({
                activeRide: ride,
                isAvailable: ride === null,
            }),

            updateRideStatus: (status) => {
                const { activeRide } = get();
                if (activeRide) {
                    set({ activeRide: { ...activeRide, status } });
                }
            },

            clearRide: () => set({
                activeRide: null,
                isAvailable: true,
            }),

            // الإحصائيات
            updateTodayStats: (stats) => set((state) => ({
                todayStats: { ...state.todayStats, ...stats },
            })),

            incrementRides: () => set((state) => ({
                todayStats: {
                    ...state.todayStats,
                    rides: state.todayStats.rides + 1
                },
            })),

            addEarnings: (amount) => set((state) => ({
                todayStats: {
                    ...state.todayStats,
                    earnings: state.todayStats.earnings + amount
                },
            })),

            resetDailyStats: () => set({
                todayStats: { rides: 0, earnings: 0, onlineHours: 0 },
            }),

            // الطلبات
            addPendingRequest: (request) => set((state) => ({
                pendingRequests: [...state.pendingRequests, request],
            })),

            removePendingRequest: (requestId) => set((state) => ({
                pendingRequests: state.pendingRequests.filter(r => r.id !== requestId),
            })),

            clearPendingRequests: () => set({ pendingRequests: [] }),

            // الإعدادات
            toggleAutoAccept: () => set((state) => ({
                autoAccept: !state.autoAccept
            })),

            toggleSounds: () => set((state) => ({
                soundsEnabled: !state.soundsEnabled
            })),

            toggleVibration: () => set((state) => ({
                vibrationEnabled: !state.vibrationEnabled
            })),

            // UI
            setLoading: (loading) => set({ isLoading: loading }),

            // إعادة تعيين
            reset: () => set(initialState),
        }),
        {
            name: 'raan-driver-store',
            partialize: (state) => ({
                // حفظ فقط الإعدادات
                autoAccept: state.autoAccept,
                soundsEnabled: state.soundsEnabled,
                vibrationEnabled: state.vibrationEnabled,
                todayStats: state.todayStats,
            }),
        }
    )
);

// Selectors
export const useDriverInfo = () => useDriverStore((state) => state.driver);
export const useDriverLocation = () => useDriverStore((state) => state.currentLocation);
export const useDriverOnlineStatus = () => useDriverStore((state) => ({
    isOnline: state.isOnline,
    isAvailable: state.isAvailable,
}));
export const useActiveRideStore = () => useDriverStore((state) => state.activeRide);
export const useTodayStats = () => useDriverStore((state) => state.todayStats);
export const useDriverSettings = () => useDriverStore((state) => ({
    autoAccept: state.autoAccept,
    soundsEnabled: state.soundsEnabled,
    vibrationEnabled: state.vibrationEnabled,
}));

export default useDriverStore;
