/**
 * Event Deduplication Module - Technical Documentation
 * ============================================================================
 * 
 * PURPOSE:
 * Prevent duplicate ride events from being processed on Rider/Driver sides
 * using Lamport timestamps for distributed event ordering.
 * 
 * PROBLEM SOLVED:
 * - Rider accepts ride → both rider and driver get "ride-accepted" notification
 * - Network retransmission → same event arrives twice
 * - Without dedup: Rider sees notification twice, state updates twice
 * - With dedup: Event processed exactly once on each node
 * 
 * ============================================================================
 * FILE STRUCTURE
 * ============================================================================
 * 
 * src/lib/eventDeduplication/
 *   ├── types.ts                      # Type definitions
 *   ├── EventDeduplicator.ts          # Core deduplication engine
 *   └── index.ts                      # Exports
 * 
 * src/hooks/
 *   ├── useRideEventQueue.ts          # Low-level event queuing hook
 *   └── useRealtimeRideEvents.ts      # High-level Realtime integration hook
 * 
 * ============================================================================
 * CORE COMPONENTS
 * ============================================================================
 * 
 * 1. EventDeduplicator (Core Engine)
 *    - Maintains Lamport clock for ordering
 *    - Tracks processed event IDs (Set)
 *    - Tracks event hashes (Map)
 *    - Queues events in order
 *    - Provides statistics
 *    
 *    Key Methods:
 *    - processEvent(event): Deduplicates and queues
 *    - getNextEvent(): Get next in order
 *    - getAllPendingEvents(): Get all ordered events
 *    - clearRideEvents(rideId): Clean up after ride ends
 *    - getStats(): Monitoring/debugging
 *    
 * 2. useRideEventQueue Hook
 *    - Low-level hook for manual event control
 *    - Used when you need custom logic
 *    - Direct access to EventDeduplicator
 *    
 *    Use When:
 *    - Custom event processing
 *    - WebSocket integration
 *    - Advanced filtering
 *    
 * 3. useRealtimeRideEvents Hook
 *    - High-level hook for Supabase Realtime
 *    - Automatically subscribes to ride channel
 *    - Automatic event dispatching
 *    - Recommended for most use cases
 *    
 *    Use When:
 *    - Component receives Supabase Realtime events
 *    - Standard ride event handling
 *    - Integration with GoPage/DriverHome
 * 
 * ============================================================================
 * HOW DEDUPLICATION WORKS
 * ============================================================================
 * 
 * Step 1: Lamport Clock Update
 * ────────────────────────────
 * Rule: lamportClock = max(currentClock, receivedClock) + 1
 * 
 * Example Timeline:
 *   Rider-side (local clock: 0)
 *   - User clicks "Accept Ride"
 *   - Generate event with lamportTS = 1
 *   - Send to server
 *   
 *   Driver-side (local clock: 0)
 *   - Receive event with lamportTS = 1
 *   - Update clock: max(0, 1) + 1 = 2
 *   - Add event to queue
 *   
 * Benefit: Events always have monotonically increasing timestamps,
 *          ensuring proper ordering even if they arrive out of order
 * 
 * Step 2: Event ID Deduplication
 * ───────────────────────────────
 * Each event has a UUID: "ride-accepted-uuid-123"
 * 
 * Scenario: Network retransmission
 *   - First attempt: Event ID "uuid-123" arrives and is processed
 *   - Network retransmits: Same "uuid-123" arrives again
 *   - Action: Check processedEventIds.has("uuid-123")
 *   - Result: Rejected as duplicate
 *   - Stat: stats.duplicatesFiltered++
 * 
 * Step 3: Hash-Based Deduplication
 * ──────────────────────────────────
 * Hash = SHA256(rideId + eventType + source + JSON.stringify(payload))
 * 
 * Scenario: Same event generated independently
 *   - Event 1: "ride-accepted" from Rider with eventId="id1"
 *   - Event 2: "ride-accepted" from Rider with eventId="id2" (network bug)
 *   - Hash 1: "abc123abc..."
 *   - Hash 2: "abc123abc..." (same!)
 *   - Check: dedupHashes.has("abc123abc...")
 *   - Result: Rejected as duplicate
 * 
 * Step 4: Location-Update Special Handling
 * ──────────────────────────────────────────
 * Events within 2 seconds AND <5 meters are considered duplicates
 * 
 * Scenario: GPS noise
 *   - Location update 1: lat=33.3123, lng=44.3612, timestamp=1000ms
 *   - Location update 2: lat=33.3124, lng=44.3613, timestamp=1200ms (noise)
 *   - Distance = 13 meters
 *   - Result: Processed (beyond 5m threshold)
 *   
 * Scenario: Duplicate GPS update
 *   - Location update 1: lat=33.3123, lng=44.3612, timestamp=1000ms
 *   - Location update 2: lat=33.3123, lng=44.3612, timestamp=1100ms (dup)
 *   - Distance = 0 meters
 *   - Result: Rejected as duplicate
 * 
 * ============================================================================
 * EVENT FLOW DIAGRAM
 * ============================================================================
 * 
 * Supabase Realtime Channel
 *          ↓
 *   [Incoming Event]
 *          ↓
 *   Update Lamport Clock
 *          ↓
 *   Check Event ID in Set
 *   ├─ Found? → Reject (duplicate)
 *   └─ New? → Continue
 *          ↓
 *   Generate Hash
 *          ↓
 *   Check Hash in Map
 *   ├─ Found? → Reject (duplicate)
 *   └─ New? → Continue
 *          ↓
 *   [Location-update?]
 *   ├─ Yes → Check distance/time
 *   │   ├─ <5m & <2s? → Reject
 *   │   └─ Otherwise? → Process
 *   └─ No → Process
 *          ↓
 *   [Process Event]
 *   ├─ Add to processedEventIds
 *   ├─ Add to dedupHashes
 *   ├─ Add to eventQueue
 *   ├─ Sort by Lamport timestamp
 *   └─ Dispatch callback
 *          ↓
 *   Component State Update
 * 
 * ============================================================================
 * USAGE EXAMPLES
 * ============================================================================
 * 
 * EXAMPLE 1: Basic Usage in GoPage (Rider)
 * ─────────────────────────────────────────
 * 
 * import { useRealtimeRideEvents } from '@/hooks/useRealtimeRideEvents';
 * 
 * export function GoPage() {
 *   const { rideId } = useBookingFlow();
 *   
 *   const { isConnected, stats } = useRealtimeRideEvents({
 *     rideId,
 *     nodeId: 'rider',
 *     onRideAccepted: (data) => {
 *       console.log('Driver accepted!', data);
 *       playSound();
 *     },
 *   });
 *   
 *   return <div>Connected: {isConnected}</div>;
 * }
 * 
 * EXAMPLE 2: Advanced Usage in DriverHome
 * ────────────────────────────────────────
 * 
 * import { useRealtimeRideEvents } from '@/hooks/useRealtimeRideEvents';
 * 
 * export function DriverHome() {
 *   const { activeRideId } = useActiveRide();
 *   const [driverLocation, setDriverLocation] = useState(null);
 *   
 *   const { emitLocalEvent, stats } = useRealtimeRideEvents({
 *     rideId: activeRideId,
 *     nodeId: 'driver',
 *     
 *     onLocationUpdate: (data) => {
 *       setRiderLocation(data);
 *     },
 *     
 *     onDriverArrived: (data) => {
 *       showNotification('Ride complete!');
 *     },
 *   });
 *   
 *   // Emit driver's location every 5 seconds
 *   useEffect(() => {
 *     const interval = setInterval(async () => {
 *       const location = await getGPSLocation();
 *       await emitLocalEvent('location-update', {
 *         latitude: location.lat,
 *         longitude: location.lng,
 *       });
 *     }, 5000);
 *     
 *     return () => clearInterval(interval);
 *   }, [emitLocalEvent]);
 *   
 *   return (
 *     <div>
 *       Duplicates filtered: {stats.duplicatesFiltered}
 *     </div>
 *   );
 * }
 * 
 * ============================================================================
 * MONITORING & DEBUGGING
 * ============================================================================
 * 
 * Check Deduplication Working:
 * ──────────────────────────────
 * const { stats } = useRealtimeRideEvents(...);
 * console.log(stats);
 * 
 * Output:
 * {
 *   totalEvents: 542,              // Events received
 *   duplicatesFiltered: 45,         // Duplicates caught
 *   eventsProcessed: 497,           // Unique events processed
 *   lastProcessedTimestamp: 1234567890,
 *   queueSize: 5,
 *   processedIdsCacheSize: 497,
 *   dedupHashesCacheSize: 497
 * }
 * 
 * Monitor Lamport Clock:
 * ──────────────────────
 * Lamport timestamp increases monotonically, even if network reorders events.
 * If you see: [TS: 10, TS: 8, TS: 9] arriving
 * After processing: Events reordered to [TS: 8, TS: 9, TS: 10]
 * This proves deduplication is working correctly.
 * 
 * ============================================================================
 * PERFORMANCE CHARACTERISTICS
 * ============================================================================
 * 
 * Time Complexity:
 * - processEvent: O(log n) for Set lookup + O(n log n) for sort
 * - getNextEvent: O(n log n) for sort (n = queue size, typically 5-50)
 * - Memory: O(n) for hashes/IDs + O(m) for queue
 * 
 * Space Complexity per Ride:
 * - Typical ride (20 minutes, 1 event/second): 1,200 events
 * - Each event ID: 36 bytes (UUID)
 * - Each hash: 65 bytes (SHA256 hex)
 * - Event objects: varies (20-200 bytes each)
 * - Total: ~200 KB peak per ride
 * 
 * Network Impact:
 * - Zero additional network (uses existing Realtime channel)
 * - Slightly smaller payloads (no duplicate retransmissions)
 * - Bandwidth saved: ~5-10 KB per ride
 * 
 * ============================================================================
 * TESTING CHECKLIST
 * ============================================================================
 * 
 * [ ] Test 1: Duplicate event ID rejected
 *     - Send same event twice
 *     - Verify stats.duplicatesFiltered increased
 *     - Verify callback only fired once
 * 
 * [ ] Test 2: Out-of-order events reordered
 *     - Send events with TS: 10, 8, 9
 *     - Verify queue processes as: 8, 9, 10
 * 
 * [ ] Test 3: Location-update deduplication
 *     - Send two locations within 2s and <5m
 *     - Verify second is rejected
 *     - Send locations >5m apart
 *     - Verify both processed
 * 
 * [ ] Test 4: ride-accepted processes exactly once on each side
 *     - Rider accepts
 *     - Event arrives on Rider side → callback fires
 *     - Event arrives on Driver side → callback fires
 *     - Simulate network retransmit on both sides
 *     - Verify callbacks don't fire additional times
 * 
 * [ ] Test 5: Graceful cleanup after ride
 *     - Complete a ride
 *     - Call clearEvents()
 *     - Verify memory released
 * 
 * ============================================================================
 * KNOWN LIMITATIONS & FUTURE IMPROVEMENTS
 * ============================================================================
 * 
 * Current Limitations:
 * - Requires UUID for eventId (if missing, generated locally)
 * - Location-update dedup uses Haversine (acceptable for ride tracking)
 * - No persistent storage (in-memory only, lost on app restart)
 * - Single EventDeduplicator per ride (not across multiple rides)
 * 
 * Future Improvements:
 * - IndexedDB persistence for app crashes
 * - Automatic Lamport clock sync on reconnect
 * - Configurable dedup strategies (strict/loose)
 * - Event audit log for debugging
 * - Distributed tracing with request IDs
 * 
 * ============================================================================
 */
