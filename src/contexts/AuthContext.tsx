/**
 * ران - Auth Context الموحد
 * يدير حالة المستخدم والجلسات والأجهزة
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type UserRole = "rider" | "driver" | "admin" | null;
export type UserType = "rider" | "driver" | "admin";

interface AuthContextType {
  // User data
  user: User | null;
  userRole: UserRole;
  isLoading: boolean;
  isOnboardingComplete: boolean;
  isLocationEnabled: boolean;
  
  // Session management
  deviceId: string | null;
  isMultiDeviceConflict: boolean;
  
  // Methods
  setUserRole: (role: UserRole) => void;
  setIsOnboardingComplete: (complete: boolean) => void;
  setIsLocationEnabled: (enabled: boolean) => void;
  logout: () => Promise<void>;
  
  // Rider-to-Driver switching
  canSwitchToDriver: boolean;
  switchToDriver: () => Promise<boolean>;
  switchToRider: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Safety-net timeout: if onAuthStateChange never fires, stop loading after 4s
// 10 ثواني كانت طويلة جداً على الجوال — المستخدم يظن التطبيق معلق
const SAFETY_TIMEOUT = 4000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  
  // User state
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  
  // Session state
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isMultiDeviceConflict, setIsMultiDeviceConflict] = useState(false);
  const [canSwitchToDriver, setCanSwitchToDriver] = useState(false);

  // Generate device ID
  const generateDeviceId = useCallback(() => {
    const stored = localStorage.getItem("raan_device_id");
    if (stored) return stored;
    
    const newId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("raan_device_id", newId);
    return newId;
  }, []);

  // Check onboarding status
  useEffect(() => {
    const status = localStorage.getItem("raan_onboarding_completed") === "true";
    setIsOnboardingComplete(status);
  }, []);

  // Check location permission
  useEffect(() => {
    const checkLocation = async () => {
      if (!user) return;
      
      try {
        const permission = await navigator.permissions.query({ name: "geolocation" });
        setIsLocationEnabled(permission.state === "granted");
      } catch (error) {
        console.error("Error checking location permission:", error);
      }
    };

    checkLocation();
  }, [user]);

  // Detect user role (admin, rider, or driver)
  const detectUserRole = useCallback(async (userId: string): Promise<UserRole> => {
    try {
      // 1. تحقق من صلاحية المدير أولاً عبر جدول user_roles
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (adminRole) {
        return "admin";
      }

      // 2. تحقق إذا كان المستخدم سائق
      const { data: driver } = await supabase
        .from("drivers")
        .select("status")
        .eq("user_id", userId)
        .maybeSingle();

      if (driver) {
        setCanSwitchToDriver(driver.status === "approved");
        return "rider"; // الدور الافتراضي راكب مع إمكانية التبديل للسائق
      }

      return "rider"; // Default
    } catch (error) {
      console.error("Error detecting user role:", error);
      return "rider";
    }
  }, []);

  // Monitor device sessions and prevent multiple logins
  const monitorDeviceSessions = useCallback(async (userId: string) => {
    try {
      const currentDeviceId = generateDeviceId();
      setDeviceId(currentDeviceId);

      // Simple device session tracking via localStorage
      const sessionsKey = `raan_sessions_${userId}`;
      const sessions = JSON.parse(localStorage.getItem(sessionsKey) || "[]");
      
      const existingDevice = sessions.find((s: any) => s.device_id === currentDeviceId);
      
      if (!existingDevice && sessions.length > 0) {
        // Different device detected
        setIsMultiDeviceConflict(true);
      }

      // Update sessions
      const newSessions = [
        ...sessions.filter((s: any) => s.device_id !== currentDeviceId),
        {
          device_id: currentDeviceId,
          is_active: true,
          last_activity: new Date().toISOString(),
        }
      ];
      
      localStorage.setItem(sessionsKey, JSON.stringify(newSessions));
    } catch (error) {
      console.error("Error monitoring device sessions:", error);
    }
  }, [generateDeviceId]);

  // Auth state listener - uses both onAuthStateChange AND getSession for reliability
  // onAuthStateChange (INITIAL_SESSION) is the primary mechanism
  // getSession() is a fallback in case INITIAL_SESSION doesn't fire
  useEffect(() => {
    let isMounted = true;
    let authResolved = false; // Prevents double-processing from both mechanisms

    // Safety-net: force loading off if nothing works (e.g. network completely down)
    const safetyTimer = setTimeout(() => {
      if (isMounted && !authResolved) {
        console.warn("[AuthContext] Safety timeout reached (10s), forcing loading complete");
        authResolved = true;
        setIsLoading(false);
      }
    }, SAFETY_TIMEOUT);

    // Helper: process a session (used by both onAuthStateChange and getSession)
    const processSession = async (session: any, source: string) => {
      if (!isMounted) return;

      if (session?.user) {
        console.log(`[AuthContext] Session found via ${source}:`, session.user.id);
        setUser(session.user);

        // كشف الدور قبل إنهاء التحميل لمنع حلقات إعادة التوجيه
        try {
          const role = await detectUserRole(session.user.id);
          if (isMounted) {
            setUserRole(role);
            // استعادة الدور المحفوظ في localStorage إذا متاح
            const savedRole = localStorage.getItem("raan_current_role");
            if (savedRole === "driver" && role === "rider") {
              setUserRole("driver");
            }
          }
        } catch (roleError) {
          console.error("[AuthContext] Role detection error:", roleError);
          if (isMounted) setUserRole("rider");
        }

        // إنهاء التحميل بعد تحديد الدور
        if (isMounted) setIsLoading(false);

        // Monitor device sessions (non-blocking)
        monitorDeviceSessions(session.user.id).catch(() => {});
      } else if (source === "INITIAL_SESSION" || source === "getSession" || source === "SIGNED_OUT") {
        // No user — clear state
        if (source === "SIGNED_OUT") {
          console.log("[AuthContext] User signed out, clearing state");
          setUser(null);
          setUserRole(null);
          localStorage.removeItem("raan_current_role");
        } else {
          console.log(`[AuthContext] No session found (${source})`);
        }
        setIsLoading(false);
      }
    };

    // 1) Subscribe to auth changes — fires INITIAL_SESSION on startup
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session) => {
        if (!isMounted) return;
        console.log("[AuthContext] Auth event:", event);
        clearTimeout(safetyTimer);

        if (!authResolved || event !== "INITIAL_SESSION") {
          // For INITIAL_SESSION, mark as resolved so getSession fallback skips
          if (event === "INITIAL_SESSION") authResolved = true;
          await processSession(session, event);
        }
      }
    );

    // 2) Fallback: getSession() مع timeout خاص — لمنع التعليق على شبكة بطيئة
    const getSessionWithTimeout = () => {
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 3000); // 3 ثواني كحد أقصى
      });
      const sessionPromise = supabase.auth.getSession()
        .then(({ data: { session } }) => session)
        .catch(() => null);

      return Promise.race([sessionPromise, timeoutPromise]);
    };

    getSessionWithTimeout().then((session) => {
      if (!isMounted || authResolved) return;
      console.log("[AuthContext] getSession fallback resolving", session ? 'with user' : 'no user');
      authResolved = true;
      clearTimeout(safetyTimer);
      processSession(session ? { user: (session as any).user || session } : null, "getSession");
    }).catch((err) => {
      console.error("[AuthContext] getSession error:", err);
      if (isMounted && !authResolved) {
        authResolved = true;
        clearTimeout(safetyTimer);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
    // ✅ CRITICAL: Only include functions, NOT state values
    // This prevents infinite loops from state changes
  }, [detectUserRole, monitorDeviceSessions]);

  // Logout
  const logout = useCallback(async () => {
    try {
      // Mark session as inactive in localStorage
      if (deviceId) {
        const user = await supabase.auth.getUser();
        if (user.data.user) {
          const sessionsKey = `raan_sessions_${user.data.user.id}`;
          const sessions = JSON.parse(localStorage.getItem(sessionsKey) || "[]");
          const updated = sessions.map((s: any) => 
            s.device_id === deviceId ? { ...s, is_active: false } : s
          );
          localStorage.setItem(sessionsKey, JSON.stringify(updated));
        }
      }

      // Sign out
      await supabase.auth.signOut();
      setUser(null);
      setUserRole(null);
      localStorage.removeItem("raan_current_role");
    } catch (error) {
      console.error("Error logging out:", error);
      toast({
        title: "خطأ في تسجيل الخروج",
        variant: "destructive",
      });
    }
  }, [deviceId, toast]);

  // Switch to driver mode — returns true if succeeded, false if not
  const switchToDriver = useCallback(async (): Promise<boolean> => {
    if (!canSwitchToDriver) {
      toast({
        title: "لم تتم الموافقة عليك كسائق بعد",
        description: "يمكنك التسجيل كسائق أولاً",
        variant: "destructive",
      });
      return false;
    }

    setUserRole("driver");
    localStorage.setItem("raan_current_role", "driver");
    return true;
  }, [canSwitchToDriver, toast]);

  // Switch to rider mode
  const switchToRider = useCallback(() => {
    setUserRole("rider");
    localStorage.setItem("raan_current_role", "rider");
  }, []);

  const value: AuthContextType = {
    user,
    userRole,
    isLoading,
    isOnboardingComplete,
    isLocationEnabled,
    deviceId,
    isMultiDeviceConflict,
    setUserRole,
    setIsOnboardingComplete,
    setIsLocationEnabled,
    logout,
    canSwitchToDriver,
    switchToDriver,
    switchToRider,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
