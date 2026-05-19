/**
 * Phase 7 Integration Guide - GoPage
 * 
 * How to integrate the new systems into GoPage.tsx:
 * 1. Adaptive Hooks (Maps, Routing, Geocoding)
 * 2. Event Deduplication (Realtime sync)
 * 3. Notification Router (Smart delivery)
 * 
 * ============================================================================
 * STEP 1: Replace useLocationPicker with useAdaptiveMap
 * ============================================================================
 * 
 * OLD CODE (current):
 * ────────────────
 * const { map, isLoading, centerAddress } = useLocationPicker(mapToken, ...);
 * // Internally uses Google Maps API
 * 
 * NEW CODE (integrated):
 * ─────────────────────
 * import { useAdaptiveMap } from '@/hooks/useAdaptiveMap';
 * 
 * const { currentAdapter: mapAdapter, isLoading, adapterError } = useAdaptiveMap({
 *   defaultProvider: 'osm', // OpenStreetMap primary
 *   fallbackProviders: ['google', 'static'], // Fallbacks
 * });
 * 
 * // Usage exactly the same, but now auto-fallsback!
 * 
 * ============================================================================
 * STEP 2: Replace useDynamicPlacesSearch with useAdaptiveGeocoding
 * ============================================================================
 * 
 * OLD CODE (current):
 * ────────────────
 * const { predictions, getPlaceDetails } = useSearchAndPlaces(...);
 * // Uses Google Places API
 * 
 * NEW CODE (integrated):
 * ─────────────────────
 * import { useAdaptiveGeocoding } from '@/hooks/useAdaptiveGeocoding';
 * 
 * const { searchPlaces, predictions, isSearching } = useAdaptiveGeocoding({
 *   defaultProvider: 'nominatim', // Nominatim primary (free)
 *   fallbackProviders: ['photon', 'google'], // Fallback to Photon, then Google
 *   debounceMs: 300, // Debounce search input
 *   cacheSize: 50, // Cache results
 *   cacheTTL: 5 * 60 * 1000, // 5 minutes
 * });
 * 
 * ============================================================================
 * STEP 3: Replace Realtime event handlers with useRealtimeRideEvents
 * ============================================================================
 * 
 * OLD CODE (current in GoPage):
 * ──────────────────────────────
 * useEffect(() => {
 *   const channel = supabase.channel(`ride:${rideId}`);
 *   channel.on('broadcast', { event: 'ride-accepted' }, (data) => {
 *     playSound(); // Direct notification
 *     showBanner('Driver accepted!');
 *     // ...
 *   });
 * }, [rideId]);
 * 
 * NEW CODE (integrated):
 * ─────────────────────
 * import { useRealtimeRideEvents } from '@/hooks/useRealtimeRideEvents';
 * 
 * const { isConnected } = useRealtimeRideEvents({
 *   rideId,
 *   nodeId: 'rider',
 *   
 *   // Deduplication + routing built-in!
 *   onRideAccepted: async (data) => {
 *     await routeNotification('ride-accepted', data);
 *   },
 *   
 *   onLocationUpdate: async (data) => {
 *     await routeNotification('driver-location-update', data);
 *     updateMarkerOnMap(data);
 *   },
 * });
 * 
 * ============================================================================
 * STEP 4: Add useNotificationRouter for smart notification delivery
 * ============================================================================
 * 
 * NEW CODE:
 * ────────
 * import { useNotificationRouter } from '@/hooks/useNotificationRouter';
 * 
 * const { routeNotification, isDriving } = useNotificationRouter({
 *   nodeId: 'rider',
 *   enableDebugging: false,
 * });
 * 
 * // Now all notification calls go through smart routing
 * await routeNotification('ride-accepted', { driverName: 'Ahmed', eta: 5 });
 * // Automatically decides: sound? vibration? banner? based on context
 * 
 * ============================================================================
 * STEP 5: Update imports
 * ============================================================================
 * 
 * REMOVE:
 * ───────
 * - loadGoogleMaps()
 * - getGeocoder()
 * - useSearchAndPlaces() (for Places API)
 * 
 * ADD:
 * ────
 * - useAdaptiveMap()
 * - useAdaptiveGeocoding()
 * - useAdaptiveRouting()
 * - useRealtimeRideEvents()
 * - useRideEventQueue()
 * - useNotificationRouter()
 * 
 * ============================================================================
 * INTEGRATION CHECKLIST FOR GoPage.tsx
 * ============================================================================
 * 
 * MAPS:
 * [ ] Import useAdaptiveMap
 * [ ] Replace useLocationPicker map initialization
 * [ ] Test map loads (OSM primary, falls back to Google, then static)
 * 
 * GEOCODING/SEARCH:
 * [ ] Import useAdaptiveGeocoding
 * [ ] Replace search input handler (now auto-debounced)
 * [ ] Replace Place picker (now uses Nominatim + Photon)
 * [ ] Test search still works (Nominatim calls)
 * 
 * ROUTING:
 * [ ] Import useAdaptiveRouting
 * [ ] Replace getRoute() calls for bookingMap (now uses OSRM)
 * [ ] Test route calculation works
 * 
 * EVENTS:
 * [ ] Import useRealtimeRideEvents
 * [ ] Replace old Realtime channel subscriptions
 * [ ] Add event deduplication (automatic)
 * [ ] Test: ride-accepted only triggers callback once
 * 
 * NOTIFICATIONS:
 * [ ] Import useNotificationRouter
 * [ ] Replace direct playSound() calls with routeNotification()
 * [ ] Test driving detection (silent when moving)
 * [ ] Test batching (location updates 5x per minute instead of 60x)
 * 
 * QA:
 * [ ] Full booking flow (pickup → dropoff → confirm → tracking)
 * [ ] Driving detection works
 * [ ] Notifications smart-filtered
 * [ ] Map never stays blank (fallbacks working)
 * [ ] Search responsive with debouncing
 * [ ] No duplicate ride-accepted notifications
 * 
 * ============================================================================
 * BEFORE/AFTER COMPARISON
 * ============================================================================
 * 
 * BEFORE:
 * ───────
 * // Nested conditionals for network issues
 * if (!mapToken) { show loading... }
 * // Single provider (Google)
 * if (googleMapsLoaded) { render... }
 * // All features work or nothing works
 * 
 * AFTER:
 * ──────
 * // Automatic fallback chain
 * OSM → Google → Static (always works)
 * // Search: Nominatim → Photon → Google
 * // Routing: OSRM → Google Directions → Haversine
 * // Features degrade gracefully, never completely broken
 * 
 * BEFORE:
 * ───────
 * User taps search → 60 API calls/min to Google Places
 * Cost: ~$5/day per active rider
 * 
 * AFTER:
 * ──────
 * User taps search → debounced to Nominatim (free)
 * Cost: $0/day
 * Same UX, 100% cost reduction
 * 
 * BEFORE:
 * ───────
 * Notification when driving:
 * 🔊 Sound + 📱 Vibration + 🚨 Alert → Distraction!
 * 
 * AFTER:
 * ──────
 * Notification when driving:
 * 🔇 Silent + 📛 Banner only → Focus on road
 * 
 * ============================================================================
 * CONFIGURATION
 * ============================================================================
 * 
 * Map Configuration (src/lib/adapters/config.ts):
 * 
 * FEATURE_FLAGS.USE_ADAPTIVE_MAPS = true;
 * FEATURE_FLAGS.ADAPTIVE_MAPS_PROVIDER = 'osm'; // Primary
 * 
 * This enables:
 * - OSM (Leaflet) primary
 * - Google Maps fallback 1
 * - Static Mapbox fallback 2
 * 
 * 
 * Geocoding Configuration:
 * 
 * FEATURE_FLAGS.USE_ADAPTIVE_GEOCODING = true;
 * FEATURE_FLAGS.GEOCODING_PROVIDER = 'nominatim'; // Primary (free)
 * 
 * This enables:
 * - Nominatim primary (free, OpenStreetMap)
 * - Photon secondary (faster)
 * - Google Geocoding tertiary (fallback)
 * 
 * 
 * Notification Configuration:
 * 
 * FEATURE_FLAGS.SMART_NOTIFICATIONS = true;
 * 
 * This enables:
 * - Silent notifications while driving
 * - Batched location updates (5-10s windows)
 * - Night quiet hours (10 PM - 8 AM)
 * - Critical events always notify
 * 
 * ============================================================================
 * TESTING SCENARIOS
 * ============================================================================
 * 
 * Scenario 1: Normal Booking (Connectivity OK)
 * ─────────────────────────────────────────────
 * 1. Open GoPage
 * 2. Select pickup location
 * 3. Type destination (should use Nominatim)
 * 4. Confirm → see route (should use OSRM)
 * 5. Book ride
 * 6. Receive ride-accepted (only once, deduplicated)
 * 7. Track driver (location updates batched)
 * 
 * Expected: Everything works, only free APIs called
 * Verification: DevTools Network tab shows no google.maps calls
 * 
 * 
 * Scenario 2: Map Provider Failure
 * ──────────────────────────────────
 * 1. Open GoPage
 * 2. [DevTools] Mock OSRM endpoint to fail
 * 3. Try to get route
 * 4. Should fallback to Google Directions
 * 5. If that fails, should fallback to Haversine
 * 
 * Expected: Route always calculated (degrades gracefully)
 * Verification: Route shows with lower UX (straight line, no traffic)
 * 
 * 
 * Scenario 3: Driving Detection
 * ──────────────────────────────
 * 1. Open GoPage in car
 * 2. Simulate motion (device moving)
 * 3. Receive notification
 * 4. Should be SILENT (no sound/vibration)
 * 
 * Expected: Notification appears but silently
 * Verification: Check stats.deliveryMethods for delivery="sound:0"
 * 
 * 
 * Scenario 4: Location Update Batching
 * ─────────────────────────────────────
 * 1. Accept ride (driver tracking starts)
 * 2. Driver sends location every 5 seconds (60/min)
 * 3. Observe notifications
 * 
 * Expected: ~6 notifications per minute (batched), not 60
 * Verification: stats.totalReceived=60, stats.totalDelivered~6
 * 
 * ============================================================================
 * ROLLOUT STRATEGY
 * ============================================================================
 * 
 * Phase 1: Feature Flag (A/B Testing)
 * ────────────────────────────────────
 * FEATURE_FLAGS.USE_ADAPTIVE_MAPS = false (default, uses current code)
 * 
 * Phase 2: Gradual Rollout
 * ────────────────────────
 * Set FEATURE_FLAGS.USE_ADAPTIVE_MAPS = true for 10% of users
 * Monitor errors, performance
 * 
 * Phase 3: Full Rollout
 * ────────────────────
 * Set FEATURE_FLAGS.USE_ADAPTIVE_MAPS = true for 100%
 * 
 * Rollback: Just set to false and redeploy
 * 
 * ============================================================================
 */

/**
 * Integration Implementation Example
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * This is what the integrated GoPage would look like (simplified version)
 */

/*
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdaptiveMap } from '@/hooks/useAdaptiveMap';
import { useAdaptiveGeocoding } from '@/hooks/useAdaptiveGeocoding';
import { useAdaptiveRouting } from '@/hooks/useAdaptiveRouting';
import { useRealtimeRideEvents } from '@/hooks/useRealtimeRideEvents';
import { useNotificationRouter } from '@/hooks/useNotificationRouter';
import { useRideEventQueue } from '@/hooks/useRideEventQueue';

export function GoPageIntegrated() {
  const navigate = useNavigate();
  const rideId = getCurrentRideId(); // From state/store
  
  // Map: Now handles fallbacks automatically
  const { currentAdapter: mapAdapter, isLoading: mapLoading } = useAdaptiveMap({
    defaultProvider: 'osm',
  });
  
  // Geocoding: Debounced search with caching
  const { searchPlaces, predictions, isSearching } = useAdaptiveGeocoding({
    defaultProvider: 'nominatim',
  });
  
  // Routing: OSRM with fallbacks
  const { getRoute, isLoading: routeLoading } = useAdaptiveRouting();
  
  // Notifications: Smart routing based on context
  const { routeNotification, isDriving, stats } = useNotificationRouter({
    nodeId: 'rider',
  });
  
  // Realtime events: Deduplicated + ordered
  const { isConnected } = useRealtimeRideEvents({
    rideId,
    nodeId: 'rider',
    
    onRideAccepted: async (data) => {
      // Now: deduplicated automatically
      // Never called twice for same event
      await routeNotification('ride-accepted', {
        driverName: data.driver_name,
        eta: data.eta,
      });
      
      // Update map with driver location
      updateMapMarkersForRide(data);
    },
    
    onLocationUpdate: async (data) => {
      // Received every 5 seconds from driver
      // Notification will be BATCHED (max 1 per 5 seconds)
      // If isDriving, notification will be silent
      await routeNotification('driver-location-update', {
        latitude: data.latitude,
        longitude: data.longitude,
        heading: data.heading,
      });
      
      // UI updates always happen regardless of notification routing
      updateDriverMarkerOnMap(data);
    },
    
    onRideCompleted: async (data) => {
      // CRITICAL event - always notified
      await routeNotification('ride-completed', {
        totalAmount: data.total_amount,
      });
      
      // Navigate to rating screen
      setTimeout(() => navigate('/rating'), 1000);
    },
  });
  
  // Handle search input
  const handleSearchChange = useCallback((query: string) => {
    // Auto-debounced (300ms), auto-cached, tries Nominatim first
    searchPlaces(query);
  }, [searchPlaces]);
  
  // Handle location selection
  const handleSelectLocation = useCallback(async (selectedPlace) => {
    const location = {
      lat: selectedPlace.lat,
      lng: selectedPlace.lng,
      address: selectedPlace.name,
    };
    
    // If booking, calculate route
    if (currentMode === 'booking' && pickupLocation) {
      const route = await getRoute({
        start: { latitude: pickupLocation.lat, longitude: pickupLocation.lng },
        end: { latitude: location.lat, longitude: location.lng },
      });
      
      // Route was calculated with automatic fallback
      // OSRM → Google Directions → Haversine
      setRoute(route);
    }
  }, [currentMode, pickupLocation, getRoute]);
  
  return (
    <div>
      // Map Container
      {mapLoading && <Spinner>Loading map...</Spinner>}
      {mapAdapter && <MapComponent adapter={mapAdapter} ref={mapContainer} />}
      
      // Search Input
      <input
        placeholder="Search location..."
        onChange={(e) => handleSearchChange(e.target.value)}
        disabled={isSearching}
      />
      
      // Predictions List
      {predictions.map((place) => (
        <PlaceItem
          key={place.id}
          place={place}
          onClick={() => handleSelectLocation(place)}
        />
      ))}
      
      // Driving Status
      {isDriving && <WarningBanner>Focus on road 🚗</WarningBanner>}
      
      // Notification Stats (for debugging)
      <div>Stats: {stats.totalSuppressed} suppressed, {stats.totalDelivered} delivered</div>
    </div>
  );
}
*/
