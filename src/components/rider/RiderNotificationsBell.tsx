/**
 * جرس إشعارات الراكب
 * Rider Notifications Bell Component
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, X, Clock, Car, Gift, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface RiderNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

interface RiderNotificationsBellProps {
  userId: string;
}

const typeIcons: Record<string, React.ElementType> = {
  ride_update: Car,
  ride_accepted: Car,
  driver_arrived: Clock,
  driver_arrival: Clock,
  ride_started: Car,
  ride_completed: Check,
  ride_cancelled: AlertCircle,
  ride_requested: Clock,
  promo: Gift,
  scheduled_reminder: Clock,
  general: Bell,
};

const typeColors: Record<string, string> = {
  ride_update: "bg-primary/10 text-primary",
  ride_accepted: "bg-green-500/10 text-green-600",
  driver_arrived: "bg-blue-500/10 text-blue-600",
  driver_arrival: "bg-accent/10 text-accent-foreground",
  ride_started: "bg-primary/10 text-primary",
  ride_completed: "bg-green-500/10 text-green-600",
  ride_cancelled: "bg-red-500/10 text-red-600",
  ride_requested: "bg-yellow-500/10 text-yellow-600",
  promo: "bg-chart-4/10 text-chart-4",
  scheduled_reminder: "bg-chart-2/10 text-chart-2",
  general: "bg-muted text-muted-foreground",
};

const RiderNotificationsBell = ({ userId }: RiderNotificationsBellProps) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<RiderNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Fetch notifications
  useEffect(() => {
    if (!userId) return;

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("rider_notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) throw error;
        setNotifications((data as RiderNotification[]) || []);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Real-time subscription
    const channel = supabase
      .channel(`rider-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rider_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as RiderNotification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from("rider_notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
      if (unreadIds.length === 0) return;

      await supabase
        .from("rider_notifications")
        .update({ is_read: true })
        .in("id", unreadIds);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      await supabase
        .from("rider_notifications")
        .delete()
        .eq("id", notificationId);

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "الآن";
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays < 7) return `منذ ${diffDays} يوم`;
    return date.toLocaleDateString("ar-IQ");
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative w-11 h-11 flex items-center justify-center rounded-xl bg-card/95 backdrop-blur-xl shadow-lg hover:bg-card hover:scale-105 transition-all duration-200 active:scale-95 border border-border/30"
          aria-label="الإشعارات"
        >
          <Bell className="w-5 h-5" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 p-0 shadow-2xl"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-lg">الإشعارات</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs h-8"
            >
              <Check className="w-3 h-3 mr-1" />
              قراءة الكل
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <Bell className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">لا توجد إشعارات</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = typeIcons[notification.type] || Bell;
                const colorClass = typeColors[notification.type] || typeColors.general;

                return (
                  <motion.div
                    key={notification.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    className={cn(
                      "p-3 hover:bg-muted/50 transition-colors cursor-pointer relative group",
                      !notification.is_read && "bg-primary/5"
                    )}
                    onClick={() => !notification.is_read && markAsRead(notification.id)}
                  >
                    <div className="flex gap-3">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", colorClass)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={cn("text-sm font-medium truncate", !notification.is_read && "font-bold")}>
                            {notification.title}
                          </h4>
                          {!notification.is_read && (
                            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.body}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {formatTime(notification.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className="absolute top-2 left-2 w-6 h-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer — عرض الكل */}
        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs h-8 text-primary"
              onClick={() => { setIsOpen(false); navigate("/rider/notifications"); }}
            >
              عرض جميع الإشعارات
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default RiderNotificationsBell;
