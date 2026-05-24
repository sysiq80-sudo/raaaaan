import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface DriverVisibilitySettings {
  showRealDrivers: boolean;
  showFakeDrivers: boolean;
}

export interface FakeDriver {
  id: string;
  name: string;
  vehicle_type: string;
  location: Json;
  rating: number | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  is_active: boolean | null;
}

export const useDriverVisibilitySettings = () => {
  // Fetch visibility settings
  const { data: settings } = useQuery({
    queryKey: ["driver-visibility-settings-rider"],
    queryFn: async (): Promise<DriverVisibilitySettings> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["show_drivers_to_riders", "show_fake_drivers"]);

      if (error) throw error;

      let showRealDrivers = false;
      let showFakeDrivers = false;

      data?.forEach((s) => {
        if (s.key === "show_drivers_to_riders") {
          showRealDrivers = s.value === true || s.value === "true";
        }
        if (s.key === "show_fake_drivers") {
          showFakeDrivers = s.value === true || s.value === "true";
        }
      });

      return { showRealDrivers, showFakeDrivers };
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch fake drivers if enabled
  const { data: fakeDrivers = [] } = useQuery({
    queryKey: ["fake-drivers-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fake_drivers")
        .select("*")
        .eq("is_active", true);

      if (error) throw error;
      return (data || []) as FakeDriver[];
    },
    enabled: settings?.showFakeDrivers === true,
    staleTime: 30000,
  });

  return {
    showRealDrivers: settings?.showRealDrivers ?? true, // افتراضي true للتطوير
    showFakeDrivers: settings?.showFakeDrivers ?? true, // افتراضي true للتطوير
    fakeDrivers: settings?.showFakeDrivers ? fakeDrivers : [],
  };
};
