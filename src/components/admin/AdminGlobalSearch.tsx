import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, X, Car, Users, Route, MapPin, Settings, LayoutDashboard, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  category: "page" | "driver" | "user" | "ride";
  icon: React.ElementType;
}

// ثوابت الصفحات المتاحة في لوحة التحكم
const ADMIN_PAGES: SearchResult[] = [
  { id: "dashboard", title: "الرئيسية", subtitle: "لوحة الإحصائيات الرئيسية", href: "/admin", category: "page", icon: LayoutDashboard },
  { id: "drivers", title: "السائقين", subtitle: "إدارة وعرض السائقين", href: "/admin/drivers", category: "page", icon: Car },
  { id: "riders", title: "الركاب", subtitle: "قائمة الركاب المسجلين", href: "/admin/riders", category: "page", icon: Users },
  { id: "rides", title: "الرحلات", subtitle: "جميع الرحلات", href: "/admin/rides", category: "page", icon: Route },
  { id: "pending-rides", title: "الرحلات المعلقة", subtitle: "طلبات تنتظر سائقاً", href: "/admin/pending-rides", category: "page", icon: Route },
  { id: "map", title: "الخريطة الحية", subtitle: "تتبع السائقين والرحلات", href: "/admin/map", category: "page", icon: MapPin },
  { id: "regions", title: "المناطق والأسعار", subtitle: "إدارة مناطق التسعير", href: "/admin/regions", category: "page", icon: MapPin },
  { id: "users", title: "المستخدمين", subtitle: "إدارة صلاحيات المستخدمين", href: "/admin/users", category: "page", icon: Users },
  { id: "reports", title: "التقارير المالية", subtitle: "الدخل والأرباح", href: "/admin/reports", category: "page", icon: Settings },
  { id: "notifications", title: "الإشعارات", subtitle: "إرسال وإدارة الإشعارات", href: "/admin/notifications", category: "page", icon: Settings },
  { id: "complaints", title: "الشكاوى", subtitle: "دعم وشكاوى العملاء", href: "/admin/complaints", category: "page", icon: Settings },
  { id: "settings", title: "الإعدادات", subtitle: "إعدادات النظام", href: "/admin/settings", category: "page", icon: Settings },
  { id: "incentives", title: "المكافآت والحوافز", subtitle: "برامج المكافآت", href: "/admin/incentives", category: "page", icon: Settings },
  { id: "commission-tiers", title: "شرائح العمولة", subtitle: "مستويات العمولة", href: "/admin/commission-tiers", category: "page", icon: Settings },
  { id: "fare-settings", title: "إعدادات الأجرة", subtitle: "تعديل تعريفات الأجر", href: "/admin/fare-settings", category: "page", icon: Settings },
  { id: "vehicle-types", title: "أنواع السيارات", subtitle: "أنواع المركبات المتاحة", href: "/admin/vehicle-types", category: "page", icon: Car },
  { id: "fleets", title: "الأساطيل", subtitle: "إدارة أساطيل السيارات", href: "/admin/fleets", category: "page", icon: Car },
  { id: "surge-pricing", title: "تسعير الذروة", subtitle: "أسعار ساعات الذروة", href: "/admin/surge-pricing", category: "page", icon: Settings },
  { id: "wallet-requests", title: "طلبات المحفظة", subtitle: "طلبات شحن وسحب", href: "/admin/wallet-requests", category: "page", icon: Settings },
  { id: "security-settings", title: "الأمان والحدود", subtitle: "حدود الأمان والنظام", href: "/admin/security-settings", category: "page", icon: Settings },
];

export const AdminGlobalSearch = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearchingData, setIsSearchingData] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // فتح البحث بـ Ctrl+K أو Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // إغلاق عند الضغط خارج البحث
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // البحث عن نتائج
  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(ADMIN_PAGES.slice(0, 6));
      return;
    }

    const lowerQ = q.toLowerCase();

    // بحث في الصفحات
    const pageResults = ADMIN_PAGES.filter(
      (p) => p.title.includes(q) || p.subtitle?.includes(q)
    );

    // بحث في البيانات الحية
    setIsSearchingData(true);
    try {
      const [driversRes, usersRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("drivers") as any)
          .select("id, full_name, phone")
          .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
          .limit(3),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("profiles") as any)
          .select("id, full_name, phone")
          .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
          .limit(3),
      ]);

      const driverResults: SearchResult[] = (driversRes.data || []).map((d: Record<string, string>) => ({
        id: `driver-${d.id}`,
        title: d.full_name || "سائق",
        subtitle: d.phone || "",
        href: `/admin/drivers/${d.id}`,
        category: "driver" as const,
        icon: Car,
      }));

      const userResults: SearchResult[] = (usersRes.data || []).map((u: Record<string, string>) => ({
        id: `user-${u.id}`,
        title: u.full_name || "مستخدم",
        subtitle: u.phone || "",
        href: `/admin/users`,
        category: "user" as const,
        icon: Users,
      }));

      const combined = [...pageResults, ...driverResults, ...userResults].slice(0, 8);
      setResults(combined.length ? combined : pageResults);
    } catch {
      setResults(pageResults);
    } finally {
      setIsSearchingData(false);
    }
  }, []);

  // debounce البحث
  useEffect(() => {
    const timer = setTimeout(() => performSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // تهيئة النتائج الافتراضية عند الفتح
  useEffect(() => {
    if (isOpen && !query) {
      setResults(ADMIN_PAGES.slice(0, 6));
      setSelectedIndex(0);
    }
  }, [isOpen, query]);

  // التنقل بالكيبورد في النتائج
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      navigateTo(results[selectedIndex]);
    }
  };

  const navigateTo = (result: SearchResult) => {
    navigate(result.href);
    setIsOpen(false);
    setQuery("");
  };

  const categoryLabel: Record<string, string> = {
    page: "صفحة",
    driver: "سائق",
    user: "مستخدم",
    ride: "رحلة",
  };

  const categoryColor: Record<string, string> = {
    page: "bg-primary/10 text-primary",
    driver: "bg-emerald-500/10 text-emerald-500",
    user: "bg-blue-500/10 text-blue-500",
    ride: "bg-amber-500/10 text-amber-500",
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md mx-6">
      {/* زر/حقل البحث */}
      <button
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-2 rounded-xl border transition-all duration-200",
          isOpen
            ? "border-primary/50 bg-background shadow-lg shadow-primary/10"
            : "border-border/50 bg-secondary/50 hover:border-border hover:bg-secondary/80"
        )}
      >
        <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        {!isOpen && (
          <>
            <span className="text-sm text-muted-foreground flex-1 text-right">
              ابحث في لوحة التحكم...
            </span>
            <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-background border border-border text-muted-foreground font-mono">
              Ctrl K
            </kbd>
          </>
        )}
        {isOpen && (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="ابحث عن صفحة، سائق، مستخدم..."
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground text-right"
            dir="rtl"
          />
        )}
        {isOpen && query && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setQuery("");
              inputRef.current?.focus();
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </button>

      {/* نتائج البحث */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-2xl shadow-black/20 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* رأس نتائج */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
            <span className="text-xs text-muted-foreground">
              {isSearchingData ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  جاري البحث...
                </span>
              ) : query ? (
                `${results.length} نتيجة`
              ) : (
                "الصفحات الأخيرة"
              )}
            </span>
            <span className="text-xs text-muted-foreground/60">
              ↑↓ للتنقل · Enter للفتح · Esc للإغلاق
            </span>
          </div>

          {/* قائمة النتائج */}
          <div className="max-h-80 overflow-y-auto">
            {results.length === 0 && !isSearchingData && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Search className="w-6 h-6 mb-2 opacity-40" />
                <p className="text-sm">لا توجد نتائج لـ "{query}"</p>
              </div>
            )}
            {results.map((result, idx) => {
              const Icon = result.icon;
              return (
                <button
                  key={result.id}
                  onClick={() => navigateTo(result)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-right transition-colors",
                    idx === selectedIndex
                      ? "bg-primary/10"
                      : "hover:bg-muted/50"
                  )}
                  dir="rtl"
                >
                  <div className={cn("p-1.5 rounded-lg", categoryColor[result.category])}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {result.title}
                    </p>
                    {result.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">
                        {result.subtitle}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full", categoryColor[result.category])}>
                      {categoryLabel[result.category]}
                    </span>
                    {idx === selectedIndex && (
                      <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminGlobalSearch;
