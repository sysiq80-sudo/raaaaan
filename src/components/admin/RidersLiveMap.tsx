import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, MapPin, RefreshCw, X } from "lucide-react";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";

interface RiderLocation {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  current_location: { lat: number; lng: number } | null;
  status: string;
}

interface RidersLiveMapProps {
  open: boolean;
  onClose: () => void;
}

const RidersLiveMap = ({ open, onClose }: RidersLiveMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  
  const [riders, setRiders] = useState<RiderLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapboxToken, setMapboxToken] = useState<string>("");

  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const response = await fetch(
          'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token'
        );
        const data = await response.json();
        if (data.token) {
          setMapboxToken(data.token);
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
      }
    };
    fetchMapboxToken();
  }, []);

  const fetchRiders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, phone, current_location, status")
      .not("current_location", "is", null);

    if (!error && data) {
      const ridersWithLocation = data.filter(r => {
        const loc = r.current_location as any;
        return loc && typeof loc.lat === 'number' && typeof loc.lng === 'number';
      }) as RiderLocation[];
      setRiders(ridersWithLocation);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchRiders();
    }
  }, [open]);

  // Real-time subscription
  useEffect(() => {
    if (!open) return;

    const channel = supabase
      .channel('riders-location-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: 'current_location=neq.null'
        },
        (payload) => {
          const updated = payload.new as RiderLocation;
          setRiders(prev => {
            const existing = prev.find(r => r.id === updated.id);
            if (existing) {
              return prev.map(r => r.id === updated.id ? updated : r);
            }
            return [...prev, updated];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open]);

  // Initialize map
  useEffect(() => {
    if (!open || !mapContainer.current || !mapboxToken || map.current) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [43.6793, 33.3152], // Iraq center
      zoom: 6,
      language: "ar",
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-left");

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [open, mapboxToken]);

  // Update markers
  useEffect(() => {
    if (!map.current) return;

    // Remove old markers
    markersRef.current.forEach((marker, id) => {
      if (!riders.find(r => r.id === id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add/update markers
    riders.forEach((rider) => {
      const loc = rider.current_location;
      if (!loc) return;

      let marker = markersRef.current.get(rider.id);
      
      if (marker) {
        marker.setLngLat([loc.lng, loc.lat]);
      } else {
        const el = document.createElement("div");
        el.className = "rider-marker";
        el.innerHTML = `
          <div class="w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
            rider.status === 'suspended' ? 'bg-red-500' : 'bg-primary'
          }">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        `;

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div class="p-2 text-right" dir="rtl">
            <p class="font-bold">${rider.full_name || "بدون اسم"}</p>
            <p class="text-sm text-gray-600" dir="ltr">${rider.phone || "-"}</p>
            <span class="inline-block mt-1 px-2 py-0.5 text-xs rounded ${
              rider.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }">
              ${rider.status === 'suspended' ? 'معطل' : 'نشط'}
            </span>
          </div>
        `);

        marker = new mapboxgl.Marker(el)
          .setLngLat([loc.lng, loc.lat])
          .setPopup(popup)
          .addTo(map.current!);
        
        markersRef.current.set(rider.id, marker);
      }
    });

    // Fit bounds if we have riders
    if (riders.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      riders.forEach(r => {
        if (r.current_location) {
          bounds.extend([r.current_location.lng, r.current_location.lat]);
        }
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 12 });
    }
  }, [riders]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 md:inset-10 bg-background rounded-lg shadow-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg">خريطة الركاب الحية</h2>
              <p className="text-sm text-muted-foreground">
                {riders.length} راكب على الخريطة
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchRiders} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-1 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 relative">
          {!mapboxToken ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="text-center">
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  يرجى إضافة مفتاح Mapbox في الإعدادات لعرض الخريطة
                </p>
              </div>
            </div>
          ) : (
            <div ref={mapContainer} className="absolute inset-0" />
          )}
        </div>

        {/* Legend */}
        <div className="p-3 border-t bg-muted/50 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-primary"></div>
            <span className="text-sm">راكب نشط</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span className="text-sm">راكب معطل</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RidersLiveMap;
