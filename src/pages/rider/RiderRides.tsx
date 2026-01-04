import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User } from "@supabase/supabase-js";
import LiveRideTracker from "@/components/rider/LiveRideTracker";
import RideWaitingScreen from "@/components/rider/RideWaitingScreen";
import RatingDialog from "@/components/RatingDialog";
import { ScheduledRidesList } from "@/components/rider/ScheduledRidesList";
import { useRideNotifications } from "@/hooks/useRideNotifications";
import { StaticRideMap } from "@/components/StaticRideMap";
import {
  Car,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Navigation,
  Eye,
  Star,
  Ban,
  MapPin,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Ride {
  id: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  status: string;
  estimated_fare: number | null;
  final_fare: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  vehicle_type: string;
  created_at: string;
  completed_at: string | null;
  driver_id: string | null;
  driver_rating: number | null;
}

const RiderRides = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState<Ride[]>([]);
  const [trackingRide, setTrackingRide] = useState<Ride | null>(null);
  const [rideToRate, setRideToRate] = useState<Ride | null>(null);
  const [cancellingRideId, setCancellingRideId] = useState<string | null>(null);

  // Enable real-time ride notifications with sounds
  useRideNotifications(user?.id || null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await fetchRides(session.user.id);
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  // Subscribe to real-time ride updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('rider-rides')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: `rider_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Ride change:', payload);
          if (payload.eventType === 'INSERT') {
            const newRide = payload.new as any;
            setRides(prev => [{
              ...newRide,
              pickup_location: newRide.pickup_location,
              dropoff_location: newRide.dropoff_location
            }, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedRide = payload.new as any;
            setRides(prev => prev.map(r => 
              r.id === updatedRide.id ? {
                ...updatedRide,
                pickup_location: updatedRide.pickup_location,
                dropoff_location: updatedRide.dropoff_location
              } : r
            ));
            // Update tracking ride if active
            if (trackingRide?.id === updatedRide.id) {
              setTrackingRide({
                ...updatedRide,
                pickup_location: updatedRide.pickup_location,
                dropoff_location: updatedRide.dropoff_location
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, trackingRide?.id]);

  const fetchRides = async (userId: string) => {
    const { data, error } = await supabase
      .from("rides")
      .select("*")
      .eq("rider_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const mappedRides = data.map((r: any) => ({
        ...r,
        pickup_location: r.pickup_location as { lat: number; lng: number },
        dropoff_location: r.dropoff_location as { lat: number; lng: number }
      }));
      setRides(mappedRides);
      
      // Auto-open tracker for active rides
      const activeRide = data.find((r: any) => 
        ['pending', 'accepted', 'arrived', 'in_progress'].includes(r.status)
      );
      if (activeRide) {
        setTrackingRide({
          ...activeRide,
          pickup_location: activeRide.pickup_location as { lat: number; lng: number },
          dropoff_location: activeRide.dropoff_location as { lat: number; lng: number }
        });
      }

      // Check for completed rides without rating
      const unratedRide = data.find((r: any) => 
        r.status === 'completed' && 
        r.driver_rating === null && 
        r.driver_id
      );
      if (unratedRide) {
        setRideToRate({
          ...unratedRide,
          pickup_location: unratedRide.pickup_location as { lat: number; lng: number },
          dropoff_location: unratedRide.dropoff_location as { lat: number; lng: number }
        });
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'in_progress':
        return <Navigation className="w-4 h-4 text-primary animate-pulse" />;
      case 'accepted':
      case 'arrived':
        return <Car className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-amber-500 animate-pulse" />;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'قيد الانتظار',
      accepted: 'السائق في الطريق',
      arrived: 'السائق وصل',
      in_progress: 'جارية',
      completed: 'مكتملة',
      cancelled: 'ملغية'
    };
    return statusMap[status] || status;
  };

  const getVehicleTypeName = (type: string) => {
    const types: Record<string, string> = {
      economy: 'اقتصادي',
      comfort: 'مريح',
      premium: 'فاخر',
      women_only: 'نسائي'
    };
    return types[type] || type;
  };

  const isActiveRide = (status: string) => {
    return ['pending', 'accepted', 'arrived', 'in_progress'].includes(status);
  };

  const canCancelRide = (status: string) => {
    return ['pending', 'accepted'].includes(status);
  };

  const handleCancelRide = async (rideId: string) => {
    setCancellingRideId(rideId);
    try {
      const { error } = await supabase
        .from("rides")
        .update({
          status: 'cancelled',
          cancelled_by: 'rider',
          cancellation_reason: 'إلغاء من قبل الراكب'
        })
        .eq("id", rideId)
        .in("status", ['pending', 'accepted']);

      if (error) throw error;

      toast({
        title: "تم إلغاء الرحلة",
        description: "تم إلغاء طلبك بنجاح"
      });

      // Update local state
      setRides(prev => prev.map(r => 
        r.id === rideId ? { ...r, status: 'cancelled' } : r
      ));
    } catch (error: any) {
      console.error("Cancel error:", error);
      toast({
        title: "خطأ",
        description: "لا يمكن إلغاء هذه الرحلة",
        variant: "destructive"
      });
    } finally {
      setCancellingRideId(null);
    }
  };

  const filterRides = (tab: string) => {
    switch (tab) {
      case 'active':
        return rides.filter(r => isActiveRide(r.status));
      case 'completed':
        return rides.filter(r => r.status === 'completed');
      case 'cancelled':
        return rides.filter(r => r.status === 'cancelled');
      default:
        return rides;
    }
  };

  const activeRidesCount = rides.filter(r => isActiveRide(r.status)).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Show waiting screen for pending rides
  if (trackingRide && trackingRide.status === 'pending') {
    return (
      <RideWaitingScreen
        rideId={trackingRide.id}
        pickupAddress={trackingRide.pickup_address || 'موقع الانطلاق'}
        dropoffAddress={trackingRide.dropoff_address || 'الوجهة'}
        estimatedFare={trackingRide.estimated_fare || 0}
        onCancel={async () => {
          await handleCancelRide(trackingRide.id);
          setTrackingRide(null);
        }}
        onDriverFound={() => {
          // Refetch the ride to get driver info
          fetchRides(user!.id);
        }}
      />
    );
  }

  // Show live tracker for active rides (not pending)
  if (trackingRide) {
    return (
      <>
        <LiveRideTracker
          ride={trackingRide}
          onClose={() => setTrackingRide(null)}
          onRideUpdate={(updatedRide) => {
            const mappedRide: Ride = {
              ...updatedRide,
              driver_rating: updatedRide.driver_rating ?? null
            };
            if (updatedRide.status === 'completed') {
              // Let LiveRideTracker show the completed screen
              setTrackingRide(mappedRide);
            } else if (updatedRide.status === 'cancelled') {
              setTrackingRide(null);
            } else {
              setTrackingRide(mappedRide);
            }
          }}
        />
        {rideToRate && rideToRate.driver_id && (
          <RatingDialog
            isOpen={!!rideToRate}
            onClose={() => setRideToRate(null)}
            rideId={rideToRate.id}
            ratingType="driver"
            targetId={rideToRate.driver_id}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Rating Dialog */}
      {rideToRate && rideToRate.driver_id && (
        <RatingDialog
          isOpen={!!rideToRate}
          onClose={() => setRideToRate(null)}
          rideId={rideToRate.id}
          ratingType="driver"
          targetId={rideToRate.driver_id}
        />
      )}

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container flex items-center justify-between h-16">
          <Button variant="ghost" size="icon" onClick={() => navigate("/rider")}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg">رحلاتي</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Content */}
      <main className="pt-20 pb-8 px-4">
        <div className="container max-w-lg">
          <section aria-label="الرحلات المجدولة" className="mb-6">
            {user && <ScheduledRidesList />}
          </section>

          <Tabs defaultValue={activeRidesCount > 0 ? "active" : "all"} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="all">الكل</TabsTrigger>
              <TabsTrigger value="active" className="relative">
                نشطة
                {activeRidesCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center">
                    {activeRidesCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed">مكتملة</TabsTrigger>
              <TabsTrigger value="cancelled">ملغية</TabsTrigger>
            </TabsList>

            {['all', 'active', 'completed', 'cancelled'].map(tab => (
              <TabsContent key={tab} value={tab} className="space-y-4">
                {filterRides(tab).length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Car className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">لا توجد رحلات</p>
                    </CardContent>
                  </Card>
                ) : (
                  filterRides(tab).map(ride => (
                    <Card 
                      key={ride.id} 
                      className={`overflow-hidden transition-all ${
                        isActiveRide(ride.status) ? 'border-primary/50 shadow-glow' : ''
                      }`}
                    >
                      {/* Static Map for completed/cancelled rides - cheaper than interactive */}
                      {(ride.status === 'completed' || ride.status === 'cancelled') && (
                        <div className="relative">
                          <StaticRideMap
                            pickupLocation={ride.pickup_location}
                            dropoffLocation={ride.dropoff_location}
                            width={400}
                            height={120}
                            className="w-full"
                          />
                          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-background/90 backdrop-blur-sm rounded-full px-2 py-1">
                            {getStatusIcon(ride.status)}
                            <span className="text-xs font-medium">{getStatusText(ride.status)}</span>
                          </div>
                        </div>
                      )}
                      
                      <CardContent className="p-4">
                        {/* Header for active rides only (completed/cancelled have map header) */}
                        {isActiveRide(ride.status) && (
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(ride.status)}
                              <span className={`text-sm font-medium text-primary`}>
                                {getStatusText(ride.status)}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(ride.created_at).toLocaleDateString('ar-IQ')}
                            </span>
                          </div>
                        )}
                        
                        {/* Date and rating for non-active rides */}
                        {!isActiveRide(ride.status) && (
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-muted-foreground">
                              {new Date(ride.created_at).toLocaleDateString('ar-IQ', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {ride.driver_rating && (
                              <span className="flex items-center gap-1 text-xs text-warning">
                                <Star className="w-3 h-3 fill-warning" />
                                {ride.driver_rating}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="space-y-2 mb-3">
                          <div className="flex items-start gap-2">
                            <div className="w-3 h-3 mt-1 rounded-full bg-primary shrink-0" />
                            <p className="text-sm text-foreground line-clamp-1">
                              {ride.pickup_address || `${ride.pickup_location.lat.toFixed(4)}, ${ride.pickup_location.lng.toFixed(4)}`}
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="w-3 h-3 mt-1 rounded-full bg-destructive shrink-0" />
                            <p className="text-sm text-foreground line-clamp-1">
                              {ride.dropoff_address || `${ride.dropoff_location.lat.toFixed(4)}, ${ride.dropoff_location.lng.toFixed(4)}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-border">
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{getVehicleTypeName(ride.vehicle_type)}</span>
                            {ride.distance_km && <span>{ride.distance_km} كم</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-primary">
                              {(ride.final_fare || ride.estimated_fare || 0).toLocaleString()} د.ع
                            </span>
                            {isActiveRide(ride.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => setTrackingRide(ride)}
                              >
                                <Eye className="w-4 h-4 ml-1" />
                                تتبع
                              </Button>
                            )}
                            {/* Cancel button for pending/accepted rides */}
                            {canCancelRide(ride.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                onClick={() => handleCancelRide(ride.id)}
                                disabled={cancellingRideId === ride.id}
                              >
                                {cancellingRideId === ride.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Ban className="w-4 h-4 ml-1" />
                                    إلغاء
                                  </>
                                )}
                              </Button>
                            )}
                            {/* Rate button for unrated completed rides */}
                            {ride.status === 'completed' && !ride.driver_rating && ride.driver_id && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => setRideToRate(ride)}
                              >
                                <Star className="w-4 h-4 ml-1" />
                                قيّم
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default RiderRides;
