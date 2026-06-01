import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { roundFare } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { Sentry } from "@/lib/sentry";
import {
  buildRideStopsPayload,
  checkServiceAreaWithRetry,
  validateRideLocations,
  withTimeout,
  type BookingLocation,
  type BookingStop,
} from "@/lib/riderBooking";
import { showErrorToast } from "@/lib/toastHelpers";
import { mapPaymentToDb, type PaymentMethod } from "@/types/savedCards";
import type { FareBreakdown } from "@/hooks/useFareCalculation";
import type { ServiceAreaCheck } from "@/hooks/useLocationPicker";
import type { ActiveRide } from "@/hooks/useActiveRide";

type VehicleType = "economy" | "comfort" | "premium" | "women_only";

interface LastRideData {
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType: VehicleType;
  timestamp: number;
}

interface UseRideBookingSubmissionParams {
  userId: string | null;
  isOnline: boolean;
  isBooking: boolean;
  setIsBooking: Dispatch<SetStateAction<boolean>>;
  activeRide: ActiveRide | null;
  setActiveRide: Dispatch<SetStateAction<ActiveRide | null>>;
  setShowWaitingScreen: Dispatch<SetStateAction<boolean>>;
  pickupLocation: BookingLocation | null;
  dropoffLocation: BookingLocation | null;
  intermediateStops: BookingStop[];
  selectedVehicle: VehicleType;
  paymentMethod: PaymentMethod;
  setPaymentSheetOpen: Dispatch<SetStateAction<boolean>>;
  fareBreakdown: FareBreakdown | null;
  fareLoading: boolean;
  routeDistance: number | null;
  routeDuration: number | null;
  checkServiceArea: (lat: number, lng: number) => Promise<ServiceAreaCheck | null>;
  setLocalServiceAreaStatus: Dispatch<SetStateAction<ServiceAreaCheck | null>>;
  saveLastRide: (rideData: LastRideData) => void;
  setIgnorePolling?: (ignore: boolean) => void;
}

const toActiveRide = (ride: any): ActiveRide => ({
  id: ride.id,
  pickup_location: ride.pickup_location as { lat: number; lng: number },
  dropoff_location: ride.dropoff_location as { lat: number; lng: number },
  pickup_address: ride.pickup_address,
  dropoff_address: ride.dropoff_address,
  status: ride.status,
  estimated_fare: ride.estimated_fare,
  final_fare: ride.final_fare,
  distance_km: ride.distance_km,
  duration_minutes: ride.duration_minutes,
  vehicle_type: ride.vehicle_type,
  driver_id: ride.driver_id,
  created_at: ride.created_at,
  completed_at: ride.completed_at,
  payment_method: ride.payment_method,
});

export const useRideBookingSubmission = ({
  userId,
  isOnline,
  isBooking,
  setIsBooking,
  activeRide,
  setActiveRide,
  setShowWaitingScreen,
  pickupLocation,
  dropoffLocation,
  intermediateStops,
  selectedVehicle,
  paymentMethod,
  setPaymentSheetOpen,
  fareBreakdown,
  fareLoading,
  routeDistance,
  routeDuration,
  checkServiceArea,
  setLocalServiceAreaStatus,
  saveLastRide,
  setIgnorePolling,
}: UseRideBookingSubmissionParams) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleBookRide = useCallback(async () => {
    if (isBooking) {
      logger.debug("useRideBookingSubmission", "Booking already in progress; ignoring duplicate click");
      return;
    }

    logger.debug("useRideBookingSubmission", "Book ride clicked");
    setIsBooking(true);

    const bookingTimeout = setTimeout(() => {
      logger.warn("useRideBookingSubmission", "Booking timeout reached; resetting isBooking");
      setIsBooking(false);
    }, 20000);

    try {
      if (!isOnline) {
        logger.warn("useRideBookingSubmission", "Booking blocked: offline");
        toast({
          title: "لا يوجد اتصال بالإنترنت",
          description: "تحقق من اتصالك بالإنترنت وحاول مرة أخرى",
          variant: "destructive",
        });
        setIsBooking(false);
        return;
      }

      let resolvedUserId = userId;
      if (!resolvedUserId) {
        try {
          const userResult = await Promise.race([
            supabase.auth.getUser(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("auth_timeout")), 5000),
            ),
          ]);
          resolvedUserId =
            (userResult as { data: { user: { id: string } | null } }).data?.user
              ?.id || null;

          if (resolvedUserId) {
            logger.debug("useRideBookingSubmission", "User resolved via getUser; proceeding with booking");
          } else {
            toast({
              title: "يجب تسجيل الدخول",
              description: "الرجاء تسجيل الدخول للحجز",
              variant: "destructive",
            });
            setIsBooking(false);
            navigate("/auth?redirect=/rider/go");
            return;
          }
        } catch (err) {
          const isTimeout = err instanceof Error && err.message === "auth_timeout";
          logger.warn(
            "useRideBookingSubmission",
            "Booking auth check failed",
            isTimeout ? "timeout" : err,
          );
          toast({
            title: "يجب تسجيل الدخول",
            description: "الرجاء تسجيل الدخول للحجز",
            variant: "destructive",
          });
          setIsBooking(false);
          navigate("/auth?redirect=/rider/go");
          return;
        }
      }

      const bookingUserId = resolvedUserId;
      if (!bookingUserId) return;

      if (
        activeRide &&
        activeRide.status !== "completed" &&
        activeRide.status !== "cancelled"
      ) {
        toast({
          title: "لديك رحلة نشطة",
          description: "الرجاء إنهاء الرحلة الحالية قبل حجز رحلة جديدة",
          variant: "destructive",
        });
        setShowWaitingScreen(true);
        setIsBooking(false);
        return;
      }

      const locationValidation = validateRideLocations(
        pickupLocation,
        dropoffLocation,
      );
      if (!locationValidation.ok) {
        if (locationValidation.reason === "missing_location") {
          logger.warn("useRideBookingSubmission", "Booking blocked: missing pickup/dropoff");
          toast({
            title: "معلومات ناقصة",
            description: "الرجاء تحديد نقطة الانطلاق والوجهة",
            variant: "destructive",
          });
        } else {
          logger.warn("useRideBookingSubmission", "Booking blocked: coordinates outside Iraq");
          toast({
            title: "موقع خارج العراق",
            description: "الخدمة متاحة فقط داخل العراق",
            variant: "destructive",
          });
        }

        setIsBooking(false);
        return;
      }

      if (!pickupLocation || !dropoffLocation) return;

      logger.debug("useRideBookingSubmission", "Booking locations valid; checking service area");
      try {
        const pickupServiceCheck = await checkServiceAreaWithRetry(
          checkServiceArea,
          pickupLocation.lat,
          pickupLocation.lng,
          "التحقق من منطقة خدمة موقع الانطلاق",
        );
        setLocalServiceAreaStatus(pickupServiceCheck);

        if (pickupServiceCheck && !pickupServiceCheck.in_service) {
          logger.warn("useRideBookingSubmission", "Booking blocked: pickup outside service area");
          toast({
            title: "⚠️ موقع الانطلاق خارج منطقة الخدمة",
            description: pickupServiceCheck.nearest_region
              ? `أقرب منطقة خدمة: ${pickupServiceCheck.nearest_region.name_ar} (${pickupServiceCheck.nearest_region.distance_km} كم)`
              : "الرجاء اختيار موقع داخل مناطق الخدمة المتاحة",
            variant: "destructive",
          });
          return;
        }

        const dropoffServiceCheck = await checkServiceAreaWithRetry(
          checkServiceArea,
          dropoffLocation.lat,
          dropoffLocation.lng,
          "التحقق من منطقة خدمة الوجهة",
        );
        if (dropoffServiceCheck && !dropoffServiceCheck.in_service) {
          logger.warn("useRideBookingSubmission", "Booking blocked: dropoff outside service area");
          toast({
            title: "⚠️ الوجهة خارج منطقة الخدمة",
            description: dropoffServiceCheck.nearest_region
              ? `أقرب منطقة خدمة: ${dropoffServiceCheck.nearest_region.name_ar} (${dropoffServiceCheck.nearest_region.distance_km} كم)`
              : "الرجاء اختيار وجهة داخل مناطق الخدمة المتاحة",
            variant: "destructive",
          });
          return;
        }
      } catch (error) {
        logger.error("useRideBookingSubmission", "Service area check error", error);
      }

      const totalFare = fareBreakdown?.total_fare || 0;
      logger.debug("useRideBookingSubmission", "Booking fare check", {
        totalFare,
        fareBreakdown: !!fareBreakdown,
        fareLoading,
      });
      if (totalFare <= 0) {
        logger.warn("useRideBookingSubmission", "Booking blocked: total fare is zero");
        toast({
          title: "خطأ في حساب السعر",
          description: "الرجاء إعادة المحاولة",
          variant: "destructive",
        });
        setIsBooking(false);
        return;
      }

      if (paymentMethod === "wallet") {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("wallet_balance")
            .eq("user_id", bookingUserId)
            .single();

          const walletBalance = profile?.wallet_balance || 0;
          if (walletBalance < totalFare) {
            toast({
              title: "رصيد غير كافٍ",
              description: `رصيد المحفظة: ${walletBalance.toLocaleString('en-US')} د.ع - الأجرة المتوقعة: ${totalFare.toLocaleString('en-US')} د.ع\nاشحن رصيدك أو اختر الدفع نقداً`,
              variant: "destructive",
            });
            setPaymentSheetOpen(true);
            setIsBooking(false);
            return;
          }
        } catch (error) {
          logger.error("useRideBookingSubmission", "Wallet balance check error — blocking booking", error);
          toast({
            title: "تعذر التحقق من الرصيد",
            description: "حدث خطأ أثناء التحقق من رصيد المحفظة، حاول مرة أخرى أو اختر الدفع نقداً",
            variant: "destructive",
          });
          setIsBooking(false);
          return;
        }
      }

      saveLastRide({
        pickupAddress: pickupLocation.address || "",
        pickupLat: pickupLocation.lat,
        pickupLng: pickupLocation.lng,
        dropoffAddress: dropoffLocation.address || "",
        dropoffLat: dropoffLocation.lat,
        dropoffLng: dropoffLocation.lng,
        vehicleType: selectedVehicle,
        timestamp: Date.now(),
      });

      try {
        const { data: secData } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "security_settings")
          .maybeSingle();

        const maxActive =
          (secData?.value as any)?.max_active_rides_per_user ?? 3;
        const cooldown =
          (secData?.value as any)?.ride_creation_cooldown_seconds ?? 60;

        const { data: activeRidesRaw } = await supabase
          .from("rides")
          .select("id, status, created_at")
          .eq("rider_id", bookingUserId)
          .in("status", ["pending", "accepted", "in_progress", "arrived"])
          .order("created_at", { ascending: false })
          .limit(20);

        const now = Date.now();
        const activeCount = (activeRidesRaw || []).filter((ride: any) => {
          if (ride.status === "pending") {
            const ageMinutes =
              (now - new Date(ride.created_at).getTime()) / 60000;
            return ageMinutes <= 10;
          }
          return true;
        }).length;

        if (activeCount >= maxActive) {
          toast({
            title: "لديك رحلات نشطة بالفعل",
            description: `الحد الأقصى ${maxActive} رحلات نشطة في وقت واحد`,
            variant: "destructive",
          });
          setIsBooking(false);
          return;
        }

        const { data: lastRide } = await supabase
          .from("rides")
          .select("created_at")
          .eq("rider_id", bookingUserId)
          .not("status", "in", '("cancelled","completed")')
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastRide) {
          const elapsed =
            (Date.now() - new Date(lastRide.created_at).getTime()) / 1000;
          if (elapsed < cooldown) {
            toast({
              title: "يرجى الانتظار",
              description: `انتظر ${Math.ceil(cooldown - elapsed)} ثانية قبل إنشاء رحلة جديدة`,
              variant: "destructive",
            });
            setIsBooking(false);
            return;
          }
        }
      } catch (e) {
        logger.warn("useRideBookingSubmission", "Failed to check ride limits; continuing", e);
      }

      setIgnorePolling?.(true);
      try {
        const { data: ride, error } = (await supabase
          .from("rides" as any)
          .insert([
            {
              rider_id: bookingUserId,
              pickup_location: {
                lat: pickupLocation.lat,
                lng: pickupLocation.lng,
              },
              dropoff_location: {
                lat: dropoffLocation.lat,
                lng: dropoffLocation.lng,
              },
              pickup_address: pickupLocation.address,
              dropoff_address: dropoffLocation.address,
              vehicle_type: selectedVehicle,
              payment_method: mapPaymentToDb(paymentMethod),
              estimated_fare: roundFare(fareBreakdown?.total_fare || 0),
              stops: buildRideStopsPayload(intermediateStops),
              metadata: {
                final_dropoff: {
                  lat: dropoffLocation.lat,
                  lng: dropoffLocation.lng,
                  address: dropoffLocation.address,
                },
              } as Record<string, unknown>,
              distance_km: routeDistance
                ? Number(routeDistance.toFixed(2))
                : null,
              duration_minutes: routeDuration
                ? Math.round(routeDuration)
                : null,
              status: "pending" as const,
              trip_type: "app" as const,
              region_id: fareBreakdown?.region_id || null,
            },
          ] as any)
          .select()
          .single()) as { data: any; error: any };

        if (error) throw error;

        setIgnorePolling?.(false);
        setActiveRide(toActiveRide(ride));
        setShowWaitingScreen(true);

        withTimeout(
          supabase.functions.invoke("match-ride", {
            body: { rideId: ride.id },
          }),
          8000,
          "مطابقة السائق",
        ).catch(async (matchErr) => {
          logger.warn("useRideBookingSubmission", "match-ride first attempt failed", matchErr);
          try {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            await withTimeout(
              supabase.functions.invoke("match-ride", {
                body: { rideId: ride.id },
              }),
              10000,
              "مطابقة السائق (إعادة محاولة)",
            );
          } catch (retryErr) {
            logger.error("useRideBookingSubmission", "match-ride retry also failed", retryErr);
            // Phase 6C: report to Sentry so silent match failures are visible
            Sentry.captureException(retryErr, {
              tags: { module: "match-ride", event: "client_retry_failed" },
              extra: { rideId: ride.id },
            });
            toast({
              title: "⚠️ جارٍ البحث عن سائق",
              description:
                "تأخر في البحث عن سائق مناسب، سيتم المحاولة تلقائياً",
            });
          }
        });
      } catch (error: any) {
        setIgnorePolling?.(false);

        const errorMessage = String(error?.message || "");
        if (errorMessage.includes("انتهت مهلة إنشاء الرحلة")) {
          try {
            const { data: fallbackRide } = (await supabase
              .from("rides" as any)
              .select("*")
              .eq("rider_id", bookingUserId)
              .eq("status", "pending" as any)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()) as { data: any; error: any };

            if (fallbackRide) {
              setActiveRide(toActiveRide(fallbackRide));
              setShowWaitingScreen(true);
              return;
            }
          } catch (fallbackError) {
            logger.warn("useRideBookingSubmission", "Fallback pending ride check failed", fallbackError);
          }
        }

        logger.error("useRideBookingSubmission", "Booking failed", {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          status: error?.status,
        });
        showErrorToast(
          toast,
          "فشل الحجز",
          error?.message || "حدث خطأ غير متوقع",
        );
      }
    } finally {
      clearTimeout(bookingTimeout);
      setIsBooking(false);
    }
  }, [
    activeRide,
    checkServiceArea,
    dropoffLocation,
    fareBreakdown,
    fareLoading,
    intermediateStops,
    isBooking,
    isOnline,
    navigate,
    paymentMethod,
    pickupLocation,
    routeDistance,
    routeDuration,
    saveLastRide,
    selectedVehicle,
    setActiveRide,
    setIgnorePolling,
    setIsBooking,
    setLocalServiceAreaStatus,
    setPaymentSheetOpen,
    setShowWaitingScreen,
    toast,
    userId,
  ]);

  return { handleBookRide };
};
