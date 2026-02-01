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
    <Card className="border-none shadow-md rounded-xl overflow-hidden sticky top-16 z-40">
      <CardContent className="p-0">
        <div
          className={`transition-all duration-300 ${
            isOnline
              ? "bg-gradient-to-r from-green-900/20 via-green-800/10 to-background"
              : "bg-gradient-to-r from-blue-900/20 via-blue-800/10 to-background"
          }`}
        >
          {/* Main Status Bar - Compact */}
          <div className="flex items-center justify-between px-3 py-2 gap-2">
            {/* Status Button (Left) - Smaller */}
            <button
              onClick={handleToggle}
              disabled={isDisabled}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-300 text-sm
                ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:scale-105"}
                ${
                  isOnline
                    ? "bg-green-500 text-white shadow-md shadow-green-500/30 hover:shadow-lg hover:shadow-green-500/40"
                    : "bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30"
                }
              `}
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isOnline ? (
                <Wifi className="w-3.5 h-3.5" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" />
              )}
              <span className="font-semibold whitespace-nowrap">
                {isOnline ? "متصل" : "غير متصل"}
              </span>
            </button>

            {/* Search Status Indicator (Middle - Flexible) */}
            <div className="flex-1 flex items-center justify-center">
              {isSearching && isOnline ? (
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`transition-all duration-300 ${
                        pulse ? "scale-100" : "scale-125"
                      }`}
                    >
                      <div className="relative w-6 h-6">
                        {/* Outer pulse */}
                        <div
                          className={`absolute inset-0 rounded-full bg-amber-500/20 ${
                            pulse ? "animate-pulse" : ""
                          }`}
                        />
                        {/* Inner dot */}
                        <div className="absolute inset-1 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50" />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-amber-400">
                      بحث...
                    </span>
                  </div>
              ) : isOnline && !locationTracking ? (
                <span className="text-xs text-yellow-400 font-medium flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  تفعيل الموقع...
                </span>
              ) : isOnline ? (
                <span className="text-xs text-green-400 font-medium flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  جاهز
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  فعّل للبدء
                </span>
              )}
            </div>

            {/* Search Icon (Right) - Small */}
            <div
              className={`transition-all duration-300 ${
                isSearching && isOnline
                  ? "text-amber-500 scale-100"
                  : "text-muted-foreground/50 scale-75"
              }`}
            >
              <Search className="w-4 h-4" />
            </div>
          </div>

          {/* Thin Border Bottom */}
          {isSearching && isOnline && (
            <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent animate-pulse" />
          )}
        </div>
      </CardContent>
    </Card>
  );
};
