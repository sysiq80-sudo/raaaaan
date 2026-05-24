import { AlertTriangle } from "lucide-react";
import type { PlacePrediction } from "@/hooks/useDynamicPlacesSearch";
import type { RecentSearch } from "@/hooks/useRecentSearches";
import type { ServiceAreaCheck } from "@/hooks/useLocationPicker";
import type { SmartSuggestion, UnifiedSearchResult } from "@/hooks/useUnifiedSearch";
import { DynamicSearchHeader, DynamicSearchResults, type CategoryFilter } from "@/components/rider/DynamicSearchResults";
import type { SavedPlaceChip } from "@/components/rider/SavedPlacesStrip";

type VoiceState = "idle" | "listening" | "processing" | "error";
type SearchSavedPlace = Pick<SavedPlaceChip, "name" | "address" | "lat" | "lng">;

interface LocationSearchPanelProps {
  serviceAreaStatus: ServiceAreaCheck | null;
  query: string;
  results: PlacePrediction[];
  unifiedResults?: UnifiedSearchResult[];
  recentSearches: RecentSearch[];
  smartSuggestions: SmartSuggestion[];
  nearbyLandmarks: UnifiedSearchResult[];
  savedPlaces: SavedPlaceChip[];
  activeCategory: string | null;
  isPickup: boolean;
  isStopMode: boolean;
  isSearching: boolean;
  isLoadingDetails: boolean;
  isOffline: boolean;
  isOpen: boolean;
  showAddress?: string;
  isFavorite: boolean;
  voiceSupported: boolean;
  voiceState: VoiceState;
  voiceTranscript: string;
  onQueryChange: (value: string) => void;
  onClear: () => void;
  onFocus: () => void;
  onAddressClick: () => void;
  onCurrentLocation: () => void;
  onSaveLocation: () => void;
  onClearAddress: () => void;
  onVoiceToggle: () => void;
  onCategorySelect: (category: CategoryFilter) => void;
  onSelect: (placeId: string, mainText: string) => void | Promise<void>;
  onSelectUnified: (result: UnifiedSearchResult) => void | Promise<void>;
  onSelectRecent: (search: RecentSearch) => void | Promise<void>;
  onSelectSmart: (suggestion: SmartSuggestion) => void | Promise<void>;
  onSelectSavedPlace: (place: SearchSavedPlace) => void | Promise<void>;
  onRemoveRecent: (id: string) => void;
  onClose: () => void;
}

const LocationSearchPanel = ({
  serviceAreaStatus,
  query,
  results,
  unifiedResults,
  recentSearches,
  smartSuggestions,
  nearbyLandmarks,
  savedPlaces,
  activeCategory,
  isPickup,
  isStopMode,
  isSearching,
  isLoadingDetails,
  isOffline,
  isOpen,
  showAddress,
  isFavorite,
  voiceSupported,
  voiceState,
  voiceTranscript,
  onQueryChange,
  onClear,
  onFocus,
  onAddressClick,
  onCurrentLocation,
  onSaveLocation,
  onClearAddress,
  onVoiceToggle,
  onCategorySelect,
  onSelect,
  onSelectUnified,
  onSelectRecent,
  onSelectSmart,
  onSelectSavedPlace,
  onRemoveRecent,
  onClose,
}: LocationSearchPanelProps) => (
  <>
    {serviceAreaStatus && !serviceAreaStatus.in_service && (
      <div className="flex items-center gap-3 p-3 mb-1 rounded-2xl bg-red-500/10 border border-red-500/20">
        <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-400" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-red-400 text-sm mb-1">⚠️ خارج منطقة الخدمة</p>
          {serviceAreaStatus.nearest_region && (
            <p className="text-slate-400 text-xs">
              أقرب منطقة: {serviceAreaStatus.nearest_region.name_ar}{" "}
              ({serviceAreaStatus.nearest_region.distance_km} كم)
            </p>
          )}
        </div>
      </div>
    )}

    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
      <div className="relative pointer-events-auto overflow-visible z-50">
        <DynamicSearchHeader
          query={query}
          onQueryChange={onQueryChange}
          onClear={onClear}
          isSearching={isSearching}
          isOffline={isOffline}
          placeholder={isPickup ? "اختر موقع الانطلاق ...." : isStopMode ? "اختر موقع المحطة ...." : "اختر جهة الوصول ...."}
          onFocus={onFocus}
          showAddress={showAddress}
          onAddressClick={onAddressClick}
          onCurrentLocation={onCurrentLocation}
          onSaveLocation={onSaveLocation}
          isFavorite={isFavorite}
          onClearAddress={onClearAddress}
          voiceSupported={voiceSupported}
          voiceState={voiceState}
          onVoiceToggle={onVoiceToggle}
          voiceTranscript={voiceTranscript}
        />

        <DynamicSearchResults
          query={query}
          results={results}
          unifiedResults={unifiedResults}
          recentSearches={recentSearches}
          smartSuggestions={smartSuggestions}
          nearbyLandmarks={nearbyLandmarks}
          savedPlaces={savedPlaces}
          isSearching={isSearching}
          isLoadingDetails={isLoadingDetails}
          isOffline={isOffline}
          isOpen={isOpen}
          activeCategory={activeCategory}
          onCategorySelect={onCategorySelect}
          onSelect={onSelect}
          onSelectUnified={onSelectUnified}
          onSelectRecent={onSelectRecent}
          onSelectSmart={onSelectSmart}
          onSelectSavedPlace={onSelectSavedPlace}
          onRemoveRecent={onRemoveRecent}
          maxResults={6}
          maxRecentResults={3}
          onClose={onClose}
        />
      </div>
    </div>
  </>
);

export default LocationSearchPanel;
