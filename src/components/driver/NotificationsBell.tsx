import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'bonus':
      return <Gift className="h-4 w-4 text-yellow-500" />;
    case 'ride':
      return <Car className="h-4 w-4 text-blue-500" />;
    case 'alert':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />;
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
      {/* Trigger Button */}
      <button
        onClick={handleToggle}
        className="relative bg-black/40 backdrop-blur-md p-2.5 rounded-full border border-white/10 active:scale-95 transition-transform"
      >
        <Bell className="w-5 h-5 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] bg-red-500 text-white font-bold rounded-full text-[10px] flex items-center justify-center border-2 border-black px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Side Panel — slides from LEFT (Portal to escape header stacking context) */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm" onClick={handleClose}>
          <div
            className="absolute top-0 left-0 h-full w-80 bg-card shadow-xl animate-slide-in-left overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h4 className="font-bold text-lg">الإشعارات</h4>
                {unreadCount > 0 && (
                  <span className="min-w-[20px] h-5 bg-red-500 text-white font-bold rounded-full text-[11px] flex items-center justify-center px-1.5">
                    {unreadCount}
                  </span>
                )}
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-full hover:bg-accent transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Buttons — قراءة الكل + حذف الكل */}
            {notifications.length > 0 && (
              <div className="px-3 py-2 border-b border-border flex-shrink-0 flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8 flex-1 gap-1.5"
                    onClick={markAllAsRead}
                    disabled={actionLoading === 'all-read'}
                  >
                    {actionLoading === 'all-read' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCheck className="h-3.5 w-3.5" />
                    )}
                    قراءة الكل
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8 flex-1 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={deleteAllNotifications}
                  disabled={actionLoading === 'all-delete'}
                >
                  {actionLoading === 'all-delete' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash className="h-3.5 w-3.5" />
                  )}
                  حذف الكل
                </Button>
              </div>
            )}

            {/* Notifications List */}
            <ScrollArea className="flex-1">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground p-4">
                  <Bell className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">لا توجد إشعارات</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 transition-all ${
                        !notification.is_read 
                          ? 'bg-primary/5 border-r-2 border-r-primary' 
                          : 'hover:bg-muted/50'
                      } ${actionLoading === notification.id ? 'opacity-50' : ''}`}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${!notification.is_read ? 'font-bold' : 'font-medium'}`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {notification.body}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 mt-1">
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                              locale: ar,
                            })}
                          </p>
                        </div>
                        {/* Action buttons */}
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          {!notification.is_read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-primary/10"
                              onClick={() => markAsRead(notification.id)}
                              disabled={actionLoading === notification.id}
                              title="تعليم كمقروء"
                            >
                              {actionLoading === notification.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5 text-primary" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteNotification(notification.id)}
                            disabled={actionLoading === notification.id}
                            title="حذف نهائي"
                          >
                            {actionLoading === notification.id && notification.is_read ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
