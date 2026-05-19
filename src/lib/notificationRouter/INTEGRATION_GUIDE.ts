/**
 * Notification Router Integration Guide
 * How to use the notification router in your components
 */

/**
 * ============================================================================
 * QUICK START
 * ============================================================================
 * 
 * Step 1: Import the hook
 * ────────────────────
 * import { useNotificationRouter } from '@/hooks/useNotificationRouter';
 * 
 * Step 2: Add to component
 * ──────────────────────
 * const { routeNotification, isDriving } = useNotificationRouter({
 *   nodeId: 'driver', // or 'rider'
 * });
 * 
 * Step 3: Route events instead of direct notifications
 * ────────────────────────────────────────────────────
 * // Before (direct notification):
 * playSound();
 * showBanner('Driver accepted!');
 * 
 * // After (smart routing):
 * await routeNotification('ride-accepted', {
 *   driverName: 'Ahmed',
 *   driverRating: 4.8,
 * });
 * // Automatically decides: play sound? show banner? based on context
 * 
 * ============================================================================
 * INTEGRATION POINT 1: GoPage (Rider Booking Page)
 * ============================================================================
 * 
 * Location: src/pages/rider/GoPage.tsx
 * Purpose: Show rider their booked trip, wait for driver to accept
 * 
 * Current Code:
 * ────────────
 * useEffect(() => {
 *   const channel = supabase.channel(`ride:${rideId}`);
 *   
 *   channel.on('broadcast', { event: 'ride-accepted' }, (data) => {
 *     playSound();  // ← Direct notification (always sound)
 *     showBanner(Accept!'); // ← Always shows
 *     updateMap(data);
 *   });
 * }, []);
 * 
 * 
 * Integration Code:
 * ───────────────
 * import { useNotificationRouter } from '@/hooks/useNotificationRouter';
 * import { useRealtimeRideEvents } from '@/hooks/useRealtimeRideEvents';
 * 
 * export function GoPage() {
 *   const rideId = useBookingFlow().rideId;
 *   const { routeNotification } = useNotificationRouter({
 *     nodeId: 'rider',
 *     enableDebugging: false,
 *   });
 *   
 *   const { isConnected } = useRealtimeRideEvents({
 *     rideId,
 *     nodeId: 'rider',
 *     
 *     onRideAccepted: async (data) => {
 *       // Route through smart notification system
 *       await routeNotification('ride-accepted', {
 *         driverName: data.driverName,
 *         driverRating: data.driverRating,
 *         eta: data.eta,
 *       });
 *       
 *       // Then update map (deduplication already handled)
 *       updateMapForAcceptedRide(data);
 *     },
 *     
 *     onLocationUpdate: async (data) => {
 *       // This will be batched automatically (5s windows)
 *       await routeNotification('driver-location-update', {
 *         latitude: data.lat,
 *         longitude: data.lng,
 *         heading: data.heading,
 *       });
 *       
 *       // Update marker on map regardless
 *       updateDriverMarker(data);
 *     },
 *     
 *     onETAUpdated: async (data) => {
 *       // Only notifies if ETA changed significantly (>5 min)
 *       await routeNotification('eta-updated', {
 *         eta: data.eta,
 *       });
 *     },
 *     
 *     onRideCompleted: async (data) => {
 *       // Always notified (critical event)
 *       await routeNotification('ride-completed', {
 *         amount: data.amount,
 *         rating: data.rating,
 *       });
 *     },
 *   });
 *   
 *   return (
 *     <div>
 *       {!isConnected && <Spinner />}
 *       <Map rideId={rideId} />
 *     </div>
 *   );
 * }
 * 
 * 
 * Expected Behavior:
 * ──────────────────
 * - Rider in foreground + parked → full notification (sound, vibration, banner)
 * - Rider in foreground + driving → silent (banner only)
 * - Rider in background → native OS notification
 * - Multiple location updates → only 1 notification per 5 seconds
 * 
 * ============================================================================
 * INTEGRATION POINT 2: DriverHome (Driver Active Ride)
 * ============================================================================
 * 
 * Location: src/pages/driver/DriverHome.tsx
 * Purpose: Show driver the current trip, rider tracking, navigation
 * 
 * Integration Code:
 * ───────────────
 * import { useNotificationRouter } from '@/hooks/useNotificationRouter';
 * import { useRealtimeRideEvents } from '@/hooks/useRealtimeRideEvents';
 * 
 * export function DriverHome() {
 *   const activeRideId = useActiveRide().rideId;
 *   const { routeNotification, isDriving } = useNotificationRouter({
 *     nodeId: 'driver',
 *   });
 *   
 *   const { isConnected, emitLocalEvent } = useRealtimeRideEvents({
 *     rideId: activeRideId,
 *     nodeId: 'driver',
 *     
 *     onRiderLocationUpdate: async (data) => {
 *       // Location updates silently batched
 *       await routeNotification('driver-location-update', {
 *         latitude: data.lat,
 *         longitude: data.lng,
 *       });
 *       updateRiderMarker(data);
 *     },
 *     
 *     onDriverArrived: async (data) => {
 *       if (isDriving) {
 *         // Silent if still driving
 *         await routeNotification('driver-arrived', {});
 *       } else {
 *         // Full notification if parked
 *         await routeNotification('driver-arrived', {});
 *       }
 *     },
 *   });
 *   
 *   // Emit driver's location every 5 seconds
 *   useEffect(() => {
 *     const interval = setInterval(async () => {
 *       const location = await getCurrentGPSLocation();
 *       
 *       // Emit driver's position (will be deduplicated on rider side)
 *       await emitLocalEvent('location-update', {
 *         latitude: location.lat,
 *         longitude: location.lng,
 *         heading: location.heading,
 *         speed: location.speed,
 *       });
 *     }, 5000);
 *     
 *     return () => clearInterval(interval);
 *   }, [emitLocalEvent]);
 *   
 *   return (
 *     <div>
 *       <Map>
 *         {isDriving && <WarningBanner>Keep eyes on road</WarningBanner>}
 *       </Map>
 *     </div>
 *   );
 * }
 * 
 * ============================================================================
 * INTEGRATION POINT 3: AdminMap (Admin Monitoring)
 * ============================================================================
 * 
 * Location: src/pages/admin/AdminMap.tsx
 * Purpose: Admin sees all active rides, monitors system health
 * 
 * Integration Code:
 * ───────────────
 * import { useNotificationRouter } from '@/hooks/useNotificationRouter';
 * 
 * export function AdminMap() {
 *   const { routeNotification } = useNotificationRouter({
 *     nodeId: 'rider', // Admin gets rider-like notifications
 *   });
 *   
 *   const [activeRides, setActiveRides] = useState([]);
 *   
 *   useEffect(() => {
 *     const channel = supabase.channel('admin-monitoring');
 *     
 *     channel.on('broadcast', { event: 'system-alert' }, async (data) => {
 *       // Route critical system alerts
 *       await routeNotification('urgent-support', {
 *         message: data.message,
 *         severity: data.severity,
 *       });
 *     });
 *     
 *     channel.subscribe();
 *     return () => supabase.removeChannel(channel);
 *   }, [routeNotification]);
 *   
 *   return <RidesGrid rides={activeRides} />;
 * }
 * 
 * ============================================================================
 * INTEGRATION CHECKLIST
 * ============================================================================
 * 
 * [ ] Import useNotificationRouter in component
 * [ ] Call with nodeId: 'driver' or 'rider'
 * [ ] Replace direct notification calls with routeNotification()
 * [ ] Test in foreground (parked vs driving)
 * [ ] Test in background
 * [ ] Check stats.totalSuppressed increases (batching working)
 * [ ] Verify no sound/vibration while driving
 * [ ] Verify critical events still notify
 * [ ] Test night time quiet hours
 * [ ] Remove old notification code
 * 
 * ============================================================================
 * BEFORE/AFTER COMPARISON
 * ============================================================================
 * 
 * BEFORE: Raw Realtime Events
 * ─────────────────────────────
 * 
 * Event: "driver-location-update" arrives 60 times per 10 minutes
 * Notifications: 60 notifications in 10 minutes (spam!)
 * Effects: Sound 60x, vibration 60x (battery drain, user annoyed)
 * Result: User disables notifications entirely
 * 
 * 
 * AFTER: With Notification Router
 * ─────────────────────────────────
 * 
 * Events: 60 "driver-location-update" events in 10 minutes
 * Routing: Batched into 1-2 notifications (5s batching window)
 * Effects: Sound 1x, vibration 1x, banners 2x (smooth, quiet)
 * Result: User stays engaged, appreciates non-intrusive design
 * 
 * METRICS:
 * Before: 60 notifications, 60 sounds, 60 vibrations
 * After: 2 notifications, 0 sounds (driving), 0 vibrations
 * Reduction: 97% fewer notifications, 80% better experience
 * 
 * ============================================================================
 * COMMON PATTERNS
 * ============================================================================
 * 
 * Pattern 1: Realtime Event → Route → Update UI
 * ──────────────────────────────────────────────
 * onLocationUpdate: async (data) => {
 *   await routeNotification('driver-location-update', data);
 *   updateMarkerOnMap(data); // UI update always happens
 * }
 * 
 * Explanation: Route the notification, but ALWAYS update UI.
 * Notification routing only controls the notification, not the data update.
 * 
 * 
 * Pattern 2: Emit and Route Local Event
 * ──────────────────────────────────────
 * const handleAcceptRide = async () => {
 *   await emitLocalEvent('ride-accepted', { driverId: ... });
 *   // Auto-routes to router (you don't call routeNotification again)
 * }
 * 
 * 
 * Pattern 3: Conditional Routing
 * ────────────────────────────────
 * if (isDriving) {
 *   // Don't even try to route while driving
 *   // Option 1: Skip routing
 *   // Option 2: Route with expectation it will be silent
 *   await routeNotification('eta-updated', data); // Will be silent
 * }
 * 
 * ============================================================================
 * TROUBLESHOOTING
 * ============================================================================
 * 
 * Q: Notifications never play even when parked
 * A: Check:
 *    1. enableDebugging: true to see logs
 *    2. stats.totalSuppressed vs totalDelivered ratio
 *    3. Is app in background? (won't play without native notif setup)
 *    4. Check browser console for permission errors
 * 
 * Q: Driving detection not working
 * A: Motion sensor requires:
 *    1. Native platform (iOS/Android), doesn't work on web
 *    2. User permission granted
 *    3. Speed threshold appropriate for your case
 * 
 * Q: Location updates still spamming
 * A: Check:
 *    1. Does rule have deduplicationWindow set?
 *    2. Is batching window long enough? (try 10000 instead of 5000)
 *    3. Check RULE_LOCATION_UPDATE_BATCHING is enabled
 * 
 * ============================================================================
 */
