import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import Map from "@/components/Map";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Navigation,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  User,
  Car,
  Loader2,
  AlertCircle,
  Share2,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  Star,
  X,
  Send,
  Search,
  UserCheck,
  CheckCircle2,
  MapPinned,
  Route,
  Bell,
  Timer,
  HelpCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { motion, useDragControls, AnimatePresence } from "framer-motion";
import { getDriverDocumentUrl } from "@/utils/driverDocumentUrl";

interface LiveRideTrackerProps {
  rideId: string;
  userType: "rider" | "driver";
  onRideComplete?: () => void;
  onBack?: () => void;
}

interface RideData {
  id: string;
  status: string;
  driver_id: string | null;
  rider_id: string;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  pickup_address: string | null;
  dropoff_address: string | null;
  estimated_fare: number | null;
  distance_km: number | null;
  started_at: string | null;
  driver?: {
    id: string;
    full_name: string;
    phone: string;
    profile_image_url: string | null;
    vehicle_model: string | null;
    vehicle_color: string | null;
    vehicle_plate: string | null;
    rating: number;
    current_location: { lat: number; lng: number } | null;
  };
  rider?: {
    id: string;
    full_name: string;
    profile_image_url: string | null;
  };
}

export const LiveRideTracker = ({
  rideId,
  userType,
  onRideComplete,
  onBack,
}: LiveRideTrackerProps) => {
  const { toast } = useToast();
  const [ride, setRide] = useState<RideData | null>(null);
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const channelRef = useRef<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(true);
  const [showArrivedAlert, setShowArrivedAlert] = useState(false);
  const dragControls = useDragControls();

  // Quick response messages when driver arrives
  const arrivedResponses = [
    { icon: "🚶", text: "أنا قادم", action: "coming" },
    { icon: "⏱️", text: "انتظرني دقيقة", action: "wait" },
    { icon: "📍", text: "أين موقعك؟", action: "where" },
  ];

  const quickMessages = [
    "👋 أنا في الانتظار",
    "📍 أين وصلت؟",
    "👍 شكراً لك",
    "⚠️ أنا متأخر قليلاً",
  ];

  // Status configuration
  const statusConfig = {
    pending: {
      icon: Search,
      label: "جاري البحث",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      dotColor: "bg-amber-500",
      description: "نبحث عن سائق قريب منك...",
    },
    searching: {
      icon: Search,
      label: "بانتظار سائق",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      dotColor: "bg-orange-500",
      description: "جاري إرسال الطلب للسائقين...",
    },
    accepted: {
      icon: UserCheck,
      label: "السائق قَبِل",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      dotColor: "bg-blue-500",
      description: "السائق في الطريق إليك",
    },
    arrived: {
      icon: MapPinned,
      label: "السائق وصل",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      dotColor: "bg-green-500",
      description: "السائق في موقع الانطلاق",
    },
    in_progress: {
      icon: Route,
      label: "جاري التوصيل",
      color: "text-primary",
      bgColor: "bg-primary/10",
      dotColor: "bg-primary",
      description: "أنت في رحلتك الآن",
    },
    completed: {
      icon: CheckCircle2,
      label: "تم الوصول",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      dotColor: "bg-emerald-500",
      description: "وصلت بسلامة!",
    },
  };

  const allSteps = [
    "pending",
    "accepted",
    "arrived",
    "in_progress",
    "completed",
  ];

  // Fetch ride data
  useEffect(() => {
    fetchRideData();
  }, [rideId]);

  // Subscribe to live updates
  useEffect(() => {
    if (!ride) return;

    const driverId = ride.driver_id;
    if (!driverId) return;

    console.log("🔴 Subscribing to updates for ride:", rideId);

    const rideChannel = supabase
      .channel(`live-ride-${rideId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rides",
          filter: `id=eq.${rideId}`,
        },
        (payload) => {
          const newStatus = payload.new.status as string;
          console.log("🚗 Ride status updated:", newStatus);
          setRide((prev) => (prev ? { ...prev, status: newStatus } : null));

          if (newStatus === "arrived" && ride.status !== "arrived") {
            setShowArrivedAlert(true);
            toast({
              title: "السائق وصل! 🎯",
              description: "السائق في موقع الانطلاق بانتظارك",
            });
            vibrateAndSound("arrived");
          } else if (
            newStatus === "in_progress" &&
            ride.status !== "in_progress"
          ) {
            toast({
              title: "الرحلة بدأت! 🚀",
              description: "نتمنى لك رحلة آمنة وممتعة",
            });
          } else if (newStatus === "completed") {
            toast({
              title: "وصلت بالسلامة! ✅",
              description: "تم إكمال الرحلة بنجاح. شكراً لاختيارك ران.",
            });
            if (onRideComplete) onRideComplete();
          }
        },
      )
      // Note: drivers table removed from Realtime publication — no postgres_changes subscription
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    channelRef.current = rideChannel;

    return () => {
      console.log("🔴 Unsubscribing from ride updates");
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [ride?.id, ride?.driver_id]);

  const fetchRideData = async () => {
    try {
      const { data, error } = await supabase
        .from("rides")
        .select(
          `
          *,
          driver:drivers(
            id,
            full_name,
            phone,
            profile_image_url,
            vehicle_model,
            vehicle_color,
            vehicle_plate,
            rating,
            current_location
          ),
          rider:riders(
            id,
            full_name,
            profile_image_url
          )
        `,
        )
        .eq("id", rideId)
        .single();

      if (error) throw error;

      setRide(data as unknown as RideData);

      // تحويل مسار صورة السائق إلى signed URL (bucket خاص)
      if (data.driver?.profile_image_url) {
        getDriverDocumentUrl(data.driver.profile_image_url, 7200).then(url => {
          if (url) {
            setRide(prev => prev && prev.driver ? {
              ...prev,
              driver: { ...prev.driver, profile_image_url: url }
            } : prev);
          }
        });
      }

      if (data.driver?.current_location) {
        const location = data.driver.current_location as {
          lat: number;
          lng: number;
        };
        setDriverLocation(location);
        calculateETA(location);
      }
    } catch (error) {
      console.error("Error fetching ride:", error);
      toast({
        title: "خطأ",
        description: "فشل تحميل بيانات الرحلة",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateETA = async (driverLoc: { lat: number; lng: number }) => {
    if (!ride) return;
    const destination =
      ride.status === "accepted" || ride.status === "arrived"
        ? ride.pickup_location
        : ride.dropoff_location;
    if (!destination) return;

    try {
      // Use Google Directions API
      const directionsService = new google.maps.DirectionsService();
      const result = await directionsService.route({
        origin: new google.maps.LatLng(driverLoc.lat, driverLoc.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        travelMode: google.maps.TravelMode.DRIVING,
      });

      if (result.routes?.[0]) {
        const route = result.routes[0];
        // Access distance and duration from legs array
        const leg = route.legs?.[0];
        if (leg) {
          const distanceValue = leg.distance?.value || 0;
          const durationValue = leg.duration?.value || 0;
          setDistance(parseFloat((distanceValue / 1000).toFixed(1)));
          setEta(Math.round(durationValue / 60));
        }
      }
    } catch (error) {
      console.error("Error calculating ETA:", error);
    }
  };

  const vibrateAndSound = (type: "arrived" | "message") => {
    // Vibrate if supported
    if (navigator.vibrate) {
      navigator.vibrate(type === "arrived" ? [200, 100, 200] : [100]);
    }
  };

  const handleArrivedResponse = async (action: string) => {
    const messages: Record<string, string> = {
      coming: "🚶 أنا قادم الآن",
      wait: "⏱️ انتظرني دقيقة واحدة",
      where: "📍 أين موقعك بالضبط؟",
    };
    await handleSendQuickMessage(messages[action] || "");
    setShowArrivedAlert(false);
  };

  const handleShareRide = async () => {
    if (!ride) return;

    const shareText = `أنا في رحلة مع ران 🚗\nالسائق: ${ride.driver?.full_name || 'غير محدد'}\nالسيارة: ${ride.driver?.vehicle_color || ''} ${ride.driver?.vehicle_model || ''}\nرقم اللوحة: ${ride.driver?.vehicle_plate || '---'}\n\nعبر تطبيق ران`;

    // 1. Capacitor Share (Android)
    try {
      const { isNativePlatform } = await import('@/lib/capacitorBridge');
      if (isNativePlatform) {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: 'تتبع رحلتي — ران',
          text: shareText,
          dialogTitle: 'مشاركة رحلتي',
        });
        return;
      }
    } catch (e: any) {
      if (e?.message?.includes('cancel')) return;
    }

    // 2. Web Share API
    if (navigator.share) {
      navigator.share({ title: 'تتبع رحلتي مع ران', text: shareText })
        .then(() => toast({ title: '✅ تمت مشاركة الرحلة' }))
        .catch(() => {});
    } else {
      // 3. Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareText);
        toast({ title: '✅ تم نسخ تفاصيل الرحلة' });
      } catch {
        toast({ title: 'المشاركة غير مدعومة', variant: 'destructive' });
      }
    }
  };

  const handleSendQuickMessage = async (message: string) => {
    // This would ideally send a realtime message or push notification
    toast({
      title: "تم إرسال الرسالة",
      description: `"${message}"`,
    });
    // Example of sending a message via Supabase (requires a 'messages' table)
    /*
    await supabase.from('ride_messages').insert({
      ride_id: rideId,
      sender_id: ride?.rider_id,
      receiver_id: ride?.driver_id,
      content: message,
    });
    */
  };

  if (loading) {
    return (
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
        <div className="bg-background/30 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-border/20 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
        <div className="bg-destructive/20 backdrop-blur-sm rounded-md px-4 py-2.5 shadow-sm border border-destructive/30 max-w-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-sm font-semibold text-destructive">
              الرحلة غير موجودة
            </p>
          </div>
          <Button
            onClick={onBack}
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs bg-background/50 hover:bg-background/80"
          >
            العودة للرئيسية
          </Button>
        </div>
      </div>
    );
  }

  const getDriverName = () => ride.driver?.full_name?.split(" ")[0] || "السائق";
  const currentStatus =
    statusConfig[ride.status as keyof typeof statusConfig] ||
    statusConfig.pending;
  const CurrentStatusIcon = currentStatus.icon;
  const currentStepIndex = allSteps.indexOf(ride.status);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col justify-end pointer-events-none">
      {/* Driver Arrived Alert - Floating notification */}
      <AnimatePresence>
        {(ride.status === "arrived" || showArrivedAlert) && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute top-[-280px] inset-x-4 pointer-events-auto"
          >
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-md p-4 shadow-2xl border border-green-400/30">
              {/* Close button */}
              <button
                onClick={() => setShowArrivedAlert(false)}
                className="absolute top-3 left-3 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                aria-label="إغلاق"
                title="إغلاق"
              >
                <X className="w-4 h-4 text-white" />
              </button>

              {/* Bell icon with pulse */}
              <div className="flex justify-center mb-3">
                <div className="relative">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                    <Bell className="w-8 h-8 text-white animate-bounce" />
                  </div>
                  <div className="absolute inset-0 bg-white/20 rounded-full animate-ping" />
                </div>
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-white text-center mb-1">
                🔔 السائق وصل!
              </h3>
              <p className="text-white/90 text-center text-sm mb-4">
                اخرج الآن - السائق في انتظارك
              </p>

              {/* Quick Response Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {arrivedResponses.map((response) => (
                  <Button
                    key={response.action}
                    onClick={() => handleArrivedResponse(response.action)}
                    className="h-auto py-3 flex flex-col items-center gap-1 bg-white/20 hover:bg-white/30 border-0 text-white rounded-md transition-all"
                    variant="ghost"
                  >
                    <span className="text-xl">{response.icon}</span>
                    <span className="text-xs font-medium">{response.text}</span>
                  </Button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Draggable Share Button */}
      <motion.div
        drag
        dragControls={dragControls}
        dragConstraints={{ top: -300, left: 0, right: 0, bottom: -50 }}
        dragElastic={0.2}
        className="absolute top-[-200px] right-4 pointer-events-auto"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <Button
          size="icon"
          className="w-14 h-14 rounded-full bg-gradient-to-r from-primary to-primary/80 backdrop-blur-md shadow-2xl text-white hover:scale-110 transition-transform"
          onClick={handleShareRide}
        >
          <Share2 className="w-6 h-6" />
        </Button>
      </motion.div>

      {/* Floating Status Pill - Always visible at top */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-[-120px] inset-x-4 pointer-events-auto"
      >
        <div
          className={`${currentStatus.bgColor} backdrop-blur-xl rounded-md p-3 shadow-lg border border-white/10`}
        >
          <div className="flex items-center justify-between">
            {/* Current Status */}
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-md ${currentStatus.bgColor} flex items-center justify-center`}
              >
                <CurrentStatusIcon
                  className={`w-6 h-6 ${currentStatus.color}`}
                />
              </div>
              <div>
                <h4 className={`text-sm font-bold ${currentStatus.color}`}>
                  {currentStatus.label}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {currentStatus.description}
                </p>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-1.5">
              {allSteps.map((step, idx) => (
                <div key={step} className="flex items-center">
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{
                      scale: idx === currentStepIndex ? 1.2 : 1,
                      opacity: idx <= currentStepIndex ? 1 : 0.3,
                    }}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      idx <= currentStepIndex
                        ? idx === currentStepIndex
                          ? `${
                              currentStatus.dotColor
                            } ring-2 ring-offset-1 ring-offset-background ${currentStatus.dotColor.replace(
                              "bg-",
                              "ring-",
                            )}/30`
                          : "bg-emerald-500"
                        : "bg-muted-foreground/20"
                    }`}
                  />
                  {idx < allSteps.length - 1 && (
                    <div
                      className={`w-3 h-0.5 mx-0.5 rounded ${
                        idx < currentStepIndex
                          ? "bg-emerald-500"
                          : "bg-muted-foreground/20"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ETA inline */}
          {eta !== null && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {ride.status === "in_progress" ? "الوصول خلال" : "يصل خلال"}
              </span>
              <span className="text-sm font-bold text-foreground">
                {eta} دقيقة
              </span>
              {distance && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {distance} كم
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Bottom Sheet */}
      <div className="bg-background/90 backdrop-blur-xl rounded-t-lg shadow-2xl border-t border-border/20 pointer-events-auto w-full max-w-md mx-auto max-h-[85vh] overflow-y-auto" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 32px), 32px)' }}>
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 200 }}
        >
          {/* Handle */}
          <div
            className="py-3 flex justify-center cursor-pointer"
            onClick={() => setIsSheetOpen(!isSheetOpen)}
          >
            <div className="w-12 h-1.5 bg-muted-foreground/40 rounded-full hover:bg-muted-foreground/60 transition-colors" />
          </div>

          {/* Security Badge */}
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 bg-green-500/10 text-green-600 rounded-full px-3 py-1.5 text-xs font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>رحلة مؤمّنة</span>
              </div>
              {/* Mini status reminder */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div
                  className={`w-2 h-2 rounded-full animate-pulse ${currentStatus.dotColor}`}
                />
                <span>{currentStatus.label}</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <motion.div
            initial={{ height: "auto" }}
            animate={{ height: isSheetOpen ? "auto" : 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-6 space-y-4">
              {/* Driver Info Card - Enhanced */}
              <div className="bg-gradient-to-br from-card/80 to-card/40 rounded-md border border-border/50 p-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="w-18 h-18 border-3 border-primary/30 shadow-lg">
                      <AvatarImage
                        src={ride.driver?.profile_image_url && (ride.driver.profile_image_url.startsWith('http') || ride.driver.profile_image_url.startsWith('data:')) ? ride.driver.profile_image_url : ""}
                        alt={ride.driver?.full_name}
                      />
                      <AvatarFallback className="text-2xl bg-gradient-to-br from-primary/20 to-primary/5">
                        {ride.driver?.full_name?.charAt(0) || "S"}
                      </AvatarFallback>
                    </Avatar>
                    {/* Online indicator */}
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-3 border-card shadow-lg">
                      <div className="absolute inset-0.5 bg-green-400 rounded-full animate-ping opacity-75" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-foreground truncate">
                      {getDriverName()}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1 text-amber-500 bg-amber-500/15 px-2 py-1 rounded-lg">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-bold">
                          {ride.driver?.rating?.toFixed(1) || "4.8"}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {ride.driver?.vehicle_color}{" "}
                        {ride.driver?.vehicle_model}
                      </Badge>
                    </div>
                    {/* Vehicle plate - prominent */}
                    <div className="mt-2 bg-muted/50 rounded-lg px-3 py-1.5 inline-flex items-center gap-2">
                      <Car className="w-4 h-4 text-muted-foreground" />
                      <span className="text-lg font-black tracking-wider font-mono text-foreground">
                        {ride.driver?.vehicle_plate || "---"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    className="flex-1 h-12 rounded-md bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary transition-all"
                    onClick={() => window.open(`tel:${ride.driver?.phone}`)}
                  >
                    <Phone className="w-5 h-5 ml-2" />
                    اتصال
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-12 rounded-md bg-green-500/5 hover:bg-green-500/10 border-green-500/20 text-green-600 transition-all"
                    onClick={() =>
                      window.open(`https://wa.me/${ride.driver?.phone}`)
                    }
                  >
                    <MessageCircle className="w-5 h-5 ml-2" />
                    واتساب
                  </Button>
                </div>
              </div>

              {/* Route Info - Compact */}
              <div className="bg-muted/30 rounded-md p-3">
                <div className="flex items-center gap-3">
                  {/* Visual route indicator */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm" />
                    <div className="w-0.5 h-8 bg-gradient-to-b from-green-500 to-blue-500 rounded" />
                    <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm" />
                  </div>
                  {/* Addresses */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide">
                        من
                      </p>
                      <p className="text-sm text-foreground line-clamp-1">
                        {ride.pickup_address}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">
                        إلى
                      </p>
                      <p className="text-sm text-foreground line-clamp-1">
                        {ride.dropoff_address}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Messages - Grid style */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  رسالة سريعة
                </p>
                <div className="flex flex-wrap gap-2">
                  {quickMessages.map((msg) => (
                    <Button
                      key={msg}
                      variant="outline"
                      size="sm"
                      className="h-auto py-2 px-3 text-xs rounded-full bg-muted/30 hover:bg-muted/50 border-0 transition-all"
                      onClick={() => handleSendQuickMessage(msg)}
                    >
                      {msg}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Fare - Bottom sticky */}
              <div className="bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 rounded-md p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-0.5">
                      الأجرة المتوقعة
                    </span>
                    <span className="text-xs text-muted-foreground">
                      💳 نقداً عند الوصول
                    </span>
                  </div>
                  <div className="text-left">
                    <span className="text-3xl font-black text-primary">
                      {ride.estimated_fare?.toLocaleString('en-US') || "..."}
                    </span>
                    <span className="text-sm text-muted-foreground mr-1">
                      د.ع
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default LiveRideTracker;
