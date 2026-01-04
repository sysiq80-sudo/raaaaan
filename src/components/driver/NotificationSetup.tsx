import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Bell, 
  BellOff, 
  CheckCircle, 
  Loader2, 
  AlertCircle,
  Smartphone
} from "lucide-react";
import { 
  requestNotificationPermission, 
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  isPushNotificationEnabled,
  registerServiceWorker
} from "@/utils/serviceWorker";

interface NotificationSetupProps {
  driverId: string;
  isOnline: boolean;
}

export const NotificationSetup = ({ driverId, isOnline }: NotificationSetupProps) => {
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check current status
  useEffect(() => {
    const checkStatus = async () => {
      setChecking(true);
      
      // Check permission
      if ('Notification' in window) {
        setPermission(Notification.permission);
      }
      
      // Check subscription
      const subscribed = await isPushNotificationEnabled();
      setIsSubscribed(subscribed);
      
      setChecking(false);
    };
    
    checkStatus();
  }, [driverId]);

  const handleEnableNotifications = async () => {
    setLoading(true);
    
    try {
      // Register service worker first
      await registerServiceWorker();
      
      // Request permission
      const perm = await requestNotificationPermission();
      setPermission(perm);
      
      if (perm === 'granted') {
        // Subscribe to push
        const subscription = await subscribeToPushNotifications(driverId);
        
        if (subscription) {
          setIsSubscribed(true);
          toast({
            title: "تم تفعيل الإشعارات ✅",
            description: "ستصلك تنبيهات عند وصول طلبات جديدة"
          });
        } else {
          toast({
            title: "خطأ في التسجيل",
            description: "حدث خطأ أثناء تفعيل الإشعارات، حاول مرة أخرى",
            variant: "destructive"
          });
        }
      } else if (perm === 'denied') {
        toast({
          title: "تم رفض الإشعارات",
          description: "يمكنك تفعيلها لاحقاً من إعدادات المتصفح",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Notification setup error:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ غير متوقع",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    setLoading(true);
    
    try {
      await unsubscribeFromPushNotifications(driverId);
      setIsSubscribed(false);
      toast({
        title: "تم إيقاف الإشعارات",
        description: "لن تتلقى تنبيهات للطلبات الجديدة"
      });
    } catch (error) {
      console.error('Unsubscribe error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Already subscribed and permission granted
  if (isSubscribed && permission === 'granted') {
    return (
      <Card className="border-green-500/50 bg-green-500/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="font-medium text-foreground">الإشعارات مفعّلة</p>
                <p className="text-sm text-muted-foreground">ستصلك تنبيهات الطلبات الجديدة</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleDisableNotifications}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellOff className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Permission denied
  if (permission === 'denied') {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-foreground">الإشعارات محظورة</p>
              <p className="text-sm text-muted-foreground mb-3">
                لتفعيل الإشعارات، افتح إعدادات المتصفح وامنح الصلاحية لهذا الموقع
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg p-2">
                <Smartphone className="w-4 h-4" />
                <span>إعدادات → الخصوصية → الإشعارات → السماح</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not subscribed - show setup card
  return (
    <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
      <CardContent className="p-4 relative">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-20 h-20 bg-primary/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-16 h-16 bg-primary/10 rounded-full translate-x-1/2 translate-y-1/2" />
        
        <div className="relative z-10">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Bell className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-1">فعّل إشعارات الطلبات</h3>
              <p className="text-sm text-muted-foreground">
                احصل على تنبيهات فورية عند وصول طلبات جديدة حتى لو كان التطبيق مغلقاً
              </p>
            </div>
          </div>
          
          <Button 
            className="w-full h-12 text-base shadow-glow"
            onClick={handleEnableNotifications}
            disabled={loading || !isOnline}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin ml-2" />
                جاري التفعيل...
              </>
            ) : (
              <>
                <Bell className="w-5 h-5 ml-2" />
                تفعيل الإشعارات
              </>
            )}
          </Button>
          
          {!isOnline && (
            <p className="text-xs text-amber-500 mt-2 text-center">
              يجب أن تكون متصلاً لتفعيل الإشعارات
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationSetup;
