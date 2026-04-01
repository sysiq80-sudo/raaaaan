/**
 * صفحة سجل إشعارات الراكب الكامل
 * Rider Notifications History Page
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Check, CheckCheck, Trash2, Car, Gift, AlertCircle, Clock, Loader2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

interface RiderNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  action_url?: string;
  image_url?: string;
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

type FilterType = "all" | "unread" | "rides" | "promo";

const RiderNotificationsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<RiderNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const deletedIdsRef = useRef<Set<string>>(new Set());

  // جلب المستخدم الحالي
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // جلب الإشعارات
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("rider_notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && data) {
      const filtered = data.filter((n) => !deletedIdsRef.current.has(n.id));
      setNotifications(filtered as RiderNotification[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchNotifications();

    // Realtime
    const channel = supabase
      .channel(`rider-notif-page-${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "rider_notifications",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const n = payload.new as RiderNotification;
        if (deletedIdsRef.current.has(n.id)) return;
        setNotifications((prev) => {
          if (prev.some((x) => x.id === n.id)) return prev;
          return [n, ...prev];
        });
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "rider_notifications",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const updated = payload.new as RiderNotification;
        setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      })
      .on("postgres_changes", {
        event: "DELETE",
        schema: "public",
        table: "rider_notifications",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const deletedId = (payload.old as { id: string }).id;
        setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchNotifications]);

  // فلترة
  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.is_read;
    if (filter === "rides") return ["ride_update", "ride_accepted", "driver_arrived", "driver_arrival", "ride_started", "ride_completed", "ride_cancelled", "ride_requested"].includes(n.type);
    if (filter === "promo") return ["promo", "general", "scheduled_reminder"].includes(n.type);
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // قراءة واحد
  const markAsRead = async (id: string) => {
    setActionLoading(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    const { error } = await supabase.from("rider_notifications").update({ is_read: true }).eq("id", id);
    if (error) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: false } : n)));
      toast({ title: "خطأ", description: "فشل تحديث الإشعار", variant: "destructive" });
    }
    setActionLoading(null);
  };

  // قراءة الكل
  const markAllAsRead = async () => {
    if (!userId) return;
    setActionLoading("all-read");
    const prev = [...notifications];
    setNotifications((p) => p.map((n) => ({ ...n, is_read: true })));
    const { error } = await supabase.from("rider_notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    if (error) {
      setNotifications(prev);
      toast({ title: "خطأ", description: "فشل تحديث الإشعارات", variant: "destructive" });
    }
    setActionLoading(null);
  };

  // حذف واحد
  const deleteNotification = async (id: string) => {
    setActionLoading(id);
    const notification = notifications.find((n) => n.id === id);
    deletedIdsRef.current.add(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase.from("rider_notifications").delete().eq("id", id);
    if (error) {
      deletedIdsRef.current.delete(id);
      if (notification) setNotifications((prev) => [notification, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      toast({ title: "خطأ", description: "فشل حذف الإشعار", variant: "destructive" });
    }
    setActionLoading(null);
  };

  // تنسيق الوقت
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

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "الكل" },
    { key: "unread", label: `غير مقروءة ${unreadCount > 0 ? `(${unreadCount})` : ""}` },
    { key: "rides", label: "الرحلات" },
    { key: "promo", label: "العروض" },
  ];

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: 'var(--raan-bg)', color: 'var(--raan-text)' }} dir="rtl">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl pt-[env(safe-area-inset-top)] transition-colors duration-300" style={{ background: 'var(--raan-bg)', borderBottom: '1px solid var(--raan-border)' }}>
        <div className="flex items-center justify-between h-14 px-4">
          <div />
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/rider")}
              className="p-1.5 rounded-xl bg-[#5bdda6]/10 border border-[#5bdda6]/20 hover:bg-[#5bdda6]/20 active:scale-90 transition-all"
              aria-label="رجوع"
            >
              <ArrowRight className="w-4 h-4 text-[#5bdda6]" />
            </button>
            <img src={logo} alt="RAAN" className="w-8 h-8 rounded-xl shadow-[0_0_10px_rgba(91,221,166,0.25)]" />
            <span className="font-bold text-white text-sm">الإشعارات</span>
          </div>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-[#5bdda6] text-xs h-8 hover:bg-[#5bdda6]/10"
              onClick={markAllAsRead}
              disabled={actionLoading === "all-read"}
            >
              {actionLoading === "all-read" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            </Button>
          ) : (
            <div />
          )}
        </div>
      </header>

      {/* Content */}
      <div className="pt-[calc(env(safe-area-inset-top)+3.5rem)]">
        {/* Filter Chips */}
        <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                filter === f.key
                  ? "bg-[#5bdda6] text-[#0b1326] font-bold"
                  : "bg-[#171f33] text-slate-400 border border-slate-700/40 hover:text-white"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Bell className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-sm">
              {filter === "unread" ? "لا توجد إشعارات غير مقروءة" : "لا توجد إشعارات"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/30">
            <AnimatePresence mode="popLayout">
              {filteredNotifications.map((notification) => {
                const Icon = typeIcons[notification.type] || Bell;
                const colorClass = typeColors[notification.type] || typeColors.general;

                return (
                  <motion.div
                    key={notification.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100, height: 0 }}
                    className={cn(
                      "px-4 py-3.5 transition-colors relative group hover:bg-[#171f33]/50",
                      !notification.is_read && "bg-[#5bdda6]/5 border-r-2 border-r-[#5bdda6]",
                      actionLoading === notification.id && "opacity-50"
                    )}
                    onClick={() => !notification.is_read && markAsRead(notification.id)}
                  >
                    <div className="flex gap-3">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", colorClass)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={cn("text-sm", !notification.is_read ? "font-bold" : "font-medium")}>
                          {notification.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">
                          {notification.body}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {formatTime(notification.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-primary/10"
                            onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                            disabled={actionLoading === notification.id}
                          >
                            <Check className="h-3.5 w-3.5 text-primary" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                          disabled={actionLoading === notification.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiderNotificationsPage;
