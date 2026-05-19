import { Home, Route, Wallet, Settings } from "lucide-react";
import type { ComponentType } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type DockShortcut = {
  key: string;
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
};

const SHORTCUTS: DockShortcut[] = [
  { key: "home", label: "الرئيسية", path: "/driver", icon: Home },
  { key: "rides", label: "الرحلات", path: "/driver/rides", icon: Route },
  { key: "finance", label: "المالية", path: "/driver/finance", icon: Wallet },
  { key: "settings", label: "الإعدادات", path: "/driver/settings", icon: Settings },
];

const isRouteActive = (pathname: string, path: string) => {
  if (path === "/driver") return pathname === "/driver";
  return pathname === path || pathname.startsWith(`${path}/`);
};

const CarModeQuickDock = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="car-quick-dock shrink-0 z-50 w-full px-2 pb-[env(safe-area-inset-bottom)]" dir="rtl">
      <div className="mx-auto w-[min(96vw,740px)]">
      <div className="car-quick-dock-panel rounded-2xl border border-emerald-400/35 bg-slate-950/85 p-2 shadow-2xl backdrop-blur-xl">
        <nav className="grid grid-cols-4 gap-2" aria-label="اختصارات القيادة">
          {SHORTCUTS.map((shortcut) => {
            const Icon = shortcut.icon;
            const active = isRouteActive(pathname, shortcut.path);

            return (
              <button
                key={shortcut.key}
                type="button"
                onClick={() => navigate(shortcut.path)}
                className={`car-quick-btn rounded-xl px-2 py-3 transition-all duration-200 ${
                  active
                    ? "bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.45)]"
                    : "bg-slate-900/90 text-slate-100 hover:bg-slate-800"
                }`}
              >
                <span className="flex flex-col items-center justify-center gap-1">
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-semibold">{shortcut.label}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>
      </div>
    </div>
  );
};

export default CarModeQuickDock;
