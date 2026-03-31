// Service Worker for RAAN - Push Notifications + Advanced Caching
// v4 - Fixed stale cache issues that caused white screen on mobile after deployments

const CACHE_VERSION = 'v4';
const STATIC_CACHE = `raan-static-${CACHE_VERSION}`;
const API_CACHE = `raan-api-${CACHE_VERSION}`;
const RUNTIME_CACHE = `raan-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = '/';
const DB_NAME = 'raan-notifications';
const STORE_NAME = 'pending-notifications';

// ⚠️ لا نخزّن '/' (HTML) مسبقاً — Vite يولّد أسماء ملفات مختلفة مع كل بناء
// تخزين HTML القديم يسبب شاشة بيضاء لأنه يشير لملفات JS محذوفة
const STATIC_ASSETS = [
  '/favicon.ico',
  '/logo.png',
  '/manifest.json'
];

// API endpoints with their cache durations (in seconds)
const API_CACHE_CONFIG = {
  // Mapbox token - cache for 24 hours
  'mapbox-proxy?action=token': { maxAge: 86400, strategy: 'cache-first' },
  // Vehicle types - cache for 24 hours
  'vehicle_types': { maxAge: 86400, strategy: 'cache-first' },
  // Regions - cache for 24 hours  
  'regions': { maxAge: 86400, strategy: 'cache-first' },
  // Landmarks - cache for 12 hours
  'landmarks': { maxAge: 43200, strategy: 'cache-first' },
  // App settings - cache for 5 minutes (reduced to prevent excessive caching)
  'app_settings': { maxAge: 300, strategy: 'network-first' },
  // Promo banners - cache for 30 minutes
  'promo_banners': { maxAge: 1800, strategy: 'network-first' },
  // Saved places - cache for 5 minutes
  'saved_places': { maxAge: 300, strategy: 'network-first' },
  // Fare calculation - cache for 5 minutes
  'calculate-fare': { maxAge: 300, strategy: 'network-first' },
  // Service area check - cache for 5 minutes
  'check-service-area': { maxAge: 300, strategy: 'network-first' },
  // Directions - cache for 10 minutes
  'directions': { maxAge: 600, strategy: 'network-first' },
  // Geocoding - cache for 1 hour
  'reverse-geocode': { maxAge: 3600, strategy: 'cache-first' },
  'geocode': { maxAge: 3600, strategy: 'cache-first' }
};

// Static file extensions to cache aggressively
const STATIC_EXTENSIONS = ['.js', '.css', '.woff2', '.woff', '.ttf', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico'];

// IndexedDB helper functions
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function addToOfflineQueue(notification) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await store.add({
      ...notification,
      queuedAt: Date.now()
    });
    console.log('[SW] Notification queued for offline');
  } catch (error) {
    console.error('[SW] Failed to queue notification:', error);
  }
}

async function getOfflineQueue() {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW] Failed to get offline queue:', error);
    return [];
  }
}

async function clearOfflineQueue() {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await store.clear();
    console.log('[SW] Offline queue cleared');
  } catch (error) {
    console.error('[SW] Failed to clear offline queue:', error);
  }
}

// Track notification open with server
async function trackNotificationOpen(notificationId) {
  if (!notificationId) return;
  
  try {
    const response = await fetch('https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/send-push-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'notification_opened',
        notification_id: notificationId,
        opened_at: new Date().toISOString()
      })
    });
    
    if (response.ok) {
      console.log('[SW] Notification open tracked:', notificationId);
    }
  } catch (error) {
    console.error('[SW] Failed to track notification open:', error);
    await addToOfflineQueue({
      type: 'open_tracking',
      notificationId,
      openedAt: Date.now()
    });
  }
}

// Process offline queue when back online
async function processOfflineQueue() {
  const queue = await getOfflineQueue();
  
  if (queue.length === 0) return;
  
  console.log(`[SW] Processing ${queue.length} queued items`);
  
  for (const item of queue) {
    try {
      if (item.type === 'open_tracking') {
        await fetch('https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/send-push-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'notification_opened',
            notification_id: item.notificationId,
            opened_at: new Date(item.openedAt).toISOString()
          })
        });
      }
    } catch (error) {
      console.error('[SW] Failed to process queued item:', error);
      return;
    }
  }
  
  await clearOfflineQueue();
}

// Check if response is still fresh based on cache config
function isResponseFresh(response, maxAge) {
  if (!response) return false;
  const cachedAt = response.headers.get('sw-cached-at');
  if (!cachedAt) return false;
  const age = (Date.now() - parseInt(cachedAt)) / 1000;
  return age < maxAge;
}

// Limit cache size for API responses (max 50 entries per cache)
async function limitCacheSize(cacheName, maxEntries = 50) {
  try {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    if (requests.length > maxEntries) {
      const entriesToDelete = requests.slice(0, requests.length - maxEntries);
      for (const request of entriesToDelete) {
        await cache.delete(request);
      }
      console.log(`[SW] Limited ${cacheName} to ${maxEntries} entries, deleted ${entriesToDelete.length}`);
    }
  } catch (error) {
    console.error(`[SW] Failed to limit cache size for ${cacheName}:`, error);
  }
}

// Add timestamp header to response before caching
function addCacheTimestamp(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cached-at', Date.now().toString());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// Get cache config for URL
function getCacheConfig(url) {
  for (const [pattern, config] of Object.entries(API_CACHE_CONFIG)) {
    if (url.includes(pattern)) {
      return config;
    }
  }
  return null;
}

// Check if URL is a static asset
function isStaticAsset(url) {
  return STATIC_EXTENSIONS.some(ext => url.includes(ext));
}

// Install event - pre-cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v3 with enhanced caching...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
  
  // Start periodic cleanup (every 10 minutes)
  setInterval(periodicCacheCleanup, 600000);
});

// Periodic cache cleanup to prevent excessive memory usage
async function periodicCacheCleanup() {
  try {
    const cache = await caches.open(API_CACHE);
    const requests = await cache.keys();
    const now = Date.now();
    let cleaned = 0;
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const cachedAt = parseInt(response.headers.get('sw-cached-at') || 0);
        // Remove entries older than 24 hours
        if (now - cachedAt > 86400000) {
          await cache.delete(request);
          cleaned++;
        }
      }
    }
    
    if (cleaned > 0) {
      console.log(`[SW] Periodic cleanup: removed ${cleaned} old cache entries`);
    }
    
    // Also maintain size limit
    await limitCacheSize(API_CACHE, 50);
  } catch (error) {
    console.error('[SW] Periodic cleanup failed:', error);
  }
}

// Activate event - clean up old caches and expired entries
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v3...');
  event.waitUntil(
    Promise.all([
      // Clean up old version caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Delete old version caches
              return name.startsWith('raan-') && 
                     !name.includes(CACHE_VERSION);
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
      // Clean up expired entries from current API cache
      caches.open(API_CACHE).then((cache) => {
        return cache.keys().then((requests) => {
          const now = Date.now();
          let cleaned = 0;
          
          return Promise.all(
            requests.map(async (request) => {
              const response = await cache.match(request);
              if (response) {
                const cachedAt = parseInt(response.headers.get('sw-cached-at') || 0);
                const maxAge = 86400000; // 24 hours default max age in ms
                
                if (now - cachedAt > maxAge) {
                  await cache.delete(request);
                  cleaned++;
                }
              }
            })
          ).then(() => {
            if (cleaned > 0) {
              console.log(`[SW] Cleaned ${cleaned} expired entries from API cache`);
            }
          });
        });
      })
    ])
  );
  self.clients.claim();
});

// Smart notification configuration based on ETA
function getSmartNotificationConfig(notificationType, etaMinutes) {
  const configs = {
    // Driver location update - silent for far distances
    'UPDATE_DRIVER_LOCATION': {
      silent: etaMinutes > 5,
      vibrate: etaMinutes <= 2 ? [200, 100, 200] : [100],
      requireInteraction: false,
      tag: 'driver-location'
    },
    // Driver is approaching - 2-5 minutes away
    'DRIVER_APPROACHING': {
      silent: false,
      vibrate: [300, 100, 300],
      requireInteraction: true,
      tag: 'driver-approaching'
    },
    // Driver is arriving - less than 2 minutes
    'DRIVER_ARRIVING': {
      silent: false,
      vibrate: [500, 200, 500, 200, 500],
      requireInteraction: true,
      tag: 'driver-arriving'
    },
    // Driver has arrived
    'DRIVER_ARRIVED': {
      silent: false,
      vibrate: [1000, 300, 1000, 300, 1000],
      requireInteraction: true,
      tag: 'driver-arrived'
    },
    // New ride request (for drivers) — أقوى إشعار: اهتزاز متكرر + إجباري
    'NEW_RIDE_REQUEST': {
      silent: false,
      vibrate: [500, 150, 500, 150, 500, 150, 500, 150, 800],
      requireInteraction: true,
      tag: 'new-ride'
    },
    // new_ride from push (variant tag from Edge Function)
    'new_ride': {
      silent: false,
      vibrate: [500, 150, 500, 150, 500, 150, 500, 150, 800],
      requireInteraction: true,
      tag: 'new-ride'
    },
    // Ride status change
    'RIDE_STATUS_CHANGE': {
      silent: false,
      vibrate: [300, 100, 300],
      requireInteraction: true,
      tag: 'ride-status'
    }
  };

  return configs[notificationType] || {
    silent: false,
    vibrate: [300, 100, 300, 100, 400],
    requireInteraction: true,
    tag: 'raan-notification'
  };
}

// Push event - handle incoming push notifications with smart logic
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);

  let data = {
    title: '🚗 ران كابتن',
    body: 'لديك إشعار جديد',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: 'raan-notification',
    data: { url: '/driver' }
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
      
      const notificationType = payload.data?.type || payload.type;
      const etaMinutes = payload.data?.eta_minutes || 999;
      
      // Get smart configuration based on notification type and ETA
      const smartConfig = getSmartNotificationConfig(notificationType, etaMinutes);
      
      // Handle silent notifications (location updates when driver is far)
      if (smartConfig.silent || payload.data?.silent) {
        console.log('[Service Worker] Silent push received, updating UI only');
        event.waitUntil(
          self.clients.matchAll({ type: 'window' }).then((clients) => {
            clients.forEach((client) => {
              client.postMessage({
                type: 'SILENT_PUSH',
                notificationType: notificationType,
                data: payload.data
              });
            });
          })
        );
        return;
      }

      // Smart notification options based on urgency
      const options = {
        body: data.body,
        icon: data.icon || '/logo.png',
        badge: data.badge || '/logo.png',
        image: data.image,
        tag: smartConfig.tag,
        vibrate: smartConfig.vibrate,
        requireInteraction: smartConfig.requireInteraction,
        renotify: true,
        actions: getActionsForType(notificationType, payload.data),
        data: {
          ...data.data,
          notificationType,
          receivedAt: Date.now()
        }
      };

      event.waitUntil(
        self.registration.showNotification(data.title, options)
      );
      return;
    } catch (e) {
      data.body = event.data.text();
    }
  }

  // Default notification for non-smart pushes
  const options = {
    body: data.body,
    icon: data.icon || '/logo.png',
    badge: data.badge || '/logo.png',
    image: data.image,
    tag: data.tag || 'raan-notification',
    vibrate: [300, 100, 300, 100, 400],
    requireInteraction: true,
    renotify: true,
    actions: [
      { action: 'open', title: 'فتح التطبيق' },
      { action: 'dismiss', title: 'تجاهل' }
    ],
    data: {
      ...data.data,
      receivedAt: Date.now()
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Get actions based on notification type
function getActionsForType(notificationType, data) {
  switch (notificationType) {
    case 'NEW_RIDE_REQUEST':
      return [
        { action: 'accept', title: '✅ قبول' },
        { action: 'reject', title: '❌ رفض' }
      ];
    case 'DRIVER_ARRIVED':
      return [
        { action: 'open', title: '🚗 أنا قادم' },
        { action: 'call', title: '📞 اتصال بالسائق' }
      ];
    case 'DRIVER_ARRIVING':
    case 'DRIVER_APPROACHING':
      return [
        { action: 'open', title: 'عرض الموقع' }
      ];
    case 'RIDE_STATUS_CHANGE':
      return [
        { action: 'open', title: 'عرض التفاصيل' }
      ];
    default:
      return [
        { action: 'open', title: 'فتح التطبيق' },
        { action: 'dismiss', title: 'تجاهل' }
      ];
  }
}

// Notification click event with open tracking
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click:', event.action);
  
  const notificationData = event.notification.data || {};
  const notificationId = notificationData.notificationId;
  
  event.notification.close();

  // Track the notification open
  if (notificationId) {
    event.waitUntil(trackNotificationOpen(notificationId));
  }

  if (event.action === 'dismiss') {
    return;
  }

  const rideIdFromNotification = notificationData.rideId;
  const urlToOpen = notificationData.url || (rideIdFromNotification ? `/driver?ride_id=${rideIdFromNotification}&action=open_request` : '/driver');

  // Handle accept action — قبول الرحلة مباشرة من الإشعار
  if (event.action === 'accept' && notificationData.rideId) {
    console.log('[Service Worker] ✅ Accepting ride from notification:', notificationData.rideId);
    
    event.waitUntil(
      // إرسال رسالة للتطبيق المفتوح لقبول الرحلة
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
        // محاولة إبلاغ التطبيق المفتوح أولاً
        let clientFound = false;
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            client.postMessage({
              type: 'ACCEPT_RIDE_FROM_NOTIFICATION',
              rideId: notificationData.rideId
            });
            client.focus();
            clientFound = true;
            break;
          }
        }
        
        // إذا لم يكن التطبيق مفتوحاً، فتح نافذة جديدة مع معلمات القبول
        if (!clientFound && clients.openWindow) {
          return clients.openWindow(`/driver?ride_id=${notificationData.rideId}&action=accept&accept_ride=${notificationData.rideId}`);
        }
      })
    );
    return;
  }

  if ((event.action === 'open' || event.action === '') && notificationData.rideId) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
        let clientFound = false;
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            client.postMessage({
              type: 'OPEN_RIDE_REQUEST_FROM_NOTIFICATION',
              rideId: notificationData.rideId,
            });
            await client.navigate(`/driver?ride_id=${notificationData.rideId}&action=open_request`);
            clientFound = true;
            return client.focus();
          }
        }

        if (!clientFound && clients.openWindow) {
          return clients.openWindow(`/driver?ride_id=${notificationData.rideId}&action=open_request`);
        }
      })
    );
    return;
  }

  // Handle reject action
  if (event.action === 'reject' && notificationData.rideId) {
    console.log('[Service Worker] ❌ Ride rejected from notification:', notificationData.rideId);
    // لا حاجة لعمل أي شيء — مجرد إغلاق الإشعار
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          // Send message to client about the notification
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: notificationData
          });
          return client.focus();
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification close event (dismissed without clicking)
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification dismissed');
  // Could track dismissals for analytics
});

// Background sync for offline updates
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-location') {
    event.waitUntil(syncDriverLocation());
  }
  
  if (event.tag === 'sync-notifications') {
    event.waitUntil(processOfflineQueue());
  }
});

// Online event - process offline queue
self.addEventListener('online', () => {
  console.log('[Service Worker] Back online, processing queue');
  processOfflineQueue();
});

// Sync driver location when back online
async function syncDriverLocation() {
  try {
    const pendingUpdates = await getStoredLocationUpdates();
    for (const update of pendingUpdates) {
      await sendLocationToServer(update);
    }
    await clearStoredLocationUpdates();
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
  }
}

// Helper functions for IndexedDB operations (location)
async function getStoredLocationUpdates() {
  return [];
}

async function sendLocationToServer(update) {
  console.log('[Service Worker] Sending location update:', update);
}

async function clearStoredLocationUpdates() {
  console.log('[Service Worker] Cleared stored updates');
}

// Fetch event - Multi-strategy caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle Supabase API requests with smart caching
  if (url.includes('supabase.co')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle Mapbox tile/API requests - cache aggressively
  if (url.includes('mapbox.com') || url.includes('tiles.mapbox.com')) {
    event.respondWith(handleMapboxRequest(event, request));
    return;
  }

  // Handle same-origin requests
  if (url.startsWith(self.location.origin)) {
    // Static assets - cache first strategy
    if (isStaticAsset(url)) {
      event.respondWith(handleStaticAsset(request));
      return;
    }

    // HTML/Navigation - network first
    event.respondWith(handleNavigationRequest(request));
    return;
  }
});

// Handle API requests with configurable caching strategies
async function handleApiRequest(request) {
  const url = request.url;
  const cacheConfig = getCacheConfig(url);

  // No caching for this endpoint - always fetch
  if (!cacheConfig) {
    try {
      return await fetch(request);
    } catch (error) {
      console.log('[SW] API request failed, no cache available');
      throw error;
    }
  }

  const cache = await caches.open(API_CACHE);

  // Cache-first strategy
  if (cacheConfig.strategy === 'cache-first') {
    const cachedResponse = await cache.match(request);

    if (cachedResponse && isResponseFresh(cachedResponse, cacheConfig.maxAge)) {
      console.log('[SW] Cache hit (fresh):', url);
      return cachedResponse;
    }

    // Fetch fresh data
    try {
      const response = await fetch(request);
      if (response.ok) {
        const responseToCache = addCacheTimestamp(response.clone());
        await cache.put(request, responseToCache);
        // Limit cache size to prevent excessive memory usage
        await limitCacheSize(API_CACHE, 50);
        console.log('[SW] Cached API response:', url);
      }
      return response;
    } catch (error) {
      // Return stale cache if available
      if (cachedResponse) {
        console.log('[SW] Using stale cache:', url);
        return cachedResponse;
      }
      throw error;
    }
  }

  // Network-first strategy (default)
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = addCacheTimestamp(response.clone());
      await cache.put(request, responseToCache);
      // Limit cache size to prevent excessive memory usage
      await limitCacheSize(API_CACHE, 50);
    }
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[SW] Network failed, using cache:', url);
      return cachedResponse;
    }
    throw error;
  }
}

// Handle Mapbox requests - aggressive caching for tiles
async function handleMapboxRequest(event, request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Return cached immediately, refresh in background
    event.waitUntil(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
        })
        .catch(() => {})
    );

    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Mapbox request failed');
    throw error;
  }
}

// Handle static assets - network first for hashed JS/CSS, cache fallback for offline
async function handleStaticAsset(request) {
  const url = request.url;
  const cache = await caches.open(STATIC_CACHE);

  // Vite hashed assets (مثل index-BMDhVPbd.js) — آمنة للتخزين لأن الاسم يتغير مع كل بناء
  const isHashedAsset = /\/assets\/[^/]+-[a-zA-Z0-9]{8}\.(js|css)$/.test(url);

  if (isHashedAsset) {
    // Cache-first للملفات المهشّرة (اسمها فريد)
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    try {
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    } catch (error) {
      console.log('[SW] Hashed asset fetch failed:', url);
      throw error;
    }
  }

  // Non-hashed assets (logo, favicon) — network first, cache fallback
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    // إرجاع استجابة فارغة بدلاً من throw — يمنع أخطاء الكونسول للأصول غير الحرجة مثل favicon
    console.log('[SW] Static asset fetch failed (returning empty):', url);
    return new Response('', { status: 200, headers: { 'Content-Type': 'image/x-icon' } });
  }
}

// Handle navigation requests — ALWAYS network (never serve stale HTML)
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    // ⚠️ لا نخزّن HTML في الكاش — لتجنب شاشة بيضاء بعد كل deployment
    return response;
  } catch (error) {
    // فقط عند عدم الاتصال: نعيد صفحة بسيطة
    return new Response(
      '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ران</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0f172a;color:#fff;text-align:center}button{padding:12px 24px;background:#10b981;border:none;border-radius:8px;color:#fff;font-size:16px;cursor:pointer;margin-top:16px}</style></head><body><div><h2>⚠️ لا يوجد اتصال بالإنترنت</h2><p>يرجى التحقق من اتصالك وإعادة المحاولة</p><button onclick="location.reload()">إعادة المحاولة</button></div></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'PROCESS_OFFLINE_QUEUE') {
    processOfflineQueue();
  }

  // Clear specific caches
  if (event.data.type === 'CLEAR_API_CACHE') {
    caches.delete(API_CACHE).then(() => {
      console.log('[SW] API cache cleared');
    });
  }

  // Prefetch important resources
  if (event.data.type === 'PREFETCH') {
    const urls = event.data.urls || [];
    caches.open(RUNTIME_CACHE).then(cache => {
      urls.forEach(url => {
        fetch(url).then(response => {
          if (response.ok) {
            cache.put(url, response);
          }
        }).catch(() => {});
      });
    });
  }

  if (event.data.type === 'NEW_RIDE_NOTIFICATION') {
    const { ride } = event.data;
    self.registration.showNotification('🚗 طلب رحلة جديد!', {
      body: `${ride.estimatedFare?.toLocaleString() || 0} د.ع - ${ride.pickupAddress || 'موقع غير محدد'}`,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: `new-ride-${ride.id}`,
      vibrate: [500, 150, 500, 150, 500, 150, 500, 150, 800],
      requireInteraction: true,
      renotify: true,
      silent: false,
      actions: [
        { action: 'accept', title: '✅ قبول' },
        { action: 'reject', title: '❌ رفض' }
      ],
      data: { rideId: ride.id, url: '/driver', type: 'NEW_RIDE_REQUEST' }
    });
  }

  // قبول الرحلة من إشعار — يُرسل من الصفحة الرئيسية بعد معالجة URL params
  if (event.data.type === 'ACCEPT_RIDE_FROM_NOTIFICATION') {
    console.log('[SW] Ride accept request forwarded:', event.data.rideId);
  }

  // Get cache stats
  if (event.data.type === 'GET_CACHE_STATS') {
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => cache.keys()),
      caches.open(API_CACHE).then(cache => cache.keys()),
      caches.open(RUNTIME_CACHE).then(cache => cache.keys())
    ]).then(([staticKeys, apiKeys, runtimeKeys]) => {
      event.source.postMessage({
        type: 'CACHE_STATS',
        stats: {
          static: staticKeys.length,
          api: apiKeys.length,
          runtime: runtimeKeys.length,
          total: staticKeys.length + apiKeys.length + runtimeKeys.length
        }
      });
    });
  }
});
