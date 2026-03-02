/**
 * ران - Hook البيانات الأساسية
 * يدير بيانات المستخدم والـ Mapbox token والموقع
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

import type { User } from "@supabase/supabase-js";

export const useRiderData = () => {
  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
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
        console.log("✅ Using Google Maps API - token initialization complete");
        setMapToken("google-maps"); // Dummy token to indicate readiness
      }
    };

    // Call immediately - no network request needed
    initializeMapToken();

    return () => {
      mounted = false;
    };
  }, []);

  // Get user location - only after authentication
  // ✅ Lazy Loading: set default immediately, then update when GPS resolves
  useEffect(() => {
    // ✅ Guard: لا تطلب الموقع الجغرافي إن لم يكن المستخدم مسجلاً
    if (!userId) return;

    // ⚡ Set default location IMMEDIATELY so the map can render instantly
    // This will be overwritten once GPS resolves
    setUserLocation({ lat: 33.4233, lng: 43.2974 }); // Ramadi center

    let mounted = true;

    if (navigator.geolocation) {
      console.log("📍 Requesting user location (non-blocking)...");

      // Try high accuracy first (15 seconds timeout)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (mounted) {
            console.log(
              "✅ User location received:",
              position.coords.latitude,
              position.coords.longitude,
            );
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
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
            console.log("📍 Falling back to coarse location (WiFi/Cell)...");
            navigator.geolocation.getCurrentPosition(
              (position) => {
                if (mounted) {
                  console.log("✅ Coarse location received");
                  setUserLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                  });
                }
              },
              (fallbackError) => {
                console.warn(
                  "⚠️ Coarse geolocation also failed:",
                  fallbackError.message,
                );
                // Default location already set above - no crash
              },
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
            );
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      );
    } else {
      console.warn("⚠️ Geolocation not supported - using default location");
      // Default already set above
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
