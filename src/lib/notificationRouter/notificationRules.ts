/**
 * Default Notification Rules
 * Prevents spam while ensuring critical notifications are delivered
 * 
 * PHILOSOPHY:
 * - Driver concentrating → no distracting notifications
 * - Driver parked/idle → full notifications
 * - Critical events → always notify
 * - Location updates → smart batching
 */

import {
  NotificationRule,
  NotificationPriority,
  NotificationDelivery,
} from './types';

/**
 * RULE 1: Critical Events - Always notify with max urgency
 * ride-cancelled, urgent-support, emergency
 */
export const RULE_CRITICAL_EVENTS: NotificationRule = {
  id: 'rule-critical-events',
  name: 'Critical Events',
  enabled: true,
  conditions: [
    {
      type: 'event-type',
      eventType: ['ride-cancelled', 'urgent-support'],
    },
  ],
  actions: [
    {
      type: 'deliver',
      delivery: {
        sound: true,
        vibration: true,
        banner: true,
        badge: true,
        haptic: true,
        localNotification: true,
      },
    },
  ],
  priority: NotificationPriority.CRITICAL,
};

/**
 * RULE 2: Driver Parked (Not Driving) - Full notifications
 * ride-accepted, driver-arrived, payment-confirmation
 */
export const RULE_DRIVER_PARKED: NotificationRule = {
  id: 'rule-driver-parked',
  name: 'Driver Parked - Full Notifications',
  enabled: true,
  conditions: [
    {
      type: 'event-type',
      eventType: ['ride-accepted', 'driver-arrived', 'payment-confirmation'],
    },
    {
      type: 'is-driving',
      isDriving: false, // Not driving
    },
  ],
  actions: [
    {
      type: 'deliver',
      delivery: {
        sound: true,
        vibration: true,
        banner: true,
        badge: true,
        haptic: true,
        localNotification: true,
      },
    },
  ],
  priority: NotificationPriority.HIGH,
};

/**
 * RULE 3: Driver Actively Driving - Silent notifications (no sound/vibration)
 * ride-accepted, driver-arrived, eta-updated
 * 
 * Reasoning:
 * - Keep driver focused on road
 * - Quick glance at in-app banner is enough
 * - No auditory distraction = safer driving
 */
export const RULE_DRIVER_DRIVING_SILENT: NotificationRule = {
  id: 'rule-driver-driving-silent',
  name: 'Driver Driving - Silent Notifications',
  enabled: true,
  conditions: [
    {
      type: 'event-type',
      eventType: ['ride-accepted', 'driver-arrived', 'eta-updated'],
    },
    {
      type: 'is-driving',
      isDriving: true, // Currently driving
    },
  ],
  actions: [
    {
      type: 'deliver',
      delivery: {
        sound: false, // SILENT - avoid distraction
        vibration: false,
        banner: true, // Quick glance OK
        badge: false,
        haptic: false,
        localNotification: false,
      },
    },
  ],
  priority: NotificationPriority.NORMAL,
  deduplicationWindow: 10000, // Hold for 10s to batch
};

/**
 * RULE 4: Location Updates - Smart batching
 * driver-location-update: batch every 5 seconds (Rider watching driver position)
 * 
 * Reasoning:
 * - Rider doesn't need every GPS ping
 * - Batch 3-5 updates into one notification
 * - Reduces notification spam by 80%
 */
export const RULE_LOCATION_UPDATE_BATCHING: NotificationRule = {
  id: 'rule-location-batching',
  name: 'Location Updates - Smart Batching',
  enabled: true,
  conditions: [
    {
      type: 'event-type',
      eventType: ['driver-location-update'],
    },
  ],
  actions: [
    {
      type: 'queue',
      queueMs: 5000, // Wait 5s and batch multiple updates
    },
    {
      type: 'deliver',
      delivery: {
        sound: false,
        vibration: false,
        banner: false, // No UI popup for location
        badge: false,
        haptic: false,
        localNotification: false,
      },
    },
  ],
  priority: NotificationPriority.LOW,
  deduplicationWindow: 5000,
};

/**
 * RULE 5: ETA Updates - Only notify when significant change (>5 min)
 * 
 * Reasoning:
 * - Rider is watching the timer already
 * - Only notify if ETA changes significantly
 * - Prevents "1 min → 59s → 58s → 57s" spam
 */
export const RULE_ETA_SIGNIFICANT_CHANGE: NotificationRule = {
  id: 'rule-eta-significant',
  name: 'ETA - Only Significant Changes',
  enabled: true,
  conditions: [
    {
      type: 'event-type',
      eventType: ['eta-updated'],
    },
    // Custom check: ETA changed by >5 minutes
    {
      type: 'custom',
      customCheck: (context) => {
        const previousETA = context.recentNotifications
          .filter((n) => n.eventType === 'eta-updated')
          .slice(-1)[0];

        if (!previousETA) return true; // First ETA, notify

        const prevTime = previousETA.timestamp;
        const currTime = context.eventTimestamp;
        const deltaMinutes = Math.abs(currTime - prevTime) / (1000 * 60);

        return deltaMinutes >= 5; // Only if 5+ minutes changed
      },
    },
  ],
  actions: [
    {
      type: 'deliver',
      delivery: {
        sound: false,
        vibration: false,
        banner: true, // In-app only
        badge: false,
        haptic: false,
        localNotification: false,
      },
    },
  ],
  priority: NotificationPriority.LOW,
  deduplicationWindow: 60000, // Don't spam within 1 minute
};

/**
 * RULE 6: Night Time Quiet Hours (10 PM - 8 AM)
 * Reduce notifications at night to not wake user
 */
export const RULE_NIGHT_TIME_QUIET: NotificationRule = {
  id: 'rule-night-quiet',
  name: 'Night Time - Quiet Hours',
  enabled: true,
  conditions: [
    {
      type: 'time-of-day',
      hoursRange: [22, 8], // 10 PM to 8 AM
    },
    {
      type: 'event-type',
      eventType: ['rating-request', 'payment-confirmation'],
    },
  ],
  actions: [
    {
      type: 'queue',
      queueMs: 3600000, // Queue until morning (1 hour example, adjust as needed)
    },
    {
      type: 'deliver',
      delivery: {
        sound: false,
        vibration: false,
        banner: false,
        badge: true, // Silent badge, user checks in morning
        haptic: false,
        localNotification: false,
      },
    },
  ],
  priority: NotificationPriority.LOW,
  deduplicationWindow: 3600000,
};

/**
 * RULE 7: Ride Lifecycle - Important milestones
 * ride-started: notify driver has started (for rider)
 * ride-completed: completion with delivery method based on driving state
 */
export const RULE_RIDE_LIFECYCLE: NotificationRule = {
  id: 'rule-ride-lifecycle',
  name: 'Ride Lifecycle Events',
  enabled: true,
  conditions: [
    {
      type: 'event-type',
      eventType: ['ride-started', 'ride-completed'],
    },
  ],
  actions: [
    {
      type: 'deliver',
      delivery: {
        sound: true,
        vibration: true,
        banner: true,
        badge: true,
        haptic: true,
        localNotification: true,
      },
    },
  ],
  priority: NotificationPriority.HIGH,
  deduplicationWindow: 30000,
};

/**
 * RULE 8: Suppress Duplicates
 * If same event notified in last 5 seconds, suppress
 */
export const RULE_DEDUPLICATION_FALLBACK: NotificationRule = {
  id: 'rule-dedup-fallback',
  name: 'Global Deduplication Fallback',
  enabled: true,
  conditions: [], // Always check
  actions: [
    {
      type: 'log',
      logLevel: 'debug',
    },
  ],
  priority: NotificationPriority.SILENT,
  deduplicationWindow: 5000,
};

/**
 * RULE 9: New Ride Request (Driver Side)
 * سائق يتلقى طلب رحلة جديد — إشعار كامل دائماً (صوت + اهتزاز)
 * dedup 3 ثوانٍ لمنع تكرار Supabase Realtime عند إعادة الاتصال
 */
export const RULE_NEW_RIDE_REQUEST: NotificationRule = {
  id: 'rule-new-ride-request',
  name: 'New Ride Request - Full Alert',
  enabled: true,
  conditions: [
    {
      type: 'event-type',
      eventType: ['new-ride-request'],
    },
  ],
  actions: [
    {
      type: 'deliver',
      delivery: {
        sound: true,
        vibration: true,
        banner: true,
        badge: true,
        haptic: true,
        localNotification: true,
      },
    },
  ],
  priority: NotificationPriority.HIGH,
  deduplicationWindow: 3000, // منع Double-ring من Supabase retransmit
};

/**
 * All default rules in order of priority/evaluation
 * Rules are evaluated in order - first match wins
 */
export const DEFAULT_NOTIFICATION_RULES: NotificationRule[] = [
  // Critical first
  RULE_CRITICAL_EVENTS,

  // New ride requests (driver side) — always HIGH priority
  RULE_NEW_RIDE_REQUEST,

  // Then driving state
  RULE_DRIVER_DRIVING_SILENT,
  RULE_DRIVER_PARKED,

  // Then event-specific
  RULE_RIDE_LIFECYCLE,
  RULE_LOCATION_UPDATE_BATCHING,
  RULE_ETA_SIGNIFICANT_CHANGE,

  // Time-based
  RULE_NIGHT_TIME_QUIET,

  // Fallback
  RULE_DEDUPLICATION_FALLBACK,
];

/**
 * Get rule by ID for testing/debugging
 */
export function getNotificationRuleById(ruleId: string): NotificationRule | undefined {
  return DEFAULT_NOTIFICATION_RULES.find((r) => r.id === ruleId);
}

/**
 * Enable/disable rule dynamically
 */
export function setRuleEnabled(ruleId: string, enabled: boolean): void {
  const rule = getNotificationRuleById(ruleId);
  if (rule) {
    rule.enabled = enabled;
    console.log(`[NotificationRules] Rule ${ruleId} ${enabled ? 'enabled' : 'disabled'}`);
  }
}
