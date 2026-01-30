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

  // Fetch Mapbox token - IMMEDIATELY on mount with timeout
  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const fetchToken = async () => {
      try {
        console.log("🗺️ Fetching Mapbox token...");
        
        // Create abort controller for timeout
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(
          "https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token",
          { 
            headers: { "Content-Type": "application/json" },
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.token && mounted) {
          console.log("✅ Mapbox token received");
          setMapToken(data.token);
          // Cache the token
          localStorage.setItem('mapbox_token', data.token);
        } else {
          throw new Error("No token in response");
        }
      } catch (error) {
        console.error("❌ Error fetching Mapbox token:", error);
        
        // Fallback: Try to use cached token or show error
        if (mounted) {
          // Check localStorage for cached token
          const cachedToken = localStorage.getItem('mapbox_token');
          if (cachedToken) {
            console.log("📦 Using cached Mapbox token");
            setMapToken(cachedToken);
          } else {
            toast({
              title: "⚠️ خطأ في تحميل الخريطة",
              description: "تعذر الاتصال بخادم الخرائط. يرجى التحقق من الاتصال.",
              variant: "destructive",
              duration: 5000,
            });
          }
        }
      }
    };

    // Fetch immediately
    fetchToken();

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [toast]);

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
