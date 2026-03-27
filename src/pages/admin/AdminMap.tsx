import { useEffect, useRef, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { 
  Car, 
  Users, 
  MapPin, 
  RefreshCw,
  Navigation,
  Circle,
  Clock,
  Filter
} from "lucide-react";

interface Region {
  id: string;
  name_ar: string;
  name_en: string | null;
}

interface Driver {
  id: string;
  full_name: string;
  phone: string;
  vehicle_type: string | null;
  vehicle_plate: string | null;
  is_online: boolean | null;
  is_available: boolean | null;
  current_location: { lat: number; lng: number } | null;
  working_region_id: string | null;
}

interface ActiveRide {
  id: string;
  status: string | null;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  pickup_address: string | null;
  dropoff_address: string | null;
  driver_id: string | null;
  region_id: string | null;
  vehicle_type: string | null;
  created_at: string;
}

const AdminMap = () => {
  const { loading: authLoading, isAdmin } = useAdminAuth();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const driverMarkers = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const rideMarkers = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  
  const { apiKey: googleMapsApiKey } = useGoogleMapsApiKey();
  const [isLoading, setIsLoading] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [activeRides, setActiveRides] = useState<ActiveRide[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>("all");

  // Ramadi center (Anbar)
  const ramadiCenter = { lat: 33.4233, lng: 43.2974 };

  // Fetch regions
  useEffect(() => {
    if (!isAdmin) return;
    const fetchRegions = async () => {
      const { data } = await supabase
        .from('regions')
        .select('id, name_ar, name_en')
        .eq('is_active', true);
      if (data) setRegions(data);
    };
    fetchRegions();
  }, [isAdmin]);

  // Fetch drivers and rides
  const fetchData = async () => {
    try {
      const [driversResult, ridesResult] = await Promise.all([
        supabase
          .from('drivers')
          .select('id, full_name, phone, vehicle_type, vehicle_plate, is_online, is_available, current_location, working_region_id')
          .eq('status', 'approved'),
        supabase
          .from('rides')
          .select('id, status, pickup_location, dropoff_location, pickup_address, dropoff_address, driver_id, region_id, vehicle_type, created_at')
          .in('status', ['pending', 'accepted', 'arrived', 'in_progress'])
          .order('created_at', { ascending: false })
      ]);

      if (driversResult.data) {
        const parsedDrivers = driversResult.data.map(d => ({
          ...d,
          current_location: d.current_location as { lat: number; lng: number } | null
        }));
        setDrivers(parsedDrivers);
      }
      
      if (ridesResult.data) {
        const parsedRides = ridesResult.data.map(r => ({
          ...r,
          pickup_location: r.pickup_location as { lat: number; lng: number },
          dropoff_location: r.dropoff_location as { lat: number; lng: number }
        }));
        setActiveRides(parsedRides);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();
    
    // Set up realtime subscription for driver locations
    const driversChannel = supabase
      .channel('drivers-location')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'drivers' },
        (payload) => {
          const updatedDriver = payload.new as Driver;
          setDrivers(prev => 
            prev.map(d => d.id === updatedDriver.id ? {
              ...d,
              ...updatedDriver,
              current_location: updatedDriver.current_location as { lat: number; lng: number } | null
            } : d)
          );
        }
      )
      .subscribe();

    // Set up realtime subscription for rides
    const ridesChannel = supabase
      .channel('rides-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides' },
        () => {
          fetchData(); // Refresh all data on ride changes
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(driversChannel);
      supabase.removeChannel(ridesChannel);
    };
  }, [isAdmin]);

  // Load Google Maps script
  useEffect(() => {
    if (!googleMapsApiKey || !isAdmin) return;
    if (window.google?.maps) return;
    
    loadGoogleMaps(googleMapsApiKey).then(() => {
      // Trigger map initialization
      setIsLoading(prev => prev); // force re-render
    }).catch(err => console.error("AdminMap: load error", err));
  }, [googleMapsApiKey, isAdmin]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !window.google?.maps) return;
    if (map.current) return;

    const darkStyle = [
      { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#255763" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
      { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283d6a" }] },
    ];

    map.current = new google.maps.Map(mapContainer.current, {
      center: ramadiCenter,
      zoom: 11,
      tilt: 30,
      styles: darkStyle,
      mapId: 'admin-live-map',
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    map.current.addListener('tilesloaded', () => {
      setIsLoading(false);
    });

    return () => {
      map.current = null;
    };
  }, [googleMapsApiKey, isLoading]);

  // Filter data based on selected region
  const filteredDrivers = selectedRegion === "all" 
    ? drivers 
    : drivers.filter(d => d.working_region_id === selectedRegion);
  
  const filteredRides = selectedRegion === "all"
    ? activeRides
    : activeRides.filter(r => r.region_id === selectedRegion);

  const pendingRides = filteredRides.filter(r => r.status === 'pending');

  // Update driver markers on map
  useEffect(() => {
    if (!map.current || isLoading) return;

    const displayDrivers = selectedRegion === "all" 
      ? drivers 
      : drivers.filter(d => d.working_region_id === selectedRegion);

    // Remove old markers
    driverMarkers.current.forEach((marker, id) => {
      if (!displayDrivers.find(d => d.id === id)) {
        marker.map = null;
        driverMarkers.current.delete(id);
      }
    });

    // Add/update driver markers
    displayDrivers.forEach(driver => {
      const location = driver.current_location || { lat: 33.4233, lng: 43.2974 };
      const existingMarker = driverMarkers.current.get(driver.id);
      
      const hasLocation = !!driver.current_location;
      const bgColor = !hasLocation ? '#94a3b8' : (driver.is_online ? (driver.is_available ? '#00d9a5' : '#f59e0b') : '#6b7280');
      const glowColor = !hasLocation ? 'rgba(148, 163, 184, 0.3)' : (driver.is_online ? (driver.is_available ? 'rgba(0, 217, 165, 0.5)' : 'rgba(245, 158, 11, 0.5)') : 'rgba(107, 114, 128, 0.3)');
      
      if (existingMarker) {
        existingMarker.position = new google.maps.LatLng(location.lat, location.lng);
        const el = existingMarker.content as HTMLElement;
        const innerDiv = el?.querySelector('.driver-inner') as HTMLElement;
        if (innerDiv) {
          innerDiv.style.background = bgColor;
          innerDiv.style.boxShadow = `0 0 15px ${glowColor}`;
        }
      } else {
        const el = document.createElement('div');
        el.className = 'driver-marker';
        el.innerHTML = `
          <div class="relative cursor-pointer" style="transform: translate(-50%, -50%);">
            <div class="driver-inner" style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${bgColor};box-shadow:0 0 15px ${glowColor};transition:transform 0.2s;">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
                <circle cx="7" cy="17" r="2"/>
                <path d="M9 17h6"/>
                <circle cx="17" cy="17" r="2"/>
              </svg>
            </div>
            ${!hasLocation ? '<div style="position:absolute;top:-4px;right:-4px;width:12px;height:12px;border-radius:50%;border:2px solid #1a1a2e;background:#94a3b8;animation:pulse 2s infinite;"></div>' : ''}
            ${hasLocation && driver.is_online ? `<div style="position:absolute;top:-4px;right:-4px;width:12px;height:12px;border-radius:50%;border:2px solid #1a1a2e;background:${driver.is_available ? '#22c55e' : '#f59e0b'};"></div>` : ''}
          </div>
        `;

        el.addEventListener('click', () => setSelectedDriver(driver));

        const marker = new google.maps.marker.AdvancedMarkerElement({
          map: map.current!,
          position: new google.maps.LatLng(location.lat, location.lng),
          content: el,
        });

        driverMarkers.current.set(driver.id, marker);
      }
    });
  }, [drivers, isLoading, selectedRegion]);

  // Update pending ride markers on map
  useEffect(() => {
    if (!map.current || isLoading) return;

    const displayRides = selectedRegion === "all"
      ? activeRides.filter(r => r.status === 'pending')
      : activeRides.filter(r => r.status === 'pending' && r.region_id === selectedRegion);

    // Remove old ride markers
    rideMarkers.current.forEach((marker, id) => {
      if (!displayRides.find(r => r.id === id)) {
        marker.map = null;
        rideMarkers.current.delete(id);
      }
    });

    // Add pending ride markers
    displayRides.forEach(ride => {
      if (rideMarkers.current.has(ride.id)) return;

      const el = document.createElement('div');
      el.className = 'ride-marker';
      el.innerHTML = `
        <div class="relative cursor-pointer" style="animation:pulse 2s infinite;transform:translate(-50%,-100%);">
          <div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#ef4444;box-shadow:0 0 20px rgba(239,68,68,0.6);">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div style="position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:4px solid #ef4444;"></div>
        </div>
      `;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: map.current!,
        position: new google.maps.LatLng(ride.pickup_location.lat, ride.pickup_location.lng),
        content: el,
      });

      rideMarkers.current.set(ride.id, marker);
    });
  }, [activeRides, isLoading, selectedRegion]);

  const focusOnDriver = (driver: Driver) => {
    if (driver.current_location && map.current) {
      map.current.panTo({ lat: driver.current_location.lat, lng: driver.current_location.lng });
      map.current.setZoom(16);
      setSelectedDriver(driver);
    }
  };

  const onlineDrivers = filteredDrivers.filter(d => d.is_online);
  const availableDrivers = filteredDrivers.filter(d => d.is_online && d.is_available);

  const getVehicleTypeLabel = (type: string | null) => {
    const labels: Record<string, string> = {
      'economy': 'اقتصادي',
      'comfort': 'مريح',
      'premium': 'فاخر',
      'women_only': 'نسائي'
    };
    return type ? labels[type] || type : 'غير محدد';
  };

  const getStatusLabel = (status: string | null) => {
    const labels: Record<string, string> = {
      'pending': 'بانتظار السائق',
      'accepted': 'تم القبول',
      'arrived': 'وصل السائق',
      'in_progress': 'جارية'
    };
    return status ? labels[status] || status : '';
  };

  const getTimeSince = (date: string) => {
    const now = new Date();
    const created = new Date(date);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `${diffMins} د`;
    return `${Math.floor(diffMins / 60)} س`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <AdminLayout 
      title="الخريطة الحية" 
      subtitle="تتبع السائقين والرحلات في الوقت الفعلي"
      actions={
        <div className="flex items-center gap-3">
          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 ml-2" />
              <SelectValue placeholder="فلترة المنطقة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المناطق</SelectItem>
              {regions.map(region => (
                <SelectItem key={region.id} value={region.id}>
                  {region.name_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 ml-2" />
            تحديث
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map Section */}
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <div className="relative h-[600px]">
              <div ref={mapContainer} className="absolute inset-0" />
              
              {isLoading && (
                <div className="absolute inset-0 bg-card flex items-center justify-center">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground">جاري تحميل الخريطة...</p>
                  </div>
                </div>
              )}

              {/* Stats overlay */}
              <div className="absolute top-4 right-4 flex gap-2 z-10">
                <div className="bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-border/50">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-sm font-medium">{onlineDrivers.length} متصل</span>
                  </div>
                </div>
                <div className="bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-border/50">
                  <div className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                    <span className="text-sm font-medium">{availableDrivers.length} متاح</span>
                  </div>
                </div>
                <div className="bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-border/50">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-3 h-3 text-warning" />
                    <span className="text-sm font-medium">{filteredRides.length} رحلة</span>
                  </div>
                </div>
                {pendingRides.length > 0 && (
                  <div className="bg-destructive/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-destructive animate-pulse">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      <span className="text-sm font-medium text-destructive-foreground">{pendingRides.length} طلب معلق</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="absolute bottom-4 right-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 border border-border/50 z-10">
                <p className="text-xs text-muted-foreground mb-2">دليل الألوان</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span>متاح</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full bg-warning" />
                    <span>مشغول</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                    <span>غير متصل</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full bg-slate-400" />
                    <span>بدون موقع</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                    <span>طلب معلق</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Selected Driver Info */}
          {selectedDriver && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Car className="w-5 h-5" />
                  معلومات السائق
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium">{selectedDriver.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedDriver.phone}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant={selectedDriver.is_online ? "default" : "secondary"}>
                    {selectedDriver.is_online ? 'متصل' : 'غير متصل'}
                  </Badge>
                  {selectedDriver.is_online && (
                    <Badge variant={selectedDriver.is_available ? "default" : "outline"}>
                      {selectedDriver.is_available ? 'متاح' : 'مشغول'}
                    </Badge>
                  )}
                </div>
                <div className="text-sm">
                  <p><span className="text-muted-foreground">نوع السيارة:</span> {getVehicleTypeLabel(selectedDriver.vehicle_type)}</p>
                  <p><span className="text-muted-foreground">رقم اللوحة:</span> {selectedDriver.vehicle_plate || 'غير محدد'}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setSelectedDriver(null)}
                >
                  إغلاق
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Online Drivers List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                السائقون المتصلون ({onlineDrivers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {onlineDrivers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  لا يوجد سائقون متصلون حالياً
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {onlineDrivers.map(driver => (
                    <div 
                      key={driver.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => focusOnDriver(driver)}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${driver.is_available ? 'bg-green-500' : 'bg-warning'}`} />
                        <div>
                          <p className="text-sm font-medium">{driver.full_name}</p>
                          <p className="text-xs text-muted-foreground">{getVehicleTypeLabel(driver.vehicle_type)}</p>
                        </div>
                      </div>
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Rides */}
          <Card className={pendingRides.length > 0 ? "border-destructive/50" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-destructive" />
                الطلبات المعلقة ({pendingRides.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingRides.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  لا توجد طلبات معلقة
                </p>
              ) : (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {pendingRides.map(ride => (
                    <div 
                      key={ride.id}
                      className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 space-y-2 cursor-pointer hover:bg-destructive/20 transition-colors"
                      onClick={() => {
                        map.current?.panTo({ lat: ride.pickup_location.lat, lng: ride.pickup_location.lng });
                        map.current?.setZoom(15);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="destructive" className="text-xs">
                          منتظر منذ {getTimeSince(ride.created_at)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {getVehicleTypeLabel(ride.vehicle_type)}
                        </Badge>
                      </div>
                      <p className="text-xs truncate">
                        <MapPin className="w-3 h-3 inline ml-1 text-destructive" />
                        {ride.pickup_address || 'غير محدد'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Rides */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                الرحلات الجارية ({filteredRides.filter(r => r.status !== 'pending').length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredRides.filter(r => r.status !== 'pending').length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  لا توجد رحلات جارية
                </p>
              ) : (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {filteredRides.filter(r => r.status !== 'pending').map(ride => (
                    <div 
                      key={ride.id}
                      className="p-2 rounded-lg border border-border/50 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {getStatusLabel(ride.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        من: {ride.pickup_address || 'غير محدد'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        إلى: {ride.dropoff_address || 'غير محدد'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminMap;
