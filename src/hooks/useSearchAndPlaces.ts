/**
 * ران - Hook البحث الديناميكي عبر الخريطة
 * يوفر بحثاً مباشراً عبر Google Places API بدون أماكن محفوظة
 */

import { useDynamicPlacesSearch } from "./useDynamicPlacesSearch";

export const useSearchAndPlaces = (
  userLocation: { lat: number; lng: number } | null
) => {
  const {
    searchQuery,
    setSearchQuery,
    predictions,
    isSearching,
    isLoadingDetails,
    isOffline,
    getPlaceDetails,
    clearSearch,
  } = useDynamicPlacesSearch(userLocation);

  return {
    searchQuery,
    setSearchQuery,
    predictions,
    isSearching,
    isLoadingDetails,
    isOffline,
    getPlaceDetails,
    clearSearch,
  };
};
