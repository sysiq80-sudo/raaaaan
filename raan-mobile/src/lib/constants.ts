/**
 * ران - ثوابت التطبيق (React Native)
 * نسخة متوافقة مع React Native بدون import.meta.env
 */

export const APP_INFO = {
  name: 'ران',
  nameEn: 'RAAN',
  version: '1.0.0',
  description: 'تطبيق تاكسي ذكي مصمم خصيصاً لمحافظة الأنبار',
  website: 'https://raan.app',
  email: 'info@raan.app',
  phone: '+964 7884669922',
} as const;

export const LOCATIONS = {
  RAMADI_CENTER: { lat: 33.4233, lng: 43.2974 },
  FALLUJAH_CENTER: { lat: 33.35, lng: 43.7833 },
  ANBAR_BOUNDS: {
    north: 34.5,
    south: 32.0,
    east: 44.5,
    west: 38.5,
  },
} as const;

export const RIDE_STATUS = {
  pending: { id: 'pending', nameAr: 'في الانتظار', nameEn: 'Pending', color: '#f59e0b' },
  accepted: { id: 'accepted', nameAr: 'تم القبول', nameEn: 'Accepted', color: '#3b82f6' },
  arrived: { id: 'arrived', nameAr: 'وصل السائق', nameEn: 'Arrived', color: '#6366f1' },
  in_progress: { id: 'in_progress', nameAr: 'في الطريق', nameEn: 'In Progress', color: '#22c55e' },
  completed: { id: 'completed', nameAr: 'مكتملة', nameEn: 'Completed', color: '#22c55e' },
  cancelled: { id: 'cancelled', nameAr: 'ملغاة', nameEn: 'Cancelled', color: '#ef4444' },
} as const;

export const DRIVER_STATUS = {
  pending: { id: 'pending', nameAr: 'قيد المراجعة', nameEn: 'Pending', color: '#f59e0b' },
  approved: { id: 'approved', nameAr: 'مقبول', nameEn: 'Approved', color: '#22c55e' },
  rejected: { id: 'rejected', nameAr: 'مرفوض', nameEn: 'Rejected', color: '#ef4444' },
  suspended: { id: 'suspended', nameAr: 'موقوف', nameEn: 'Suspended', color: '#ef4444' },
} as const;

export const MAP_CONFIG = {
  defaultZoom: 14,
  maxZoom: 18,
  minZoom: 8,
  driverRefreshInterval: 5000,
  routeColor: '#00d9a5',
  pickupMarkerColor: '#22c55e',
  dropoffMarkerColor: '#2A6CD5',
  driverMarkerColor: '#3b82f6',
} as const;

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

export const EMERGENCY_CONTACTS = {
  emergency: '911',
  appSupport: '+964 7884669922',
} as const;

export const roundFare = (fare: number): number => {
  return Math.round(fare / 250) * 250;
};

export type RideStatusKey = keyof typeof RIDE_STATUS;
export type DriverStatusKey = keyof typeof DRIVER_STATUS;
