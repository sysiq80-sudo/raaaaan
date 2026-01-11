/**
 * ران - Hook البحث والأماكن المحفوظة
 * يدير البحث عن المواقع والأماكن المحفوظة
 */

import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { debounce } from "@/lib/debounce";

interface SavedPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  icon?: string;
}

interface LocationType {
  lat: number;
  lng: number;
  address: string;
}

export const useSearchAndPlaces = (userId: string | null) => {
  const { toast } = useToast();
  const debouncedSearchRef = useRef<ReturnType<typeof debounce>>();

  const [searchQuery, setSearchQuery] = useState("");
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [loadingSavedPlaces, setLoadingSavedPlaces] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch saved places
  const fetchSavedPlaces = useCallback(
    async (userId: string) => {
      setLoadingSavedPlaces(true);
      try {
        const { data, error } = await supabase
          .from("saved_places")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        setSavedPlaces(data || []);
      } catch (error) {
        console.error("Error fetching saved places:", error);
        toast({
          title: "خطأ في جلب الأماكن",
          description: "فشل في تحميل الأماكن المحفوظة",
          variant: "destructive",
        });
      } finally {
        setLoadingSavedPlaces(false);
      }
    },
    [toast]
  );

  // Load saved places on mount
  useEffect(() => {
    if (userId) {
      fetchSavedPlaces(userId);
    }
  }, [userId, fetchSavedPlaces]);

  // Initialize debounced search
  useEffect(() => {
    const handleDebouncedSearch = debounce((query: string) => {
      setIsSearching(false);
      // يمكن إضافة logic للبحث الفعلي هنا
    }, 500); // انتظر 500ms بعد آخر تغيير

    debouncedSearchRef.current = handleDebouncedSearch;

    return () => {
      if (debouncedSearchRef.current) {
        // تنظيف
      }
    };
  }, []);

  // Handle search input change with debounce
  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
    setIsSearching(true);
    if (debouncedSearchRef.current) {
      debouncedSearchRef.current(query);
    }
  }, []);

  // Handle search location selection
  const handleSearchSelect = useCallback((location: LocationType) => {
    setSearchQuery("");
    return location;
  }, []);

  // Handle saved place selection
  const handleSavedPlaceSelect = useCallback((place: SavedPlace) => {
    const location: LocationType = {
      lat: place.lat,
      lng: place.lng,
      address: place.address,
    };
    return location;
  }, []);

  // Save a new place
  const savePlace = useCallback(
    async (place: Omit<SavedPlace, "id">) => {
      if (!userId) return false;

      try {
        const { error } = await supabase.from("saved_places").insert({
          ...place,
          user_id: userId,
          label: place.name, // استخدام name كـ label
        });

        if (error) throw error;

        await fetchSavedPlaces(userId);
        toast({
          title: "تم الحفظ ✅",
          description: `تم حفظ الموقع: ${place.name}`,
        });
        return true;
      } catch (error) {
        console.error("Error saving place:", error);
        toast({
          title: "خطأ في الحفظ",
          description: "فشل في حفظ الموقع",
          variant: "destructive",
        });
        return false;
      }
    },
    [userId, fetchSavedPlaces, toast]
  );

  return {
    searchQuery,
    setSearchQuery,
    handleSearchQueryChange,
    isSearching,
    savedPlaces,
    loadingSavedPlaces,
    handleSearchSelect,
    handleSavedPlaceSelect,
    savePlace,
    fetchSavedPlaces,
  };
};
