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
type NotificationMuteMode = 'off' | 'always' | 'scheduled';

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

interface RideRequest {
    id: string;
    rideId: string;
    pickupAddress: string | null;
    dropoffAddress: string | null;
    estimatedFare: number | null;
    distanceKm: number | null;
    receivedAt: string;
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
    pendingRequests: RideRequest[];

    // تاريخ آخر إعادة ضبط يومي
    lastStatsResetDate: string | null;

    // الإعدادات
    autoAccept: boolean;
    soundsEnabled: boolean;
    vibrationEnabled: boolean;

    // إعدادات كتم الإشعارات
    notificationMuteMode: NotificationMuteMode;
    muteScheduleStart: string; // "HH:mm" format
    muteScheduleEnd: string;   // "HH:mm" format
    muteDays: number[];        // 0=Sunday, 1=Monday, ... 6=Saturday
    notificationVolume: number; // 0-100

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
    addPendingRequest: (request: RideRequest) => void;
    removePendingRequest: (requestId: string) => void;
    clearPendingRequests: () => void;

    // إعادة ضبط تلقائي عند منتصف الليل
    checkAndResetDailyStats: () => void;

    // الإعدادات
    toggleAutoAccept: () => void;
    toggleSounds: () => void;
    toggleVibration: () => void;

    // إعدادات كتم الإشعارات
    setNotificationMuteMode: (mode: NotificationMuteMode) => void;
    setMuteSchedule: (start: string, end: string, days: number[]) => void;
    setNotificationVolume: (volume: number) => void;
    isMutedNow: () => boolean;

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
    lastStatsResetDate: null,
    autoAccept: false,
    soundsEnabled: true,
    vibrationEnabled: true,
    notificationMuteMode: 'off' as NotificationMuteMode,
    muteScheduleStart: '23:00',
    muteScheduleEnd: '07:00',
    muteDays: [0, 1, 2, 3, 4, 5, 6], // كل الأيام افتراضياً
    notificationVolume: 80,
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
                lastStatsResetDate: new Date().toISOString().split('T')[0],
            }),

            // إعادة ضبط تلقائي عند منتصف الليل
            checkAndResetDailyStats: () => {
                const today = new Date().toISOString().split('T')[0];
                const { lastStatsResetDate } = get();
                if (lastStatsResetDate !== today) {
                    set({
                        todayStats: { rides: 0, earnings: 0, onlineHours: 0 },
                        lastStatsResetDate: today,
                    });
                    console.log('[DriverStore] Daily stats auto-reset for', today);
                }
            },

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

            // إعدادات كتم الإشعارات
            setNotificationMuteMode: (mode) => set({ notificationMuteMode: mode }),

            setMuteSchedule: (start, end, days) => set({
                muteScheduleStart: start,
                muteScheduleEnd: end,
                muteDays: days,
            }),

            setNotificationVolume: (volume) => set({ notificationVolume: volume }),

            isMutedNow: () => {
                const state = get();
                if (state.notificationMuteMode === 'off') return false;
                if (state.notificationMuteMode === 'always') return true;

                // scheduled mode
                const now = new Date();
                const currentDay = now.getDay();
                if (!state.muteDays.includes(currentDay)) return false;

                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                const [startH, startM] = state.muteScheduleStart.split(':').map(Number);
                const [endH, endM] = state.muteScheduleEnd.split(':').map(Number);
                const startMinutes = startH * 60 + startM;
                const endMinutes = endH * 60 + endM;

                if (startMinutes <= endMinutes) {
                    // نفس اليوم: مثل 08:00 - 17:00
                    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
                } else {
                    // عبر منتصف الليل: مثل 23:00 - 07:00
                    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
                }
            },

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
                notificationMuteMode: state.notificationMuteMode,
                muteScheduleStart: state.muteScheduleStart,
                muteScheduleEnd: state.muteScheduleEnd,
                muteDays: state.muteDays,
                notificationVolume: state.notificationVolume,
                todayStats: state.todayStats,
                lastStatsResetDate: state.lastStatsResetDate,
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
export const useDriverActiveRide = () => useDriverStore((state) => state.activeRide);

/** @deprecated Use useDriverActiveRide instead — kept for backward compatibility */
export const useActiveRideStore = useDriverActiveRide;
export const useTodayStats = () => useDriverStore((state) => state.todayStats);
export const useDriverSettings = () => useDriverStore((state) => ({
    autoAccept: state.autoAccept,
    soundsEnabled: state.soundsEnabled,
    vibrationEnabled: state.vibrationEnabled,
}));

export const useNotificationMuteSettings = () => useDriverStore((state) => ({
    notificationMuteMode: state.notificationMuteMode,
    muteScheduleStart: state.muteScheduleStart,
    muteScheduleEnd: state.muteScheduleEnd,
    muteDays: state.muteDays,
    notificationVolume: state.notificationVolume,
    isMutedNow: state.isMutedNow,
    setNotificationMuteMode: state.setNotificationMuteMode,
    setMuteSchedule: state.setMuteSchedule,
    setNotificationVolume: state.setNotificationVolume,
}));

export default useDriverStore;
