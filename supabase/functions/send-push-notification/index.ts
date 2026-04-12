// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeSendPushRequest } from "../_shared/pushFunctionAuth.ts";
import { corsHeaders as baseCorsHeaders } from "../_shared/utils.ts";

const corsHeaders = {
  ...baseCorsHeaders,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  image?: string; // Rich notification image
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string }>;
}

interface RideData {
  id: string;
  pickup_address?: string;
  dropoff_address?: string;
  estimated_fare?: number;
  distance_km?: number;
  vehicle_type?: string;
  pickup_lat?: number;
  pickup_lng?: number;
}

interface SendResult {
  success: boolean;
  error?: string;
  attempts?: number;
  delivery_delay_ms?: number;
}

// Generate unique notification ID
function generateNotificationId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Log notification to database with enhanced tracking
async function logNotification(
  supabase: any,
  driver_id: string | null,
  notification_type: string,
  title: string,
  body: string,
  data: Record<string, unknown> | null,
  status: 'sent' | 'failed',
  error_message?: string,
  retry_count: number = 0,
  notification_id?: string,
  sent_at?: Date
): Promise<void> {
  try {
    const delivery_delay_ms = sent_at ? Date.now() - sent_at.getTime() : null;
    
    await supabase.from('notifications_log').insert({
      driver_id,
      notification_type,
      title,
      body,
      data,
      status,
      error_message,
      retry_count,
      notification_id,
      sent_at: sent_at?.toISOString() || new Date().toISOString(),
      delivered_at: status === 'sent' ? new Date().toISOString() : null,
      delivery_delay_ms
    });
    
    // Update analytics
    await supabase.rpc('update_notification_analytics', {
      p_notification_type: notification_type,
      p_is_sent: status === 'sent',
      p_is_delivered: status === 'sent',
      p_is_failed: status === 'failed',
      p_delivery_delay_ms: delivery_delay_ms
    });
    
    console.log(`Notification logged: ${notification_type} - ${status} (retry: ${retry_count})`);
  } catch (err) {
    console.error('Failed to log notification:', err);
  }
}

// Calculate distance between two points using Haversine formula
function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ═══════════════════════════════════════════════════════
// Firebase Cloud Messaging (FCM) HTTP v1 API
// يرسل إشعارات أصلية للتطبيقات عبر FCM
// ═══════════════════════════════════════════════════════

let _cachedAccessToken: { token: string; expiresAt: number } | null = null;

function getFirebaseProjectId(): string | null {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) return null;
  try { return JSON.parse(raw).project_id; } catch { return null; }
}

async function getFirebaseAccessToken(): Promise<string | null> {
  // Use cached token if still valid
  if (_cachedAccessToken && Date.now() < _cachedAccessToken.expiresAt) {
    return _cachedAccessToken.token;
  }

  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) {
    console.log('FIREBASE_SERVICE_ACCOUNT not configured — FCM disabled');
    return null;
  }

  try {
    const sa = JSON.parse(raw);
    const now = Math.floor(Date.now() / 1000);

    // Base64url encode helper
    const b64url = (input: string | ArrayBuffer): string => {
      const str = typeof input === 'string'
        ? btoa(input)
        : btoa(String.fromCharCode(...new Uint8Array(input as ArrayBuffer)));
      return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    };

    // Build JWT
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }));
    const signingInput = `${header}.${claims}`;

    // Import RSA private key from PEM
    const pemClean = sa.private_key
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\s/g, '');
    const binaryKey = Uint8Array.from(atob(pemClean), (c: string) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8', binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    );

    // Sign JWT
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5', cryptoKey,
      new TextEncoder().encode(signingInput)
    );
    const jwt = `${signingInput}.${b64url(signature)}`;

    // Exchange JWT for access token
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });

    if (!resp.ok) {
      console.error('Firebase token exchange failed:', await resp.text());
      return null;
    }

    const tokenData = await resp.json();
    _cachedAccessToken = {
      token: tokenData.access_token,
      expiresAt: Date.now() + (tokenData.expires_in - 120) * 1000,
    };
    console.log('✅ Firebase access token obtained');
    return _cachedAccessToken.token;
  } catch (err) {
    console.error('Firebase auth error:', err);
    return null;
  }
}

function isNewRidePayload(payload: PushPayload): boolean {
  const t = payload.data?.type;
  return t === 'new_ride' || t === 'NEW_RIDE_REQUEST';
}

async function sendFCMNotification(
  fcmToken: string,
  payload: PushPayload,
  channelId: string = 'raan-rides'
): Promise<SendResult> {
  const startTime = Date.now();
  const accessToken = await getFirebaseAccessToken();
  if (!accessToken) return { success: false, error: 'fcm_not_configured' };

  const projectId = getFirebaseProjectId();
  if (!projectId) return { success: false, error: 'firebase_project_id_missing' };

  try {
    // FCM data values must be strings
    const fcmData: Record<string, string> = {};
    if (payload.data) {
      for (const [k, v] of Object.entries(payload.data)) {
        if (v !== undefined && v !== null) fcmData[k] = String(v);
      }
    }

    const urgentRide = isNewRidePayload(payload);
    const message: Record<string, unknown> = {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.image ? { image: payload.image } : {}),
      },
      data: fcmData,
      android: {
        priority: 'high',
        notification: {
          channel_id: channelId,
          sound: 'default',
          default_vibrate_timings: true,
          // أيقونة الإشعار: monochrome (أبيض/شفاف على Android 5+)
          icon: 'ic_launcher_monochrome',
          // لون خلفية الأيقونة: أخضر ران
          color: '#1DB954',
          // طلب رحلة جديد: أقصى أولوية عند قفل الشاشة / إغلاق التطبيق
          notification_priority: urgentRide ? 'PRIORITY_MAX' : 'PRIORITY_HIGH',
        },
      },
    };

    const resp = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      }
    );

    const delivery_delay_ms = Date.now() - startTime;

    if (resp.ok) {
      console.log(`✅ FCM sent to ...${fcmToken.slice(-8)} (${delivery_delay_ms}ms)`);
      return { success: true, attempts: 1, delivery_delay_ms };
    }

    const errData = await resp.json().catch(() => ({}));
    const errMsg = (errData as any)?.error?.message || `HTTP ${resp.status}`;
    console.error(`FCM error: ${errMsg}`);

    // Token invalid/expired → mark for cleanup
    if (
      errMsg.includes('NOT_FOUND') ||
      errMsg.includes('UNREGISTERED') ||
      errMsg.includes('not a valid FCM registration token') ||
      resp.status === 404
    ) {
      return { success: false, error: 'subscription_expired', attempts: 1, delivery_delay_ms };
    }

    return { success: false, error: `FCM: ${errMsg}`, attempts: 1, delivery_delay_ms };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'FCM error', attempts: 1 };
  }
}

// ═══════════════════════════════════════════════════════
// Send push notification with retry logic
// يدعم Web Push و FCM تلقائياً بناءً على نوع الاشتراك
// ═══════════════════════════════════════════════════════

async function sendPushNotificationWithRetry(
  subscription: { endpoint: string; p256dh_key: string; auth_key: string; fcm_token?: string | null; platform?: string | null },
  payload: PushPayload,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<SendResult> {
  const hasFcmEndpoint = subscription.endpoint?.includes('fcm.googleapis.com/fcm/send/');

  // ═══ FCM path for native mobile (Capacitor stores fcm_token + fcm://<token>) ═══
  if (subscription.fcm_token) {
    const channelId = isNewRidePayload(payload) ? 'raan-rides' : 'raan-rider';
    return sendFCMNotification(subscription.fcm_token, payload, channelId);
  }

  // ═══ FCM path for web subscriptions on FCM endpoints ═══
  // Web Push subscriptions on Chromium often use FCM endpoint URLs.
  // For FCM endpoints, use only FCM v1. Direct POST to endpoint will fail (401 unauthenticated).
  if (hasFcmEndpoint) {
    const token = subscription.endpoint.split('/fcm/send/')[1];
    if (token) {
      const channelId = isNewRidePayload(payload) ? 'raan-rides' : 'raan-rider';
      return sendFCMNotification(token, payload, channelId);
    }

    return { success: false, error: 'subscription_expired' };
  }

  // Capacitor native: قد يُخزَّن endpoint كـ fcm://<token> دون عمود fcm_token (سجلات قديمة)
  if (subscription.endpoint?.startsWith('fcm://')) {
    const tokenFromEndpoint = subscription.endpoint.slice('fcm://'.length).trim();
    if (tokenFromEndpoint) {
      const channelId = isNewRidePayload(payload) ? 'raan-rides' : 'raan-rider';
      return sendFCMNotification(tokenFromEndpoint, payload, channelId);
    }
    return { success: false, error: 'invalid_web_push_endpoint' };
  }

  if (!subscription.endpoint) {
    return { success: false, error: 'invalid_web_push_endpoint' };
  }

  // ═══ Non-FCM Web Push endpoints (Firefox/Safari) ═══
  // These require VAPID authentication which is not implemented.
  // Only FCM/Chromium endpoints are supported in production.
  // Return a descriptive error instead of silently failing with retries.
  console.warn(`Unsupported non-FCM push endpoint: ${subscription.endpoint.substring(0, 60)}...`);
  return { success: false, error: 'unsupported_non_fcm_endpoint' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const body = await req.json() as Record<string, unknown>;
    const authz = await authorizeSendPushRequest(req, body, supabaseUrl, anonKey);
    if (!authz.ok) {
      return new Response(JSON.stringify({ error: authz.error }), {
        status: authz.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action } = body;
    
    // Support both direct properties and nested ride object
    const ride = body.ride || {
      id: body.ride_id,
      pickup_address: body.pickup_address,
      dropoff_address: body.dropoff_address,
      estimated_fare: body.estimated_fare,
      vehicle_type: body.vehicle_type,
      pickup_lat: body.pickup_lat,
      pickup_lng: body.pickup_lng,
      distance_km: body.distance_km
    };
    
    const { driver_ids, subscription, max_radius_km = 15, custom_title, custom_body } = body;
    console.log('Received request:', { action, ride_id: ride?.id, driver_ids_count: driver_ids?.length, max_radius_km });

    // Action: Track notification opened
    if (action === 'notification_opened') {
      const { notification_id, opened_at } = body;
      
      if (notification_id) {
        // Update the notification log with opened timestamp
        await supabase
          .from('notifications_log')
          .update({ opened_at: opened_at || new Date().toISOString() })
          .eq('notification_id', notification_id);
        
        // Get the notification type for analytics
        const { data: notifData } = await supabase
          .from('notifications_log')
          .select('notification_type')
          .eq('notification_id', notification_id)
          .single();
        
        if (notifData) {
          await supabase.rpc('update_notification_analytics', {
            p_notification_type: notifData.notification_type,
            p_is_opened: true
          });
        }
        
        console.log(`Notification ${notification_id} marked as opened`);
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: Save subscription
    if (action === 'subscribe') {
      if (!subscription || typeof subscription !== 'object') {
        return new Response(JSON.stringify({
          success: false,
          error: 'invalid_subscription_payload'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { driver_id, user_id, endpoint, p256dh_key, auth_key } = subscription as {
        driver_id?: string;
        user_id?: string;
        endpoint?: string;
        p256dh_key?: string;
        auth_key?: string;
      };

      if (!endpoint || typeof endpoint !== 'string') {
        return new Response(JSON.stringify({
          success: false,
          error: 'invalid_subscription_endpoint'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!driver_id && !user_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'missing_subscription_owner'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // First delete any existing subscription with same endpoint
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint);
      
      const insertData: Record<string, string> = {
        endpoint,
        p256dh_key: p256dh_key || '',
        auth_key: auth_key || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // If endpoint is an FCM web endpoint, store token for FCM v1 delivery path.
      if (endpoint.includes('fcm.googleapis.com/fcm/send/')) {
        const webFcmToken = endpoint.split('/fcm/send/')[1];
        if (webFcmToken) insertData.fcm_token = webFcmToken;
        insertData.platform = 'web';
      }

      // Support both driver_id and user_id (rider)
      if (driver_id) insertData.driver_id = driver_id;
      if (user_id) insertData.user_id = user_id;

      // Keep a single active web subscription per rider to avoid stale token fan-out.
      if (user_id && endpoint.includes('fcm.googleapis.com/fcm/send/')) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user_id)
          .or('platform.eq.web,endpoint.like.https://fcm.googleapis.com/fcm/send/%');
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .insert(insertData);

      if (error) throw error;

      console.log('Subscription saved:', driver_id ? `driver ${driver_id}` : `rider ${user_id}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: Unsubscribe
    if (action === 'unsubscribe') {
      const { driver_id, user_id, endpoint } = subscription;
      
      let query = supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint);

      if (driver_id) query = query.eq('driver_id', driver_id);
      if (user_id) query = query.eq('user_id', user_id);

      const { error } = await query;

      if (error) throw error;

      console.log('Subscription removed:', driver_id ? `driver ${driver_id}` : `rider ${user_id}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: Notify by topic (new feature)
    if (action === 'notify_topic') {
      const { topic, title, body: notifyBody, data, image } = body;
      
      // Get all drivers subscribed to this topic
      const { data: topicSubs, error: topicError } = await supabase
        .from('notification_topics')
        .select('driver_id')
        .eq('topic', topic)
        .eq('is_active', true);
      
      if (topicError) throw topicError;
      
      if (!topicSubs || topicSubs.length === 0) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'No subscribers for this topic',
          notified: 0 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const driverIds = topicSubs.map(s => s.driver_id);
      
      // Get push subscriptions for these drivers
      const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select(`*, drivers!inner(is_online, status)`)
        .in('driver_id', driverIds)
        .eq('drivers.is_online', true)
        .eq('drivers.status', 'approved');
      
      if (error) throw error;
      
      if (!subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'No online subscribers for this topic',
          notified: 0 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const notificationId = generateNotificationId();
      const sentAt = new Date();
      
      const payload: PushPayload = {
        title: title || '📢 إشعار جديد',
        body: notifyBody || 'لديك إشعار جديد',
        icon: '/logo.png',
        badge: '/logo.png',
        image,
        tag: `topic-${topic}-${Date.now()}`,
        data: { ...data, url: '/driver', notificationId, type: 'topic' }
      };
      
      const results = await Promise.all(
        subscriptions.map(sub => sendPushNotificationWithRetry(sub, payload))
      );
      
      const successCount = results.filter(r => r.success).length;
      const totalRetries = results.reduce((sum, r) => sum + (r.attempts || 1) - 1, 0);
      
      // Log for each driver
      await Promise.all(
        subscriptions.map((sub, i) => 
          logNotification(
            supabase,
            sub.driver_id,
            'topic',
            payload.title,
            payload.body,
            { ...payload.data, topic },
            results[i].success ? 'sent' : 'failed',
            results[i].error,
            (results[i].attempts || 1) - 1,
            notificationId,
            sentAt
          )
        )
      );
      
      return new Response(JSON.stringify({ 
        success: true,
        topic,
        notified: successCount,
        total_subscribers: subscriptions.length,
        total_retries: totalRetries
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: Notify drivers about new ride
    if (action === 'notify_new_ride') {
      const rideData = ride as RideData;
      const notificationId = generateNotificationId();
      const sentAt = new Date();
      
      // دالة للتحقق من مطابقة نوع السيارة
      const canDriverServeRide = (driverType: string, rideType: string): boolean => {
        if (driverType === 'women_only') return rideType === 'women_only';
        if (rideType === 'women_only') return driverType === 'women_only';
        
        const typeHierarchy: Record<string, number> = { 'economy': 1, 'comfort': 2, 'premium': 3 };
        const driverLevel = typeHierarchy[driverType] || 1;
        const rideLevel = typeHierarchy[rideType] || 1;
        
        return rideLevel <= driverLevel;
      };
      
      // Get all active driver subscriptions with their locations
      let query = supabase
        .from('push_subscriptions')
        .select(`
          *,
          drivers!inner(id, is_online, is_available, vehicle_type, status, current_location, max_pickup_radius, profile_image_url)
        `)
        .eq('drivers.is_online', true)
        .eq('drivers.is_available', true)
        .eq('drivers.status', 'approved');

      if (driver_ids && driver_ids.length > 0) {
        query = query.in('driver_id', driver_ids);
      }

      const { data: subscriptions, error } = await query;

      if (error) {
        console.error('Error fetching subscriptions:', error);
        throw error;
      }

      console.log(`Found ${subscriptions?.length || 0} total subscriptions`);

      if (!subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'No active subscriptions found',
          notified: 0 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Filter by vehicle type compatibility AND geographic distance
      const eligibleSubscriptions = subscriptions.filter(sub => {
        const driver = sub.drivers as any;
        const driverVehicleType = driver?.vehicle_type || 'economy';
        const rideVehicleType = rideData.vehicle_type || 'economy';
        
        if (!canDriverServeRide(driverVehicleType, rideVehicleType)) {
          console.log(`Driver ${sub.driver_id} (${driverVehicleType}) cannot serve ${rideVehicleType} ride`);
          return false;
        }
        
        if (rideData.pickup_lat && rideData.pickup_lng) {
          if (!driver?.current_location) {
            console.log(`Driver ${sub.driver_id} has no location, including anyway`);
            return true;
          }
          
          const driverLat = driver.current_location.lat;
          const driverLng = driver.current_location.lng;
          const driverMaxRadius = driver.max_pickup_radius || max_radius_km;
          
          const distance = calculateDistanceKm(
            rideData.pickup_lat!,
            rideData.pickup_lng!,
            driverLat,
            driverLng
          );
          
          console.log(`Driver ${sub.driver_id}: type=${driverVehicleType}, distance=${distance.toFixed(2)}km, max_radius=${driverMaxRadius}km`);
          return distance <= driverMaxRadius;
        }
        
        return true;
      });
      
      console.log(`After vehicle type and geographic filter: ${eligibleSubscriptions.length} eligible drivers`);

      if (eligibleSubscriptions.length === 0) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'No nearby drivers found',
          notified: 0,
          total_checked: subscriptions.length
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Prepare notification payload with rich info
      const fareText = rideData.estimated_fare 
        ? `${rideData.estimated_fare.toLocaleString()} د.ع`
        : 'غير محدد';
      const distanceText = rideData.distance_km 
        ? ` • ${rideData.distance_km.toFixed(1)} كم`
        : '';
      
      const payload: PushPayload = {
        title: custom_title || '🚗 طلب رحلة جديد!',
        body: `${fareText}${distanceText}\n📍 ${rideData.pickup_address || 'موقع غير محدد'}`,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: `new-ride-${rideData.id}`,
        data: {
          notificationId,
          rideId: rideData.id,
          url: '/driver',
          type: 'new_ride',
          pickup_address: rideData.pickup_address,
          dropoff_address: rideData.dropoff_address,
          estimated_fare: rideData.estimated_fare,
          distance_km: rideData.distance_km
        },
        actions: [
          { action: 'view', title: '👁️ عرض' },
          { action: 'accept', title: '✅ قبول' }
        ]
      };

      // Send notifications with retry logic
      const results = await Promise.all(
        eligibleSubscriptions.map(sub => sendPushNotificationWithRetry(sub, payload))
      );

      // Remove expired subscriptions
      const expiredSubs = eligibleSubscriptions.filter((_, i) => 
        results[i].error === 'subscription_expired'
      );
      
      if (expiredSubs.length > 0) {
        console.log(`Removing ${expiredSubs.length} expired subscriptions`);
        await Promise.all(
          expiredSubs.map(sub =>
            supabase.from('push_subscriptions').delete().eq('id', sub.id)
          )
        );
      }

      const successCount = results.filter(r => r.success).length;
      const totalRetries = results.reduce((sum, r) => sum + (r.attempts || 1) - 1, 0);
      const avgDelay = results.filter(r => r.success && r.delivery_delay_ms)
        .reduce((sum, r, _, arr) => sum + (r.delivery_delay_ms || 0) / arr.length, 0);
      
      console.log(`Notifications sent: ${successCount}/${eligibleSubscriptions.length}, retries: ${totalRetries}, avg_delay: ${avgDelay.toFixed(0)}ms`);

      // Log notifications for each driver
      await Promise.all(
        eligibleSubscriptions.map((sub, i) => 
          logNotification(
            supabase,
            sub.driver_id,
            'new_ride',
            payload.title,
            payload.body,
            payload.data || null,
            results[i].success ? 'sent' : 'failed',
            results[i].error,
            (results[i].attempts || 1) - 1,
            notificationId,
            sentAt
          )
        )
      );

      return new Response(JSON.stringify({ 
        success: true,
        notified: successCount,
        total_eligible: eligibleSubscriptions.length,
        total_checked: subscriptions.length,
        expired_removed: expiredSubs.length,
        total_retries: totalRetries,
        avg_delivery_delay_ms: Math.round(avgDelay)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: Notify ride status update to rider
    if (action === 'notify_rider') {
      const { rider_id, title, body: notifyBody, data } = body;
      if (!rider_id || typeof rider_id !== 'string') {
        return new Response(JSON.stringify({
          success: false,
          function_executed: true,
          push_delivered: false,
          error: 'invalid_rider_id',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const notificationId = generateNotificationId();
      const sentAt = new Date();
      
      console.log(`Notifying rider ${rider_id}: ${title}`);

      // Try to find rider push subscriptions by user_id
      const { data: subscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', rider_id);

      let pushSent = false;
      let pushError = '';
      let cleanedSubscriptions = 0;
      let invalidEndpointCount = 0;
      let expiredCount = 0;
      let fcmConfigErrors = 0;

      if (!subError && subscriptions && subscriptions.length > 0) {
        const payload: PushPayload = {
          title: title || 'ران',
          body: notifyBody || 'لديك إشعار جديد',
          icon: '/logo.png',
          badge: '/badge.png',
          tag: `rider-${notificationId}`,
          data: { ...data, notification_id: notificationId, sent_at: sentAt.toISOString() },
        };

        let successCount = 0;
        for (const sub of subscriptions) {
          const result = await sendPushNotificationWithRetry(sub, payload, 2);
          if (result.success) successCount++;
          if (result.error === 'subscription_expired') {
            expiredCount++;
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            cleanedSubscriptions++;
          } else if (result.error === 'invalid_web_push_endpoint') {
            invalidEndpointCount++;
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            cleanedSubscriptions++;
          } else if (result.error === 'fcm_not_configured' || result.error === 'firebase_project_id_missing') {
            fcmConfigErrors++;
          }
        }
        pushSent = successCount > 0;
        if (!pushSent) {
          pushError = 'All push deliveries failed';
          if (invalidEndpointCount > 0) {
            pushError += `; invalid endpoints=${invalidEndpointCount}`;
          }
          if (expiredCount > 0) {
            pushError += `; expired subscriptions=${expiredCount}`;
          }
          if (fcmConfigErrors > 0) {
            pushError += `; fcm config errors=${fcmConfigErrors}`;
          }
        }

        console.log(
          `[notify_rider] rider=${rider_id} subs=${subscriptions.length} ` +
          `sent=${successCount} cleaned=${cleanedSubscriptions} invalid=${invalidEndpointCount} expired=${expiredCount} fcmConfig=${fcmConfigErrors}`
        );
      } else if (subError) {
        pushError = `Subscription lookup failed: ${subError.message}`;
        console.error(`[notify_rider] subscription query failed for rider ${rider_id}:`, subError);
      } else {
        pushError = 'No push subscription found for rider';
        console.warn(`[notify_rider] no subscriptions found for rider ${rider_id}`);
      }

      // Always log notification regardless of push delivery
      await logNotification(
        supabase, null, 'rider_notification', title || 'ران',
        notifyBody || '', data || null,
        pushSent ? 'sent' : 'failed', pushError || undefined,
        0, notificationId, sentAt
      );

      // Also insert into in-app notifications table for the rider
      try {
        await supabase.from('notifications').insert({
          user_id: rider_id,
          title: title || 'ران',
          body: notifyBody || '',
          type: data?.type || 'ride_update',
          data: data || {},
          is_read: false,
        });
      } catch (e) {
        console.log('In-app notification insert skipped (table may not exist):', e);
      }

      return new Response(JSON.stringify({ 
        success: pushSent,
        function_executed: true,
        push_delivered: pushSent,
        message: pushSent ? 'Rider notified via push' : 'Notification executed but push not delivered',
        reason: pushSent ? undefined : pushError,
        delivery_stats: {
          subscriptions_total: subscriptions?.length || 0,
          cleaned_subscriptions: cleanedSubscriptions,
          invalid_endpoint_count: invalidEndpointCount,
          expired_subscriptions: expiredCount,
          fcm_config_errors: fcmConfigErrors,
        },
        notification_id: notificationId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: Notify specific driver with rich notifications
    if (action === 'notify_driver') {
      const { driver_id, title, body: notifyBody, data, image } = body;
      const notificationId = generateNotificationId();
      const sentAt = new Date();
      
      const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('driver_id', driver_id);

      if (error) throw error;

      if (!subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'No subscription found for driver' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const payload: PushPayload = {
        title: title || 'ران كابتن',
        body: notifyBody || 'لديك إشعار جديد',
        icon: '/logo.png',
        image, // Rich notification image
        data: { ...data, url: '/driver', notificationId }
      };

      const results = await Promise.all(
        subscriptions.map(sub => sendPushNotificationWithRetry(sub, payload))
      );

      const successCount = results.filter(r => r.success).length;
      const totalRetries = results.reduce((sum, r) => sum + (r.attempts || 1) - 1, 0);

      await logNotification(
        supabase,
        driver_id,
        'custom',
        payload.title,
        payload.body,
        payload.data || null,
        successCount > 0 ? 'sent' : 'failed',
        results.find(r => !r.success)?.error,
        totalRetries,
        notificationId,
        sentAt
      );

      return new Response(JSON.stringify({ 
        success: successCount > 0,
        notified: successCount,
        total_retries: totalRetries
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: Notify driver about status change
    if (action === 'notify_driver_status_change') {
      const { driver_id, old_status, new_status, driver_name } = body;
      const notificationId = generateNotificationId();
      const sentAt = new Date();
      
      console.log(`Driver status change notification: ${driver_id} from ${old_status} to ${new_status}`);
      
      const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('driver_id', driver_id);

      if (error) throw error;

      let title = '';
      let notifyBody = '';
      
      switch (new_status) {
        case 'approved':
          title = '🎉 تهانينا! تم قبول طلبك';
          notifyBody = 'تم اعتماد حسابك كسائق في ران. يمكنك الآن البدء في استقبال الطلبات!';
          break;
        case 'rejected':
          title = '❌ عذراً - تم رفض طلبك';
          notifyBody = 'للأسف تم رفض طلب تسجيلك كسائق. يرجى التواصل مع الدعم لمعرفة التفاصيل.';
          break;
        case 'suspended':
          title = '⚠️ تم إيقاف حسابك';
          notifyBody = 'تم إيقاف حسابك مؤقتاً. يرجى التواصل مع الإدارة لمعرفة السبب.';
          break;
        case 'pending':
          title = '📋 حسابك قيد المراجعة';
          notifyBody = 'تم استلام طلبك وهو قيد المراجعة من قبل الإدارة.';
          break;
        default:
          title = '📢 تحديث حالة الحساب';
          notifyBody = `تم تغيير حالة حسابك إلى: ${new_status}`;
      }

      if (!subscriptions || subscriptions.length === 0) {
        console.log(`No push subscription for driver ${driver_id}, notification logged only`);
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Status change logged (no push subscription)',
          driver_id,
          new_status
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const payload: PushPayload = {
        title,
        body: notifyBody,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: `status-change-${driver_id}`,
        data: { 
          url: '/driver',
          type: 'status_change',
          old_status,
          new_status,
          notificationId
        }
      };

      const results = await Promise.all(
        subscriptions.map(sub => sendPushNotificationWithRetry(sub, payload))
      );

      const successCount = results.filter(r => r.success).length;
      const totalRetries = results.reduce((sum, r) => sum + (r.attempts || 1) - 1, 0);
      console.log(`Status change notifications sent: ${successCount}/${subscriptions.length}`);

      await logNotification(
        supabase,
        driver_id,
        'status_change',
        title,
        notifyBody,
        { old_status, new_status },
        successCount > 0 ? 'sent' : 'failed',
        results.find(r => !r.success)?.error,
        totalRetries,
        notificationId,
        sentAt
      );

      return new Response(JSON.stringify({ 
        success: successCount > 0,
        notified: successCount,
        driver_id,
        new_status,
        total_retries: totalRetries
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: Send silent push for data refresh
    if (action === 'silent_push') {
      const { driver_id, data } = body;
      
      const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('driver_id', driver_id);

      if (error) throw error;

      if (!subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({ success: false, message: 'No subscription' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const payload: PushPayload = {
        title: '',
        body: '',
        data: { ...data, type: 'silent', silent: true }
      };

      const results = await Promise.all(
        subscriptions.map(sub => sendPushNotificationWithRetry(sub, payload, 1)) // Only 1 attempt for silent
      );

      return new Response(JSON.stringify({ 
        success: results.some(r => r.success)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ═══════════════════════════════════════════════════════
    // Action: Send campaign notification (from admin panel)
    // ═══════════════════════════════════════════════════════
    if (action === 'send_campaign') {
      const { campaign_id } = body;
      if (!campaign_id) throw new Error('campaign_id required');

      // Fetch campaign details
      const { data: campaign, error: campErr } = await supabase
        .from('notification_campaigns')
        .select('*')
        .eq('id', campaign_id)
        .single();

      if (campErr || !campaign) throw new Error('Campaign not found');

      // Mark as sending
      await supabase.from('notification_campaigns')
        .update({ status: 'sending', updated_at: new Date().toISOString() })
        .eq('id', campaign_id);

      const notificationId = generateNotificationId();
      const sentAt = new Date();

      try {
        // ── Resolve target recipients ──
        let driverIds: string[] = [];
        let riderIds: string[] = [];

        if (campaign.target_type === 'all' || campaign.target_type === 'all_drivers') {
          const { data: drivers } = await supabase
            .from('drivers')
            .select('user_id')
            .eq('status', 'approved');
          driverIds = (drivers || []).map((d: any) => d.user_id);
        }

        if (campaign.target_type === 'all' || campaign.target_type === 'all_riders') {
          // استخدام user_roles بدلاً من profiles.role (غير موجود)
          const { data: riderRoles } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'rider');
          riderIds = (riderRoles || []).map((r: any) => r.user_id);
        }

        if (campaign.target_type === 'individual' && campaign.target_user_id) {
          // Check if driver or rider
          const { data: driver } = await supabase
            .from('drivers')
            .select('user_id')
            .eq('user_id', campaign.target_user_id)
            .single();
          if (driver) {
            driverIds = [campaign.target_user_id];
          } else {
            riderIds = [campaign.target_user_id];
          }
        }

        if (campaign.target_type === 'group' && campaign.target_group_id) {
          const { data: group } = await supabase
            .from('notification_groups')
            .select('*')
            .eq('id', campaign.target_group_id)
            .single();

          if (group) {
            if (group.is_dynamic && group.filters) {
              // Dynamic group — resolve from filters
              if (group.group_type === 'drivers' || group.group_type === 'mixed') {
                let dq = supabase.from('drivers').select('user_id').eq('status', 'approved');
                if (group.filters.vehicle_type) dq = dq.eq('vehicle_type', group.filters.vehicle_type);
                if (group.filters.min_rating) dq = dq.gte('rating', group.filters.min_rating);
                const { data: gd } = await dq;
                driverIds = (gd || []).map((d: any) => d.user_id);
              }
              if (group.group_type === 'riders' || group.group_type === 'mixed') {
                // استخدام user_roles بدلاً من profiles.role (غير موجود)
                const { data: gr } = await supabase
                  .from('user_roles')
                  .select('user_id')
                  .eq('role', 'rider');
                riderIds = (gr || []).map((r: any) => r.user_id);
              }
            } else {
              // Static group — use members table
              const { data: members } = await supabase
                .from('notification_group_members')
                .select('user_id')
                .eq('group_id', group.id);
              const memberIds = (members || []).map((m: any) => m.user_id);

              // Determine who is driver vs rider
              const { data: driverMembers } = await supabase
                .from('drivers')
                .select('user_id')
                .in('user_id', memberIds);
              const driverMemberIds = new Set((driverMembers || []).map((d: any) => d.user_id));
              
              driverIds = memberIds.filter((id: string) => driverMemberIds.has(id));
              riderIds = memberIds.filter((id: string) => !driverMemberIds.has(id));
            }
          }
        }

        const totalRecipients = driverIds.length + riderIds.length;
        await supabase.from('notification_campaigns')
          .update({ total_recipients: totalRecipients })
          .eq('id', campaign_id);

        console.log(`Campaign ${campaign_id}: ${driverIds.length} drivers, ${riderIds.length} riders`);

        // ── Prepare payload ──
        const payload: PushPayload = {
          title: campaign.title,
          body: campaign.body,
          icon: '/logo.png',
          badge: '/logo.png',
          image: campaign.image_url || undefined,
          tag: `campaign-${campaign_id}`,
          data: {
            type: campaign.notification_type,
            campaign_id,
            notificationId,
            action_url: campaign.action_url || '/',
            ...(campaign.extra_data || {}),
          },
        };

        let sentCount = 0;
        let failedCount = 0;

        // ── Send to drivers (in batches of 50) ──
        for (let i = 0; i < driverIds.length; i += 50) {
          const batch = driverIds.slice(i, i + 50);

          // Insert in-app notifications
          await supabase.from('driver_notifications').insert(
            batch.map((dId: string) => ({
              driver_id: dId,
              title: campaign.title,
              body: campaign.body,
              type: campaign.notification_type,
              campaign_id,
              action_url: campaign.action_url,
              image_url: campaign.image_url,
              data: { campaign_id, action_url: campaign.action_url },
            }))
          );

          // Get push subscriptions
          const { data: subs } = await supabase
            .from('push_subscriptions')
            .select('*')
            .in('driver_id', batch);

          if (subs && subs.length > 0) {
            const results = await Promise.all(
              subs.map(sub => sendPushNotificationWithRetry(sub, payload, 2))
            );
            sentCount += results.filter(r => r.success).length;
            failedCount += results.filter(r => !r.success).length;

            // Clean up expired subscriptions
            const expired = subs.filter((_, idx) => results[idx].error === 'subscription_expired');
            if (expired.length > 0) {
              await Promise.all(expired.map(sub => supabase.from('push_subscriptions').delete().eq('id', sub.id)));
            }
          }
        }

        // ── Send to riders (in batches of 50) ──
        for (let i = 0; i < riderIds.length; i += 50) {
          const batch = riderIds.slice(i, i + 50);

          // Insert in-app notifications
          await supabase.from('rider_notifications').insert(
            batch.map((rId: string) => ({
              user_id: rId,
              title: campaign.title,
              body: campaign.body,
              type: campaign.notification_type,
              campaign_id,
              action_url: campaign.action_url,
              image_url: campaign.image_url,
              data: { campaign_id, action_url: campaign.action_url },
            }))
          );

          // Get push subscriptions (riders use user_id)
          const { data: subs } = await supabase
            .from('push_subscriptions')
            .select('*')
            .in('user_id', batch);

          if (subs && subs.length > 0) {
            const results = await Promise.all(
              subs.map(sub => sendPushNotificationWithRetry(sub, payload, 2))
            );
            sentCount += results.filter(r => r.success).length;
            failedCount += results.filter(r => !r.success).length;
          }
        }

        // ── Update campaign status ──
        await supabase.from('notification_campaigns')
          .update({
            status: 'sent',
            sent_at: sentAt.toISOString(),
            sent_count: sentCount,
            failed_count: failedCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', campaign_id);

        console.log(`Campaign ${campaign_id} complete: sent=${sentCount}, failed=${failedCount}`);

        return new Response(JSON.stringify({
          success: true,
          campaign_id,
          total_recipients: totalRecipients,
          sent_count: sentCount,
          failed_count: failedCount,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Campaign send error';
        console.error(`Campaign ${campaign_id} failed:`, err);
        await supabase.from('notification_campaigns')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', campaign_id);

        return new Response(JSON.stringify({ success: false, error: errMsg }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-push-notification:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
