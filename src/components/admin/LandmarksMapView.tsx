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
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const [mapToken, setMapToken] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showInactive, setShowInactive] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch(
          "https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token"
        );
        const data = await response.json();
        if (data.token) setMapToken(data.token);
      } catch (error) {
        console.error("Error fetching token:", error);
      }
    };
    fetchToken();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapToken) return;

    mapboxgl.accessToken = mapToken;

    // Calculate center from landmarks or default to Ramadi
    const defaultCenter: [number, number] = [43.3074, 33.4235];
    let center = defaultCenter;

    if (landmarks.length > 0) {
      const avgLat =
        landmarks.reduce((sum, l) => sum + l.location.lat, 0) /
        landmarks.length;
      const avgLng =
        landmarks.reduce((sum, l) => sum + l.location.lng, 0) /
        landmarks.length;
      center = [avgLng, avgLat];
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center,
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-left");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      // Google Maps doesn't have remove method
      map.current = null;
    };
  }, [mapToken]);

  // Update markers when landmarks or filters change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Filter landmarks
    const filteredLandmarks = landmarks.filter((landmark) => {
      if (!showInactive && !landmark.is_active) return false;
      if (selectedCategory && landmark.category !== selectedCategory)
        return false;
      return true;
    });

    // Add markers
    filteredLandmarks.forEach((landmark) => {
      const categoryConfig =
        landmarkCategories[
          landmark.category as keyof typeof landmarkCategories
        ] || landmarkCategories.other;

      // Create custom marker element
      const el = document.createElement("div");
      el.className = "landmark-marker";
      el.style.cssText = `
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        border: 2px solid white;
        ${!landmark.is_active ? "opacity: 0.5;" : ""}
      `;

      // Set background color based on category
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
      el.style.backgroundColor =
        colorMap[landmark.category || "other"] || "#6b7280";

      // Add icon
      el.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      `;

      el.onmouseenter = () => {
        el.style.transform = "scale(1.2)";
      };
      el.onmouseleave = () => {
        el.style.transform = "scale(1)";
      };

      el.onclick = (e) => {
        e.stopPropagation();

        // Close any existing popup
        popupRef.current?.remove();

        // Create popup
        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: true,
          closeOnClick: false,
          maxWidth: "280px",
        })
          .setLngLat([landmark.location.lng, landmark.location.lat])
          .setHTML(
            `
            <div style="direction: rtl; text-align: right; padding: 8px 0;">
              <h3 style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${
                landmark.name_ar
              }</h3>
              ${
                landmark.name_en
                  ? `<p style="color: #6b7280; font-size: 12px; margin-bottom: 8px;">${landmark.name_en}</p>`
                  : ""
              }
              <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
                <span style="background: ${
                  colorMap[landmark.category || "other"]
                }20; color: ${
              colorMap[landmark.category || "other"]
            }; padding: 2px 8px; border-radius: 4px; font-size: 11px;">
                  ${categoryConfig.label}
                </span>
                ${
                  landmark.region
                    ? `<span style="color: #6b7280; font-size: 11px;">${landmark.region.name_ar}</span>`
                    : ""
                }
              </div>
              <button 
                id="edit-landmark-${landmark.id}" 
                style="width: 100%; padding: 8px; background: #22c55e; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;"
              >
                ✏️ تعديل المعلم
              </button>
            </div>
          `
          )
          .addTo(map.current!);

        popupRef.current = popup;

        // Add click handler for edit button
        setTimeout(() => {
          const editBtn = document.getElementById(
            `edit-landmark-${landmark.id}`
          );
          if (editBtn) {
            editBtn.onclick = () => {
              popup.remove();
              onLandmarkClick(landmark);
            };
          }
        }, 100);
      };

      const marker = new mapboxgl.Marker(el)
        .setLngLat([landmark.location.lng, landmark.location.lat])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [landmarks, mapLoaded, showInactive, selectedCategory, onLandmarkClick]);

  const handleZoomIn = () => map.current?.zoomIn();
  const handleZoomOut = () => map.current?.zoomOut();

  const handleFitBounds = () => {
    if (!map.current || landmarks.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    landmarks.forEach((l) => bounds.extend([l.location.lng, l.location.lat]));
    map.current.fitBounds(bounds, { padding: 50 });
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
