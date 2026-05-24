import React from "react";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { useMapContext } from "@/contexts/MapContext";

/**
 * MapProviderSelector - Now only supports Google Maps
 * Mapbox option removed as the app has migrated to Google Maps
 */
const MapProviderSelector: React.FC = () => {
  const { provider, isGoogleConfigured, isLoading } = useMapContext();

  return (
    <div className="flex items-center gap-3">
      <MapPin className="w-5 h-5 text-muted-foreground" />
      <div className="flex-1">
        <p className="font-medium">مزود الخريطة</p>
        <p className="text-xs text-muted-foreground">
          {isLoading ? "جارٍ التحقق..." : "Google Maps ✓"}
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="default"
          disabled
          title="Google Maps is the default provider"
        >
          Google Maps
        </Button>
      </div>
    </div>
  );
};

export default MapProviderSelector;
