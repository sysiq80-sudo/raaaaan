/**
 * ران - Hook البيانات الأساسية
 * يدير بيانات المستخدم والـ Mapbox token والموقع
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { saveLastKnownLocation, getLastKnownLocation } from "@/services/lastKnownLocationService";

import type { User } from "@supabase/supabase-js";

export const useRiderData = () => {
  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [mapToken, setMapToken] = useState<string | null>(null);
  // ✅ تهيئة من آخر موقع مخزن — الخريطة تبدأ من الموقع الحقيقي فوراً
  const cachedLoc = getLastKnownLocation();
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(cachedLoc ? { lat: cachedLoc.lat, lng: cachedLoc.lng } : null);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Get user location - only after authentication
  // ✅ Lazy Loading: آخر موقع مخزن متاح فوراً، GPS يحدّثه عند الجاهزية
  useEffect(() => {
    if (!userId) return;

    let mounted = true;

    if (navigator.geolocation) {
      // Try high accuracy first (15 seconds timeout)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (mounted) {
            const loc = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setUserLocation(loc);
            // ✅ حفظ الموقع للاستخدام عند فقدان النت أو فتح التطبيق لاحقاً
            saveLastKnownLocation(loc.lat, loc.lng);
          }
        },
        (error) => {
          console.warn(
            "⚠️ High-accuracy geolocation failed:",
            error.code,
            error.message,
          );

          // Fallback: Try with lower accuracy (coarse - WiFi/Cell)
          if (mounted) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                if (mounted) {
                  const loc = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                  };
                  setUserLocation(loc);
                  saveLastKnownLocation(loc.lat, loc.lng);
                }
              },
              (fallbackError) => {
                console.warn(
                  "⚠️ Coarse geolocation also failed:",
                  fallbackError.message,
                );
              },
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
            );
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      );
    }

    return () => {
      mounted = false;
    };
  }, [userId, toast]);

  return {
    userId,
    user,
    mapToken,
    userLocation,
    menuOpen,
    setMenuOpen,
    setUser,
  };
};
