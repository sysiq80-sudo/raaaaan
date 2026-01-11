import { useState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle,
  ShieldAlert,
  Bell,
  BellOff,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface Alert {
  id: string;
  type: "warning" | "success" | "info";
  title: string;
  message: string;
  actionText: string;
  actionRoute: string;
  icon?: React.ReactNode;
}

interface DriverAlertsProps {
  isProfileComplete: boolean;
  notificationPermission: NotificationPermission;
  isOnline: boolean;
  adminActivated: boolean;
  driverStatus: string | null;
}

export function DriverAlerts({
  isProfileComplete,
  notificationPermission,
  isOnline,
  adminActivated,
  driverStatus,
}: DriverAlertsProps) {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const newAlerts: Alert[] = [];

    // تحقق من حالة الموافقة من المدير
    if (!adminActivated || driverStatus === "pending") {
      newAlerts.push({
        id: "admin-approval",
        type: "warning",
        title: "في انتظار الموافقة",
        message: "حسابك قيد المراجعة من قبل الإدارة. سيتم تفعيلك قريباً.",
        actionText: "عرض الحالة",
        actionRoute: "/driver/status",
        icon: <ShieldAlert className="h-4 w-4 text-orange-500" />,
      });
    }

    // تحقق من اكتمال البيانات
    if (!isProfileComplete) {
      newAlerts.push({
        id: "profile-incomplete",
        type: "warning",
        title: "أكمل بياناتك",
        message:
          "لم تكمل جميع البيانات المطلوبة. أكمل ملفك لتسريع عملية المراجعة والموافقة.",
        actionText: "إكمال البيانات",
        actionRoute: "/driver/complete-registration",
        icon: <FileCheck className="h-4 w-4 text-orange-500" />,
      });
    }

    // تحقق من حالة الإشعارات
    if (notificationPermission === "granted" && isOnline) {
      newAlerts.push({
        id: "notifications-enabled",
        type: "success",
        title: "الإشعارات مفعّلة",
        message: "ستصلك تنبيهات الطلبات الجديدة",
        actionText: "الإعدادات",
        actionRoute: "/driver/settings",
        icon: <Bell className="h-4 w-4 text-green-500" />,
      });
    } else if (notificationPermission === "denied" && isOnline) {
      newAlerts.push({
        id: "notifications-disabled",
        type: "warning",
        title: "الإشعارات معطّلة",
        message: "لن تصلك تنبيهات الطلبات. قم بتفعيل الإشعارات من الإعدادات.",
        actionText: "تفعيل الإشعارات",
        actionRoute: "/driver/settings",
        icon: <BellOff className="h-4 w-4 text-orange-500" />,
      });
    } else if (notificationPermission === "default" && isOnline) {
      newAlerts.push({
        id: "notifications-default",
        type: "info",
        title: "فعّل الإشعارات",
        message: "لاستقبال تنبيهات الطلبات الجديدة بشكل فوري.",
        actionText: "تفعيل الآن",
        actionRoute: "/driver/settings",
        icon: <Bell className="h-4 w-4 text-blue-500" />,
      });
    }

    setAlerts(newAlerts);
  }, [
    isProfileComplete,
    notificationPermission,
    isOnline,
    adminActivated,
    driverStatus,
  ]);

  const handleAlertClick = (route: string) => {
    setIsOpen(false);
    navigate(route);
  };

  const getAlertIcon = (alert: Alert) => {
    if (alert.icon) return alert.icon;

    switch (alert.type) {
      case "warning":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAlertBadgeColor = (type: Alert["type"]) => {
    switch (type) {
      case "warning":
        return "bg-orange-500";
      case "success":
        return "bg-green-500";
      default:
        return "bg-blue-500";
    }
  };

  if (alerts.length === 0) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10">
          <div className="relative">
            {alerts.some((a) => a.type === "warning") ? (
              <AlertCircle className="h-5 w-5 text-orange-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            {alerts.length > 0 && (
              <Badge
                className={`absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] ${
                  alerts.some((a) => a.type === "warning")
                    ? "bg-orange-500 hover:bg-orange-600"
                    : "bg-green-500 hover:bg-green-600"
                }`}
              >
                {alerts.length}
              </Badge>
            )}
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="p-4 border-b">
          <h3 className="font-semibold">التنبيهات</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {alerts.length} تنبيه{alerts.length > 1 ? "ات" : ""}
          </p>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="p-4 border-b last:border-b-0 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start gap-3 mb-3">
                {getAlertIcon(alert)}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm mb-1">{alert.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {alert.message}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                className="w-full"
                variant={alert.type === "warning" ? "default" : "outline"}
                onClick={() => handleAlertClick(alert.actionRoute)}
              >
                {alert.actionText}
              </Button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
