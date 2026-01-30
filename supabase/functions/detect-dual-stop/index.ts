import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DualStopAlert {
  ride_id: string
  driver_id: string
  rider_id: string
  driver_last_location: any
  rider_last_location: any
  stop_duration_minutes: number
  distance_between_meters: number
  alert_severity: 'warning' | 'critical'
}

// حساب المسافة بين نقطتين (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // نصف قطر الأرض بالأمتار
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // المسافة بالأمتار
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    console.log('🔍 بدء فحص الرحلات للكشف عن التوقف المزدوج...')

    // 1️⃣ جلب الإعدادات
    const { data: settings } = await supabaseClient
      .from('app_settings')
      .select('key, value')
      .in('key', ['dual_stop_detection_interval', 'dual_stop_distance_threshold', 'dual_stop_critical_threshold'])

    const settingsMap = new Map(settings?.map(s => [s.key, parseInt(s.value)]) || [])
    const warningThreshold = settingsMap.get('dual_stop_detection_interval') || 5 // دقائق
    const criticalThreshold = settingsMap.get('dual_stop_critical_threshold') || 10
    const distanceThreshold = settingsMap.get('dual_stop_distance_threshold') || 50 // أمتار

    console.log(`⚙️ الإعدادات: تنبيه=${warningThreshold} دقيقة، حرج=${criticalThreshold} دقيقة، مسافة=${distanceThreshold} متر`)

    // 2️⃣ جلب جميع الرحلات النشطة (in_progress)
    const { data: activeRides, error: ridesError } = await supabaseClient
      .from('rides')
      .select(`
        id,
        rider_id,
        driver_id,
        status,
        started_at,
        rider_last_location,
        rider_location_updated_at,
        drivers!inner (
          id,
          current_location,
          updated_at
        )
      `)
      .eq('status', 'in_progress')
      .not('rider_last_location', 'is', null)
      .not('drivers.current_location', 'is', null)

    if (ridesError) {
      console.error('❌ خطأ في جلب الرحلات:', ridesError)
      throw ridesError
    }

    console.log(`📊 عدد الرحلات النشطة: ${activeRides?.length || 0}`)

    if (!activeRides || activeRides.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'لا توجد رحلات نشطة للفحص',
          checked: 0,
          alerts_created: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const alertsToCreate: DualStopAlert[] = []
    const now = new Date()

    // 3️⃣ فحص كل رحلة
    for (const ride of activeRides) {
      // Handle driver data - can be array or single object from inner join
      const driverData = Array.isArray(ride.drivers) ? ride.drivers[0] : ride.drivers
      if (!driverData) continue
      
      const driverUpdatedAt = new Date(driverData.updated_at)
      const riderUpdatedAt = new Date(ride.rider_location_updated_at)

      // حساب مدة التوقف لكل طرف
      const driverStopMinutes = (now.getTime() - driverUpdatedAt.getTime()) / 60000
      const riderStopMinutes = (now.getTime() - riderUpdatedAt.getTime()) / 60000

      console.log(`🔍 رحلة ${ride.id}: سائق=${driverStopMinutes.toFixed(1)} دقيقة، راكب=${riderStopMinutes.toFixed(1)} دقيقة`)

      // التحقق من شرط التوقف المزدوج
      if (driverStopMinutes >= warningThreshold && riderStopMinutes >= warningThreshold) {
        // حساب المسافة بين الموقعين
        const driverLoc = driverData.current_location as { lat: number; lng: number }
        const riderLoc = ride.rider_last_location as { lat: number; lng: number }
        
        const distance = calculateDistance(
          driverLoc.lat,
          driverLoc.lng,
          riderLoc.lat,
          riderLoc.lng
        )

        console.log(`⚠️ توقف مزدوج محتمل: ${distance.toFixed(0)} متر بينهما`)

        // إذا كانوا قريبين (<= المسافة المحددة)، تأكيد التوقف المزدوج
        if (distance <= distanceThreshold) {
          const stopDuration = Math.min(driverStopMinutes, riderStopMinutes)
          const severity: 'warning' | 'critical' = stopDuration >= criticalThreshold ? 'critical' : 'warning'

          // التحقق من عدم وجود تنبيه نشط لنفس الرحلة
          const { data: existingAlert } = await supabaseClient
            .from('dual_stop_alerts')
            .select('id')
            .eq('ride_id', ride.id)
            .eq('status', 'active')
            .single()

          if (!existingAlert) {
            alertsToCreate.push({
              ride_id: ride.id,
              driver_id: ride.driver_id,
              rider_id: ride.rider_id,
              driver_last_location: driverLoc,
              rider_last_location: riderLoc,
              stop_duration_minutes: Math.floor(stopDuration),
              distance_between_meters: Math.round(distance),
              alert_severity: severity,
            })

            console.log(`🚨 ${severity === 'critical' ? 'حرج' : 'تحذير'}: توقف مزدوج ${stopDuration.toFixed(1)} دقيقة`)
          } else {
            console.log(`ℹ️ تنبيه نشط موجود مسبقاً`)
          }
        }
      }
    }

    // 4️⃣ إنشاء التنبيهات
    let alertsCreated = 0
    if (alertsToCreate.length > 0) {
      const { data: newAlerts, error: alertError } = await supabaseClient
        .from('dual_stop_alerts')
        .insert(alertsToCreate)
        .select('id, ride_id, alert_severity')

      if (alertError) {
        console.error('❌ خطأ في إنشاء التنبيهات:', alertError)
      } else {
        alertsCreated = newAlerts?.length || 0
        console.log(`✅ تم إنشاء ${alertsCreated} تنبيه جديد`)

        // 5️⃣ إرسال إشعارات للأطراف
        for (const alert of newAlerts || []) {
          const alertData = alertsToCreate.find(a => a.ride_id === alert.ride_id)
          if (!alertData) continue

          const messageAr = alert.alert_severity === 'critical' 
            ? `🚨 تنبيه حرج: رحلتك متوقفة منذ ${alertData.stop_duration_minutes} دقيقة. هل تحتاج مساعدة؟`
            : `⚠️ لاحظنا توقف رحلتك منذ ${alertData.stop_duration_minutes} دقيقة. هل كل شيء بخير؟`

          // إشعار للراكب
          await supabaseClient.from('notifications').insert({
            user_id: alertData.rider_id,
            title: alert.alert_severity === 'critical' ? 'تنبيه حرج' : 'تنبيه رحلة',
            message: messageAr,
            type: 'alert',
            priority: alert.alert_severity === 'critical' ? 'urgent' : 'high',
            data: { ride_id: alert.ride_id, alert_id: alert.id, type: 'dual_stop' }
          })

          // إشعار للسائق
          const { data: driver } = await supabaseClient
            .from('drivers')
            .select('user_id')
            .eq('id', alertData.driver_id)
            .single()

          if (driver?.user_id) {
            await supabaseClient.from('notifications').insert({
              user_id: driver.user_id,
              title: alert.alert_severity === 'critical' ? 'تنبيه حرج' : 'تنبيه رحلة',
              message: messageAr,
              type: 'alert',
              priority: alert.alert_severity === 'critical' ? 'urgent' : 'high',
              data: { ride_id: alert.ride_id, alert_id: alert.id, type: 'dual_stop' }
            })
          }

          console.log(`📬 تم إرسال إشعارات للرحلة ${alert.ride_id}`)
        }
      }
    }

    const result = {
      success: true,
      message: `تم فحص ${activeRides.length} رحلة`,
      checked: activeRides.length,
      alerts_created: alertsCreated,
      timestamp: now.toISOString(),
    }

    console.log('✅ اكتمل الفحص بنجاح:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('❌ خطأ عام:', error)
    const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
