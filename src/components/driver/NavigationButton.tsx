import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Navigation, ChevronDown, MapPin } from "lucide-react";

interface NavigationButtonProps {
  lat: number;
  lng: number;
  label?: string;
  className?: string;
  size?: "default" | "compact" | "icon";
  onOpenModal?: (lat: number, lng: number) => void;
}

type NavApp = 'google' | 'waze' | 'apple';

const navApps = {
  google: {
    name: 'Google Maps',
    icon: '🗺️',
    getUrl: (lat: number, lng: number) => 
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
  },
  waze: {
    name: 'Waze',
    icon: '🚗',
    getUrl: (lat: number, lng: number) => 
      `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
  },
  apple: {
    name: 'Apple Maps',
    icon: '🍎',
    getUrl: (lat: number, lng: number) => 
      `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
  }
};

export const NavigationButton = ({ 
  lat, 
  lng, 
  label = "افتح الملاحة",
  className,
  size = "default",
  onOpenModal,
}: NavigationButtonProps) => {
  const [preferredApp, setPreferredApp] = useState<NavApp>(() => {
    const saved = localStorage.getItem('preferred_nav_app') as NavApp;
    return saved || 'google';
  });

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const openNavigation = (app: NavApp) => {
    const url = navApps[app].getUrl(lat, lng);
    window.open(url, '_blank');
  };

  const handleQuickNav = () => {
    // If modal callback provided, use it instead of direct navigation
    if (onOpenModal) {
      onOpenModal(lat, lng);
    } else {
      // On iOS, prefer Apple Maps by default if no preference set
      const app = isIOS && !localStorage.getItem('preferred_nav_app') ? 'apple' : preferredApp;
      openNavigation(app);
    }
  };

  const handleSelectApp = (app: NavApp) => {
    setPreferredApp(app);
    localStorage.setItem('preferred_nav_app', app);
    openNavigation(app);
  };

  return (
    <div className={`flex h-full ${className ?? ""}`}>
      {/* Main navigation button */}
      <button
        className={`flex-1 flex ${size === "icon" ? "items-center justify-center p-0" : "flex-col items-center justify-center gap-1"} bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-colors touch-manipulation ${
          size === "compact" ? "text-xs" : size === "icon" ? "" : "text-sm"
        } ${size === "icon" ? "rounded-full shadow-lg" : "rounded-none"}`}
        onClick={handleQuickNav}
        title={label}
      >
        <Navigation className={size === "compact" ? "w-5 h-5" : size === "icon" ? "w-5 h-5 text-white" : "w-6 h-6"} />
        {size !== "icon" && <span className="font-bold">{label}</span>}
      </button>

      {/* Dropdown for app selection — only when no modal */}
      {!onOpenModal && size !== "icon" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`flex items-center justify-center bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white border-r-0 border-l border-blue-500/50 rounded-none touch-manipulation transition-colors ${
                size === "compact" ? "w-9" : "w-12"
              }`}
              title="اختيار تطبيق الملاحة"
            >
              <ChevronDown className={size === "compact" ? "w-4 h-4" : "w-5 h-5"} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {Object.entries(navApps).map(([key, app]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => handleSelectApp(key as NavApp)}
                className="gap-3 cursor-pointer"
              >
                <span className="text-lg">{app.icon}</span>
                <span>{app.name}</span>
                {preferredApp === key && (
                  <span className="mr-auto text-xs text-primary">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export default NavigationButton;
