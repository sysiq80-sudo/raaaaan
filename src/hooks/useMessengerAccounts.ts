/**
 * ران — هوك إدارة حسابات Facebook Messenger / Instagram
 * CRUD operations for messenger_accounts table
 */

import { useState, useCallback } from 'react';
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
  const [accounts, setAccounts] = useState<MessengerAccount[]>([]);
  const [loading, setLoading] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await sb
        .from('messenger_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (err: any) {
      console.error('❌ fetchMessengerAccounts error:', err);
      toast.error('فشل تحميل حسابات Messenger');
    } finally {
      setLoading(false);
    }
  }, []);

  const createAccount = useCallback(async (input: CreateMessengerAccountInput) => {
    try {
      const { data, error } = await sb
        .from('messenger_accounts')
        .insert({
          account_name: input.account_name || null,
          page_name: input.page_name,
          page_id: input.page_id,
          page_access_token: input.page_access_token,
          app_id: input.app_id || null,
          app_secret: input.app_secret || null,
          platform: input.platform || 'messenger',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('هذا الـ Page ID مسجل مسبقاً');
        } else {
          throw error;
        }
        return null;
      }

      toast.success('تمت إضافة حساب Messenger بنجاح');
      await fetchAccounts();
      return data;
    } catch (err: any) {
      console.error('❌ createMessengerAccount error:', err);
      toast.error('فشل إضافة الحساب: ' + (err.message || 'خطأ غير معروف'));
      return null;
    }
  }, [fetchAccounts]);

  const updateAccount = useCallback(async (id: string, updates: Partial<MessengerAccount>) => {
    try {
      const { error } = await sb
        .from('messenger_accounts')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      toast.success('تم تحديث الحساب');
      await fetchAccounts();
      return true;
    } catch (err: any) {
      console.error('❌ updateMessengerAccount error:', err);
      toast.error('فشل التحديث');
      return false;
    }
  }, [fetchAccounts]);

  const deleteAccount = useCallback(async (id: string) => {
    try {
      const { error } = await sb
        .from('messenger_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('تم حذف الحساب');
      await fetchAccounts();
      return true;
    } catch (err: any) {
      console.error('❌ deleteMessengerAccount error:', err);
      toast.error('فشل الحذف');
      return false;
    }
  }, [fetchAccounts]);

  const toggleActive = useCallback(async (id: string, isActive: boolean) => {
    return updateAccount(id, { is_active: isActive });
  }, [updateAccount]);

  const testConnection = useCallback(async (account: MessengerAccount) => {
    try {
      // تحقق من صلاحية التوكن عبر Graph API
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
  }, []);

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
