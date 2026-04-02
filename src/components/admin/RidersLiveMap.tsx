import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, MapPin, RefreshCw, X } from "lucide-react";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";

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
  const map = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [riders, setRiders] = useState<RiderLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const { apiKey, isLoading: isApiKeyLoading } = useGoogleMapsApiKey();

  // Initialize Google Maps when dialog opens
  useEffect(() => {
    if (!open || !mapContainer.current || isApiKeyLoading || !apiKey) return;
    if (map.current) { setMapReady(true); return; }

    loadGoogleMaps(apiKey).then(() => {
      if (!mapContainer.current) return;
      map.current = new google.maps.Map(mapContainer.current, {
        center: { lat: 33.3152, lng: 43.6793 },
        zoom: 6,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
      });
      infoWindowRef.current = new google.maps.InfoWindow();
      setMapReady(true);
    }).catch(err => console.error('Google Maps load error:', err));
  }, [open, apiKey, isApiKeyLoading]);

  // Cleanup when dialog closes
  useEffect(() => {
    if (!open) {
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current.clear();
      if (infoWindowRef.current) infoWindowRef.current.close();
      map.current = null;
      setMapReady(false);
    }
  }, [open]);

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
  // (handled above with Google Maps init effect)

  // Update markers when riders data changes
  useEffect(() => {
    if (!mapReady || !map.current) return;

    // Remove stale markers
    markersRef.current.forEach((marker, id) => {
      if (!riders.find(r => r.id === id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });

    // Add/update markers
    riders.forEach((rider) => {
      const loc = rider.current_location;
      if (!loc) return;

      const isActive = rider.status !== 'suspended';
      let marker = markersRef.current.get(rider.id);

      if (marker) {
        marker.setPosition({ lat: loc.lat, lng: loc.lng });
      } else {
        marker = new google.maps.Marker({
          position: { lat: loc.lat, lng: loc.lng },
          map: map.current!,
          title: rider.full_name || 'راكب',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: isActive ? '#22c55e' : '#ef4444',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });

        marker.addListener('click', () => {
          if (!infoWindowRef.current) return;
          infoWindowRef.current.setContent(`
            <div dir="rtl" style="text-align:right;padding:6px;min-width:150px;font-family:sans-serif;">
              <p style="font-weight:700;margin:0 0 4px;font-size:13px;">${rider.full_name || 'بدون اسم'}</p>
              <p style="color:#6b7280;font-size:11px;margin:0 0 6px;">${rider.phone || '-'}</p>
              <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;${isActive ? 'background:#dcfce7;color:#15803d' : 'background:#fee2e2;color:#b91c1c'}">
                ${isActive ? 'نشط' : 'معطل'}
              </span>
            </div>
          `);
          infoWindowRef.current.open(map.current!, marker);
        });

        markersRef.current.set(rider.id, marker);
      }
    });

    // Fit bounds if we have riders
    if (riders.length > 0 && map.current) {
      const bounds = new google.maps.LatLngBounds();
      riders.forEach(r => {
        if (r.current_location) {
          bounds.extend({ lat: r.current_location.lat, lng: r.current_location.lng });
        }
      });
      map.current.fitBounds(bounds, 50);
    }
  }, [riders, mapReady]);

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
          <div ref={mapContainer} className="absolute inset-0" />
          {(isApiKeyLoading || !apiKey) && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
              <div className="text-center">
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">جاري تحميل الخريطة...</p>
              </div>
            </div>
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
