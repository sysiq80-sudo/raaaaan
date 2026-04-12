/**
 * ران — هوك إدارة حسابات Facebook Messenger / Instagram
 * CRUD operations for messenger_accounts table
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MessengerAccount {
  id: string;
  account_name: string | null;
  page_name: string;
  page_id: string;
  page_access_token: string;
  app_id: string | null;
  app_secret: string | null;
  verify_token: string;
  is_active: boolean;
  is_verified: boolean;
  platform: 'messenger' | 'instagram' | 'both';
  messages_sent: number;
  messages_received: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateMessengerAccountInput {
  account_name?: string;
  page_name: string;
  page_id: string;
  page_access_token: string;
  app_id?: string;
  app_secret?: string;
  platform?: 'messenger' | 'instagram' | 'both';
}

export function useMessengerAccounts() {
  const queryClient = useQueryClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: accounts = [], isLoading: loading } = useQuery({
    queryKey: ['messenger-accounts'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('messenger_accounts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as MessengerAccount[];
    },
  });

  const fetchAccounts = () => queryClient.invalidateQueries({ queryKey: ['messenger-accounts'] });

  const createAccountMutation = useMutation({
    mutationFn: async (input: CreateMessengerAccountInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const insertData = {
        account_name: input.account_name || null,
        page_name: input.page_name,
        page_id: input.page_id,
        page_access_token: input.page_access_token,
        app_id: input.app_id || null,
        app_secret: input.app_secret || null,
        platform: input.platform || 'messenger',
        created_by: user?.id || null,
      };
      
      const { data, error } = await sb
        .from('messenger_accounts')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('هذا الـ Page ID مسجل مسبقاً');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      toast.success('تمت إضافة حساب Messenger بنجاح');
      queryClient.invalidateQueries({ queryKey: ['messenger-accounts'] });
    },
    onError: (err: any) => {
      console.error('❌ createMessengerAccount error:', err);
      toast.error('فشل إضافة الحساب: ' + (err.message || 'خطأ غير معروف'));
    },
  });

  const createAccount = async (input: CreateMessengerAccountInput) => {
    try {
      const result = await createAccountMutation.mutateAsync(input);
      return result;
    } catch {
      return null;
    }
  };

  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MessengerAccount> }) => {
      const { error } = await sb
        .from('messenger_accounts')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث الحساب');
      queryClient.invalidateQueries({ queryKey: ['messenger-accounts'] });
    },
    onError: (err: any) => {
      console.error('❌ updateMessengerAccount error:', err);
      toast.error('فشل التحديث');
    },
  });

  const updateAccount = async (id: string, updates: Partial<MessengerAccount>) => {
    try {
      await updateAccountMutation.mutateAsync({ id, updates });
      return true;
    } catch {
      return false;
    }
  };

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb
        .from('messenger_accounts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف الحساب');
      queryClient.invalidateQueries({ queryKey: ['messenger-accounts'] });
    },
    onError: (err: any) => {
      console.error('❌ deleteMessengerAccount error:', err);
      toast.error('فشل الحذف');
    },
  });

  const deleteAccount = async (id: string) => {
    try {
      await deleteAccountMutation.mutateAsync(id);
      return true;
    } catch {
      return false;
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    return updateAccount(id, { is_active: isActive });
  };

  const testConnection = async (account: MessengerAccount) => {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${account.page_id}?fields=name,id&access_token=${account.page_access_token}`
      );
      const data = await res.json();

      if (data.error) {
        toast.error(`فشل الاتصال: ${data.error.message}`);
        return false;
      }

      toast.success(`✅ الاتصال ناجح — الصفحة: ${data.name}`);
      return true;
    } catch (err: any) {
      toast.error('فشل اختبار الاتصال: ' + err.message);
      return false;
    }
  };

  return {
    accounts,
    loading,
    fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
    toggleActive,
    testConnection,
  };
}
