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
    phone: '+964 7734446636',
} as const;

// إحداثيات المناطق
export const LOCATIONS = {
    RAMADI_CENTER: { lat: 33.4262, lng: 43.2954 },
    FALLUJAH_CENTER: { lat: 33.3500, lng: 43.7833 },
    ANBAR_BOUNDS: {
        north: 34.5,
        south: 32.0,
        east: 44.5,
        west: 38.5,
    },
} as const;

// أنواع المركبات
export const VEHICLE_TYPES = {
    economy: {
        id: 'economy',
        nameAr: 'اقتصادي',
        nameEn: 'Economy',
        icon: '🚗',
        multiplier: 1.0,
        description: 'سيارات عادية وأسعار مناسبة',
    },
    comfort: {
        id: 'comfort',
        nameAr: 'مريح',
        nameEn: 'Comfort',
        icon: '🚙',
        multiplier: 1.3,
        description: 'سيارات مريحة ومكيفة',
    },
    premium: {
        id: 'premium',
        nameAr: 'فاخر',
        nameEn: 'Premium',
        icon: '🚘',
        multiplier: 1.8,
        description: 'سيارات فاخرة وخدمة مميزة',
    },
    women_only: {
        id: 'women_only',
        nameAr: 'للنساء فقط',
        nameEn: 'Women Only',
        icon: '👩',
        multiplier: 1.2,
        description: 'سائقات محترفات للنساء فقط',
    },
} as const;

// طرق الدفع - 3 خيارات أساسية
export const PAYMENT_METHODS = {
    cash: {
        id: 'cash',
        nameAr: 'نقداً',
        nameEn: 'Cash',
        icon: 'Banknote',
        enabled: true,
    },
    wallet: {
        id: 'wallet',
        nameAr: 'المحفظة',
        nameEn: 'Wallet',
        icon: 'Wallet',
        enabled: true,
    },
    card: {
        id: 'card',
        nameAr: 'البطاقة',
        nameEn: 'Card',
        icon: 'CreditCard',
        enabled: true,
    },
} as const;

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
    appSupport: '+964 7734446636',
} as const;

// دالة تقريب الأسعار لأقرب 250 دينار
export const roundFare = (fare: number): number => {
    return Math.round(fare / 250) * 250;
};

// Types
export type VehicleType = keyof typeof VEHICLE_TYPES;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;
export type RideStatus = keyof typeof RIDE_STATUS;
export type DriverStatus = keyof typeof DRIVER_STATUS;
