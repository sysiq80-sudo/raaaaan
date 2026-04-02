import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Map as MapIcon,
  Layers,
  ZoomIn,
  ZoomOut,
  Locate,
  Eye,
  EyeOff,
} from "lucide-react";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { landmarkCategories } from "@/pages/admin/AdminLandmarks";

interface LandmarkData {
  id: string;
  name_ar: string;
  name_en: string | null;
  category: string | null;
  location: { lat: number; lng: number };
  region_id: string | null;
  is_active: boolean;
  created_at: string;
  region?: { name_ar: string } | null;
}

interface LandmarksMapViewProps {
  landmarks: LandmarkData[];
  onLandmarkClick: (landmark: LandmarkData) => void;
}

export const LandmarksMapView = ({
  landmarks,
  onLandmarkClick,
}: LandmarksMapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [showInactive, setShowInactive] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { apiKey, isLoading: isApiKeyLoading } = useGoogleMapsApiKey();

  // Initialize Google Maps
  useEffect(() => {
    if (!mapContainer.current || isApiKeyLoading || !apiKey) return;
    if (map.current) return;

    const defaultCenter = { lat: 33.4235, lng: 43.3074 };
    const center = landmarks.length > 0
      ? {
          lat: landmarks.reduce((s, l) => s + l.location.lat, 0) / landmarks.length,
          lng: landmarks.reduce((s, l) => s + l.location.lng, 0) / landmarks.length,
        }
      : defaultCenter;

    loadGoogleMaps(apiKey).then(() => {
      if (!mapContainer.current) return;
      map.current = new google.maps.Map(mapContainer.current, {
        center,
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: false,
      });
      infoWindowRef.current = new google.maps.InfoWindow();
      setMapReady(true);
    });

    return () => {
      if (map.current) {
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];
        map.current = null;
        setMapReady(false);
      }
    };
  }, [apiKey, isApiKeyLoading]);

  // Color map by category
  const categoryColorMap: Record<string, string> = {
    hospital: "#ef4444", university: "#3b82f6", school: "#6366f1",
    mosque: "#10b981", market: "#f97316", government: "#a855f7",
    station: "#06b6d4", airport: "#0ea5e9", gas_station: "#eab308",
    restaurant: "#ec4899", hotel: "#8b5cf6", parking: "#64748b",
    landmark: "#f59e0b", residential: "#14b8a6", other: "#6b7280",
  };

  // Update markers when landmarks or filters change
  useEffect(() => {
    if (!mapReady || !map.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    // Filter landmarks
    const filteredLandmarks = landmarks.filter((landmark) => {
      if (!showInactive && !landmark.is_active) return false;
      if (selectedCategory && landmark.category !== selectedCategory) return false;
      return true;
    });

    // Add markers
    filteredLandmarks.forEach((landmark) => {
      const categoryConfig =
        landmarkCategories[landmark.category as keyof typeof landmarkCategories] || landmarkCategories.other;

      const color = categoryColorMap[landmark.category || "other"] || "#6b7280";

      const marker = new google.maps.Marker({
        position: { lat: landmark.location.lat, lng: landmark.location.lng },
        map: map.current!,
        title: landmark.name_ar,
        opacity: landmark.is_active ? 1 : 0.5,
        icon: {
          // Map pin SVG path
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 1,
          scale: 1.5,
          anchor: new google.maps.Point(12, 22),
        },
      });

      marker.addListener('click', () => {
        if (!infoWindowRef.current) return;
        infoWindowRef.current.setContent(`
          <div style="direction:rtl;text-align:right;padding:8px 4px;min-width:200px;font-family:sans-serif;">
            <h3 style="font-weight:600;font-size:14px;margin:0 0 4px;">${landmark.name_ar}</h3>
            ${landmark.name_en ? `<p style="color:#6b7280;font-size:12px;margin:0 0 8px;">${landmark.name_en}</p>` : ''}
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
              <span style="background:${color}20;color:${color};padding:2px 8px;border-radius:4px;font-size:11px;">${categoryConfig.label}</span>
              ${landmark.region ? `<span style="color:#6b7280;font-size:11px;">${landmark.region.name_ar}</span>` : ''}
            </div>
            <button id="edit-lm-${landmark.id}"
              style="width:100%;padding:8px;background:#22c55e;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;">
              ✏️ تعديل المعلم
            </button>
          </div>
        `);
        infoWindowRef.current.open(map.current!, marker);
        setTimeout(() => {
          document.getElementById(`edit-lm-${landmark.id}`)?.addEventListener('click', () => {
            infoWindowRef.current?.close();
            onLandmarkClick(landmark);
          });
        }, 100);
      });

      markersRef.current.push(marker);
    });
  }, [landmarks, mapReady, showInactive, selectedCategory, onLandmarkClick]);

  const handleZoomIn = () => { if (map.current) map.current.setZoom((map.current.getZoom() ?? 12) + 1); };
  const handleZoomOut = () => { if (map.current) map.current.setZoom((map.current.getZoom() ?? 12) - 1); };

  const handleFitBounds = () => {
    if (!map.current || landmarks.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    landmarks.forEach((l) => bounds.extend({ lat: l.location.lat, lng: l.location.lng }));
    map.current.fitBounds(bounds, 50);
  };

  const visibleCount = landmarks.filter((l) => {
    if (!showInactive && !l.is_active) return false;
    if (selectedCategory && l.category !== selectedCategory) return false;
    return true;
  }).length;

  // Get unique categories from landmarks
  const usedCategories = [
    ...new Set(landmarks.map((l) => l.category).filter(Boolean)),
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapIcon className="w-5 h-5 text-primary" />
            خريطة المعالم
            <Badge variant="secondary">{visibleCount} معلم</Badge>
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* Category Filter */}
            <div className="flex items-center gap-1 flex-wrap">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className="h-7 text-xs"
              >
                الكل
              </Button>
              {usedCategories.slice(0, 5).map((cat) => {
                const config =
                  landmarkCategories[cat as keyof typeof landmarkCategories] ||
                  landmarkCategories.other;
                if (!config) return null;
                const Icon = config.icon;
                return (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setSelectedCategory(cat === selectedCategory ? null : cat)
                    }
                    className="h-7 text-xs gap-1"
                  >
                    <Icon className="w-3 h-3" />
                    {config.label.split("/")[0]}
                  </Button>
                );
              })}
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Show/Hide inactive */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInactive(!showInactive)}
              className="h-7 gap-1"
            >
              {showInactive ? (
                <Eye className="w-3 h-3" />
              ) : (
                <EyeOff className="w-3 h-3" />
              )}
              {showInactive ? "إخفاء المعطلة" : "إظهار المعطلة"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 relative">
        <div ref={mapContainer} className="h-[500px] w-full" />

        {/* Map Controls */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={handleZoomIn}
            className="h-8 w-8 shadow-md"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleZoomOut}
            className="h-8 w-8 shadow-md"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleFitBounds}
            className="h-8 w-8 shadow-md"
          >
            <Locate className="w-4 h-4" />
          </Button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg max-w-[200px]">
          <div className="flex items-center gap-2 mb-2 text-xs font-medium">
            <Layers className="w-3 h-3" />
            دليل الألوان
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            {usedCategories.slice(0, 6).map((cat) => {
              const config =
                landmarkCategories[cat as keyof typeof landmarkCategories] ||
                landmarkCategories.other;
              if (!config) return null;
              const colorMap: Record<string, string> = {
                hospital: "#ef4444",
                university: "#3b82f6",
                school: "#6366f1",
                mosque: "#10b981",
                market: "#f97316",
                government: "#a855f7",
                station: "#06b6d4",
                airport: "#0ea5e9",
                gas_station: "#eab308",
                restaurant: "#ec4899",
                hotel: "#8b5cf6",
                parking: "#64748b",
                landmark: "#f59e0b",
                residential: "#14b8a6",
                other: "#6b7280",
              };
              return (
                <div key={cat} className="flex items-center gap-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colorMap[cat || "other"] }}
                  />
                  <span className="truncate">{config.label.split("/")[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
