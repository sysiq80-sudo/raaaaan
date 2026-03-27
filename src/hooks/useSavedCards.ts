/**
 * ران - Hook للبطاقات المحفوظة
 * جلب وإضافة وحذف البطاقات المحفوظة من saved_cards
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { SavedCard, SavedCardInsert } from "@/types/savedCards";

/**
 * جلب البطاقات المحفوظة للمستخدم الحالي
 */
export const useSavedCards = () => {
  const { user } = useAuth();

  return useQuery<SavedCard[]>({
    queryKey: ["saved_cards", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("saved_cards" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error fetching saved cards:", error);
        throw error;
      }

      return (data as unknown as SavedCard[]) || [];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 دقائق
  });
};

/**
 * جلب البطاقة الافتراضية فقط
 */
export const useDefaultCard = () => {
  const { user } = useAuth();

  return useQuery<SavedCard | null>({
    queryKey: ["saved_cards", "default", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("saved_cards" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("is_default", true)
        .maybeSingle();

      if (error) {
        console.error("❌ Error fetching default card:", error);
        throw error;
      }

      return (data as unknown as SavedCard) || null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * إضافة بطاقة جديدة
 */
export const useAddCard = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (card: Omit<SavedCardInsert, "user_id">) => {
      if (!user?.id) throw new Error("المستخدم غير مسجل");

      const { data, error } = await supabase
        .from("saved_cards" as any)
        .insert([
          {
            user_id: user.id,
            provider: card.provider,
            card_token: card.card_token,
            last4: card.last4,
            brand: card.brand,
            is_default: card.is_default,
          },
        ] as any)
        .select()
        .single();

      if (error) {
        console.error("❌ Error adding card:", error);
        throw error;
      }

      return data as unknown as SavedCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved_cards"] });
    },
  });
};

/**
 * حذف بطاقة محفوظة
 */
export const useDeleteCard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await supabase
        .from("saved_cards" as any)
        .delete()
        .eq("id", cardId);

      if (error) {
        console.error("❌ Error deleting card:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved_cards"] });
    },
  });
};

/**
 * تعيين بطاقة كافتراضية
 */
export const useSetDefaultCard = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (cardId: string) => {
      if (!user?.id) throw new Error("المستخدم غير مسجل");

      // إزالة الافتراضي من كل البطاقات
      await supabase
        .from("saved_cards" as any)
        .update({ is_default: false } as any)
        .eq("user_id", user.id);

      // تعيين البطاقة الجديدة كافتراضية
      const { error } = await supabase
        .from("saved_cards" as any)
        .update({ is_default: true } as any)
        .eq("id", cardId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved_cards"] });
    },
  });
};
