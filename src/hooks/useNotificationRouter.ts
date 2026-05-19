/**
 * React Hook: useNotificationRouter
 * Integrates NotificationRouter with:
 * - Realtime ride events
 * - Driving state detection
 * - In-app notifications
 * - Native Capacitor notifications
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  NotificationRouter,
  NotificationPriority,
} from '@/lib/notificationRouter';
import type { NotificationRouterOptions } from '@/lib/notificationRouter/NotificationRouter';
import type { NotificationMessage, NotificationEventType, NotificationContext } from '@/lib/notificationRouter';
const uuidv4 = () => crypto.randomUUID();

interface UseNotificationRouterOptions extends NotificationRouterOptions {
  nodeId: 'rider' | 'driver';
  onNotificationDelivered?: (notification: NotificationMessage) => void;
  onNotificationQueued?: (notification: NotificationMessage) => void;
}

interface UseNotificationRouterReturn {
  /** Route a notification through the system */
  routeNotification: (
    eventType: NotificationEventType,
    eventData: Record<string, any>,
    context?: Partial<NotificationContext>
  ) => Promise<void>;

  /** Is app in foreground */
  isInForeground: boolean;

  /** Is driver actively driving (high speed, movement) */
  isDriving: boolean;

  /** Current statistics */
  stats: ReturnType<NotificationRouter['getStats']>;

  /** Delivery methods available */
  isNativeNotificationsSupported: boolean;
}

export function useNotificationRouter(
  options: UseNotificationRouterOptions
): UseNotificationRouterReturn {
  const {
    onNotificationDelivered,
    onNotificationQueued,
    ...routerOptions
  } = options;

  const routerRef = useRef<NotificationRouter>(new NotificationRouter(routerOptions));
  const [stats, setStats] = useState(routerRef.current.getStats());
  const [isInForeground, setIsInForeground] = useState(true);
  const [isDriving, setIsDriving] = useState(false);
  const [isNativeNotificationsSupported, setIsNativeNotificationsSupported] =
    useState(false);

  /**
   * Initialize native notifications
   */
  useEffect(() => {
    const initNotifications = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          await LocalNotifications.requestPermissions();
          setIsNativeNotificationsSupported(true);
          console.log('[useNotificationRouter] Native notifications enabled');
        }
      } catch (error) {
        console.error('[useNotificationRouter] Failed to init notifications:', error);
      }
    };

    initNotifications();
  }, []);

  /**
   * Track app foreground/background
   */
  useEffect(() => {
    const handleResume = () => {
      setIsInForeground(true);
      console.log('[useNotificationRouter] App resumed');
    };

    const handlePause = () => {
      setIsInForeground(false);
      console.log('[useNotificationRouter] App paused');
    };

    document.addEventListener('resume', handleResume);
    document.addEventListener('pause', handlePause);

    return () => {
      document.removeEventListener('resume', handleResume);
      document.removeEventListener('pause', handlePause);
    };
  }, []);

  // Motion plugin غير متاح حالياً في الحزمة؛ نعتمد القيمة الافتراضية حتى اكتمال الربط.
  useEffect(() => {
    setIsDriving(false);
  }, []);

  /**
   * Deliver notification through appropriate channel
   */
  const deliverNotification = useCallback(
    async (notification: NotificationMessage) => {
      // Show in-app banner if in foreground
      if (isInForeground && notification.delivery.banner) {
        // Trigger in-app toast/banner
        dispatchEvent(
          new CustomEvent('notification-banner', {
            detail: {
              title: notification.title,
              body: notification.body,
              priority: notification.priority,
            },
          })
        );
      }

      // Native notification if supported and configured
      if (
        isNativeNotificationsSupported &&
        notification.delivery.localNotification &&
        !isInForeground
      ) {
        try {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: parseInt(notification.id.replace(/\D/g, '').substring(0, 10)),
                title: notification.title,
                body: notification.body,
                smallIcon: 'icon',
                largeIcon: 'icon',
                sound: notification.delivery.sound ? 'default' : undefined,
                autoCancel: true,
              },
            ],
          });
        } catch (error) {
          console.error('[useNotificationRouter] Failed to send native notification:', error);
        }
      }

      // Play sound if configured
      if (notification.delivery.sound) {
        try {
          const audio = new Audio('/sounds/notification.mp3');
          await audio.play();
        } catch (error) {
          console.debug('[useNotificationRouter] Failed to play sound:', error);
        }
      }

      // Haptic feedback if configured
      if (notification.delivery.haptic && Capacitor.isNativePlatform()) {
        try {
          // Trigger haptic feedback (platform-dependent)
          const event = new CustomEvent('haptic-feedback', { detail: { duration: 100 } });
          dispatchEvent(event);
        } catch (error) {
          console.debug('[useNotificationRouter] Haptic feedback unavailable:', error);
        }
      }

      // Callback
      if (onNotificationDelivered) {
        onNotificationDelivered(notification);
      }

      // Update stats
      setStats(routerRef.current.getStats());

      console.debug(
        `[useNotificationRouter] Notification delivered - Type: ${notification.eventType}`
      );
    },
    [isInForeground, isNativeNotificationsSupported, onNotificationDelivered]
  );

  /**
   * Route a notification through the system
   */
  const routeNotification = useCallback(
    async (
      eventType: NotificationEventType,
      eventData: Record<string, any>,
      context?: Partial<NotificationContext>
    ) => {
      try {
        const notification = await routerRef.current.routeNotification(
          eventType,
          eventData,
          {
            ...context,
            isDriving,
            isInForeground,
          }
        );

        if (notification) {
          await deliverNotification(notification);
        } else if (onNotificationQueued) {
          onNotificationQueued({
            id: uuidv4(),
            eventType,
            title: '',
            body: '',
            priority: NotificationPriority.SILENT,
            delivery: {
              sound: false,
              vibration: false,
              banner: false,
              badge: false,
            },
            timestamp: Date.now(),
            metadata: eventData,
          });
        }
      } catch (error) {
        console.error('[useNotificationRouter] Error routing notification:', error);
      }
    },
    [isDriving, isInForeground, deliverNotification, onNotificationQueued]
  );

  /**
   * Update stats periodically
   */
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(routerRef.current.getStats());
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return {
    routeNotification,
    isInForeground,
    isDriving,
    stats,
    isNativeNotificationsSupported,
  };
}
