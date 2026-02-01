import { useState, useEffect } from "react";
import { Wifi, WifiOff, Search, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatusSearchBarProps {
  isOnline: boolean;
  isSearching: boolean;
  onToggleOnline: (online: boolean) => Promise<void>;
  isLoading: boolean;
  locationTracking: boolean;
  driverStatus?: string;
}

export const StatusSearchBar = ({
  isOnline,
  isSearching,
  onToggleOnline,
  isLoading,
  locationTracking,
  driverStatus = "approved",
}: StatusSearchBarProps) => {
  const [pulse, setPulse] = useState(false);

  // Pulse animation for search state
  useEffect(() => {
    if (!isSearching) {
      setPulse(false);
      return;
    }

    const interval = setInterval(() => {
      setPulse((prev) => !prev);
    }, 1000);

    return () => clearInterval(interval);
  }, [isSearching]);

  const isDisabled = isLoading || driverStatus !== "approved";

  const handleToggle = async () => {
    if (!isDisabled) {
      await onToggleOnline(!isOnline);
    }
  };

  return (
    <Card className="border-none shadow-lg rounded-2xl overflow-hidden sticky top-20 z-40">
      <CardContent className="p-0">
        <div
          className={`transition-all duration-300 ${
            isOnline
              ? "bg-gradient-to-r from-green-900/20 via-green-800/10 to-background"
              : "bg-gradient-to-r from-blue-900/20 via-blue-800/10 to-background"
          }`}
        >
          {/* Main Status Bar */}
          <div className="flex items-center justify-between p-4 gap-3">
            {/* Status Button (Left) */}
            <button
              onClick={handleToggle}
              disabled={isDisabled}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300
                ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:scale-105"}
                ${
                  isOnline
                    ? "bg-green-500 text-white shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40"
                    : "bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30"
                }
              `}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isOnline ? (
                <Wifi className="w-4 h-4" />
              ) : (
                <WifiOff className="w-4 h-4" />
              )}
              <span className="text-sm font-semibold whitespace-nowrap">
                {isOnline ? "متصل" : "غير متصل"}
              </span>
            </button>

            {/* Search Status Indicator (Middle - Flexible) */}
            <div className="flex-1 flex items-center justify-center">
              {isSearching && isOnline ? (
                <div className="flex items-center gap-2">
                  <div
                    className={`transition-all duration-300 ${
                      pulse ? "scale-100" : "scale-125"
                    }`}
                  >
                    <div className="relative w-8 h-8">
                      {/* Outer pulse */}
                      <div
                        className={`absolute inset-0 rounded-full bg-amber-500/20 ${
                          pulse ? "animate-pulse" : ""
                        }`}
                      />
                      {/* Inner dot */}
                      <div className="absolute inset-2 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50" />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-amber-400">
                    جاري البحث...
                  </span>
                </div>
              ) : isOnline && !locationTracking ? (
                <span className="text-xs text-yellow-400 font-medium flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  جاري تفعيل الموقع...
                </span>
              ) : isOnline ? (
                <span className="text-xs text-green-400 font-medium flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  جاهز لاستقبال الطلبات
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  فعّل الاتصال للبدء
                </span>
              )}
            </div>

            {/* Search Icon (Right) - Visual Indicator */}
            <div
              className={`transition-all duration-300 ${
                isSearching && isOnline
                  ? "text-amber-500 scale-100"
                  : "text-muted-foreground/50 scale-75"
              }`}
            >
              <Search className="w-5 h-5" />
            </div>
          </div>

          {/* Animated Border Bottom */}
          {isSearching && isOnline && (
            <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent animate-pulse" />
          )}
        </div>
      </CardContent>
    </Card>
  );
};
