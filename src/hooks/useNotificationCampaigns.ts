import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface NotificationCampaign {
  id: string;
  title: string;
  body: string;
  image_url?: string;
  target_type: "all" | "all_drivers" | "all_riders" | "group" | "individual";
  target_user_id?: string;
  target_group_id?: string;
  target_filters?: Record<string, unknown>;
  notification_type: "promo" | "announcement" | "contest" | "system" | "custom";
  priority: "low" | "normal" | "high" | "urgent";
  scheduled_at?: string;
  sent_at?: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  read_count: number;
  action_url?: string;
  extra_data?: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignInput {
  title: string;
  body: string;
  image_url?: string;
  target_type: string;
  target_user_id?: string;
  target_group_id?: string;
  target_filters?: Record<string, unknown>;
  notification_type: string;
  priority?: string;
  scheduled_at?: string;
  action_url?: string;
  extra_data?: Record<string, unknown>;
}

export interface NotificationAutoSetting {
  id: string;
  title_template: string;
  body_template: string;
  is_enabled: boolean;
  sound: string;
  priority: string;
  target_role: string;
  updated_at: string;
}

// ── Campaigns ──

export function useCampaigns(statusFilter?: string) {
  return useQuery({
    queryKey: ["notification-campaigns", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("notification_campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as NotificationCampaign[];
    },
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCampaignInput) => {
      const { data: { user } } = await supabase.auth.getUser();

      const isScheduled = !!input.scheduled_at;
      const status = isScheduled ? "scheduled" : "draft";

      const { data, error } = await supabase
        .from("notification_campaigns")
        .insert({
          title: input.title,
          body: input.body,
          image_url: input.image_url,
          target_type: input.target_type,
          target_user_id: input.target_user_id,
          target_group_id: input.target_group_id,
          target_filters: input.target_filters as unknown as undefined,
          notification_type: input.notification_type,
          priority: input.priority,
          scheduled_at: input.scheduled_at,
          action_url: input.action_url,
          extra_data: input.extra_data as unknown as undefined,
          status,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as NotificationCampaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-campaigns"] });
      toast.success("تم إنشاء الحملة بنجاح");
    },
    onError: (err: Error) => {
      toast.error("فشل إنشاء الحملة: " + err.message);
    },
  });
}

export function useSendCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      // Call Edge Function to send
      const { data, error } = await supabase.functions.invoke(
        "send-push-notification",
        {
          body: { action: "send_campaign", campaign_id: campaignId },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["notification-campaigns"] });
      toast.success(`تم الإرسال! (${data?.sent_count || 0} مستلم)`);
    },
    onError: (err: Error) => {
      toast.error("فشل إرسال الحملة: " + err.message);
    },
  });
}

export function useCancelCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from("notification_campaigns")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-campaigns"] });
      toast.success("تم إلغاء الحملة");
    },
  });
}

// ── Auto Settings ──

export function useAutoSettings() {
  return useQuery({
    queryKey: ["notification-auto-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_auto_settings")
        .select("*")
        .order("id");
      if (error) throw error;
      return (data || []) as unknown as NotificationAutoSetting[];
    },
  });
}

export function useUpdateAutoSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<NotificationAutoSetting> & { id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("notification_auto_settings")
        .update({ ...updates, updated_by: user?.id, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-auto-settings"] });
      toast.success("تم تحديث الإعداد");
    },
  });
}

// ── Notification Groups ──

export interface NotificationGroup {
  id: string;
  name: string;
  description?: string;
  group_type: "drivers" | "riders" | "mixed";
  is_dynamic: boolean;
  filters?: Record<string, unknown>;
  member_count: number;
  created_at: string;
}

export function useNotificationGroups() {
  return useQuery({
    queryKey: ["notification-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_groups")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as NotificationGroup[];
    },
  });
}

export function useCreateNotificationGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      group_type: string;
      is_dynamic: boolean;
      filters?: Record<string, unknown>;
    }) => {
      const { data, error } = await supabase
        .from("notification_groups")
        .insert({
          name: input.name,
          description: input.description,
          group_type: input.group_type,
          is_dynamic: input.is_dynamic,
          filters: input.filters as unknown as undefined,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-groups"] });
      toast.success("تم إنشاء المجموعة");
    },
  });
}

export function useDeleteNotificationGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase
        .from("notification_groups")
        .delete()
        .eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-groups"] });
      toast.success("تم حذف المجموعة");
    },
  });
}

// ── Campaign Stats ──

export function useCampaignStats() {
  return useQuery({
    queryKey: ["campaign-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_campaigns")
        .select("status, sent_count, failed_count, total_recipients");
      if (error) throw error;

      const campaigns = (data || []) as unknown as NotificationCampaign[];
      return {
        total: campaigns.length,
        sent: campaigns.filter((c) => c.status === "sent").length,
        scheduled: campaigns.filter((c) => c.status === "scheduled").length,
        totalDelivered: campaigns.reduce((s, c) => s + (c.sent_count || 0), 0),
        totalFailed: campaigns.reduce((s, c) => s + (c.failed_count || 0), 0),
      };
    },
  });
}
