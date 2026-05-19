/**
 * Notification Router Types
 * Smart notification filtering and routing
 */

/**
 * Event types that trigger notifications
 */
export type NotificationEventType =
  | 'ride-accepted'
  | 'driver-arrived'
  | 'ride-started'
  | 'ride-completed'
  | 'ride-cancelled'
  | 'driver-location-update'
  | 'eta-updated'
  | 'rating-request'
  | 'payment-confirmation'
  | 'urgent-support'
  | 'new-ride-request'; // سائق يتلقى طلب رحلة جديد

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  CRITICAL = 5, // ride-cancelled unexpectedly, urgent support
  HIGH = 4, // ride-accepted, driver-arrived, urgent issues
  NORMAL = 3, // eta-updated, location-update
  LOW = 2, // ride-completed, rating-request
  SILENT = 1, // diagnostics, no user action needed
}

/**
 * Delivery channels for notifications
 */
export interface NotificationDelivery {
  sound: boolean; // Play notification sound
  vibration: boolean; // Phone vibration
  banner: boolean; // In-app banner/toast
  badge: boolean; // App badge counter
  haptic?: boolean; // Haptic feedback
  localNotification?: boolean; // Native push (Capacitor)
}

/**
 * Notification rule - if conditions match, apply actions
 */
export interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  
  // Conditions (ALL must match)
  conditions: NotificationCondition[];
  
  // Actions when conditions match
  actions: NotificationAction[];
  
  priority: NotificationPriority;
  
  // Optional: suppress duplicates within X ms
  deduplicationWindow?: number; // Default: 5000ms
}

/**
 * Condition for a rule
 */
export interface NotificationCondition {
  type: 'event-type' | 'is-active-ride' | 'is-driving' | 'time-of-day' | 'location' | 'custom';
  
  // event-type: which event triggered
  eventType?: NotificationEventType[];
  
  // is-active-ride: has active ride being tracked
  hasActiveRide?: boolean;
  
  // is-driving: driver is actively driving (speed > 5 km/h)
  isDriving?: boolean;
  
  // time-of-day: hour of day (0-23)
  hoursRange?: [number, number]; // e.g., [22, 8] night time
  
  // location: radius check
  location?: {
    latitude: number;
    longitude: number;
    radiusKm: number;
  };
  
  // custom: user-defined function
  customCheck?: (context: NotificationContext) => boolean;
}

/**
 * Action to take when rule matches
 */
export interface NotificationAction {
  type: 'deliver' | 'suppress' | 'queue' | 'log';
  
  // deliver: send with specific delivery method
  delivery?: NotificationDelivery;
  
  // queue: hold for later delivery (e.g., batch at intervals)
  queueMs?: number;
  
  // log: for debugging
  logLevel?: 'debug' | 'info' | 'warn';
  
  // Custom message override
  messageOverride?: string;
}

/**
 * Context for notification evaluation
 */
export interface NotificationContext {
  // Event being evaluated
  eventType: NotificationEventType;
  eventData: Record<string, any>;
  eventTimestamp: number;
  
  // Ride context
  rideId?: string;
  isActiveRide: boolean;
  
  // User state
  isDriving: boolean;
  isInForeground: boolean;
  currentLocation?: { latitude: number; longitude: number };
  
  // Time
  localDateTime: Date;
  
  // Rule evaluation history
  recentNotifications: { eventType: string; timestamp: number }[];
}

/**
 * Notification to be delivered
 */
export interface NotificationMessage {
  id: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  priority: NotificationPriority;
  delivery: NotificationDelivery;
  timestamp: number;
  rideId?: string;
  metadata?: Record<string, any>;
}

/**
 * Statistics for notification delivery
 */
export interface NotificationStats {
  totalReceived: number;
  totalDelivered: number;
  totalSuppressed: number;
  totalQueued: number;
  lastDeliveredTimestamp?: number;
  deliveredByPriority: Record<string, number>;
  deliveryMethods: Record<string, number>;
}
