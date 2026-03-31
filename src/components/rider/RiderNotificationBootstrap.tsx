import { useAuth } from "@/contexts/AuthContext";
import { useRiderFCMRegistration } from "@/hooks/useRiderFCMRegistration";
import { useRiderWebPushSetup } from "@/hooks/useRiderWebPushSetup";

/**
 * Initializes rider push registration once user session exists.
 * Mounted at app level so /rider and all rider routes share same setup.
 */
const RiderNotificationBootstrap = () => {
  const { user } = useAuth();

  useRiderFCMRegistration(user?.id ?? null);
  useRiderWebPushSetup(user?.id ?? null);

  return null;
};

export default RiderNotificationBootstrap;
