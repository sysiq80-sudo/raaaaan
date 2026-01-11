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

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch(
          "https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token",
          { headers: { "Content-Type": "application/json" } }
        );
        const data = await response.json();
        if (data.token) {
          setMapToken(data.token);
        } else {
          throw new Error("No token received");
        }
      } catch (error) {
        console.error("Error fetching Mapbox token:", error);
        toast({
          title: "خطأ في الخريطة",
          description: "فشل تحميل الخريطة. الرجاء إعادة المحاولة",
          variant: "destructive",
        });
      }
    };

    fetchToken();
  }, [toast]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Geolocation error:", error);
          toast({
            title: "خطأ في الموقع",
            description: "لم نتمكن من تحديد موقعك. الرجاء تفعيل خدمة الموقع",
            variant: "destructive",
          });
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
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
