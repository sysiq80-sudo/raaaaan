import { useEffect, useRef, useState, useMemo } from "react";
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
  // ✅ FIX: استخدام Marker العادي بدلاً من AdvancedMarkerElement
  // AdvancedMarkerElement تحتاج mapId حقيقي من Google Cloud Console
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const driverMarkers = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rideMarkers = useRef<Map<string, any>>(new Map());
  
  const { apiKey: googleMapsApiKey } = useGoogleMapsApiKey();
  const [isLoading, setIsLoading] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [activeRides, setActiveRides] = useState<ActiveRide[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>("all");

  // useMemo لتثبيت reference وتجنب تحذير missing dependency
  const ramadiCenter = useMemo(() => ({ lat: 33.4233, lng: 43.2974 }), []);

  // Fetch regions
  useEffect(() => {
    if (!isAdmin) return;
    const fetchRegions = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const regionsTable = supabase.from('regions') as any;
      const { data } = await regionsTable
        .select('id, name_ar, name_en')
        .eq('is_active', true);
      if (data) setRegions(data as Region[]);
    };
    fetchRegions();
  }, [isAdmin]);

  // Fetch drivers and rides
  const fetchData = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const driversTable = supabase.from('drivers') as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ridesTable = supabase.from('rides') as any;

      const [driversResult, ridesResult] = await Promise.all([
        driversTable
          .select('id, full_name, phone, vehicle_type, vehicle_plate, is_online, is_available, current_location, working_region_id')
          .eq('status', 'approved'),
        ridesTable
          .select('id, status, pickup_location, dropoff_location, pickup_address, dropoff_address, driver_id, region_id, vehicle_type, created_at')
          .in('status', ['pending', 'accepted', 'arrived', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(500)
      ]);

      if (driversResult.data) {
        const parsedDrivers = (driversResult.data as unknown[]).map((d: unknown) => {
          const driver = d as Record<string, unknown>;
          return {
            id: driver.id as string,
            full_name: driver.full_name as string,
            phone: driver.phone as string,
            vehicle_type: driver.vehicle_type as string | null,
            vehicle_plate: driver.vehicle_plate as string | null,
            is_online: driver.is_online as boolean | null,
            is_available: driver.is_available as boolean | null,
            current_location: driver.current_location as { lat: number; lng: number } | null,
            working_region_id: driver.working_region_id as string | null,
          } as Driver;
        });
        setDrivers(parsedDrivers);
      }
      
      if (ridesResult.data) {
        const parsedRides = (ridesResult.data as unknown[]).map((r: unknown) => {
          const ride = r as Record<string, unknown>;
          return {
            id: ride.id as string,
            status: ride.status as string | null,
            pickup_location: ride.pickup_location as { lat: number; lng: number },
            dropoff_location: ride.dropoff_location as { lat: number; lng: number },
            pickup_address: ride.pickup_address as string | null,
            dropoff_address: ride.dropoff_address as string | null,
            driver_id: ride.driver_id as string | null,
            region_id: ride.region_id as string | null,
            vehicle_type: ride.vehicle_type as string | null,
            created_at: ride.created_at as string,
          } as ActiveRide;
        });
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

    // ✅ FIX: لا يمكن استخدام styles و mapId معاً — نختار أحدهما
    // mapId يتحكم بالستايل من Cloud Console — نستخدم styles بدون mapId
    map.current = new google.maps.Map(mapContainer.current, {
      center: ramadiCenter,
      zoom: 11,
      tilt: 30,
      styles: darkStyle, // ✅ يعمل بدون mapId
      // mapId مُعطَّل: AdvancedMarkerElement تحتاج mapId من Cloud Console الحقيقي
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

      if (existingMarker) {
        existingMarker.setPosition(new google.maps.LatLng(location.lat, location.lng));
      } else {
        // ✅ FIX: استخدام google.maps.Marker العادي بدلاً من AdvancedMarkerElement
        // AdvancedMarkerElement تتطلب mapId حقيقي من Google Cloud Console + مكتبة marker
        const marker = new google.maps.Marker({
          map: map.current!,
          position: new google.maps.LatLng(location.lat, location.lng),
          title: driver.full_name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: bgColor,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });

        marker.addListener('click', () => setSelectedDriver(driver));
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

      // ✅ FIX: استخدام Marker العادي بدلاً من AdvancedMarkerElement
      const marker = new google.maps.Marker({
        map: map.current!,
        position: new google.maps.LatLng(ride.pickup_location.lat, ride.pickup_location.lng),
        title: ride.pickup_address || 'طلب معلق',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#ef4444',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        animation: google.maps.Animation.BOUNCE,
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
