import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, Trash2, Gift, AlertCircle, Info, Car, X, CheckCheck, Trash, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  data: unknown;
  is_read: boolean;
  created_at: string;
}

interface NotificationsBellProps {
  driverId: string | null;
  isOpen?: boolean;
  onToggle?: () => void;
}

const getNotificationIconConfig = (type: string) => {
  switch (type) {
    case 'bonus':
      return { icon: Gift, color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" };
    case 'ride':
    case 'ride_completed':
      return { icon: Car, color: "text-[#5bdda6]", bg: "bg-[#5bdda6]/10", border: "border-[#5bdda6]/20" };
    case 'ride_cancelled':
    case 'alert':
    case 'application_rejected':
      return { icon: AlertCircle, color: "text-rose-400", bg: "bg-rose-400/10", border: "border-rose-400/20" };
    default:
      return { icon: Info, color: "text-sky-400", bg: "bg-sky-400/10", border: "border-sky-400/20" };
  }
};

export function NotificationsBell({ driverId, isOpen: externalOpen, onToggle }: NotificationsBellProps) {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [internalOpen, setInternalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // id أو 'all-read' أو 'all-delete'
  
  // تتبع IDs المحذوفة محلياً لمنع إعادة إضافتها من Realtime
  const deletedIdsRef = useRef<Set<string>>(new Set());

  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const handleToggle = onToggle || (() => setInternalOpen(prev => !prev));
  const handleClose = onToggle || (() => setInternalOpen(false));

  // دالة جلب الإشعارات — تُستدعى عند التحميل وعند فتح اللوحة
  const fetchNotifications = useCallback(async () => {
    if (!driverId) return;
    
    const { data, error } = await supabase
      .from('driver_notifications')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      // استبعاد المحذوفة محلياً التي لم تُحذف بعد من DB (حالة نادرة)
      const filtered = data.filter(n => !deletedIdsRef.current.has(n.id));
      setNotifications(filtered);
      setUnreadCount(filtered.filter(n => !n.is_read).length);
    }
  }, [driverId]);

  // إعادة تحميل عند فتح اللوحة — يضمن بيانات محدثة
  useEffect(() => {
    if (isOpen && driverId) {
      fetchNotifications();
    }
  }, [isOpen, driverId, fetchNotifications]);

  // الاشتراك Realtime: INSERT + UPDATE + DELETE
  useEffect(() => {
    if (!driverId) return;

    fetchNotifications();

    const channel = supabase
      .channel(`driver-notifications-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_notifications',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          // لا تُضِف إشعاراً محذوفاً محلياً
          if (deletedIdsRef.current.has(newNotification.id)) return;
          // لا تُضِف مكرراً
          setNotifications(prev => {
            if (prev.some(n => n.id === newNotification.id)) return prev;
            return [newNotification, ...prev];
          });
          setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_notifications',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications(prev =>
            prev.map(n => (n.id === updated.id ? updated : n))
          );
          // إعادة حساب العدد
          setNotifications(prev => {
            setUnreadCount(prev.filter(n => !n.is_read).length);
            return prev;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'driver_notifications',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setNotifications(prev => {
            const filtered = prev.filter(n => n.id !== deletedId);
            setUnreadCount(filtered.filter(n => !n.is_read).length);
            return filtered;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, fetchNotifications]);

  // ═══ وظيفة قراءة إشعار واحد ═══
  const markAsRead = async (id: string) => {
    setActionLoading(id);
    // تحديث متفائل فوري
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    const { error } = await supabase
      .from('driver_notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      // التراجع عند الخطأ
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: false } : n))
      );
      setUnreadCount(prev => prev + 1);
      toast({ title: 'خطأ', description: 'فشل تحديث الإشعار', variant: 'destructive' });
    }
    setActionLoading(null);
  };

  // ═══ وظيفة قراءة الكل ═══
  const markAllAsRead = async () => {
    if (!driverId) return;
    setActionLoading('all-read');
    
    const prevNotifications = [...notifications];
    const prevUnread = unreadCount;

    // تحديث متفائل
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);

    const { error } = await supabase
      .from('driver_notifications')
      .update({ is_read: true })
      .eq('driver_id', driverId)
      .eq('is_read', false);

    if (error) {
      setNotifications(prevNotifications);
      setUnreadCount(prevUnread);
      toast({ title: 'خطأ', description: 'فشل تحديث الإشعارات', variant: 'destructive' });
    } else {
      toast({ title: 'تم', description: 'تم قراءة جميع الإشعارات' });
    }
    setActionLoading(null);
  };

  // ═══ وظيفة حذف إشعار واحد (حذف فعلي من DB) ═══
  const deleteNotification = async (id: string) => {
    setActionLoading(id);
    const notification = notifications.find(n => n.id === id);
    
    // تحديث متفائل + تسجيل في المحذوفات
    deletedIdsRef.current.add(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (notification && !notification.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    const { error } = await supabase
      .from('driver_notifications')
      .delete()
      .eq('id', id);

    if (error) {
      // التراجع
      deletedIdsRef.current.delete(id);
      if (notification) {
        setNotifications(prev => [notification, ...prev].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
        if (!notification.is_read) {
          setUnreadCount(prev => prev + 1);
        }
      }
      toast({ title: 'خطأ', description: 'فشل حذف الإشعار', variant: 'destructive' });
    }
    setActionLoading(null);
  };

  // ═══ وظيفة حذف الكل (حذف فعلي من DB) ═══
  const deleteAllNotifications = async () => {
    if (!driverId || notifications.length === 0) return;
    setActionLoading('all-delete');

    const prevNotifications = [...notifications];
    const prevUnread = unreadCount;
    
    // تسجيل كل IDs كمحذوفة
    notifications.forEach(n => deletedIdsRef.current.add(n.id));
    setNotifications([]);
    setUnreadCount(0);

    const { error } = await supabase
      .from('driver_notifications')
      .delete()
      .eq('driver_id', driverId);

    if (error) {
      // التراجع
      prevNotifications.forEach(n => deletedIdsRef.current.delete(n.id));
      setNotifications(prevNotifications);
      setUnreadCount(prevUnread);
      toast({ title: 'خطأ', description: 'فشل حذف الإشعارات', variant: 'destructive' });
    } else {
      toast({ title: 'تم', description: 'تم حذف جميع الإشعارات نهائياً' });
    }
    setActionLoading(null);
  };

  return (
    <>
      {/* Trigger Button — World-Class Glassmorphism Bell */}
      <button
        onClick={handleToggle}
        className="relative flex items-center justify-center w-11 h-11 rounded-xl border border-[#5bdda6]/30 outline-none focus:outline-none select-none active:scale-90 transition-all duration-200 bg-[#5bdda6] hover:bg-[#34d399] text-slate-950 shadow-[0_0_20px_rgba(91,221,166,0.5)]"
        style={{
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <Bell className="w-5 h-5 text-slate-950" />

        {/* Badge */}
        {unreadCount > 0 && (
          <span
            className="absolute flex items-center justify-center font-black text-white"
            style={{
              top: '-5px',
              right: '-5px',
              minWidth: unreadCount > 9 ? '22px' : '18px',
              height: '18px',
              fontSize: '10px',
              lineHeight: 1,
              borderRadius: '999px',
              padding: '0 4px',
              background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
              border: '2px solid #0a0f1c',
              boxShadow: '0 0 8px rgba(244,63,94,0.6)',
              letterSpacing: '-0.02em',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}

      </button>

      {/* Full Screen Panel — slides up from bottom (Portal to escape header stacking context) */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0.5 }}
              transition={{ type: "spring", damping: 28, stiffness: 240 }}
              className="fixed inset-0 z-[100] bg-[#0b1326] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              {/* Header */}
              <div className="relative flex items-center justify-between px-6 py-5 border-b border-white/5 bg-[#0b1326] z-10 shrink-0 shadow-[0_4px_30px_rgba(91,221,166,0.05)]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#151f30] flex items-center justify-center border border-[#5bdda6]/20 shadow-[0_0_15px_rgba(91,221,166,0.1)]">
                    <Bell className="h-6 w-6 text-[#5bdda6]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white leading-none mb-1">الإشعارات</h2>
                    <p className="text-sm font-medium text-slate-400">
                      {unreadCount > 0 ? `لديك ${unreadCount} إشعار جديد` : 'لا توجد إشعارات جديدة'}
                    </p>
                  </div>
                </div>
                {/* Close Button */}
                <button
                  onClick={handleClose}
                  className="w-10 h-10 rounded-full bg-slate-800/40 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-all border border-transparent hover:border-rose-500/20 active:scale-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Action Buttons — قراءة الكل + حذف الكل */}
              {notifications.length > 0 && (
                <div className="px-6 py-4 flex items-center gap-3 shrink-0 bg-[#0b1326]">
                  {unreadCount > 0 && (
                    <button
                      className="flex-1 h-12 rounded-xl bg-[#5bdda6]/10 text-[#5bdda6] font-bold flex items-center justify-center gap-2 border border-[#5bdda6]/20 hover:bg-[#5bdda6]/20 active:scale-95 transition-all"
                      onClick={markAllAsRead}
                      disabled={actionLoading === 'all-read'}
                    >
                      {actionLoading === 'all-read' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCheck className="h-5 w-5" />
                      )}
                      قراءة الكل
                    </button>
                  )}
                  <button
                    className="flex-1 h-12 rounded-xl bg-rose-500/10 text-rose-400 font-bold flex items-center justify-center gap-2 border border-rose-500/20 hover:bg-rose-500/20 active:scale-95 transition-all"
                    onClick={deleteAllNotifications}
                    disabled={actionLoading === 'all-delete'}
                  >
                    {actionLoading === 'all-delete' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash className="h-5 w-5" />
                    )}
                    حذف الكل
                  </button>
                </div>
              )}

              {/* Notifications List */}
              <ScrollArea className="flex-1 px-4">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground pt-32 pb-20">
                    <div className="w-24 h-24 rounded-full bg-[#151f30] flex items-center justify-center mb-6">
                      <Bell className="h-10 w-10 text-slate-500 opacity-50" />
                    </div>
                    <p className="text-xl font-bold text-slate-300">لا توجد إشعارات</p>
                    <p className="text-sm text-slate-500 mt-2">ستظهر إشعارات الرحلات والتحديثات هنا</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 pb-8 pt-2">
                    {notifications.map((notification) => {
                      const iconConfig = getNotificationIconConfig(notification.type);
                      const Icon = iconConfig.icon;
                      return (
                        <div
                          key={notification.id}
                          className={`group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 ${
                            !notification.is_read 
                              ? 'bg-[#151f30] border border-[#5bdda6]/20 shadow-[0_4px_20px_rgba(91,221,166,0.05)]' 
                              : 'bg-[#111827]/50 border border-slate-800/50'
                          } ${actionLoading === notification.id ? 'opacity-50 scale-[0.98]' : ''}`}
                        >
                          {/* Glow effect for unread */}
                          {!notification.is_read && (
                            <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-[#5bdda6] to-emerald-600 shadow-[0_0_10px_rgba(91,221,166,0.5)]" />
                          )}
                          
                          <div className="flex gap-4 items-start">
                            <div className={`flex-shrink-0 mt-0.5 flex items-center justify-center w-12 h-12 rounded-full border ${iconConfig.bg} ${iconConfig.border}`}>
                              <Icon className={`h-5 w-5 ${iconConfig.color}`} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <p className={`text-[16px] mb-1.5 truncate ${!notification.is_read ? 'font-black text-white' : 'font-bold text-slate-200'}`}>
                                {notification.title}
                              </p>
                              <p className="text-[13px] leading-relaxed text-slate-400 line-clamp-2">
                                {notification.body}
                              </p>
                              <p className="text-[11px] font-bold tracking-wider text-slate-500 mt-3 flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${!notification.is_read ? 'bg-[#5bdda6] animate-pulse' : 'bg-slate-600'}`}></span>
                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ar })}
                              </p>
                            </div>

                            {/* Action buttons */}
                            <div className="flex flex-col gap-2 flex-shrink-0">
                              {!notification.is_read && (
                                <button
                                  className="h-9 w-9 flex items-center justify-center rounded-full bg-emerald-500/10 text-[#5bdda6] active:bg-emerald-500/20 active:scale-95 transition-all border border-emerald-500/20"
                                  onClick={() => markAsRead(notification.id)}
                                  disabled={actionLoading === notification.id}
                                >
                                  {actionLoading === notification.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                              <button
                                className="h-9 w-9 flex items-center justify-center rounded-full bg-rose-500/10 text-rose-400 active:bg-rose-500/20 active:scale-95 transition-all border border-rose-500/20"
                                onClick={() => deleteNotification(notification.id)}
                                disabled={actionLoading === notification.id}
                              >
                                {actionLoading === notification.id && notification.is_read ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
