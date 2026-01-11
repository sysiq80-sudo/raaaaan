import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SearchMessage {
  text: string;
  icon: string;
}

interface RiderWaitSettings {
  id: string;
  max_wait_minutes: number;
  search_messages: SearchMessage[];
  warning_message: string;
  warning_threshold: number;
  auto_cancel_enabled: boolean;
  auto_cancel_message: string;
  updated_at: string;
}

const DEFAULT_SETTINGS: RiderWaitSettings = {
  id: "00000000-0000-0000-0000-000000000001",
  max_wait_minutes: 10,
  search_messages: [
    { text: "جاري البحث عن أفضل سائق لك...", icon: "🔍" },
    { text: "سائقونا في الطريق إليك...", icon: "🚗" },
    { text: "لحظات قليلة وسيتم إيجاد سائق...", icon: "⏳" },
    { text: "نبحث في منطقتك عن سائق متاح...", icon: "📍" },
    { text: "شكراً لصبرك، نحن نعمل على ذلك...", icon: "💚" },
    { text: "سيتم إعلامك فور قبول السائق...", icon: "🔔" },
  ],
  warning_message: "⚠️ سيتم الإلغاء التلقائي قريباً",
  warning_threshold: 0.8,
  auto_cancel_enabled: true,
  auto_cancel_message: "لم يتم العثور على سائق متاح خلال الوقت المحدد",
  updated_at: new Date().toISOString(),
};

export const useRiderWaitSettings = () => {
  return useQuery({
    queryKey: ["rider-wait-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rider_wait_settings")
        .select("*")
        .limit(1)
        .single();

      if (error) {
        console.error("Error fetching rider wait settings:", error);
        return DEFAULT_SETTINGS;
      }

      if (!data) {
        return DEFAULT_SETTINGS;
      }

      return {
        ...data,
        search_messages: data.search_messages as SearchMessage[],
      } as RiderWaitSettings;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
  });
};
