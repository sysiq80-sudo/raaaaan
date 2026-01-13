import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { useState, useEffect } from "react";
import {
  Car,
  MapPin,
  DollarSign,
  LayoutDashboard,
  Users,
  UserCheck,
  Map,
  Settings,
  LogOut,
  Route,
  MapPinned,
  AlertTriangle,
  Gift,
  Timer,
  Clock,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  ChevronDown,
  Zap,
  CreditCard,
  Layers,
  Ban,
  Megaphone,
  FileText,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AdminNotificationsBell } from "./AdminNotificationsBell";
import AIAdminAssistant from "./AIAdminAssistant";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const AdminLayout = ({
  children,
  title,
  subtitle,
  actions,
}: AdminLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [adminName, setAdminName] = useState<string>("");
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("admin-sidebar-collapsed");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("admin-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchAdminInfo = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", user.id)
          .single();

        setAdminName(profile?.full_name || user.email || "مدير النظام");
      }
    };

    fetchAdminInfo();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const navItems = [
    { icon: LayoutDashboard, label: "الرئيسية", href: "/admin" },
    { icon: MapPin, label: "المناطق والأسعار", href: "/admin/regions" },
    { icon: MapPinned, label: "المعالم والأماكن", href: "/admin/landmarks" },
    { icon: Car, label: "أنواع السيارات", href: "/admin/vehicle-types" },
    { icon: DollarSign, label: "إعدادات الأجرة", href: "/admin/fare-settings" },
    { icon: Car, label: "السائقين", href: "/admin/drivers" },
    {
      icon: FileText,
      label: "إعدادات تسجيل السائقين",
      href: "/admin/driver-registration-settings",
    },
    { icon: UserCheck, label: "الركاب", href: "/admin/riders" },
    {
      icon: Clock,
      label: "إعدادات انتظار الراكب",
      href: "/admin/rider-wait-settings",
    },
    { icon: Route, label: "الرحلات", href: "/admin/rides" },
    { icon: Timer, label: "الرحلات المعلقة", href: "/admin/pending-rides" },
    { icon: Users, label: "المستخدمين", href: "/admin/users" },
    { icon: Map, label: "الخريطة الحية", href: "/admin/map" },
    { icon: Map, label: "ظهور السائقين", href: "/admin/driver-visibility" },
    { icon: DollarSign, label: "التقارير المالية", href: "/admin/reports" },
    {
      icon: DollarSign,
      label: "تقارير العمولات",
      href: "/admin/commission-reports",
    },
    {
      icon: AlertTriangle,
      label: "غرامة الإلغاء",
      href: "/admin/cancellation",
    },
    {
      icon: AlertTriangle,
      label: "تقرير الإلغاءات",
      href: "/admin/cancellation-report",
    },
    { icon: Gift, label: "المكافآت والحوافز", href: "/admin/incentives" },
    { icon: Ban, label: "الأسماء المحظورة", href: "/admin/banned-names" },
    {
      icon: Megaphone,
      label: "العروض الترويجية",
      href: "/admin/promo-banners",
    },
    { icon: Layers, label: "صفحات الراكب", href: "/admin/rider-pages" },
    { icon: BarChart3, label: "إحصائيات API", href: "/admin/api-stats" },
    { icon: Settings, label: "الإعدادات", href: "/admin/settings" },
  ];

  const advancedPricingItems = [
    { icon: Zap, label: "تسعير الذروة", href: "/admin/surge-pricing" },
    {
      icon: CreditCard,
      label: "خطط الاشتراك",
      href: "/admin/subscription-plans",
    },
    { icon: Layers, label: "شرائح العمولة", href: "/admin/commission-tiers" },
  ];

  const [pricingOpen, setPricingOpen] = useState(() => {
    return advancedPricingItems.some((item) => location.pathname === item.href);
  });

  const sidebarWidth = collapsed ? "w-[72px]" : "w-64";
  const mainMargin = collapsed ? "mr-[72px]" : "mr-64";

  return (
    <div className="min-h-screen bg-background flex" dir="rtl">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground fixed top-0 right-0 h-full border-l border-sidebar-border flex flex-col transition-all duration-300 ease-in-out z-20",
          sidebarWidth
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "border-b border-sidebar-border flex items-center transition-all duration-300",
            collapsed ? "p-4 justify-center" : "p-6"
          )}
        >
          <div className={cn("flex items-center", collapsed ? "" : "gap-3")}>
            <img src={logo} alt="RAAN" className="w-10 h-10 flex-shrink-0" />
            {!collapsed && (
              <div className="animate-fade-in">
                <h1 className="font-bold">ران RAAN</h1>
                <p className="text-xs text-sidebar-foreground/70">
                  لوحة التحكم
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-2">
          <nav className={cn("space-y-1", collapsed ? "px-2" : "px-4")}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;

              const linkContent = (
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center rounded-lg transition-all duration-200",
                    collapsed
                      ? "justify-center p-3"
                      : "gap-3 px-4 py-3 flex-row-reverse",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="animate-fade-in whitespace-nowrap flex-1 text-right">
                      {item.label}
                    </span>
                  )}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href} delayDuration={0}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="left" className="font-medium">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return <div key={item.href}>{linkContent}</div>;
            })}

            {/* التسعير المتقدم - قسم قابل للطي */}
            {collapsed ? (
              advancedPricingItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Tooltip key={item.href} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.href}
                        className={cn(
                          "flex items-center rounded-lg transition-all duration-200 justify-center p-3",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        )}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="font-medium">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })
            ) : (
              <Collapsible
                open={pricingOpen}
                onOpenChange={setPricingOpen}
                className="mt-2"
              >
                <CollapsibleTrigger
                  className={cn(
                    "flex items-center w-full rounded-lg transition-all duration-200 gap-3 px-4 py-3 flex-row-reverse",
                    advancedPricingItems.some(
                      (item) => location.pathname === item.href
                    )
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <DollarSign className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 text-right whitespace-nowrap">
                    التسعير المتقدم
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 transition-transform duration-200",
                      pricingOpen && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="pr-4 space-y-1 mt-1">
                  {advancedPricingItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          "flex items-center rounded-lg transition-all duration-200 gap-3 px-4 py-2.5 flex-row-reverse",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        )}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="whitespace-nowrap text-sm flex-1 text-right">
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            )}
          </nav>
        </ScrollArea>

        {/* Bottom Section */}
        <div
          className={cn(
            "border-t border-sidebar-border",
            collapsed ? "p-2" : "p-4"
          )}
        >
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleLogout}
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">تسجيل الخروج</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-between text-destructive hover:text-destructive hover:bg-destructive/10 flex-row-reverse"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              <span className="flex-1 text-right">تسجيل الخروج</span>
            </Button>
          )}
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 -left-4 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-200 border-2 border-background"
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300 ease-in-out",
          mainMargin
        )}
      >
        {/* Top Header Bar */}
        <header className="bg-card border-b border-border sticky top-0 z-10 px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="w-5 h-5" />
                <span className="font-medium text-foreground">{adminName}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-5 h-5" />
                <span>{formatDate(currentTime)}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-5 h-5" />
                <span className="font-mono">{formatTime(currentTime)}</span>
              </div>
              <AdminNotificationsBell />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {title}
              </h1>
              {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
            </div>
            {actions}
          </div>
          {children}
        </div>
      </main>

      {/* AI Admin Assistant - Floating Button */}
      <AIAdminAssistant />
    </div>
  );
};

export default AdminLayout;
