/**
 * Notification Router Documentation
 * ============================================================================
 * 
 * PURPOSE:
 * Prevent notification spam by intelligently routing notifications based on
 * user context: whether they're driving, time of day, type of event, etc.
 * 
 * PROBLEM SOLVED:
 * - Driver receives "location-update" notification every 5 seconds (spam)
 * - Driver gets distracted by sounds while driving (safety issue)
 * - Rider gets notifications for insignificant ETA changes
 * - User woken up by notifications at 2 AM for non-critical events
 * 
 * SOLUTION:
 * Rules engine that evaluates context and decides:
 * 1. Should deliver? (event matches rule conditions)
 * 2. How to deliver? (sound, vibration, banner, badge)
 * 3. When to deliver? (immediately or queue for later)
 * 
 * ============================================================================
 * KEY CONCEPTS
 * ============================================================================
 * 
 * 1. RULES
 *    A rule = IF [conditions] THEN [actions]
 *    
 *    Example:
 *    IF (event-type = "ride-accepted") AND (is-driving = false)
 *    THEN deliver with { sound: true, vibration: true, banner: true }
 * 
 * 2. CONDITIONS
 *    - event-type: which type of event (ride-accepted, location-update, etc)
 *    - is-driving: is driver actively driving (speed > 5 km/h)
 *    - is-active-ride: does user have active ride
 *    - time-of-day: hour of day (for night quiet hours)
 *    - location: within radius of specified coords
 *    - custom: user-defined function
 * 
 * 3. ACTIONS
 *    - deliver: send notification with specified delivery methods
 *    - queue: hold notification for X ms, batch with others
 *    - suppress: don't send
 *    - log: for debugging
 * 
 * 4. DELIVERY METHODS
 *    - sound: Play notification sound
 *    - vibration: Vibrate phone
 *    - banner: In-app banner/toast
 *    - badge: App badge counter
 *    - haptic: Haptic feedback
 *    - localNotification: Native OS notification
 * 
 * ============================================================================
 * DEFAULT RULES
 * ============================================================================
 * 
 * RULE 1: Critical Events
 * ──────────────────────
 * IF (event = ride-cancelled OR urgent-support)
 * THEN deliver with { sound: true, vibration: true, banner: true,
 *                     badge: true, haptic: true, localNotif: true }
 * 
 * Reasoning: These events require immediate driver/rider attention
 * 
 * 
 * RULE 2: Driver Actively Driving
 * ────────────────────────────────
 * IF (event = ride-accepted, driver-arrived, eta-updated)
 *    AND (is-driving = true)
 * THEN deliver with { sound: false, vibration: false, banner: true,
 *                     others: false }
 * 
 * Reasoning: Keep driver focused on road, only show in-app banner
 * 
 * 
 * RULE 3: Driver Parked / Not Driving
 * ────────────────────────────────────
 * IF (event = ride-accepted, driver-arrived, payment-confirmation)
 *    AND (is-driving = false)
 * THEN deliver with { sound: true, vibration: true, banner: true,
 *                     badge: true, haptic: true }
 * 
 * Reasoning: Driver can safely receive full notifications
 * 
 * 
 * RULE 4: Location Updates - Smart Batching
 * ──────────────────────────────────────────
 * IF (event = driver-location-update)
 * THEN queue for 5s { sound: false, vibration: false, banner: false }
 * 
 * Reasoning: Batch 5-10 location updates into one, prevent spam
 * Result: 300 events/hour → 60 batches/hour (80% reduction)
 * 
 * 
 * RULE 5: ETA - Only Significant Changes
 * ───────────────────────────────────────
 * IF (event = eta-updated)
 *    AND (ETA changed by > 5 minutes)
 * THEN deliver with { sound: false, vibration: false, banner: true }
 * 
 * Reasoning: Rider watches timer constantly, only significant changes matter
 * 
 * 
 * RULE 6: Night Time - Quiet Hours (10 PM - 8 AM)
 * ────────────────────────────────────────────────
 * IF (hour between 22:00 and 08:00)
 *    AND (event = rating-request, payment-confirmation)
 * THEN queue until morning { sound: false, vibration: false,
 *                            badge: true }
 * 
 * Reasoning: Non-critical notifications don't need to wake user
 * 
 * 
 * RULE 7: Ride Lifecycle Events
 * ─────────────────────────────
 * IF (event = ride-started, ride-completed)
 * THEN deliver with { sound: true, vibration: true, banner: true,
 *                     badge: true, haptic: true }
 * 
 * Reasoning: Important milestones, user wants to know
 * 
 * 
 * RULE 8: Global Deduplication
 * ────────────────────────────
 * IF (same event in last 5 seconds)
 * THEN suppress
 * 
 * Reasoning: Network retransmission protection
 * 
 * ============================================================================
 * USAGE EXAMPLES
 * ============================================================================
 * 
 * EXAMPLE 1: Basic Integration in Component
 * ──────────────────────────────────────────
 * 
 * import { useNotificationRouter } from '@/hooks/useNotificationRouter';
 * 
 * export function DriverHome() {
 *   const { routeNotification, isDriving, stats } = useNotificationRouter({
 *     nodeId: 'driver',
 *     enableDebugging: false,
 *   });
 * 
 *   // When rider location updates
 *   const handleRiderLocationUpdate = async (location) => {
 *     await routeNotification('driver-location-update', {
 *       latitude: location.lat,
 *       longitude: location.lng,
 *     });
 *     // If driving: notification silenced, queued
 *     // If parked: notification delivered with all effects
 *   };
 * 
 *   return (
 *     <div>
 *       {isDriving ? <span>🚗 Driving</span> : <span>⏸ Parked</span>}
 *       <p>Notifications suppressed: {stats.totalSuppressed}</p>
 *     </div>
 *   );
 * }
 * 
 * 
 * EXAMPLE 2: With Realtime Event Handler
 * ──────────────────────────────────────
 * 
 * import { useRealtimeRideEvents } from '@/hooks/useRealtimeRideEvents';
 * import { useNotificationRouter } from '@/hooks/useNotificationRouter';
 * 
 * export function GoPage() {
 *   const rideId = useBookingFlow().rideId;
 *   const { routeNotification } = useNotificationRouter({
 *     nodeId: 'rider',
 *   });
 * 
 *   const { isConnected } = useRealtimeRideEvents({
 *     rideId,
 *     nodeId: 'rider',
 *     
 *     // Route notifications through smart router
 *     onRideAccepted: async (data) => {
 *       await routeNotification('ride-accepted', {
 *         driverName: data.driverName,
 *         eta: data.eta,
 *       });
 *     },
 *     
 *     onLocationUpdate: async (data) => {
 *       await routeNotification('driver-location-update', data);
 *       // Will be batched if rider tapping screen
 *     },
 *     
 *     onRideCompleted: async (data) => {
 *       await routeNotification('ride-completed', data);
 *       // Always delivered (high priority)
 *     },
 *   });
 * 
 *   return <div>{isConnected && <Map />}</div>;
 * }
 * 
 * 
 * EXAMPLE 3: Custom Rules
 * ──────────────────────
 * 
 * import { useNotificationRouter } from '@/hooks/useNotificationRouter';
 * import { NotificationRule, NotificationPriority } from '@/lib/notificationRouter';
 * 
 * const customRule: NotificationRule = {
 *   id: 'rule-friday-night-party',
 *   name: 'Friday Night - Don\'t Disturb',
 *   enabled: true,
 *   conditions: [
 *     { type: 'time-of-day', hoursRange: [20, 23] }, // 8 PM - 11 PM on Friday
 *     { type: 'event-type', eventType: ['rating-request', 'payment-confirmation'] },
 *   ],
 *   actions: [
 *     { type: 'suppress' }, // Don't send at all
 *   ],
 *   priority: NotificationPriority.SILENT,
 * };
 * 
 * export function MyComponent() {
 *   const { routeNotification } = useNotificationRouter({
 *     nodeId: 'rider',
 *     customRules: [customRule], // Add to default rules
 *   });
 *   // ...
 * }
 * 
 * ============================================================================
 * TESTING & VERIFICATION
 * ============================================================================
 * 
 * Test 1: Location Update Batching
 * ──────────────────────────────────
 * 1. Have rider watch driver on map
 * 2. Driver moves and location updates fire every 5 seconds
 * 3. Verify rider only sees 1 notification per 5 seconds (not every 5s)
 * 4. Check stats: totalReceived = 60 (1/min × 1hr)
 *                 totalDelivered < 15 (batched)
 * 
 * Test 2: Driving State
 * ────────────────────
 * 1. Driver accepts ride
 * 2. Notification plays sound/vibration (parked state)
 * 3. Driver starts driving
 * 4. Next notification is silent (banner only)
 * 5. Driver parks
 * 6. Next notification plays sound/vibration again
 * 
 * Test 3: Night Time Quiet
 * ──────────────────────
 * 1. Set device time to 11 PM
 * 2. Complete ride (ride-completed event)
 * 3. Rating request queued, not delivered immediately
 * 4. Set time to 8 AM
 * 5. Notification delivered from queue
 * 
 * Test 4: Critical Events Always Notify
 * ──────────────────────────────────────
 * 1. Toggle "offline" mode or suppress non-critical events
 * 2. Trigger urgent-support event
 * 3. Notification STILL delivered with full effects
 * 
 * ============================================================================
 * MONITORING & DEBUGGING
 * ============================================================================
 * 
 * Check Suppression Rate:
 * ──────────────────────
 * const { stats } = useNotificationRouter(...);
 * 
 * suppressionRate = stats.totalSuppressed / stats.totalReceived;
 * // Should be: 70-80% for active rides (batch benefit)
 * 
 * 
 * Check Delivery Methods:
 * ─────────────────────
 * stats.deliveryMethods = {
 *   sound: 45,            // 45 sound notifications
 *   vibration: 45,        // matching
 *   banner: 200,          // more banners than sounds
 *   badge: 20,            // fewer badge updates
 * }
 * 
 * Analysis: "banner" >> "sound" suggests things are batched correctly
 * 
 * 
 * Check Priority Distribution:
 * ───────────────────────────
 * stats.deliveredByPriority = {
 *   5: 2,  // CRITICAL (ride-cancelled, support)
 *   4: 30, // HIGH (ride lifecycle)
 *   3: 100, // NORMAL (location updates)
 *   2: 50,  // LOW (rating requests)
 *   1: 0,   // SILENT
 * }
 * 
 * ============================================================================
 * PERFORMANCE CONSIDERATIONS
 * ============================================================================
 * 
 * Memory Usage:
 * - Recent notifications history: O(n) where n = maxRecentNotifications (50)
 * - Each entry: ~30 bytes
 * - Total: ~1.5 KB
 * - Queued notifications: varies, typically 5-20 items
 * - Total: <100 KB
 * 
 * CPU Usage:
 * - routeNotification(): ~0.5ms (rule evaluation)
 * - evaluateRules(): O(n) where n = number of rules (8 default)
 * - evaluateCondition(): <0.1ms per condition
 * - Total per notification: <5ms
 * 
 * Network Impact:
 * - Zero additional network (local-only routing)
 * - Reduced push notifications (batching saves bandwidth)
 * 
 * ============================================================================
 * FUTURE IMPROVEMENTS
 * ============================================================================
 * 
 * [ ] ML-based learning: adjust rules based on user behavior
 * [ ] Geofencing: suppress notifications when at home/office
 * [ ] Context awareness: pause notifications in movie theaters
 * [ ] Do Not Disturb integration: respect OS quiet hours
 * [ ] Advanced batching: combine multiple events into single notification
 * [ ] Notification history: show past queued notifications
 * [ ] A/B testing: test different notification strategies
 * [ ] Analytics: track which notification types user engages with
 */
