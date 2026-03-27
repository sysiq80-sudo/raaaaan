import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, Car, Clock, DollarSign, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SmartNotification {
  id: string;
  type: 'driver_arrived' | 'promo' | 'weather_warning' | 'traffic_alert' | 'ride_complete' | 'payment_reminder';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actions?: Array<{
    label: string;
    action: () => void;
    primary?: boolean;
  }>;
  autoHide?: boolean;
  duration?: number;
  icon?: React.ReactNode;
  timestamp: Date;
}

interface SmartNotificationsProps {
  notifications: SmartNotification[];
  onNotificationAction?: (notificationId: string, action: string) => void;
  onNotificationDismiss?: (notificationId: string) => void;
  position?: 'top' | 'bottom' | 'top-right' | 'bottom-right';
  maxVisible?: number;
}

export const SmartNotifications: React.FC<SmartNotificationsProps> = ({
  notifications,
  onNotificationAction,
  onNotificationDismiss,
  position = 'top',
  maxVisible = 3
}) => {
  const [visibleNotifications, setVisibleNotifications] = useState<SmartNotification[]>([]);

  useEffect(() => {
    // Sort notifications by priority and timestamp
    const sorted = [...notifications].sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    setVisibleNotifications(sorted.slice(0, maxVisible));
  }, [notifications, maxVisible]);

  const handleDismiss = (id: string) => {
    setVisibleNotifications(prev => prev.filter(n => n.id !== id));
    onNotificationDismiss?.(id);
  };

  const handleAction = (notificationId: string, actionLabel: string, action: () => void) => {
    action();
    onNotificationAction?.(notificationId, actionLabel);
    // Auto dismiss after action
    setTimeout(() => handleDismiss(notificationId), 500);
  };

  const getNotificationIcon = (type: SmartNotification['type']) => {
    switch (type) {
      case 'driver_arrived':
        return <Car className="w-5 h-5" />;
      case 'promo':
        return <DollarSign className="w-5 h-5" />;
      case 'weather_warning':
        return <AlertCircle className="w-5 h-5" />;
      case 'traffic_alert':
        return <MapPin className="w-5 h-5" />;
      case 'ride_complete':
        return <CheckCircle className="w-5 h-5" />;
      case 'payment_reminder':
        return <Clock className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getNotificationColors = (priority: SmartNotification['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500 border-red-600';
      case 'high':
        return 'bg-orange-500 border-orange-600';
      case 'medium':
        return 'bg-blue-500 border-blue-600';
      case 'low':
        return 'bg-gray-500 border-gray-600';
      default:
        return 'bg-gray-500 border-gray-600';
    }
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'top-4 left-4 right-4';
      case 'bottom':
        return 'bottom-4 left-4 right-4';
      case 'top-right':
        return 'top-4 right-4 max-w-sm';
      case 'bottom-right':
        return 'bottom-4 right-4 max-w-sm';
      default:
        return 'top-4 left-4 right-4';
    }
  };

  return (
    <div className={cn("fixed z-50 space-y-2", getPositionClasses())}>
      <AnimatePresence>
        {visibleNotifications.map((notification, index) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: position.includes('top') ? -50 : 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.9 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              delay: index * 0.1
            }}
            className={cn(
              "bg-white/95 backdrop-blur-lg rounded-xl shadow-xl border-l-4 p-4",
              getNotificationColors(notification.priority)
            )}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                notification.priority === 'urgent' && "bg-red-100 text-red-600",
                notification.priority === 'high' && "bg-orange-100 text-orange-600",
                notification.priority === 'medium' && "bg-blue-100 text-blue-600",
                notification.priority === 'low' && "bg-gray-100 text-gray-600"
              )}>
                {notification.icon || getNotificationIcon(notification.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-800 text-sm mb-1">
                  {notification.title}
                </h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {notification.message}
                </p>

                {/* Actions */}
                {notification.actions && notification.actions.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {notification.actions.map((action, actionIndex) => (
                      <Button
                        key={actionIndex}
                        size="sm"
                        variant={action.primary ? "default" : "outline"}
                        className="text-xs h-7"
                        onClick={() => handleAction(notification.id, action.label, action.action)}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dismiss Button */}
              <Button
                variant="ghost"
                size="sm"
                className="w-6 h-6 p-0 text-gray-400 hover:text-gray-600"
                onClick={() => handleDismiss(notification.id)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Priority Indicator */}
            <div className="absolute top-2 left-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                notification.priority === 'urgent' && "bg-red-400 animate-pulse",
                notification.priority === 'high' && "bg-orange-400",
                notification.priority === 'medium' && "bg-blue-400",
                notification.priority === 'low' && "bg-gray-400"
              )} />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// Hook for managing notifications
export const useSmartNotifications = () => {
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);

  const addNotification = (notification: Omit<SmartNotification, 'id' | 'timestamp'>) => {
    const newNotification: SmartNotification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date()
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Auto dismiss if specified
    if (notification.autoHide && notification.duration) {
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, notification.duration);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Predefined notification templates
  const showDriverArrived = (driverName: string, minutes: number) => {
    addNotification({
      type: 'driver_arrived',
      title: 'السائق وصل!',
      message: `${driverName} في انتظارك. سيصل خلال ${minutes} دقيقة.`,
      priority: 'urgent',
      actions: [
        { label: 'فتح التطبيق', action: () => console.log('Open app'), primary: true }
      ],
      autoHide: false
    });
  };

  const showPromo = (discount: string, validUntil: string) => {
    addNotification({
      type: 'promo',
      title: 'عرض خاص!',
      message: `احصل على خصم ${discount} على رحلتك التالية. صالح حتى ${validUntil}`,
      priority: 'medium',
      actions: [
        { label: 'استخدم العرض', action: () => console.log('Use promo') }
      ],
      autoHide: true,
      duration: 10000
    });
  };

  const showWeatherWarning = (condition: string) => {
    addNotification({
      type: 'weather_warning',
      title: 'تحذير جوي',
      message: `الطقس: ${condition}. يرجى الحذر أثناء الرحلة.`,
      priority: 'high',
      actions: [
        { label: 'تأكيد الرحلة', action: () => console.log('Confirm ride') }
      ],
      autoHide: false
    });
  };

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    showDriverArrived,
    showPromo,
    showWeatherWarning
  };
};

export default SmartNotifications;