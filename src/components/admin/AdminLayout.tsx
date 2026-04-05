import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  MessageCircle,
  MessageSquare,
  Code,
  Wallet,
  Phone,
  MessageSquareWarning,
  CircleStop,
  ShieldAlert,
  Building2,
  Shield,
  UserCog,
  BookOpen,
  Bot,
  GitBranch,
  TrendingUp,
  Menu,
  Bell,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AdminNotificationsBell } from "./AdminNotificationsBell";
import AIAdminAssistant from "./AIAdminAssistant";
import { AdminGlobalSearch } from "./AdminGlobalSearch";
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

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

interface NavGroup {
  id: string;
  icon: React.ElementType;
  label: string;
  items: NavItem[];
}

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
  const { logout } = useAuth();
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const profilesTable = supabase.from("profiles") as any;
        const { data: profile } = await profilesTable
          .select("full_name, email")
          .eq("user_id", user.id)
          .single();

        const p = profile as { full_name?: string; email?: string } | null;
        setAdminName(p?.full_name || user.email || "مدير النظام");
      }
    };

    fetchAdminInfo();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/auth", { replace: true });
    } catch (err) {
      console.error("Logout error:", err);
      navigate("/auth", { replace: true });
    }
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

  // ===== تعريف المجموعات مع العناصر الفرعية =====
  const navGroups: NavGroup[] = [
    {
      id: "users",
      icon: Users,
      label: "المستخدمون",
      items: [
        { icon: Car, label: "السائقين", href: "/admin/drivers" },
        { icon: Building2, label: "الأساطيل", href: "/admin/fleets" },
        { icon: FileText, label: "إعدادات تسجيل السائقين", href: "/admin/driver-registration-settings" },
        { icon: UserCheck, label: "الركاب", href: "/admin/riders" },
        { icon: Clock, label: "إعدادات انتظار الراكب", href: "/admin/rider-wait-settings" },
        { icon: Users, label: "المستخدمين", href: "/admin/users" },
        { icon: MessageCircle, label: "عملاء البوت", href: "/admin/bot-customers" },
      ],
    },
    {
      id: "rides",
      icon: Route,
      label: "الرحلات",
      items: [
        { icon: Route, label: "الرحلات", href: "/admin/rides" },
        { icon: Timer, label: "الرحلات المعلقة", href: "/admin/pending-rides" },
        { icon: CircleStop, label: "الرحلات المتوقفة", href: "/admin/stopped-rides" },
        { icon: Map, label: "الخريطة الحية", href: "/admin/map" },
        { icon: Map, label: "ظهور السائقين", href: "/admin/driver-visibility" },
      ],
    },
    {
      id: "pricing",
      icon: DollarSign,
      label: "التسعير والمناطق",
      items: [
        { icon: MapPin, label: "المناطق والأسعار", href: "/admin/regions" },
        { icon: MapPinned, label: "المعالم والأماكن", href: "/admin/landmarks" },
        { icon: Car, label: "أنواع السيارات", href: "/admin/vehicle-types" },
        { icon: DollarSign, label: "إعدادات الأجرة", href: "/admin/fare-settings" },
        { icon: Zap, label: "تسعير الذروة", href: "/admin/surge-pricing" },
        { icon: Layers, label: "شرائح العمولة", href: "/admin/commission-tiers" },
        { icon: CreditCard, label: "خطط الاشتراك", href: "/admin/subscription-plans" },
      ],
    },
    {
      id: "finance",
      icon: TrendingUp,
      label: "التقارير والمالية",
      items: [
        { icon: DollarSign, label: "التقارير المالية", href: "/admin/reports" },
        { icon: DollarSign, label: "تقارير العمولات", href: "/admin/commission-reports" },
        { icon: Wallet, label: "طلبات المحفظة", href: "/admin/wallet-requests" },
        { icon: DollarSign, label: "طلبات السحب", href: "/admin/withdrawals" },
        { icon: AlertTriangle, label: "غرامة الإلغاء", href: "/admin/cancellation" },
        { icon: AlertTriangle, label: "تقرير الإلغاءات", href: "/admin/cancellation-report" },
        { icon: BarChart3, label: "إحصائيات API", href: "/admin/api-stats" },
        { icon: Phone, label: "سجلات SMS", href: "/admin/sms-logs" },
      ],
    },
    {
      id: "marketing",
      icon: Megaphone,
      label: "التسويق والمحتوى",
      items: [
        { icon: Bell, label: "إدارة الإشعارات", href: "/admin/notifications" },
        { icon: Users, label: "مجموعات الإشعارات", href: "/admin/notification-groups" },
        { icon: Gift, label: "المكافآت والحوافز", href: "/admin/incentives" },
        { icon: Gift, label: "نظام الإحالات", href: "/admin/referral-codes" },
        { icon: Ban, label: "الأسماء المحظورة", href: "/admin/banned-names" },
        { icon: Megaphone, label: "العروض الترويجية", href: "/admin/promo-banners" },
        { icon: Layers, label: "صفحات الراكب", href: "/admin/rider-pages" },
        { icon: BookOpen, label: "دليل عائلة ران", href: "/driver/guide" },
      ],
    },
    {
      id: "support",
      icon: MessageSquareWarning,
      label: "الدعم والشكاوى",
      items: [
        { icon: MessageSquareWarning, label: "الشكاوى", href: "/admin/complaints" },
        { icon: ShieldAlert, label: "كشف الاحتيال", href: "/admin/fraud-alerts" },
        { icon: ShieldAlert, label: "إعدادات الطوارئ", href: "/admin/emergency-settings" },
      ],
    },
    {
      id: "bot",
      icon: Bot,
      label: "البوت والتواصل",
      items: [
        { icon: Bot, label: "البوت المتحكم", href: "/admin/bot-controller" },
        { icon: GitBranch, label: "التدفقات المرئية", href: "/admin/workflows" },
        { icon: MessageCircle, label: "حسابات Messenger", href: "/admin/messenger-accounts" },
        { icon: MessageSquare, label: "محادثات البوت", href: "/admin/bot-chats" },
      ],
    },
    {
      id: "system",
      icon: Shield,
      label: "الأمان والنظام",
      items: [
        { icon: UserCog, label: "مدراء النظام", href: "/admin/controller-users" },
        { icon: Shield, label: "الأمان والحدود", href: "/admin/security-settings" },
        { icon: BookOpen, label: "التوثيق", href: "/admin/documentation" },
        { icon: Code, label: "ران المطور", href: "/admin/developer-settings" },
        { icon: Code, label: "خريطة المكونات", href: "/admin/dev-inspector" },
        { icon: Settings, label: "الإعدادات", href: "/admin/settings" },
      ],
    },
  ];

  // تحديد المجموعات المفتوحة بناءً على الصفحة الحالية
  const getDefaultOpenGroups = () => {
    const openSet: Record<string, boolean> = {};
    navGroups.forEach((group) => {
      const hasActive = group.items.some((item) => location.pathname === item.href);
      if (hasActive) openSet[group.id] = true;
    });
    return openSet;
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(getDefaultOpenGroups);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

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
          <nav className={cn("space-y-1", collapsed ? "px-2" : "px-3")}>

            {/* الرئيسية — منفردة */}
            {(() => {
              const isActive = location.pathname === "/admin";
              const linkContent = (
                <Link
                  to="/admin"
                  dir="ltr"
                  className={cn(
                    "flex items-center rounded-lg transition-all duration-200",
                    collapsed
                      ? "justify-center p-3"
                      : "gap-2 px-4 py-3",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="animate-fade-in whitespace-nowrap">
                      الرئيسية
                    </span>
                  )}
                </Link>
              );
              if (collapsed) {
                return (
                  <Tooltip key="/admin" delayDuration={0}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="left" className="font-medium">الرئيسية</TooltipContent>
                  </Tooltip>
                );
              }
              return <div key="/admin">{linkContent}</div>;
            })()}

            {/* فاصل */}
            {!collapsed && (
              <div className="pt-2 pb-1">
                <p className="text-xs text-sidebar-foreground/40 px-4 uppercase tracking-wider">القوائم</p>
              </div>
            )}
            {collapsed && <div className="my-1 border-t border-sidebar-border/30" />}

            {/* المجموعات */}
            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              const isGroupActive = group.items.some((item) => location.pathname === item.href);
              const isOpen = openGroups[group.id] ?? false;

              if (collapsed) {
                // في الوضع المطوي: عرض كل عنصر كأيقونة منفصلة
                return group.items.map((item) => {
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
                        <span className="text-xs text-muted-foreground">{group.label} ← </span>
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                });
              }

              // في الوضع الموسع: مجموعة قابلة للطي
              return (
                <Collapsible
                  key={group.id}
                  open={isOpen}
                  onOpenChange={() => toggleGroup(group.id)}
                >
                  {/* رأس المجموعة */}
                  <CollapsibleTrigger
                    dir="ltr"
                    className={cn(
                      "flex items-center w-full rounded-lg transition-all duration-200 gap-2 px-4 py-2.5",
                      isGroupActive
                        ? "bg-sidebar-accent text-sidebar-foreground font-semibold"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <GroupIcon className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-1 whitespace-nowrap text-sm font-medium">
                      {group.label}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 transition-transform duration-200 text-sidebar-foreground/50",
                        isOpen && "rotate-180"
                      )}
                    />
                  </CollapsibleTrigger>

                  {/* العناصر الفرعية */}
                  <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                    <div className="pr-4 space-y-0.5 mt-0.5 border-r-2 border-sidebar-border/40 mr-4">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            dir="ltr"
                            className={cn(
                              "flex items-center rounded-lg transition-all duration-200 gap-2 px-3 py-2",
                              isActive
                                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            )}
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="whitespace-nowrap text-xs leading-tight">
                              {item.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
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

        {/* Toggle Button — على حافة السايدبار */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 -left-4 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-200 border-2 border-background"
          )}
          title={collapsed ? "توسيع القائمة" : "طي القائمة"}
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
          "flex-1 transition-all duration-300 ease-in-out h-screen overflow-y-auto",
          mainMargin
        )}
      >
        {/* Top Header Bar */}
        <header className="bg-card border-b border-border sticky top-0 z-10 px-6 py-3">
          <div className="flex items-center gap-4">
            {/* زر فتح/إغلاق القائمة الجانبية */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground flex-shrink-0"
              title={collapsed ? "فتح القائمة الجانبية" : "إغلاق القائمة الجانبية"}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-muted-foreground flex-shrink-0">
              <User className="w-4 h-4" />
              <span className="text-sm font-medium text-foreground">{adminName}</span>
            </div>

            {/* 🔍 البحث الشامل — في المنتصف */}
            <AdminGlobalSearch />

            {/* التاريخ والوقت والإشعارات */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(currentTime)}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Clock className="w-4 h-4" />
                <span className="font-mono">{formatTime(currentTime)}</span>
              </div>
              <AdminNotificationsBell />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-foreground mb-1">
                {title}
              </h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
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
