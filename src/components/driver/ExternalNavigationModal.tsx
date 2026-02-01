import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Map, Navigation } from "lucide-react";

interface ExternalNavigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number;
  lng: number;
  onInternalNavigation?: () => void;
  destinationLabel?: string;
}

type NavApp = "google" | "waze" | "apple";

const navApps: Record<
  NavApp,
  {
    name: string;
    icon: string;
    description: string;
    getUrl: (lat: number, lng: number) => string;
    available: boolean;
  }
> = {
  google: {
    name: "Google Maps",
    icon: "🗺️",
    description: "الملاحة الدقيقة والموثوقة",
    getUrl: (lat, lng) =>
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
    available: true,
  },
  waze: {
    name: "Waze",
    icon: "🚗",
    description: "التنقل الذكي مع تحديثات المرور",
    getUrl: (lat, lng) => `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
    available: true,
  },
  apple: {
    name: "Apple Maps",
    icon: "🍎",
    description: "الملاحة على أجهزة Apple",
    getUrl: (lat, lng) =>
      `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
    available: /iPad|iPhone|iPod/.test(navigator.userAgent),
  },
};

export const ExternalNavigationModal = ({
  isOpen,
  onClose,
  lat,
  lng,
  onInternalNavigation,
  destinationLabel = "وجهتك",
}: ExternalNavigationModalProps) => {
  const [selectedTab, setSelectedTab] = useState<"internal" | "external">(
    "internal"
  );

  const openExternalApp = (app: NavApp) => {
    const url = navApps[app].getUrl(lat, lng);
    window.open(url, "_blank");
    // Save preference
    localStorage.setItem("preferred_nav_app", app);
    onClose();
  };

  const handleInternalNav = () => {
    onInternalNavigation?.();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Navigation className="w-5 h-5 text-emerald-500" />
            خيارات الملاحة
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            اختر طريقة الملاحة المفضلة للوصول إلى {destinationLabel}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={selectedTab}
          onValueChange={(v) => setSelectedTab(v as "internal" | "external")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 bg-slate-800">
            <TabsTrigger value="internal" className="text-white">
              <Map className="w-4 h-4 mr-2" />
              الملاحة الداخلية
            </TabsTrigger>
            <TabsTrigger value="external" className="text-white">
              <Navigation className="w-4 h-4 mr-2" />
              الملاحة الخارجية
            </TabsTrigger>
          </TabsList>

          {/* Internal Navigation Tab */}
          <TabsContent value="internal" className="space-y-4 mt-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <p className="text-slate-300 text-sm mb-4">
                سيتم توسيع خريطة التطبيق الداخلية لعرض المسار الكامل مع التحديثات الفورية.
              </p>
              <Button
                onClick={handleInternalNav}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <Map className="w-4 h-4" />
                استخدم الملاحة الداخلية
              </Button>
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <p>✓ تتبع فوري للموقع</p>
              <p>✓ متكامل مع نظام التطبيق</p>
              <p>✓ بدون فتح تطبيق خارجي</p>
            </div>
          </TabsContent>

          {/* External Navigation Tab */}
          <TabsContent value="external" className="space-y-3">
            <p className="text-slate-400 text-sm mb-3">
              اختر التطبيق المفضل للملاحة:
            </p>
            <div className="space-y-2">
              {Object.entries(navApps).map(([key, app]) => {
                if (!app.available) return null;

                return (
                  <Button
                    key={key}
                    onClick={() => openExternalApp(key as NavApp)}
                    className="w-full justify-start bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 h-auto py-3"
                  >
                    <span className="text-2xl mr-3">{app.icon}</span>
                    <div className="text-right flex-1">
                      <p className="font-semibold text-sm">{app.name}</p>
                      <p className="text-xs text-slate-400">{app.description}</p>
                    </div>
                  </Button>
                );
              })}
            </div>
            <div className="text-xs text-slate-500 space-y-1 mt-4">
              <p>📌 سيتم فتح التطبيق المختار مباشرة</p>
              <p>📌 يمكنك العودة للتطبيق في أي وقت</p>
              <p>📌 تطبيقك المفضل سيكون مختار تلقائياً لاحقاً</p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="bg-slate-800">
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
