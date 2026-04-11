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
  Smartphone,
} from "lucide-react";
import {
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  isPushNotificationEnabled,
  registerServiceWorker,
} from "@/utils/serviceWorker";

interface NotificationSetupProps {
  driverId: string;
  isOnline: boolean;
}

export const NotificationSetup = ({
  driverId,
  isOnline,
}: NotificationSetupProps) => {
  const { toast } = useToast();
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check current status
  useEffect(() => {
    const checkStatus = async () => {
      setChecking(true);

      // Check permission — guarded for Android WebView
      try {
        if (typeof Notification !== 'undefined') {
          setPermission(Notification.permission);
        }
      } catch {
        // Notification API not available (Android WebView)
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

      if (perm === "granted") {
        // Subscribe to push
        const subscription = await subscribeToPushNotifications(driverId);

        if (subscription) {
          setIsSubscribed(true);
          toast({
            title: "تم تفعيل الإشعارات ✅",
            description: "ستصلك تنبيهات عند وصول طلبات جديدة",
          });
        } else {
          toast({
            title: "خطأ في التسجيل",
            description: "حدث خطأ أثناء تفعيل الإشعارات، حاول مرة أخرى",
            variant: "destructive",
          });
        }
      } else if (perm === "denied") {
        toast({
          title: "تم رفض الإشعارات",
          description: "يمكنك تفعيلها لاحقاً من إعدادات المتصفح",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Notification setup error:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ غير متوقع",
        variant: "destructive",
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
        description: "لن تتلقى تنبيهات للطلبات الجديدة",
      });
    } catch (error) {
      console.error("Unsubscribe error:", error);
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
  if (isSubscribed && permission === "granted") {
    return (
      <Card className="border-2 border-green-500 bg-gradient-to-br from-gray-800 to-gray-900 shadow-xl">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center shrink-0 shadow-lg shadow-green-500/50">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-green-400 text-[clamp(0.875rem,2.5vw,1.125rem)] leading-tight">
                  الإشعارات مفعّلة
                </p>
                <p className="text-[clamp(0.75rem,2vw,0.875rem)] text-green-300/80 leading-tight">
                  ستصلك تنبيهات الطلبات الجديدة
                </p>
              </div>
            </div>
            <button
              onClick={handleDisableNotifications}
              disabled={loading}
              className={`
                relative inline-flex h-10 w-20 items-center rounded-full
                transition-all duration-300 ease-in-out
                ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                bg-green-500 shadow-lg shadow-green-500/50
                hover:shadow-xl hover:shadow-green-500/60
                active:scale-95
              `}
            >
              <span
                className={`
                  inline-block h-8 w-8 transform rounded-full
                  bg-white shadow-lg transition-transform duration-300
                  ${loading ? "" : "translate-x-12"}
                `}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 m-2 animate-spin text-gray-400" />
                ) : (
                  <CheckCircle className="w-4 h-4 m-2 text-gray-400" />
                )}
              </span>
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Permission denied
  if (permission === "denied") {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-foreground">الإشعارات محظورة</p>
              <p className="text-sm text-muted-foreground mb-3">
                لتفعيل الإشعارات، افتح إعدادات المتصفح وامنح الصلاحية لهذا
                الموقع
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
    <Card className="border-2 border-blue-500/50 bg-gradient-to-br from-gray-800 to-gray-900 shadow-xl">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 rounded-full bg-blue-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30">
              <BellOff className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="font-bold text-blue-400 text-[clamp(0.875rem,2.5vw,1.125rem)] leading-tight">
                الإشعارات غير مفعّلة
              </p>
              <p className="text-[clamp(0.75rem,2vw,0.875rem)] text-blue-300/70 leading-tight">
                فعّل لتلقي تنبيهات الطلبات الجديدة
              </p>
            </div>
          </div>
          <button
            onClick={handleEnableNotifications}
            disabled={loading}
            className={`
              relative inline-flex h-10 w-20 items-center rounded-full
              transition-all duration-300 ease-in-out
              ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              bg-gray-400 shadow-md
              hover:shadow-lg hover:bg-gray-500
              active:scale-95
            `}
          >
            <span
              className={`
                inline-block h-8 w-8 transform rounded-full
                bg-white shadow-lg transition-transform duration-300
                translate-x-0.5
              `}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 m-2 animate-spin text-gray-400" />
              ) : (
                <Bell className="w-4 h-4 m-2 text-gray-400" />
              )}
            </span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationSetup;
