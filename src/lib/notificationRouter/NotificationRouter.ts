/**
 * Notification Router - Smart notification delivery engine
 * Applies rules to determine if/how notification should be delivered
 * 
 * Flow:
 * Event → Evaluate all rules → Match first applicable → Apply delivery method
 */

import {
  NotificationRule,
  NotificationContext,
  NotificationMessage,
  NotificationStats,
  NotificationEventType,
  NotificationPriority,
  NotificationDelivery,
} from './types';
import { DEFAULT_NOTIFICATION_RULES } from './notificationRules';
const uuidv4 = () => crypto.randomUUID();

export interface NotificationRouterOptions {
  customRules?: NotificationRule[];
  enableDebugging?: boolean;
  maxRecentNotifications?: number; // Default: 50
}

export class NotificationRouter {
  private rules: NotificationRule[];
  private stats: NotificationStats;
  private recentNotifications: { eventType: string; timestamp: number }[] = [];
  private queuedNotifications: Map<string, NotificationMessage> = new Map();
  private debug: boolean;
  private maxRecentNotifications: number;

  constructor(options: NotificationRouterOptions = {}) {
    this.rules = options.customRules || DEFAULT_NOTIFICATION_RULES;
    this.debug = options.enableDebugging || false;
    this.maxRecentNotifications = options.maxRecentNotifications || 50;

    this.stats = {
      totalReceived: 0,
      totalDelivered: 0,
      totalSuppressed: 0,
      totalQueued: 0,
      deliveredByPriority: {},
      deliveryMethods: {},
    };
  }

  /**
   * Main entry point: Route a notification event
   * Returns: notification to deliver, or null if suppressed
   */
  async routeNotification(
    eventType: NotificationEventType,
    eventData: Record<string, any>,
    context: Partial<NotificationContext>
  ): Promise<NotificationMessage | null> {
    this.stats.totalReceived++;

    // Build complete context
    const fullContext: NotificationContext = {
      eventType,
      eventData,
      eventTimestamp: Date.now(),
      isActiveRide: context.isActiveRide || false,
      isDriving: context.isDriving || false,
      isInForeground: context.isInForeground !== false,
      currentLocation: context.currentLocation,
      localDateTime: new Date(),
      rideId: context.rideId,
      recentNotifications: this.recentNotifications,
    };

    this.log('debug', `[routeNotification] Event: ${eventType}`);

    // Step 1: Check global deduplication
    if (this.isDuplicateEvent(eventType)) {
      this.stats.totalSuppressed++;
      this.log('debug', `[routeNotification] Duplicate suppressed: ${eventType}`);
      return null;
    }

    // Step 2: Evaluate rules
    const matchedRule = this.evaluateRules(fullContext);

    if (!matchedRule) {
      this.stats.totalSuppressed++;
      this.log('info', `[routeNotification] No rule matched, suppressed: ${eventType}`);
      return null;
    }

    // Step 3: Create notification message
    const notification: NotificationMessage = {
      id: uuidv4(),
      eventType,
      title: this.getNotificationTitle(eventType),
      body: this.getNotificationBody(eventType, eventData),
      priority: matchedRule.priority,
      delivery: matchedRule.actions.find((a) => a.type === 'deliver')?.delivery || {
        sound: false,
        vibration: false,
        banner: false,
        badge: false,
      },
      timestamp: Date.now(),
      rideId: context.rideId,
      metadata: eventData,
    };

    // Step 4: Check if should queue
    const queueAction = matchedRule.actions.find((a) => a.type === 'queue');
    if (queueAction && queueAction.queueMs) {
      this.log('info', `[routeNotification] Queued: ${eventType} for ${queueAction.queueMs}ms`);
      this.queueNotification(notification, queueAction.queueMs);
      this.stats.totalQueued++;
      return null;
    }

    // Step 5: Update tracking and stats
    this.recentNotifications.push({
      eventType,
      timestamp: Date.now(),
    });

    // Keep only recent items
    if (this.recentNotifications.length > this.maxRecentNotifications) {
      this.recentNotifications.shift();
    }

    // Update stats
    this.stats.totalDelivered++;
    this.stats.lastDeliveredTimestamp = Date.now();
    this.stats.deliveredByPriority[matchedRule.priority] =
      (this.stats.deliveredByPriority[matchedRule.priority] || 0) + 1;

    this.log('info', `[routeNotification] Delivered: ${eventType} via rule: ${matchedRule.name}`);

    return notification;
  }

  /**
   * Evaluate all rules against context
   * Returns first matching rule
   */
  private evaluateRules(context: NotificationContext): NotificationRule | null {
    for (const rule of this.rules) {
      if (!rule.enabled) {
        continue;
      }

      // All conditions must match
      const allConditionsMatch = rule.conditions.every((condition) =>
        this.evaluateCondition(condition, context)
      );

      if (allConditionsMatch) {
        this.log(
          'debug',
          `[evaluateRules] Rule matched: ${rule.name} (${rule.id})`
        );
        return rule;
      }
    }

    return null;
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(
    condition: any,
    context: NotificationContext
  ): boolean {
    switch (condition.type) {
      case 'event-type':
        return (
          condition.eventType?.includes(context.eventType) || false
        );

      case 'is-active-ride':
        return context.isActiveRide === condition.hasActiveRide;

      case 'is-driving':
        return context.isDriving === condition.isDriving;

      case 'time-of-day': {
        const hour = context.localDateTime.getHours();
        const [start, end] = condition.hoursRange;
        if (start > end) {
          // Night: [22, 8]
          return hour >= start || hour < end;
        } else {
          // Day: [8, 22]
          return hour >= start && hour < end;
        }
      }

      case 'location': {
        if (!context.currentLocation || !condition.location) return false;
        const distance = this.calculateDistance(
          context.currentLocation,
          condition.location
        );
        return distance <= condition.location.radiusKm;
      }

      case 'custom':
        return condition.customCheck?.(context) || false;

      default:
        return true;
    }
  }

  /**
   * Check if event is a duplicate (same event in recent history)
   */
  private isDuplicateEvent(eventType: NotificationEventType): boolean {
    const now = Date.now();
    const DEDUP_WINDOW = 5000; // 5 seconds

    const recentSame = this.recentNotifications.find(
      (n) =>
        n.eventType === eventType &&
        now - n.timestamp < DEDUP_WINDOW
    );

    return !!recentSame;
  }

  /**
   * Queue notification for later delivery
   */
  private queueNotification(notification: NotificationMessage, delayMs: number): void {
    const timeout = setTimeout(() => {
      // Deliver after delay
      this.deliverNotification(notification);
      this.queuedNotifications.delete(notification.id);
    }, delayMs);

    this.queuedNotifications.set(notification.id, notification);
    this.log('debug', `[queueNotification] Queued ${notification.id} for ${delayMs}ms`);
  }

  /**
   * Actually deliver notification (call handlers)
   */
  private deliverNotification(notification: NotificationMessage): void {
    // Record delivery methods used
    if (notification.delivery.sound)
      this.stats.deliveryMethods['sound'] =
        (this.stats.deliveryMethods['sound'] || 0) + 1;
    if (notification.delivery.vibration)
      this.stats.deliveryMethods['vibration'] =
        (this.stats.deliveryMethods['vibration'] || 0) + 1;
    if (notification.delivery.banner)
      this.stats.deliveryMethods['banner'] =
        (this.stats.deliveryMethods['banner'] || 0) + 1;
    if (notification.delivery.badge)
      this.stats.deliveryMethods['badge'] =
        (this.stats.deliveryMethods['badge'] || 0) + 1;

    this.log('info', `[deliverNotification] ${notification.title}`);
  }

  /**
   * Get notification title based on event type
   */
  private getNotificationTitle(eventType: NotificationEventType): string {
    const titles: Record<NotificationEventType, string> = {
      'ride-accepted': 'رحلتك مقبولة',
      'new-ride-request': 'طلب رحلة جديد',
      'driver-arrived': 'السائق وصل',
      'ride-started': 'بدأت الرحلة',
      'ride-completed': 'انتهت الرحلة',
      'ride-cancelled': 'ألغيت الرحلة',
      'driver-location-update': 'موقع السائق',
      'eta-updated': 'وقت الوصول محدث',
      'rating-request': 'قيّم تجربتك',
      'payment-confirmation': 'تم الدفع',
      'urgent-support': 'طلب دعم فوري',
    };
    return titles[eventType] || eventType;
  }

  /**
   * Get notification body based on event type and data
   */
  private getNotificationBody(
    eventType: NotificationEventType,
    data: Record<string, any>
  ): string {
    switch (eventType) {
      case 'ride-accepted':
        return `قبل السائق ${data.driverName || 'السائق'} رحلتك`;
      case 'new-ride-request':
        return 'يوجد طلب رحلة جديد بانتظار قبولك';
      case 'driver-arrived':
        return `السائق وصل الآن`;
      case 'ride-started':
        return `بدأت الرحلة - استمتع برحلتك`;
      case 'ride-completed':
        return `انتهت الرحلة - شكراً لاستخدامك التطبيق`;
      case 'eta-updated':
        return `الوقت المتبقي: ${data.eta || '...'} دقيقة`;
      case 'rating-request':
        return `كيف كانت تجربتك؟`;
      case 'payment-confirmation':
        return `تم الدفع: ${data.amount || '...'} دينار`;
      case 'urgent-support':
        return `يحتاج السائق إلى دعمك الآن`;
      default:
        return JSON.stringify(data).substring(0, 100);
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine)
   */
  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const dLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1.latitude * Math.PI) / 180) *
        Math.cos((point2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Get statistics
   */
  getStats(): NotificationStats {
    return {
      ...this.stats,
      totalSuppressed: this.stats.totalSuppressed,
    };
  }

  /**
   * Add custom rule
   */
  addRule(rule: NotificationRule): void {
    this.rules.push(rule);
    this.log('info', `[addRule] Added rule: ${rule.name}`);
  }

  /**
   * Remove rule by ID
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
    this.log('info', `[removeRule] Removed rule: ${ruleId}`);
  }

  /**
   * Clear all queued notifications
   */
  flushQueue(): NotificationMessage[] {
    const queued = Array.from(this.queuedNotifications.values());
    this.queuedNotifications.clear();
    this.log('info', `[flushQueue] Flushed ${queued.length} queued notifications`);
    return queued;
  }

  /**
   * Logging
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    if (!this.debug && level === 'debug') return;
    console[level === 'warn' || level === 'error' ? level : 'log'](message);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalReceived: 0,
      totalDelivered: 0,
      totalSuppressed: 0,
      totalQueued: 0,
      deliveredByPriority: {},
      deliveryMethods: {},
    };
  }
}

// Singleton instance
export const globalNotificationRouter = new NotificationRouter({
  enableDebugging: false,
});
