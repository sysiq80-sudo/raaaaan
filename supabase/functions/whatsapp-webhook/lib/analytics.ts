/**
 * ران — تتبع الأحداث والتحليلات
 * RAAN Analytics & Event Tracking
 *
 * يسجّل أحداث مهمة لتحليل أداء البوت:
 * - booking_funnel: مراحل الحجز (location → destination → confirm → pending → complete)
 * - user_engagement: أنماط تفاعل المستخدمين
 * - errors: أخطاء الإرسال والاستقبال
 * - performance: أوقات الاستجابة
 */

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./config.ts";

// ════════════════════════════════════════
// أنواع الأحداث
// ════════════════════════════════════════
export type EventType =
  // مراحل الحجز
  | "booking_location_received"
  | "booking_destination_set"
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_completed"
  | "booking_repeat_trip"
  // تفاعلات المستخدم
  | "user_greeting"
  | "user_inquiry"
  | "user_complaint"
  | "user_chat_relay"
  | "user_rating"
  | "user_track_driver"
  // تصنيف AI
  | "classify_local"
  | "classify_cached"
  | "classify_gpt"
  | "destination_local"
  | "destination_cached"
  | "destination_gpt"
  // أخطاء
  | "wa_send_failed"
  | "wa_send_error"
  | "geocode_failed"
  | "ai_error"
  | "whisper_error"
  // أداء
  | "response_time"
  | "session_timeout"
  | "rate_limited";

// ════════════════════════════════════════
// Buffer — تخزين مؤقت للأحداث (batch insert)
// ════════════════════════════════════════
interface AnalyticsEvent {
  event_type: string;
  phone_number?: string;
  ride_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

const _eventBuffer: AnalyticsEvent[] = [];
const MAX_BUFFER_SIZE = 20;
let _flushTimer: number | null = null;

/**
 * تسجيل حدث (non-blocking — لا يؤخر الاستجابة)
 */
export function trackEvent(
  eventType: EventType | string,
  metadata?: Record<string, unknown>,
  phoneNumber?: string,
  rideId?: string
): void {
  const event: AnalyticsEvent = {
    event_type: eventType,
    phone_number: phoneNumber ? hashPhone(phoneNumber) : undefined,
    ride_id: rideId,
    metadata,
    created_at: new Date().toISOString(),
  };

  _eventBuffer.push(event);
  console.log(`[analytics] 📊 ${eventType}${metadata ? " — " + JSON.stringify(metadata).substring(0, 100) : ""}`);

  // Flush إذا امتلأ البافر
  if (_eventBuffer.length >= MAX_BUFFER_SIZE) {
    flushEvents().catch(() => { });
  } else if (!_flushTimer) {
    // Flush بعد 5 ثوان
    _flushTimer = setTimeout(() => {
      flushEvents().catch(() => { });
      _flushTimer = null;
    }, 5000) as unknown as number;
  }
}

/**
 * تسجيل وقت الاستجابة
 */
export function trackResponseTime(startTime: number, phoneNumber?: string, action?: string): void {
  const durationMs = Date.now() - startTime;
  trackEvent("response_time", {
    duration_ms: durationMs,
    action: action || "webhook",
    is_slow: durationMs > 5000,
  }, phoneNumber);
}

/**
 * تسجيل مرحلة حجز في الـ funnel
 */
export function trackBookingFunnel(
  stage: "location" | "destination" | "confirm" | "pending" | "complete" | "cancel" | "repeat",
  phoneNumber: string,
  rideId?: string,
  extra?: Record<string, unknown>
): void {
  const eventMap: Record<string, EventType> = {
    location: "booking_location_received",
    destination: "booking_destination_set",
    confirm: "booking_confirmed",
    pending: "booking_confirmed",
    complete: "booking_completed",
    cancel: "booking_cancelled",
    repeat: "booking_repeat_trip",
  };
  trackEvent(eventMap[stage] || stage, extra, phoneNumber, rideId);
}

// ════════════════════════════════════════
// Flush — إرسال الأحداث لقاعدة البيانات
// ════════════════════════════════════════
async function flushEvents(): Promise<void> {
  if (_eventBuffer.length === 0) return;

  // نسخ ونفرّغ البافر
  const events = [..._eventBuffer];
  _eventBuffer.length = 0;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/analytics_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(events),
    });

    if (!res.ok) {
      // إذا الجدول غير موجود — سجل بصمت ولا تخطئ
      const errTxt = await res.text();
      if (errTxt.includes("relation") && errTxt.includes("does not exist")) {
        console.log("[analytics] Table not found, events logged to console only");
      } else {
        console.warn(`[analytics] Flush failed (${res.status}):`, errTxt.substring(0, 200));
      }
    } else {
      console.log(`[analytics] ✅ Flushed ${events.length} events`);
    }
  } catch (e) {
    // لا نريد أن يؤثر فشل التحليلات على العمل الأساسي
    console.warn("[analytics] Flush error (non-critical):", e);
  }
}

/**
 * Force flush — لاستدعائه في نهاية الـ handler
 */
export async function forceFlushEvents(): Promise<void> {
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
  await flushEvents();
}

// ════════════════════════════════════════
// Helper: تشفير رقم الهاتف (خصوصية)
// ════════════════════════════════════════
function hashPhone(phone: string): string {
  // نخفي الأرقام الوسطى
  if (phone.length > 6) {
    return phone.substring(0, 3) + "****" + phone.substring(phone.length - 3);
  }
  return "****";
}
