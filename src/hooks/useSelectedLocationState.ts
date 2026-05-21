import { useReducer, useCallback } from "react";
import type { ServiceAreaCheck } from "@/hooks/useLocationPicker";

/* ─────────────────────────────────────────────────────────────────────
 *  useSelectedLocationState
 *
 *  Groups the "currently-selected location" state that GoPage,
 *  useLocationSearchPanelHandlers, and useRideBookingSubmission all
 *  share. Using useReducer instead of individual useState calls
 *  guarantees atomic state transitions (e.g. clearing query and
 *  resetting category in one render) and makes the shared boundary
 *  explicit.
 *
 *  NOTE: centerAddress and centerLat/Lng live in useLocationPicker,
 *  so they are NOT part of this hook.
 * ────────────────────────────────────────────────────────────────── */

export interface SelectedLocationState {
  /** Search query typed by the user */
  locationSearchQuery: string;
  /** Whether the search input is focused / panel is open */
  isLocationFocused: boolean;
  /** Active category filter (e.g. "restaurant", "hospital") */
  activeCategory: string | null;
  /** Service area check result for the current location */
  localServiceAreaStatus: ServiceAreaCheck | null;
}

type Action =
  | { type: "SET_SEARCH_QUERY"; value: string }
  | { type: "SET_LOCATION_FOCUSED"; value: boolean }
  | { type: "SET_ACTIVE_CATEGORY"; value: string | null }
  | { type: "SET_SERVICE_AREA_STATUS"; value: ServiceAreaCheck | null }
  | { type: "CLEAR_SELECTION" }
  | { type: "APPLY_LOCATION" };

const initialState: SelectedLocationState = {
  locationSearchQuery: "",
  isLocationFocused: false,
  activeCategory: null,
  localServiceAreaStatus: null,
};

function reducer(state: SelectedLocationState, action: Action): SelectedLocationState {
  switch (action.type) {
    case "SET_SEARCH_QUERY":
      return { ...state, locationSearchQuery: action.value };
    case "SET_LOCATION_FOCUSED":
      return { ...state, isLocationFocused: action.value };
    case "SET_ACTIVE_CATEGORY":
      return { ...state, activeCategory: action.value };
    case "SET_SERVICE_AREA_STATUS":
      return { ...state, localServiceAreaStatus: action.value };
    case "CLEAR_SELECTION":
      return {
        ...state,
        locationSearchQuery: "",
        isLocationFocused: false,
        activeCategory: null,
        localServiceAreaStatus: null,
      };
    case "APPLY_LOCATION":
      // After user confirms a location (pickup/dropoff), reset search state
      return {
        ...state,
        locationSearchQuery: "",
        isLocationFocused: false,
        activeCategory: null,
      };
    default:
      return state;
  }
}

export function useSelectedLocationState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setLocationSearchQuery = useCallback(
    (value: string) => dispatch({ type: "SET_SEARCH_QUERY", value }),
    [],
  );

  const setIsLocationFocused = useCallback(
    (value: boolean) => dispatch({ type: "SET_LOCATION_FOCUSED", value }),
    [],
  );

  const setActiveCategory = useCallback(
    (value: string | null) => dispatch({ type: "SET_ACTIVE_CATEGORY", value }),
    [],
  );

  const setLocalServiceAreaStatus = useCallback(
    (value: ServiceAreaCheck | null) =>
      dispatch({ type: "SET_SERVICE_AREA_STATUS", value }),
    [],
  );

  /** Reset all selection state — e.g. when clearing the search bar */
  const clearSelection = useCallback(
    () => dispatch({ type: "CLEAR_SELECTION" }),
    [],
  );

  /** Reset search-related state after a location is confirmed */
  const applyLocationReset = useCallback(
    () => dispatch({ type: "APPLY_LOCATION" }),
    [],
  );

  return {
    ...state,
    setLocationSearchQuery,
    setIsLocationFocused,
    setActiveCategory,
    setLocalServiceAreaStatus,
    clearSelection,
    applyLocationReset,
  };
}
