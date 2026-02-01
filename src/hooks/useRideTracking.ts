/**
 * ران - Hook تتبع الرحلة
 * يدير logic الرحلات النشطة والانتظار والتتبع المباشر
 */

import { useCallback, useState } from "react";
import { useToast } from "./use-toast";
import { useActiveRide, ActiveRide } from "./useActiveRide";

export const useRideTracking = (userId: string | null) => {
  const { toast } = useToast();

  const {
    activeRide,
    setActiveRide,
    showWaitingScreen,
    setShowWaitingScreen,
    showLiveTracker,
    setShowLiveTracker,
    completedRide,
    showCompletedScreen,
    setShowCompletedScreen,
    clearCompletedRide,
    setIgnorePolling,
  } = useActiveRide(userId);

  const [showConfirmation, setShowConfirmation] = useState(false);

  // Handle ride completion
  const handleRideCompletion = useCallback(() => {
    clearCompletedRide();
  }, [clearCompletedRide]);

  // Check if there's an active ride
  const hasActiveRide = useCallback(() => {
    return (
      activeRide &&
      activeRide.status !== "completed" &&
      activeRide.status !== "cancelled"
    );
  }, [activeRide]);

  // Handle active ride conflict
  const checkActiveRideConflict = useCallback(() => {
    if (hasActiveRide()) {
      toast({
        title: "لديك رحلة نشطة",
        description: "الرجاء إنهاء الرحلة الحالية قبل حجز رحلة جديدة",
        variant: "destructive",
      });
      setShowWaitingScreen(true);
      return true;
    }
    return false;
  }, [hasActiveRide, toast, setShowWaitingScreen]);

  return {
    activeRide,
    setActiveRide,
    showWaitingScreen,
    setShowWaitingScreen,
    showLiveTracker,
    setShowLiveTracker,
    completedRide,
    showCompletedScreen,
    setShowCompletedScreen,
    showConfirmation,
    setShowConfirmation,
    handleRideCompletion,
    hasActiveRide,
    checkActiveRideConflict,
    clearCompletedRide,
    setIgnorePolling,
  };
};
