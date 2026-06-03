/**
 * ران - Hook البيانات الأساسية
 * يدير بيانات المستخدم والـ Mapbox token والموقع
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { saveLastKnownLocation, getLastKnownLocation } from "@/services/lastKnownLocationService";

import type { User } from "@supabase/supabase-js";

/** الحد الأدنى للمسافة (بالمتر) لتحديث الموقع — يمنع jitter */
const MIN_MOVE_THRESHOLD_M = 3;

/** Haversine distance بين نقطتين (بالمتر) */
const haversineM = (
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number => {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const useRiderData = () => {
  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [mapToken, setMapToken] = useState<string | null>("google-maps"); // ⚡ قيمة ثابتة — لا حاجة لبدء بـ null
  // ✅ تهيئة من آخر موقع مخزن — الخريطة تبدأ من الموقع الحقيقي فوراً
  const cachedLoc = getLastKnownLocation();
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(cachedLoc ? { lat: cachedLoc.lat, lng: cachedLoc.lng } : null);
  const [userAccuracy, setUserAccuracy] = useState<number>(50); // دقة GPS بالمتر
  const [menuOpen, setMenuOpen] = useState(false);

  // Ref لآخر موقع مُبلّغ عنه — لتجنب setState عند حركات أقل من العتبة
  const lastReportedRef = useRef<{ lat: number; lng: number } | null>(
    cachedLoc ? { lat: cachedLoc.lat, lng: cachedLoc.lng } : null,
  );

  /** تحديث الموقع فقط إذا تحرك المستخدم بما يكفي */
  const updateIfMoved = useCallback(
    (lat: number, lng: number, accuracy?: number) => {
      const last = lastReportedRef.current;
      if (last && haversineM(last.lat, last.lng, lat, lng) < MIN_MOVE_THRESHOLD_M) {
        // لم يتحرك بما يكفي — تحديث الدقة فقط
        if (accuracy !== undefined) setUserAccuracy(accuracy);
        return;
      }
      lastReportedRef.current = { lat, lng };
      setUserLocation({ lat, lng });
      if (accuracy !== undefined) setUserAccuracy(accuracy);
      saveLastKnownLocation(lat, lng);
    },
    [],
  );

  // Fetch user ID and basic info + listen for auth changes
  useEffect(() => {
    let mounted = true;

    const fetchUserData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (mounted && session?.user) {
          setUser(session.user);
          setUserId(session.user.id);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUserData();

    // ✅ الإصغاء لتغييرات المصادقة لمنع userId من أن يصبح قديماً
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        setUserId(session.user.id);
      } else if (_event === "SIGNED_OUT") {
        setUser(null);
        setUserId(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // No need to fetch Mapbox token anymore - using Google Maps API
  // This is kept for compatibility but now just initializes as ready
  useEffect(() => {
    let mounted = true;

    const initializeMapToken = () => {
      if (mounted) {
        setMapToken("google-maps"); // Dummy token to indicate readiness
      }
    };

    initializeMapToken();

    return () => {
      mounted = false;
    };
  }, []);

  // ✅ GPS: موقع أولي سريع + مراقبة مستمرة (مثل النقطة الزرقاء في جوجل ماب)
  // يستخدم Capacitor Geolocation (native) أولاً ثم navigator.geolocation كبديل
  useEffect(() => {
    let mounted = true;
    let webWatchId: number | null = null;
    let capWatchId: string | null = null;

    const startTracking = async () => {
      try {
        // ═══ Capacitor Native ═══
        const { Geolocation } = await import('@capacitor/geolocation');
        
        // طلب الصلاحيات أولاً لضمان إتاحة التتبع الجغرافي داخل الويب فيو
        const checkPerm = await Geolocation.checkPermissions();
        if (checkPerm.location !== 'granted' && checkPerm.coarseLocation !== 'granted') {
          const reqPerm = await Geolocation.requestPermissions();
          if (reqPerm.location !== 'granted' && reqPerm.coarseLocation !== 'granted') {
            throw new Error("PERMISSION_DENIED");
          }
        }

        if (!mounted) return;
        
        // 1️⃣ طلب سريع بدقة منخفضة — يظهر النقطة فوراً
        const quickPos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 5000,
        });
        
        if (!mounted) return;
        updateIfMoved(
          quickPos.coords.latitude,
          quickPos.coords.longitude,
          quickPos.coords.accuracy ?? 50,
        );

        // 2️⃣ طلب ثانٍ بدقة عالية لتحسين الموقع الأولي
        try {
          const refinePos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15000,
          });
          if (!mounted) return;
          if (refinePos.coords.accuracy < quickPos.coords.accuracy) {
            updateIfMoved(
              refinePos.coords.latitude,
              refinePos.coords.longitude,
              refinePos.coords.accuracy ?? 30,
            );
          }
        } catch {
          /* دقة عالية فشلت، نحتفظ بالدقة المنخفضة */
        }

        // 3️⃣ مراقبة مستمرة — تحديث النقطة الخضراء في الوقت الحقيقي
        capWatchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true },
          (pos, err) => {
            if (!mounted || err || !pos) return;
            updateIfMoved(
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.accuracy ?? 30,
            );
          },
        );
      } catch (capError) {
        // ═══ Capacitor غير متوفر (Web) — navigator.geolocation ═══
        console.warn("⚠️ Capacitor Geolocation unavailable, falling back to navigator:", capError);
        if (!navigator.geolocation) return;

        // طلب أولي سريع
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (!mounted) return;
            updateIfMoved(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.accuracy ?? 50,
            );
          },
          (error) => {
            console.warn("⚠️ Navigator geolocation initial fix failed:", error.code, error.message);
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
        );

        // مراقبة مستمرة عبر Web API
        webWatchId = navigator.geolocation.watchPosition(
          (position) => {
            if (!mounted) return;
            updateIfMoved(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.accuracy ?? 30,
            );
          },
          (error) => {
            console.warn("⚠️ Navigator watchPosition error:", error.code, error.message);
          },
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
        );
      }
    };

    startTracking();

    return () => {
      mounted = false;
      // تنظيف Web watch
      if (webWatchId !== null) {
        navigator.geolocation.clearWatch(webWatchId);
      }
      // تنظيف Capacitor watch
      if (capWatchId !== null) {
        import('@capacitor/geolocation').then(({ Geolocation }) => {
          Geolocation.clearWatch({ id: capWatchId! });
        }).catch(() => { /* ignore */ });
      }
    };
  }, [updateIfMoved]);

  return {
    userId,
    user,
    mapToken,
    userLocation,
    userAccuracy,
    menuOpen,
    setMenuOpen,
    setUser,
  };
};

