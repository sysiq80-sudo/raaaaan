/**
 * Notification Router Module
 * Smart notification filtering and routing
 */

export { NotificationRouter, globalNotificationRouter } from './NotificationRouter';
export type {
  NotificationRule,
  NotificationContext,
  NotificationMessage,
  NotificationStats,
  NotificationEventType,
  NotificationDelivery,
  NotificationCondition,
  NotificationAction,
} from './types';
export { NotificationPriority } from './types';
export {
  DEFAULT_NOTIFICATION_RULES,
  RULE_CRITICAL_EVENTS,
  RULE_DRIVER_DRIVING_SILENT,
  RULE_DRIVER_PARKED,
  RULE_LOCATION_UPDATE_BATCHING,
  RULE_ETA_SIGNIFICANT_CHANGE,
  RULE_NIGHT_TIME_QUIET,
  RULE_RIDE_LIFECYCLE,
  RULE_DEDUPLICATION_FALLBACK,
  getNotificationRuleById,
  setRuleEnabled,
} from './notificationRules';
