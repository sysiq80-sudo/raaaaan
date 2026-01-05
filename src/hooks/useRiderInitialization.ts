import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { preloadMapboxToken } from './useMapboxToken';

interface RiderProfile {
  full_name: string | null;
  phone: string | null;
  wallet_balance: number;
}

interface InitializationState {
  user: any | null;
  session: any | null;
  profile: RiderProfile | null;
  isLoading: boolean;
  isProfileComplete: boolean;
  error: string | null;
}

export const useRiderInitialization = () => {
  const [state, setState] = useState<InitializationState>({
    user: null,
    session: null,
    profile: null,
    isLoading: true,
    isProfileComplete: true,
    error: null
  });

  const initStartedRef = useRef(false);

  const initialize = useCallback(async () => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    try {
      // Start preloading mapbox token in parallel (don't wait)
      preloadMapboxToken();

      // Get session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw sessionError;
      }

      if (!session?.user) {
        setState({
          user: null,
          session: null,
          profile: null,
          isLoading: false,
          isProfileComplete: true,
          error: null
        });
        return;
      }

      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, phone, wallet_balance')
        .eq('user_id', session.user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile fetch error:', profileError);
      }

      const isProfileComplete = !!(profile?.full_name && profile.full_name.trim().length >= 3);

      setState({
        user: session.user,
        session,
        profile: profile || null,
        isLoading: false,
        isProfileComplete,
        error: null
      });
    } catch (error: any) {
      console.error('Initialization error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'حدث خطأ في التحميل'
      }));
    }
  }, []);

  // Listen to auth changes
  useEffect(() => {
    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setState({
          user: null,
          session: null,
          profile: null,
          isLoading: false,
          isProfileComplete: true,
          error: null
        });
        initStartedRef.current = false;
      } else if (event === 'SIGNED_IN' && session) {
        setState(prev => ({
          ...prev,
          user: session.user,
          session
        }));
      }
    });

    return () => subscription.unsubscribe();
  }, [initialize]);

  const updateProfile = useCallback((updates: Partial<RiderProfile>) => {
    setState(prev => ({
      ...prev,
      profile: prev.profile ? { ...prev.profile, ...updates } : null,
      isProfileComplete: updates.full_name ? updates.full_name.trim().length >= 3 : prev.isProfileComplete
    }));
  }, []);

  const refetch = useCallback(() => {
    initStartedRef.current = false;
    initialize();
  }, [initialize]);

  return {
    ...state,
    updateProfile,
    refetch
  };
};
