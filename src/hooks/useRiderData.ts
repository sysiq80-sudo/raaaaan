/**
 * ران - Hook البيانات الأساسية
 * يدير بيانات المستخدم والـ Mapbox token والموقع
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

type User = {
  id: string;
  email?: string;
};

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

  // Fetch Mapbox token - IMMEDIATELY on mount
  useEffect(() => {
    let mounted = true;

    const fetchToken = async () => {
      try {
        console.log("Fetching Mapbox token...");
        const response = await fetch(
          "https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token",
          { headers: { "Content-Type": "application/json" } }
        );
        const data = await response.json();
        if (data.token && mounted) {
          console.log("Mapbox token received");
          setMapToken(data.token);
        } else {
          throw new Error("No token received");
        }
      } catch (error) {
        console.error("Error fetching Mapbox token:", error);
        // تم إلغاء التنبيه المنبثق - الحالة تظهر في الأيقونات
      }
    };

    // Fetch immediately
    fetchToken();

    return () => {
      mounted = false;
    };
  }, [toast]);

  // Get user location - IMMEDIATELY on mount
  useEffect(() => {
    let mounted = true;

    if (navigator.geolocation) {
      console.log("Requesting user location...");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (mounted) {
            console.log(
              "User location received:",
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
          console.error("Geolocation error:", error);
          // تم إلغاء التنبيه المنبثق - الحالة تظهر في الأيقونات
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      console.warn("Geolocation not supported");
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
