// Service Worker Registration and Push Notification Utilities
// Enhanced with Topic Subscriptions, Offline Queue, and Analytics
import { supabase } from "@/integrations/supabase/client";

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationTopic {
  topic: string;
  is_active: boolean;
}

// Check if service workers are supported
export const isServiceWorkerSupported = (): boolean => {
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

// Register the service worker
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isServiceWorkerSupported()) {
    console.log('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    
    console.log('Service Worker registered:', registration.scope);

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New Service Worker available');
            // Notify user about update
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
};

// Get the current service worker registration
export const getServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isServiceWorkerSupported()) return null;
  
  try {
    return await navigator.serviceWorker.ready;
  } catch (error) {
    console.error('Error getting service worker registration:', error);
    return null;
  }
};

// Request notification permission
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  try {
    if (typeof Notification === 'undefined') {
      console.log('Notifications not supported');
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
    return permission;
  } catch {
    console.log('Notification API not available');
    return 'denied';
  }
};

// Subscribe to push notifications and save to server
export const subscribeToPushNotifications = async (
  ownerId: string,
  ownerType: 'driver' | 'rider' = 'driver'
): Promise<PushSubscription | null> => {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return null;

  try {
    // Check existing subscription
    let subscription = await (registration as any).pushManager.getSubscription();
    
    if (!subscription) {
      // Create new subscription with VAPID key
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
      
      subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey
      });

      console.log('Push subscription created');
    }

    // Save subscription to server
    const json = subscription.toJSON();
    const ownerKey = ownerType === 'rider' ? 'user_id' : 'driver_id';
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        action: 'subscribe',
        subscription: {
          [ownerKey]: ownerId,
          endpoint: json.endpoint,
          p256dh_key: json.keys?.p256dh || '',
          auth_key: json.keys?.auth || ''
        }
      }
    });

    if (error) {
      console.error('Error saving subscription:', error);
    } else {
      console.log('Subscription saved to server');
    }

    return subscription;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return null;
  }
};

// Unsubscribe from push notifications
export const unsubscribeFromPushNotifications = async (
  ownerId: string,
  ownerType: 'driver' | 'rider' = 'driver'
): Promise<boolean> => {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return false;

  try {
    const subscription = await (registration as any).pushManager.getSubscription();
    if (subscription) {
      // Remove from server
      const json = subscription.toJSON();
      const ownerKey = ownerType === 'rider' ? 'user_id' : 'driver_id';
      await supabase.functions.invoke('send-push-notification', {
        body: {
          action: 'unsubscribe',
          subscription: {
            [ownerKey]: ownerId,
            endpoint: json.endpoint
          }
        }
      });

      await subscription.unsubscribe();
      console.log('Push subscription removed');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error unsubscribing:', error);
    return false;
  }
};

// Get push subscription data for server
export const getPushSubscriptionData = async (): Promise<PushSubscriptionData | null> => {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return null;

  try {
    const subscription = await (registration as any).pushManager.getSubscription();
    if (!subscription) return null;

    const json = subscription.toJSON();
    return {
      endpoint: json.endpoint || '',
      keys: {
        p256dh: json.keys?.p256dh || '',
        auth: json.keys?.auth || ''
      }
    };
  } catch (error) {
    console.error('Error getting subscription data:', error);
    return null;
  }
};

// Send message to service worker
export const sendMessageToServiceWorker = async (message: unknown): Promise<void> => {
  const registration = await getServiceWorkerRegistration();
  if (!registration || !registration.active) return;

  registration.active.postMessage(message);
};

// Show local notification via service worker
export const showLocalNotification = async (
  title: string,
  options: NotificationOptions & { data?: unknown }
): Promise<void> => {
  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    // Fallback to regular notification
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, options);
      }
    } catch {
      // Notification API not available
    }
    return;
  }

  await registration.showNotification(title, {
    ...options,
    icon: options.icon || '/logo.png',
    badge: '/logo.png',
    requireInteraction: true
  });
};

// Notify about new ride via service worker
export const notifyNewRide = async (ride: {
  id: string;
  estimatedFare?: number;
  pickupAddress?: string;
  dropoffAddress?: string;
}): Promise<void> => {
  await sendMessageToServiceWorker({
    type: 'NEW_RIDE_NOTIFICATION',
    ride
  });
};

// Check if push notifications are enabled
export const isPushNotificationEnabled = async (): Promise<boolean> => {
  if (!isServiceWorkerSupported()) return false;
  
  const registration = await getServiceWorkerRegistration();
  if (!registration) return false;

  const subscription = await (registration as any).pushManager.getSubscription();
  return !!subscription;
};

// Trigger server-side push notification for a new ride
export const triggerPushNotificationForRide = async (ride: {
  id: string;
  pickup_address?: string;
  dropoff_address?: string;
  estimated_fare?: number;
  distance_km?: number;
  vehicle_type?: string;
}, driverIds?: string[]): Promise<void> => {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        action: 'notify_new_ride',
        ride,
        driver_ids: driverIds
      }
    });

    if (error) {
      console.error('Error triggering push notification:', error);
    }
  } catch (error) {
    console.error('Failed to trigger push notification:', error);
  }
};

// ============ Topic Subscription Functions ============

// Subscribe driver to a topic (e.g., region notifications)
export const subscribeToTopic = async (driverId: string, topic: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notification_topics')
      .upsert({
        driver_id: driverId,
        topic,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'driver_id,topic'
      });

    if (error) {
      console.error('Error subscribing to topic:', error);
      return false;
    }
    
    console.log(`Subscribed to topic: ${topic}`);
    return true;
  } catch (error) {
    console.error('Failed to subscribe to topic:', error);
    return false;
  }
};

// Unsubscribe driver from a topic
export const unsubscribeFromTopic = async (driverId: string, topic: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notification_topics')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('driver_id', driverId)
      .eq('topic', topic);

    if (error) {
      console.error('Error unsubscribing from topic:', error);
      return false;
    }
    
    console.log(`Unsubscribed from topic: ${topic}`);
    return true;
  } catch (error) {
    console.error('Failed to unsubscribe from topic:', error);
    return false;
  }
};

// Get driver's topic subscriptions
export const getTopicSubscriptions = async (driverId: string): Promise<NotificationTopic[]> => {
  try {
    const { data, error } = await supabase
      .from('notification_topics')
      .select('topic, is_active')
      .eq('driver_id', driverId);

    if (error) {
      console.error('Error fetching topic subscriptions:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Failed to fetch topic subscriptions:', error);
    return [];
  }
};

// Send notification to all subscribers of a topic
export const sendTopicNotification = async (
  topic: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  image?: string
): Promise<{ notified: number }> => {
  try {
    const { data: result, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        action: 'notify_topic',
        topic,
        title,
        body,
        data,
        image
      }
    });

    if (error) {
      console.error('Error sending topic notification:', error);
      return { notified: 0 };
    }
    
    return { notified: result?.notified || 0 };
  } catch (error) {
    console.error('Failed to send topic notification:', error);
    return { notified: 0 };
  }
};

// ============ Analytics Functions ============

// Get notification analytics summary
export const getNotificationAnalytics = async (days: number = 30): Promise<{
  totals: {
    total_sent: number;
    total_delivered: number;
    total_opened: number;
    total_failed: number;
    delivery_rate: number;
    open_rate: number;
    avg_delivery_delay_ms: number;
  };
  daily: unknown[];
} | null> => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notification-analytics?action=summary&days=${days}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('Error fetching analytics');
      return null;
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Failed to fetch notification analytics:', error);
    return null;
  }
};

// Get analytics by notification type
export const getAnalyticsByType = async (days: number = 30): Promise<unknown[]> => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notification-analytics?action=by_type&days=${days}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) return [];

    const result = await response.json();
    return result.by_type || [];
  } catch (error) {
    console.error('Failed to fetch analytics by type:', error);
    return [];
  }
};

// Get subscription statistics
export const getSubscriptionStats = async (): Promise<{
  total: number;
  active_last_24h: number;
  active_last_7d: number;
  active_last_30d: number;
  stale: number;
} | null> => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notification-analytics?action=subscription_stats`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) return null;

    const result = await response.json();
    return result.subscription_stats || null;
  } catch (error) {
    console.error('Failed to fetch subscription stats:', error);
    return null;
  }
};

// ============ Offline Queue Functions ============

// Process offline notification queue (triggers SW to process)
export const processOfflineQueue = async (): Promise<void> => {
  await sendMessageToServiceWorker({ type: 'PROCESS_OFFLINE_QUEUE' });
};

// Listen for service worker messages
export const setupServiceWorkerMessageListener = (
  onNotificationClicked?: (data: unknown) => void,
  onSilentPush?: (data: unknown) => void
): (() => void) => {
  const handler = (event: MessageEvent) => {
    if (event.data.type === 'NOTIFICATION_CLICKED' && onNotificationClicked) {
      onNotificationClicked(event.data.data);
    }
    if (event.data.type === 'SILENT_PUSH' && onSilentPush) {
      onSilentPush(event.data.data);
    }
  };

  navigator.serviceWorker?.addEventListener('message', handler);
  
  return () => {
    navigator.serviceWorker?.removeEventListener('message', handler);
  };
};

// Trigger cleanup of stale subscriptions (admin function)
export const cleanupStaleSubscriptions = async (staleDays: number = 30): Promise<{
  deleted_subscriptions: number;
  remaining_subscriptions: number;
}> => {
  try {
    const { data, error } = await supabase.functions.invoke('cleanup-stale-subscriptions', {
      body: { stale_days: staleDays }
    });

    if (error) {
      console.error('Error cleaning up subscriptions:', error);
      return { deleted_subscriptions: 0, remaining_subscriptions: 0 };
    }

    return data || { deleted_subscriptions: 0, remaining_subscriptions: 0 };
  } catch (error) {
    console.error('Failed to cleanup subscriptions:', error);
    return { deleted_subscriptions: 0, remaining_subscriptions: 0 };
  }
};
