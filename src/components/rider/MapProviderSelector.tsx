import React from "react";
import { Button } from "@/components/ui/button";
import useRiderStore from "@/stores/riderStore";
import { useMapProvider } from "@/hooks/useMapProvider";
import { MapPin } from "lucide-react";

const MapProviderSelector: React.FC = () => {
  const mapProvider = useRiderStore((s) => s.mapProvider);
  const setMapProvider = useRiderStore((s) => s.setMapProvider);
  const { provider, isGoogleConfigured, loading } = useMapProvider();

  const setProvider = (p: "mapbox" | "google") => {
    console.log("[MapProviderSelector] set provider:", p);
    setMapProvider(p);
  };

  return (
    <div className="flex items-center gap-3">
      <MapPin className="w-5 h-5 text-muted-foreground" />
      <div className="flex-1">
        <p className="font-medium">مزود الخريطة</p>
        <p className="text-xs text-muted-foreground">
          {loading ? "جارٍ التحقق..." : `الإعداد الحالي: ${provider}`}
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={mapProvider === "mapbox" ? "default" : "ghost"}
          onClick={() => setProvider("mapbox")}
        >
          Mapbox
        </Button>
        <Button
          size="sm"
          variant={mapProvider === "google" ? "default" : "ghost"}
          onClick={() => setProvider("google")}
          disabled={!isGoogleConfigured}
          title={isGoogleConfigured ? "" : "Google Maps not configured"}
        >
          Google
        </Button>
      </div>
    </div>
  );
};

export default MapProviderSelector;
