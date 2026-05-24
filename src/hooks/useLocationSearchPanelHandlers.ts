import { useCallback, useMemo } from "react";
import { checkDestinationGeofence, type GeofenceResult } from "@/lib/geofencing";
import type { PlaceDetails, PlacePrediction } from "@/hooks/useDynamicPlacesSearch";
import type { RecentSearch } from "@/hooks/useRecentSearches";
import type { ServiceAreaCheck } from "@/hooks/useLocationPicker";
import type { SmartSuggestion, UnifiedSearchResult } from "@/hooks/useUnifiedSearch";

interface SearchLocation {
  lat: number;
  lng: number;
  address: string;
}

interface SearchCategory {
  id: string;
  keyword: string;
}

interface SearchSavedPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface UnifiedSearchAdapter {
  searchLocal: (query: string, recentSearches: RecentSearch[]) => UnifiedSearchResult[];
  mergeResults: (localResults: UnifiedSearchResult[], googleResults?: PlacePrediction[]) => UnifiedSearchResult[];
  getSmartSuggestions: () => SmartSuggestion[];
  getNearbyLandmarks: (limit?: number) => UnifiedSearchResult[];
}

interface UseLocationSearchPanelHandlersParams {
  query: string;
  activeCategory: string | null;
  recentSearches: RecentSearch[];
  predictions: PlacePrediction[];
  unifiedSearch: UnifiedSearchAdapter;
  centerAddress: string;
  centerLat: number | null;
  centerLng: number | null;
  mapToken: string | null;
  setQuery: (value: string) => void;
  setSearchQuery: (value: string) => void;
  setIsLocationFocused: (value: boolean) => void;
  setActiveCategory: (value: string | null) => void;
  setPanelExpanded: (value: boolean) => void;
  setCenterAddress: (value: string) => void;
  setManualAddress: (value: string) => void;
  setLocalServiceAreaStatus: (value: ServiceAreaCheck | null) => void;
  setShowSaveModal: (value: boolean) => void;
  setGeofenceResult: (value: GeofenceResult) => void;
  setShowGeofenceAlert: (value: boolean) => void;
  clearSearch: () => void;
  manualGeolocateMain: (forceHardRequest?: boolean) => void | Promise<void>;
  getPlaceDetails: (placeId: string) => Promise<PlaceDetails | null>;
  addRecentSearch: (search: Omit<RecentSearch, "id" | "timestamp">) => void;
  applySelectedLocation: (location: SearchLocation) => boolean;
}

export const useLocationSearchPanelHandlers = ({
  query,
  activeCategory,
  recentSearches,
  predictions,
  unifiedSearch,
  centerAddress,
  centerLat,
  centerLng,
  mapToken,
  setQuery,
  setSearchQuery,
  setIsLocationFocused,
  setActiveCategory,
  setPanelExpanded,
  setCenterAddress,
  setManualAddress,
  setLocalServiceAreaStatus,
  setShowSaveModal,
  setGeofenceResult,
  setShowGeofenceAlert,
  clearSearch,
  manualGeolocateMain,
  getPlaceDetails,
  addRecentSearch,
  applySelectedLocation,
}: UseLocationSearchPanelHandlersParams) => {
  const unifiedResults = useMemo(
    () => query
      ? unifiedSearch.mergeResults(
          unifiedSearch.searchLocal(query, recentSearches),
          predictions ?? [],
        )
      : undefined,
    [predictions, query, recentSearches, unifiedSearch],
  );

  const smartSuggestions = useMemo(
    () => unifiedSearch.getSmartSuggestions(),
    [unifiedSearch],
  );

  const nearbyLandmarks = useMemo(
    () => unifiedSearch.getNearbyLandmarks(5),
    [unifiedSearch],
  );

  const applyGeofencedLocation = useCallback(
    async (location: SearchLocation) => {
      const geofenceCheck = await checkDestinationGeofence(location.lat, location.lng, mapToken ?? undefined);
      if (!geofenceCheck.allowed) {
        setGeofenceResult(geofenceCheck);
        setShowGeofenceAlert(true);
        return;
      }

      applySelectedLocation(location);
    },
    [applySelectedLocation, mapToken, setGeofenceResult, setShowGeofenceAlert],
  );

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      setSearchQuery(value);
      if (value) setIsLocationFocused(true);
      if (!value) setActiveCategory(null);
    },
    [setActiveCategory, setIsLocationFocused, setQuery, setSearchQuery],
  );

  const handleClear = useCallback(() => {
    setQuery("");
    clearSearch();
    setIsLocationFocused(false);
    setCenterAddress("");
    setManualAddress("");
    setActiveCategory(null);
  }, [clearSearch, setActiveCategory, setCenterAddress, setIsLocationFocused, setManualAddress, setQuery]);

  const handleFocus = useCallback(() => {
    setIsLocationFocused(true);
    setPanelExpanded(true);
  }, [setIsLocationFocused, setPanelExpanded]);

  const handleAddressClick = useCallback(() => {
    if (!centerAddress || centerAddress.includes("بدون اسم") || centerAddress.includes("غير مفعل")) {
      manualGeolocateMain(true);
    } else {
      setIsLocationFocused(true);
    }
  }, [centerAddress, manualGeolocateMain, setIsLocationFocused]);

  const handleCurrentLocation = useCallback(() => {
    manualGeolocateMain(true);
  }, [manualGeolocateMain]);

  const handleSaveLocation = useCallback(() => {
    if (centerAddress && centerLat && centerLng) setShowSaveModal(true);
  }, [centerAddress, centerLat, centerLng, setShowSaveModal]);

  const handleClearAddress = useCallback(() => {
    setCenterAddress("");
    setManualAddress("");
    setQuery("");
    setSearchQuery("");
    setLocalServiceAreaStatus(null);
  }, [setCenterAddress, setLocalServiceAreaStatus, setManualAddress, setQuery, setSearchQuery]);

  const handleCategorySelect = useCallback(
    (category: SearchCategory) => {
      if (activeCategory === category.id) {
        setActiveCategory(null);
        setQuery("");
        setSearchQuery("");
      } else {
        setActiveCategory(category.id);
        setQuery(category.keyword);
        setSearchQuery(category.keyword);
      }
    },
    [activeCategory, setActiveCategory, setQuery, setSearchQuery],
  );

  const handleSelect = useCallback(
    async (placeId: string) => {
      const placeDetails = await getPlaceDetails(placeId);
      if (!placeDetails) return;

      addRecentSearch({
        mainText: placeDetails.name,
        secondaryText: placeDetails.address,
        address: placeDetails.address,
        lat: placeDetails.lat,
        lng: placeDetails.lng,
      });

      await applyGeofencedLocation({
        lat: placeDetails.lat,
        lng: placeDetails.lng,
        address: placeDetails.name || placeDetails.address,
      });
    },
    [addRecentSearch, applyGeofencedLocation, getPlaceDetails],
  );

  const handleSelectUnified = useCallback(
    async (result: UnifiedSearchResult) => {
      let selectedLat: number | undefined;
      let selectedLng: number | undefined;
      let selectedAddress = result.main_text;

      if (result.lat && result.lng) {
        selectedLat = result.lat;
        selectedLng = result.lng;
        addRecentSearch({
          mainText: result.main_text,
          secondaryText: result.secondary_text || "",
          address: result.secondary_text || result.main_text,
          lat: result.lat,
          lng: result.lng,
        });
      } else if (result.place_id) {
        const placeDetails = await getPlaceDetails(result.place_id);
        if (!placeDetails) return;
        selectedLat = placeDetails.lat;
        selectedLng = placeDetails.lng;
        selectedAddress = placeDetails.name || placeDetails.address;
        addRecentSearch({
          mainText: placeDetails.name,
          secondaryText: placeDetails.address,
          address: placeDetails.address,
          lat: placeDetails.lat,
          lng: placeDetails.lng,
        });
      }

      if (!selectedLat || !selectedLng) return;

      await applyGeofencedLocation({
        lat: selectedLat,
        lng: selectedLng,
        address: selectedAddress,
      });
    },
    [addRecentSearch, applyGeofencedLocation, getPlaceDetails],
  );

  const handleSelectRecent = useCallback(
    async (search: RecentSearch) => {
      await applyGeofencedLocation({
        lat: search.lat,
        lng: search.lng,
        address: search.address,
      });
    },
    [applyGeofencedLocation],
  );

  const handleSelectSmart = useCallback(
    async (suggestion: SmartSuggestion) => {
      if (suggestion.lat && suggestion.lng) {
        await applyGeofencedLocation({
          lat: suggestion.lat,
          lng: suggestion.lng,
          address: suggestion.title,
        });
      }
    },
    [applyGeofencedLocation],
  );

  const handleSelectSavedPlace = useCallback(
    async (place: SearchSavedPlace) => {
      await applyGeofencedLocation({
        lat: place.lat,
        lng: place.lng,
        address: place.name || place.address,
      });
    },
    [applyGeofencedLocation],
  );

  const handleClose = useCallback(() => {
    setIsLocationFocused(false);
  }, [setIsLocationFocused]);

  return {
    unifiedResults,
    smartSuggestions,
    nearbyLandmarks,
    handleQueryChange,
    handleClear,
    handleFocus,
    handleAddressClick,
    handleCurrentLocation,
    handleSaveLocation,
    handleClearAddress,
    handleCategorySelect,
    handleSelect,
    handleSelectUnified,
    handleSelectRecent,
    handleSelectSmart,
    handleSelectSavedPlace,
    handleClose,
  };
};
