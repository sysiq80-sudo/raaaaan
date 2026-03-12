/**
 * Google Analytics 4 Integration
 * تكامل كامل مع GA4 لتحليل أداء الموقع
 * 
 * ⚠️ استبدل G-XXXXXXXXXX بمعرف GA4 الخاص بك في index.html وهنا
 */

// معرف القياس - استبدله بمعرفك الحقيقي
const GA_MEASUREMENT_ID = 'G-NDV0675R1V';

// تعريف gtag
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/**
 * إرسال حدث إلى Google Analytics
 */
export function gaEvent(
  eventName: string,
  params: Record<string, string | number | boolean | undefined> = {}
): void {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params);
}

/**
 * تتبع مشاهدة صفحة
 */
export function gaPageView(path: string, title?: string): void {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.href,
  });
}

/**
 * تتبع تسجيل الدخول
 */
export function gaLogin(method: string): void {
  gaEvent('login', { method });
}

/**
 * تتبع التسجيل
 */
export function gaSignUp(method: string): void {
  gaEvent('sign_up', { method });
}

/**
 * تتبع بحث
 */
export function gaSearch(searchTerm: string): void {
  gaEvent('search', { search_term: searchTerm });
}

/**
 * تتبع حجز رحلة (شراء)
 */
export function gaRideBooked(rideId: string, fare: number, vehicleType: string): void {
  gaEvent('purchase', {
    transaction_id: rideId,
    value: fare,
    currency: 'IQD',
    items: vehicleType,
  });
}

/**
 * تتبع بدء حجز (begin_checkout)
 */
export function gaRideSearched(pickupName?: string, dropoffName?: string): void {
  gaEvent('begin_checkout', {
    pickup: pickupName || 'unknown',
    dropoff: dropoffName || 'unknown',
  });
}

/**
 * تتبع إلغاء رحلة
 */
export function gaRideCancelled(rideId: string, reason?: string): void {
  gaEvent('ride_cancelled', {
    ride_id: rideId,
    reason: reason || 'unknown',
  });
}

/**
 * تتبع إكمال رحلة
 */
export function gaRideCompleted(rideId: string, fare: number, duration?: number): void {
  gaEvent('ride_completed', {
    ride_id: rideId,
    value: fare,
    currency: 'IQD',
    duration_minutes: duration,
  });
}

/**
 * تتبع تقييم رحلة
 */
export function gaRideRated(rideId: string, rating: number): void {
  gaEvent('ride_rated', {
    ride_id: rideId,
    rating,
  });
}

/**
 * تتبع خطأ
 */
export function gaError(errorMessage: string, context?: string): void {
  gaEvent('exception', {
    description: `${context ? context + ': ' : ''}${errorMessage}`.substring(0, 150),
    fatal: false,
  });
}

/**
 * تتبع أداء (Web Vitals)
 */
export function gaPerformance(metricName: string, value: number): void {
  gaEvent('web_vitals', {
    metric_name: metricName,
    value: Math.round(value),
    metric_id: `${metricName}_${Date.now()}`,
  });
}

/**
 * تتبع تفاعل المستخدم مع عنصر
 */
export function gaClick(elementName: string, section?: string): void {
  gaEvent('select_content', {
    content_type: elementName,
    content_id: section || 'general',
  });
}

/**
 * تعيين خصائص المستخدم
 */
export function gaSetUserProperties(properties: Record<string, string | number | boolean>): void {
  if (typeof window.gtag !== 'function') return;
  window.gtag('set', 'user_properties', properties);
}

/**
 * تعيين معرف المستخدم
 */
export function gaSetUserId(userId: string): void {
  if (typeof window.gtag !== 'function') return;
  window.gtag('config', GA_MEASUREMENT_ID, { user_id: userId });
}

/**
 * تتبع وقت التفاعل (timing)
 */
export function gaTiming(category: string, variable: string, value: number): void {
  gaEvent('timing_complete', {
    name: variable,
    value: Math.round(value),
    event_category: category,
  });
}

export default {
  gaEvent,
  gaPageView,
  gaLogin,
  gaSignUp,
  gaSearch,
  gaRideBooked,
  gaRideSearched,
  gaRideCancelled,
  gaRideCompleted,
  gaRideRated,
  gaError,
  gaPerformance,
  gaClick,
  gaSetUserProperties,
  gaSetUserId,
  gaTiming,
};
