/**
 * ران - ثوابت التطبيق
 * جميع الثوابت المستخدمة في التطبيق في مكان واحد
 */

// معلومات التطبيق
export const APP_INFO = {
    name: 'ران',
    nameEn: 'RAAN',
    version: '1.0.0',
    description: 'تطبيق تاكسي ذكي مصمم خصيصاً لمحافظة الأنبار',
    website: 'https://raan.app',
    email: 'info@raan.app',
    phone: '+964 7884669922',
} as const;

// إحداثيات المناطق
export const LOCATIONS = {
    RAMADI_CENTER: { lat: 33.4233, lng: 43.2974 },
    FALLUJAH_CENTER: { lat: 33.3500, lng: 43.7833 },
    ANBAR_BOUNDS: {
        north: 34.5,
        south: 32.0,
        east: 44.5,
        west: 38.5,
    },
} as const;

// ملاحظة: أنواع المركبات وطرق الدفع تُجلب ديناميكياً من DB
// استخدم useVehicleTypes() و usePaymentMethods() بدلاً من الثوابت الثابتة
// حالات الرحلة
export const RIDE_STATUS = {
    pending: {
        id: 'pending',
        nameAr: 'في الانتظار',
        nameEn: 'Pending',
        color: 'warning',
        description: 'جاري البحث عن سائق',
    },
    accepted: {
        id: 'accepted',
        nameAr: 'تم القبول',
        nameEn: 'Accepted',
        color: 'info',
        description: 'السائق في الطريق',
    },
    arrived: {
        id: 'arrived',
        nameAr: 'وصل السائق',
        nameEn: 'Arrived',
        color: 'primary',
        description: 'السائق في انتظارك',
    },
    in_progress: {
        id: 'in_progress',
        nameAr: 'في الطريق',
        nameEn: 'In Progress',
        color: 'success',
        description: 'أنت في الطريق للوجهة',
    },
    completed: {
        id: 'completed',
        nameAr: 'مكتملة',
        nameEn: 'Completed',
        color: 'success',
        description: 'تم إكمال الرحلة بنجاح',
    },
    cancelled: {
        id: 'cancelled',
        nameAr: 'ملغاة',
        nameEn: 'Cancelled',
        color: 'destructive',
        description: 'تم إلغاء الرحلة',
    },
} as const;

// حالات السائق
export const DRIVER_STATUS = {
    pending: {
        id: 'pending',
        nameAr: 'قيد المراجعة',
        nameEn: 'Pending',
        color: 'warning',
    },
    approved: {
        id: 'approved',
        nameAr: 'مقبول',
        nameEn: 'Approved',
        color: 'success',
    },
    rejected: {
        id: 'rejected',
        nameAr: 'مرفوض',
        nameEn: 'Rejected',
        color: 'destructive',
    },
    suspended: {
        id: 'suspended',
        nameAr: 'موقوف',
        nameEn: 'Suspended',
        color: 'destructive',
    },
} as const;

// إعدادات الخريطة
export const MAP_CONFIG = {
    defaultZoom: 14,
    maxZoom: 18,
    minZoom: 8,
    clusterRadius: 50,
    clusterMaxZoom: 14,
    driverRefreshInterval: 5000, // 5 ثوان
    routeColor: '#00d9a5',
    pickupMarkerColor: '#22c55e', // أخضر للانطلاق 🟢
    dropoffMarkerColor: '#2A6CD5', // أزرق مضيء للوجهة 🔵
    driverMarkerColor: '#3b82f6',
} as const;

// إعدادات API
export const API_CONFIG = {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    pollingInterval: 5000,
    requestTimeout: 30000,
    maxRetries: 3,
} as const;

// رسائل التطبيق
export const MESSAGES = {
    errors: {
        network: 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.',
        location: 'تعذر تحديد موقعك الحالي. تأكد من تفعيل خدمات الموقع.',
        login: 'فشل تسجيل الدخول. تحقق من بياناتك.',
        generic: 'حدث خطأ غير متوقع. حاول مرة أخرى.',
    },
    success: {
        rideBooked: 'تم حجز رحلتك بنجاح!',
        rideCompleted: 'تم إكمال الرحلة بنجاح!',
        profileUpdated: 'تم تحديث بياناتك بنجاح.',
    },
    notifications: {
        driverAccepted: '🎉 تم قبول طلبك! السائق في الطريق.',
        driverArrived: '🔔 وصل السائق! اخرج الآن.',
        rideStarted: '🛣️ انطلقت الرحلة!',
        rideCancelled: '❌ تم إلغاء الرحلة.',
    },
} as const;

// أرقام الطوارئ
export const EMERGENCY_CONTACTS = {
    emergency: '911', // رقم الطوارئ الموحد
    appSupport: '+964 7884669922',
} as const;

// دالة تقريب الأسعار لأقرب 250 دينار
export const roundFare = (fare: number): number => {
    return Math.round(fare / 250) * 250;
};

// Types
// VehicleType و PaymentMethod مُعرَّفان في الهوكس الديناميكية:
// - VehicleTypeKey في src/hooks/useVehicleTypes.ts
// - PaymentMethodDB في src/hooks/usePaymentMethods.ts
export type RideStatus = keyof typeof RIDE_STATUS;
export type DriverStatus = keyof typeof DRIVER_STATUS;
