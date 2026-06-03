import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { preloadRiderRoute } from "@/lib/riderRoutePreload";

const RiderMapPrewarmer = () => {
  const { user, isOnboardingComplete } = useAuth();

  useEffect(() => {
    if (!user || !isOnboardingComplete) return;

    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      preloadRiderRoute("/rider/go");
    }, 900);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOnboardingComplete, user]);

  return null;
};

export default RiderMapPrewarmer;
