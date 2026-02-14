import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SessionConfig {
  timeoutMs: number; // Session timeout in milliseconds
  warningMs: number; // Show warning before timeout
  activityEvents: string[]; // Events that reset the session timer
  enableActivityTracking: boolean;
  autoLogout: boolean;
}

interface SessionState {
  isActive: boolean;
  lastActivity: number;
  timeUntilTimeout: number;
  showWarning: boolean;
  isExpired: boolean;
}

interface SessionHookReturn {
  isActive: boolean;
  timeUntilTimeout: number;
  showWarning: boolean;
  isExpired: boolean;
  extendSession: () => void;
  logout: () => Promise<void>;
  resetSession: () => void;
  getSessionInfo: () => {
    startTime: number;
    lastActivity: number;
    timeoutMs: number;
    timeRemaining: number;
  };
}

const DEFAULT_CONFIG: SessionConfig = {
  timeoutMs: 30 * 60 * 1000, // 30 minutes
  warningMs: 5 * 60 * 1000, // 5 minutes before timeout
  activityEvents: [
    'mousedown',
    'mousemove',
    'keypress',
    'scroll',
    'touchstart',
    'click',
  ],
  enableActivityTracking: true,
  autoLogout: true,
};

export const useSessionTimeout = (config: Partial<SessionConfig> = {}): SessionHookReturn => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const {
    timeoutMs,
    warningMs,
    activityEvents,
    enableActivityTracking,
    autoLogout,
  } = finalConfig;

  const [state, setState] = useState<SessionState>({
    isActive: true,
    lastActivity: Date.now(),
    timeUntilTimeout: timeoutMs,
    showWarning: false,
    isExpired: false,
  });

  const warningShownRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef(Date.now());

  // Activity handler
  const handleActivity = useCallback(() => {
    const now = Date.now();
    setState(prev => ({
      ...prev,
      lastActivity: now,
      timeUntilTimeout: timeoutMs,
      showWarning: false,
      isExpired: false,
    }));

    // Reset timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
    }

    warningShownRef.current = false;

    // Set new warning timer
    warningRef.current = setTimeout(() => {
      if (!warningShownRef.current) {
        setState(prev => ({ ...prev, showWarning: true }));
        warningShownRef.current = true;

        toast.warning('سيتم تسجيل خروجك تلقائياً خلال 5 دقائق بسبب عدم النشاط', {
          duration: 10000,
        });
      }
    }, timeoutMs - warningMs);

    // Set new timeout timer
    timeoutRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, isExpired: true, isActive: false }));

      if (autoLogout) {
        handleLogout();
      } else {
        toast.error('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.');
      }
    }, timeoutMs);
  }, [timeoutMs, warningMs, autoLogout]);

  // Setup activity listeners
  useEffect(() => {
    if (!enableActivityTracking) return;

    const events = activityEvents;

    const activityHandler = () => handleActivity();

    events.forEach(event => {
      document.addEventListener(event, activityHandler, true);
    });

    // Initial activity
    handleActivity();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, activityHandler, true);
      });

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningRef.current) {
        clearTimeout(warningRef.current);
      }
    };
  }, [enableActivityTracking, activityEvents, handleActivity]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      // Clear local session data
      localStorage.removeItem('session_start');
      localStorage.removeItem('last_activity');

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('[Session] Logout error:', error);
      }

      // Clear timers
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningRef.current) {
        clearTimeout(warningRef.current);
      }

      // Update state
      setState(prev => ({
        ...prev,
        isActive: false,
        isExpired: true,
      }));

      toast.success('تم تسجيل الخروج بنجاح');

      // Redirect to login
      window.location.href = '/login';
    } catch (error) {
      console.error('[Session] Logout failed:', error);
      toast.error('فشل في تسجيل الخروج');
    }
  }, []);

  // Extend session manually
  const extendSession = useCallback(() => {
    handleActivity();
    toast.success('تم تمديد الجلسة');
  }, [handleActivity]);

  // Reset session (for testing or manual reset)
  const resetSession = useCallback(() => {
    sessionStartRef.current = Date.now();
    handleActivity();
  }, [handleActivity]);

  // Get session information
  const getSessionInfo = useCallback(() => {
    const now = Date.now();
    return {
      startTime: sessionStartRef.current,
      lastActivity: state.lastActivity,
      timeoutMs,
      timeRemaining: Math.max(0, timeoutMs - (now - state.lastActivity)),
    };
  }, [state.lastActivity, timeoutMs]);

  // Update time until timeout every second
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        const now = Date.now();
        const timeRemaining = Math.max(0, timeoutMs - (now - prev.lastActivity));

        return {
          ...prev,
          timeUntilTimeout: timeRemaining,
          isExpired: timeRemaining === 0,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeoutMs]);

  // Persist session data
  useEffect(() => {
    localStorage.setItem('session_start', sessionStartRef.current.toString());
    localStorage.setItem('last_activity', state.lastActivity.toString());
  }, [state.lastActivity]);

  // Load persisted session data on mount
  useEffect(() => {
    const storedStart = localStorage.getItem('session_start');
    const storedActivity = localStorage.getItem('last_activity');

    if (storedStart && storedActivity) {
      const startTime = parseInt(storedStart);
      const lastActivity = parseInt(storedActivity);
      const now = Date.now();

      // Check if session is still valid
      if (now - lastActivity < timeoutMs) {
        sessionStartRef.current = startTime;
        setState(prev => ({
          ...prev,
          lastActivity,
          timeUntilTimeout: timeoutMs - (now - lastActivity),
        }));
      } else {
        // Session expired while away
        setState(prev => ({
          ...prev,
          isExpired: true,
          isActive: false,
        }));
      }
    }
  }, [timeoutMs]);

  return {
    isActive: state.isActive,
    timeUntilTimeout: state.timeUntilTimeout,
    showWarning: state.showWarning,
    isExpired: state.isExpired,
    extendSession,
    logout: handleLogout,
    resetSession,
    getSessionInfo,
  };
};

// Specialized hooks for different user types
export const useRiderSession = () => {
  return useSessionTimeout({
    timeoutMs: 45 * 60 * 1000, // 45 minutes for riders
    warningMs: 10 * 60 * 1000, // 10 minutes warning
  });
};

export const useDriverSession = () => {
  return useSessionTimeout({
    timeoutMs: 60 * 60 * 1000, // 1 hour for drivers (they might be driving)
    warningMs: 15 * 60 * 1000, // 15 minutes warning
  });
};

export const useAdminSession = () => {
  return useSessionTimeout({
    timeoutMs: 120 * 60 * 1000, // 2 hours for admins
    warningMs: 30 * 60 * 1000, // 30 minutes warning
  });
};

// Session warning component
export const SessionWarningModal = ({
  isOpen,
  onExtend,
  onLogout,
  timeRemaining,
}: {
  isOpen: boolean;
  onExtend: () => void;
  onLogout: () => void;
  timeRemaining: number;
}) => {
  if (!isOpen) return null;

  const minutes = Math.ceil(timeRemaining / 60000);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-2">تحذير انتهاء الجلسة</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          سيتم تسجيل خروجك تلقائياً خلال {minutes} دقيقة بسبب عدم النشاط.
          هل تريد تمديد الجلسة؟
        </p>
        <div className="flex gap-3">
          <button
            onClick={onExtend}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            تمديد الجلسة
          </button>
          <button
            onClick={onLogout}
            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    </div>
  );
};

// Session activity logger
export const logSessionActivity = (
  activity: string,
  details?: Record<string, any>
) => {
  const sessionInfo = {
    timestamp: new Date().toISOString(),
    activity,
    details,
    sessionId: localStorage.getItem('session_start'),
    userAgent: navigator.userAgent,
  };

  console.log('[Session Activity]', sessionInfo);

  // In production, this would send to analytics/monitoring service
};

// Security check for suspicious activity
export const checkSessionSecurity = async (): Promise<{
  isSecure: boolean;
  warnings: string[];
}> => {
  const warnings: string[] = [];

  // Check if user agent changed during session
  const storedUA = localStorage.getItem('session_user_agent');
  const currentUA = navigator.userAgent;

  if (storedUA && storedUA !== currentUA) {
    warnings.push('تغيير في بيانات المتصفح المكتشف');
  }

  // Check for multiple concurrent sessions (would require server-side check)
  try {
    const { data: sessions, error } = await supabase
      .from('user_sessions')
      .select('created_at')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (!error && sessions && sessions.length > 3) {
      warnings.push('جلسات متعددة مكتشفة');
    }
  } catch (error) {
    console.error('[Session Security] Check failed:', error);
  }

  // Store current user agent
  localStorage.setItem('session_user_agent', currentUA);

  return {
    isSecure: warnings.length === 0,
    warnings,
  };
};