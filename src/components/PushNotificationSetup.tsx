// @ts-nocheck
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PushNotificationSetupProps {
  userId: string;
  userType: 'driver' | 'rider';
}

export const PushNotificationSetup = ({ userId, userType }: PushNotificationSetupProps) => {
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // التحقق من حالة الإشعارات عند التحميل
  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = async () => {
    setChecking(true);
    try {
      // التحقق من دعم المتصفح
      if (!('Notification' in window)) {
        setPermission('denied');
        setChecking(false);
        return;
      }

      setPermission(Notification.permission);

      // التحقق من وجود subscription
      if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await (registration as any).pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      }
    } catch (error) {
      console.error('Error checking notification status:', error);
    } finally {
      setChecking(false);
    }
  };

  const requestPermission = useCallback(async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast({
          title: "تم تفعيل الإشعارات! ✅",
          description: "ستصلك الآن إشعارات فورية"
        });
        await subscribeToPush();
      } else {
        toast({
          title: "تم رفض الإشعارات",
          description: "لن تصلك إشعارات فورية",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast({
        title: "خطأ",
        description: "فشل طلب صلاحية الإشعارات",
        variant: "destructive"
      });
    }
  }, [toast]);

  const subscribeToPush = async () => {
    setLoading(true);
    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Worker غير مدعوم');
      }

      // تسجيل Service Worker إذا لم يكن مسجلاً
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
      }

      // الحصول على subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // إنشاء subscription جديد
        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
        
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
      }

      // حفظ الـ subscription في قاعدة البيانات
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          action: 'subscribe',
          subscription: {
            [`${userType}_id`]: userId,
            endpoint: subscription.endpoint,
            p256dh_key: arrayBufferToBase64(subscription.getKey('p256dh')),
            auth_key: arrayBufferToBase64(subscription.getKey('auth'))
          }
        }
      });

      if (error) throw error;

      setIsSubscribed(true);
      toast({
        title: "تم التسجيل بنجاح! 🔔",
        description: "ستصلك الإشعارات الفورية الآن"
      });

    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast({
        title: "خطأ في التسجيل",
        description: "حدث خطأ أثناء تفعيل الإشعارات",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeFromPush = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // حذف من قاعدة البيانات
        await supabase.functions.invoke('send-push-notification', {
          body: {
            action: 'unsubscribe',
            subscription: {
              [`${userType}_id`]: userId,
              endpoint: subscription.endpoint
            }
          }
        });
      }

      setIsSubscribed(false);
      toast({
        title: "تم إلغاء الاشتراك",
        description: "لن تصلك إشعارات فورية"
      });

    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast({
        title: "خطأ",
        description: "فشل إلغاء الاشتراك",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer | null): string => {
    if (!buffer) return '';
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  if (checking) {
    return (
      <Card className="border-muted">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">جاري التحقق من الإشعارات...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // إذا كان المتصفح لا يدعم الإشعارات
  if (!('Notification' in window)) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-foreground">الإشعارات غير مدعومة</p>
              <p className="text-sm text-muted-foreground">
                متصفحك لا يدعم الإشعارات الفورية. جرب متصفح حديث مثل Chrome أو Firefox.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // إذا تم رفض الصلاحية
  if (permission === 'denied') {
    return (
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <BellOff className="w-5 h-5 text-amber-500 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-foreground">الإشعارات محظورة</p>
              <p className="text-sm text-muted-foreground mb-3">
                قمت بحظر الإشعارات. لتفعيلها:
              </p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>اضغط على أيقونة القفل في شريط العنوان</li>
                <li>ابحث عن "الإشعارات" أو "Notifications"</li>
                <li>غيّر الإعداد إلى "السماح"</li>
                <li>أعد تحميل الصفحة</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // إذا كان مشترك بالفعل
  if (isSubscribed) {
    return (
      <Card className="border-green-500/50 bg-green-500/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-foreground">الإشعارات مفعّلة ✅</p>
                <p className="text-sm text-muted-foreground">
                  ستصلك إشعارات فورية عند وجود طلبات جديدة
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={unsubscribeFromPush}
              disabled={loading}
              className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <BellOff className="w-4 h-4 ml-2" />
                  إلغاء
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // طلب تفعيل الإشعارات
  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">فعّل الإشعارات الفورية</p>
              <p className="text-sm text-muted-foreground">
                احصل على تنبيهات فورية عند وجود طلبات جديدة
              </p>
            </div>
          </div>
          <Button
            onClick={permission === 'default' ? requestPermission : subscribeToPush}
            disabled={loading}
            className="shadow-glow"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Bell className="w-4 h-4 ml-2" />
                تفعيل
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PushNotificationSetup;
