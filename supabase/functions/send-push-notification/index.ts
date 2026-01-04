import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

// Send push notification with retry logic
async function sendPushNotificationWithRetry(
  subscription: { endpoint: string; p256dh_key: string; auth_key: string },
  payload: PushPayload,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<SendResult> {
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} - Sending to: ${subscription.endpoint.substring(0, 50)}...`);

      const body = JSON.stringify(payload);
      
      const response = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'TTL': '86400',
          'Urgency': 'high',
        },
        body: body
      });

      if (response.ok) {
        const delivery_delay_ms = Date.now() - startTime;
        console.log(`Push sent successfully on attempt ${attempt}`);
        return { success: true, attempts: attempt, delivery_delay_ms };
      }

      const errorText = await response.text();
      console.error(`Push failed: ${response.status} - ${errorText}`);
      
      // Don't retry for expired subscriptions
      if (response.status === 404 || response.status === 410) {
        return { success: false, error: 'subscription_expired', attempts: attempt };
      }
      
      // Don't retry for client errors (4xx except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return { success: false, error: `HTTP ${response.status}`, attempts: attempt };
      }

      // Exponential backoff for retryable errors
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(r => setTimeout(r, delay));
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Attempt ${attempt} error:`, error);
      
      if (attempt === maxRetries) {
        return { success: false, error: errorMessage, attempts: attempt };
      }
      
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  return { success: false, error: 'max_retries_exceeded', attempts: maxRetries };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
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
    
    const { driver_ids, subscription, max_radius_km = 15 } = body;
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
      const { driver_id, endpoint, p256dh_key, auth_key } = subscription;
      
      // First delete any existing subscription with same endpoint
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint);
      
      const { error } = await supabase
        .from('push_subscriptions')
        .insert({
          driver_id,
          endpoint,
          p256dh_key,
          auth_key,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      console.log('Subscription saved for driver:', driver_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action: Unsubscribe
    if (action === 'unsubscribe') {
      const { driver_id, endpoint } = subscription;
      
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('driver_id', driver_id)
        .eq('endpoint', endpoint);

      if (error) throw error;

      console.log('Subscription removed for driver:', driver_id);
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
        title: '🚗 طلب رحلة جديد!',
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
      
      console.log(`Would notify rider ${rider_id}: ${title}`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Rider notification logged (push not implemented for riders yet)' 
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
