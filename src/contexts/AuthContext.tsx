/**
 * ران - Auth Context الموحد
 * يدير حالة المستخدم والجلسات والأجهزة
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { setSentryUser, clearSentryUser } from "@/lib/sentry";
import { isNativePlatform } from "@/lib/capacitorBridge";

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
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(
    () => localStorage.getItem("raan_onboarding_completed") === "true"
  );
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  
  // ✅ FIX: Ref لتتبع المستخدم الحالي دائماً — يحل مشكلة stale closure في onAuthStateChange
  const userRef = React.useRef<User | null>(null);

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

  // ✅ تم نقل قراءة حالة onboarding إلى useState initializer لمنع الوميض

  // Check location permission — ✅ تخطي فحص الموقع في لوحة تحكم الأدمن
  useEffect(() => {
    const checkLocation = async () => {
      if (!user) return;
      
      // ✅ الأدمن لا يحتاج صلاحية الموقع الجغرافي
      const isAdminPanel = window.location.pathname.startsWith("/admin");
      if (isAdminPanel) {
        console.log("[AuthContext] Skipping geolocation check for admin panel");
        return;
      }
      
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
      // ✅ تشغيل الطلبات بالتوازي لتسريع الكشف
      const [
        { data: { user: authUser } },
        { data: adminRole },
        { data: driver },
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
        supabase.from("drivers").select("status").eq("user_id", userId).maybeSingle(),
      ]);

      const email = authUser?.email || "";
      const isPhoneAccount = (
        email.endsWith("@raan.app") ||
        email.endsWith("@driver.raan.app") ||
        email.endsWith("@whatsapp.raan.app")
      );
      const isDriverDomain = email.endsWith("@driver.raan.app");

      // 1. تحقق من صلاحية الأدمن (فقط الإيميلات الحقيقية)
      if (!isPhoneAccount && adminRole) {
        return "admin";
      }

      // 2. تحقق إذا كان المستخدم سائق
      if (driver) {
        setCanSwitchToDriver(driver.status === "approved");
        if (isDriverDomain || driver.status === "approved") {
          return "driver";
        }
        return "rider";
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
        console.warn("[AuthContext] Safety timeout reached (4s), forcing loading complete");
        authResolved = true;
        setIsLoading(false);
      }
    }, SAFETY_TIMEOUT);

    // Helper: process a session (used by both onAuthStateChange and getSession)
    const processSession = async (session: any, source: string) => {
      if (!isMounted) return;

      if (session?.user) {
        // تحقق من خيار "ابقَني مسجلاً" — فقط على الويب
        // على Capacitor يتم الاحتفاظ بالجلسة دائماً لأن sessionStorage يُمسح عند إعادة تشغيل التطبيق
        if (!isNativePlatform) {
          const rememberMe = localStorage.getItem("raan_remember_me");
          const sessionAlive = sessionStorage.getItem("raan_session_alive");
          if (
            rememberMe === "false" &&
            sessionAlive !== "1" &&
            (source === "INITIAL_SESSION" || source === "getSession")
          ) {
            console.log("[AuthContext] Session expired (remember-me=false, browser restarted) — signing out");
            await supabase.auth.signOut();
            if (isMounted) setIsLoading(false);
            return;
          }
        }

        console.log(`[AuthContext] Session found via ${source}:`, session.user.id);
        setUser(session.user);
        userRef.current = session.user; // ✅ sync ref

        // ✅ INSTANT LOAD: لا نحجب التطبيق على الشبكة أبداً
        // 1. ابحث عن الدور المخزن (cache أو raan_current_role)
        const cacheKey = `raan_role_${session.user.id}`;
        const cachedRole = (localStorage.getItem(cacheKey) || localStorage.getItem("raan_current_role")) as UserRole;

        // ✅ في التطبيقات المستقلة — فرض الدور حسب نوع التطبيق فوراً
        const appMode = typeof __APP_MODE__ !== 'undefined' ? __APP_MODE__ : null;
        const immediateRole: UserRole = appMode === 'rider' ? 'rider' : appMode === 'driver' ? 'driver' : (cachedRole || "rider");

        if (isMounted) {
          console.log(`[AuthContext] Immediate role (cache): ${immediateRole}`);
          setUserRole(immediateRole);
          setSentryUser({ id: session.user.id, email: session.user.email, role: immediateRole });
          setIsLoading(false); // أوقف التحميل فوراً — بدون انتظار الشبكة
        }

        // 2. تحقق من الدور الحقيقي في الخلفية (non-blocking)
        detectUserRole(session.user.id).then((freshRole) => {
          if (!isMounted || !freshRole) return;

          // ✅ في التطبيقات المستقلة (APK) — فرض الدور حسب نوع التطبيق
          const appMode = typeof __APP_MODE__ !== 'undefined' ? __APP_MODE__ : null;
          const effectiveRole = appMode === 'rider' ? 'rider' : appMode === 'driver' ? 'driver' : freshRole;

          localStorage.setItem(cacheKey, effectiveRole);
          if (effectiveRole !== immediateRole) {
            console.log(`[AuthContext] Role corrected in background: ${immediateRole} → ${effectiveRole}`);
            setUserRole(effectiveRole);
            setSentryUser({ id: session.user.id, email: session.user.email, role: effectiveRole });
          }
        }).catch((err) => {
          console.error("[AuthContext] Background role detection error:", err);
        });

        // Monitor device sessions (non-blocking)
        monitorDeviceSessions(session.user.id).catch(() => {});
      } else if (source === "INITIAL_SESSION" || source === "getSession" || source === "SIGNED_OUT") {
        // No user — clear state
        if (source === "SIGNED_OUT") {
          console.log("[AuthContext] User signed out, clearing state");
          setUser(null);
          setUserRole(null);
          clearSentryUser();
          // حذف role cache للمستخدم الحالي
          const uid = userRef.current?.id;
          if (uid) localStorage.removeItem(`raan_role_${uid}`);
          localStorage.removeItem("raan_current_role");
          localStorage.removeItem("raan_remember_me");
          sessionStorage.removeItem("raan_session_alive");
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

        // ✅ عند تحديث التوكن فقط: حدّث الـ user بدون إعادة كشف الدور
        if (event === "TOKEN_REFRESHED" && session?.user) {
          const currentUserId = userRef.current?.id; // ✅ قراءة من Ref لتجنب stale closure
          if (currentUserId && currentUserId === session.user.id) {
            console.log("[AuthContext] TOKEN_REFRESHED for same user — skipping role re-detection");
            setUser(session.user);
            userRef.current = session.user;
            if (isMounted) setIsLoading(false);
            return;
          }
        }

        // ✅ FIX: تجاهل SIGNED_IN إذا كان المستخدم نفسه محمل مسبقاً
        // يمنع استدعاء detectUserRole مرة ثانية بدون ضرورة
        if (event === "SIGNED_IN" && authResolved && session?.user?.id === userRef.current?.id) {
          console.log("[AuthContext] SIGNED_IN for same user already loaded — skipping");
          if (isMounted) setIsLoading(false);
          return;
        }

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
