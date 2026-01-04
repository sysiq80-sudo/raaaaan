import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, Check, Trash2, FileText, User, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface AdminNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export const AdminNotificationsBell = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();

    // Real-time subscription
    const channel = supabase
      .channel('admin-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_notifications'
        },
        (payload) => {
          setNotifications(prev => [payload.new as AdminNotification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setNotifications(data as AdminNotification[]);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase
      .from('admin_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);

    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;

    await supabase
      .from('admin_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', unreadIds);

    setNotifications(prev =>
      prev.map(n => ({ ...n, is_read: true }))
    );
  };

  const deleteNotification = async (id: string) => {
    await supabase
      .from('admin_notifications')
      .delete()
      .eq('id', id);

    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleNotificationClick = (notification: AdminNotification) => {
    markAsRead(notification.id);
    
    if (notification.type === 'driver_application' && notification.data?.driver_id) {
      setOpen(false);
      navigate('/admin/drivers');
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'driver_application':
        return <User className="w-4 h-4 text-primary" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center text-xs bg-destructive text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">الإشعارات</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              <Check className="w-4 h-4 ml-1" />
              قراءة الكل
            </Button>
          )}
        </div>

        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">لا توجد إشعارات</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                    !notification.is_read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-muted">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${!notification.is_read ? 'font-semibold' : ''}`}>
                          {notification.title}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.body}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: ar
                          })}
                        </p>
                        {notification.type === 'driver_application' && (
                          <span className="text-xs text-primary flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            عرض الطلب
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
