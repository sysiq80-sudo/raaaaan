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

  // Fetch user ID and basic info
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          setUserId(session.user.id);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUserData();
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

  // Get user location - IMMEDIATELY on mount with faster timeout
  useEffect(() => {
    let mounted = true;

    if (navigator.geolocation) {
      console.log("📍 Requesting user location...");
      
      // Try high accuracy first (5 seconds)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (mounted) {
            console.log(
              "✅ User location received:",
              position.coords.latitude,
              position.coords.longitude
            );
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          }
        },
        (error) => {
          console.error("❌ Geolocation error:", error.code, error.message);
          
          // Fallback: Try with lower accuracy
          if (mounted) {
            console.log("📍 Retrying with low accuracy...");
            navigator.geolocation.getCurrentPosition(
              (position) => {
                if (mounted) {
                  console.log("✅ Location received (low accuracy)");
                  setUserLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                  });
                }
              },
              (fallbackError) => {
                console.error("❌ Fallback geolocation failed:", fallbackError);
                // Use default location (Baghdad center)
                if (mounted) {
                  console.log("📍 Using default location (Baghdad)");
                  setUserLocation({ lat: 33.3152, lng: 44.3661 });
                }
              },
              { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
            );
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      console.warn("⚠️ Geolocation not supported - using default location");
      setUserLocation({ lat: 33.3152, lng: 44.3661 }); // Baghdad
    }

    return () => {
      mounted = false;
    };
  }, [toast]);

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
