import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DriverStatus {
  isDriver: boolean;
  isApproved: boolean;
  isActivated: boolean;
  status: string | null;
  driverId: string | null;
  loading: boolean;
}

export const useDriverStatus = (userId: string | null) => {
  const [driverStatus, setDriverStatus] = useState<DriverStatus>({
    isDriver: false,
    isApproved: false,
    isActivated: false,
    status: null,
    driverId: null,
    loading: true,
  });

  useEffect(() => {
    const checkDriverStatus = async () => {
      if (!userId) {
        setDriverStatus({
          isDriver: false,
          isApproved: false,
          isActivated: false,
          status: null,
          driverId: null,
          loading: false,
        });
        return;
      }

      try {
        const { data, error } = await supabase
          .from("drivers")
          .select("id, status, admin_activated")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          console.error("Error checking driver status:", error);
          setDriverStatus({
            isDriver: false,
            isApproved: false,
            isActivated: false,
            status: null,
            driverId: null,
            loading: false,
          });
          return;
        }

        if (data) {
          setDriverStatus({
            isDriver: true,
            isApproved: data.status === "approved",
            isActivated: data.admin_activated !== false,
            status: data.status,
            driverId: data.id,
            loading: false,
          });
        } else {
          setDriverStatus({
            isDriver: false,
            isApproved: false,
            isActivated: false,
            status: null,
            driverId: null,
            loading: false,
          });
        }
      } catch (error) {
        console.error("Error checking driver status:", error);
        setDriverStatus({
          isDriver: false,
          isApproved: false,
          isActivated: false,
          status: null,
          driverId: null,
          loading: false,
        });
      }
    };

    checkDriverStatus();
  }, [userId]);

  return driverStatus;
};
