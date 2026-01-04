/**
 * ران - نظام تتبع الأحداث والتحليلات
 * يتتبع سلوك المستخدمين والأحداث المهمة
 */

import { supabase } from '@/integrations/supabase/client';

// أنواع الأحداث
export const AnalyticsEvents = {
    // أحداث المصادقة
    AUTH_LOGIN: 'auth_login',
    AUTH_LOGOUT: 'auth_logout',
    AUTH_SIGNUP: 'auth_signup',
    AUTH_PASSWORD_RESET: 'auth_password_reset',

    // أحداث الرحلات
    RIDE_SEARCH: 'ride_search',
    RIDE_BOOK: 'ride_book',
    RIDE_CANCEL: 'ride_cancel',
    RIDE_COMPLETE: 'ride_complete',
    RIDE_RATE: 'ride_rate',

    // أحداث السائق
    DRIVER_GO_ONLINE: 'driver_go_online',
    DRIVER_GO_OFFLINE: 'driver_go_offline',
    DRIVER_ACCEPT_RIDE: 'driver_accept_ride',
    DRIVER_REJECT_RIDE: 'driver_reject_ride',
    DRIVER_COMPLETE_RIDE: 'driver_complete_ride',

    // أحداث التنقل
    PAGE_VIEW: 'page_view',
    SCREEN_VIEW: 'screen_view',

    // أحداث الدفع
    PAYMENT_INITIATED: 'payment_initiated',
    PAYMENT_SUCCESS: 'payment_success',
    PAYMENT_FAILED: 'payment_failed',

    // أحداث التطبيق
    APP_OPEN: 'app_open',
    APP_BACKGROUND: 'app_background',
    APP_ERROR: 'app_error',

    // أحداث الخريطة
    LOCATION_SELECTED: 'location_selected',
    DRIVER_LOCATED: 'driver_located',
} as const;

export type AnalyticsEvent = typeof AnalyticsEvents[keyof typeof AnalyticsEvents];

interface EventData {
    [key: string]: string | number | boolean | null | undefined;
}

interface AnalyticsConfig {
    enabled: boolean;
    debug: boolean;
    batchSize: number;
    flushInterval: number;
}

// التكوين حسب البيئة
const config: AnalyticsConfig = {
    enabled: true,
    debug: import.meta.env.DEV,
    batchSize: 10,
    flushInterval: 30000, // 30 ثانية
};

// مخزن مؤقت للأحداث
let eventBuffer: Array<{
    event: string;
    data: EventData;
    timestamp: string;
    session_id: string;
}> = [];

// معرف الجلسة
const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * تتبع حدث
 */
export const trackEvent = async (
    event: AnalyticsEvent | string,
    data: EventData = {}
): Promise<void> => {
    if (!config.enabled) return;

    const eventPayload = {
        event,
        data: {
            ...data,
            url: window.location.href,
            referrer: document.referrer,
            user_agent: navigator.userAgent,
            screen_width: window.innerWidth,
            screen_height: window.innerHeight,
            language: navigator.language,
        },
        timestamp: new Date().toISOString(),
        session_id: sessionId,
    };

    if (config.debug) {
        console.log('📊 Analytics Event:', event, data);
    }

    eventBuffer.push(eventPayload);

    // إرسال عند امتلاء المخزن المؤقت
    if (eventBuffer.length >= config.batchSize) {
        await flushEvents();
    }
};

/**
 * إرسال الأحداث المخزنة
 */
export const flushEvents = async (): Promise<void> => {
    if (eventBuffer.length === 0) return;

    const eventsToSend = [...eventBuffer];
    eventBuffer = [];

    try {
        // في الإنتاج، أرسل للخادم
        // await supabase.from('analytics_events').insert(eventsToSend);

        if (config.debug) {
            console.log('📤 Flushed analytics events:', eventsToSend.length);
        }
    } catch (error) {
        if (config.debug) {
            console.error('Failed to send analytics:', error);
        }
        // Error logging disabled - error_logs table not available
        // أعد الأحداث للمخزن المؤقت
        eventBuffer = [...eventsToSend, ...eventBuffer];
    }
};

/**
 * تتبع مشاهدة الصفحة
 */
export const trackPageView = (pageName: string, pageData: EventData = {}): void => {
    trackEvent(AnalyticsEvents.PAGE_VIEW, {
        page_name: pageName,
        page_path: window.location.pathname,
        page_title: document.title,
        ...pageData,
    });
};

/**
 * تتبع بحث رحلة
 */
export const trackRideSearch = (pickupLat: number, pickupLng: number, dropoffLat: number, dropoffLng: number): void => {
    trackEvent(AnalyticsEvents.RIDE_SEARCH, {
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        dropoff_lat: dropoffLat,
        dropoff_lng: dropoffLng,
    });
};

/**
 * تتبع حجز رحلة
 */
export const trackRideBook = (rideId: string, vehicleType: string, estimatedFare: number): void => {
    trackEvent(AnalyticsEvents.RIDE_BOOK, {
        ride_id: rideId,
        vehicle_type: vehicleType,
        estimated_fare: estimatedFare,
    });
};

/**
 * تتبع إلغاء رحلة
 */
export const trackRideCancel = (rideId: string, reason: string, cancelledBy: string): void => {
    trackEvent(AnalyticsEvents.RIDE_CANCEL, {
        ride_id: rideId,
        reason,
        cancelled_by: cancelledBy,
    });
};

/**
 * تتبع خطأ
 */
export const trackError = (error: Error, context: string = ''): void => {
    trackEvent(AnalyticsEvents.APP_ERROR, {
        error_name: error.name,
        error_message: error.message,
        error_stack: error.stack?.substring(0, 500),
        context,
    });
};

/**
 * Hook لتفعيل التتبع عند تحميل التطبيق
 */
export const initAnalytics = (): void => {
    // إرسال دوري
    setInterval(flushEvents, config.flushInterval);

    // إرسال قبل إغلاق الصفحة
    window.addEventListener('beforeunload', () => {
        flushEvents();
    });

    // تتبع فتح التطبيق
    trackEvent(AnalyticsEvents.APP_OPEN);

    if (config.debug) {
        console.log('📊 Analytics initialized with session:', sessionId);
    }
};

/**
 * تعطيل التتبع (للخصوصية)
 */
export const disableAnalytics = (): void => {
    config.enabled = false;
    eventBuffer = [];
};

/**
 * تفعيل التتبع
 */
export const enableAnalytics = (): void => {
    config.enabled = true;
};

export default {
    trackEvent,
    trackPageView,
    trackRideSearch,
    trackRideBook,
    trackRideCancel,
    trackError,
    initAnalytics,
    disableAnalytics,
    enableAnalytics,
    AnalyticsEvents,
};
