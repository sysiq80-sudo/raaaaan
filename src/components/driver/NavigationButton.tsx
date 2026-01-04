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
  className 
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
    // On iOS, prefer Apple Maps by default if no preference set
    const app = isIOS && !localStorage.getItem('preferred_nav_app') ? 'apple' : preferredApp;
    openNavigation(app);
  };

  const handleSelectApp = (app: NavApp) => {
    setPreferredApp(app);
    localStorage.setItem('preferred_nav_app', app);
    openNavigation(app);
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      {/* Main navigation button - Prominent green */}
      <Button 
        className="flex-1 h-14 text-lg gap-3 bg-green-600 hover:bg-green-700 text-white shadow-lg"
        onClick={handleQuickNav}
      >
        <Navigation className="w-6 h-6" />
        {label}
      </Button>

      {/* Dropdown for app selection */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-14 w-14 border-2 border-green-600 text-green-600 hover:bg-green-50">
            <ChevronDown className="w-5 h-5" />
          </Button>
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
    </div>
  );
};

export default NavigationButton;
