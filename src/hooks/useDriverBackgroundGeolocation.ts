/**
 * useDriverBackgroundGeolocation
 *
 * يُستدعى من DriverLayout (مستوى ثابت لا يُنمَّط) — يظل نشطاً عند التنقل بين جميع
 * صفحات السائق. يتولى دورة حياة @transistorsoft/capacitor-background-geolocation
 * بالكامل على الأجهزة النيتيف.
 *
 * على الويب: لا يفعل شيئاً — DriverHome يتولى navigator.geolocation.
 *
 * قاعدة الإيقاف: BackgroundGeolocation.stop() فقط عند:
 *   • السائق يتحوّل إلى Offline (isOnline = false)
 *   • لا توجد رحلة نشطة (activeRide = null)
 *   • unmount كامل لـ DriverLayout (logout / إغلاق التطبيق)
 */

import { useEffect, useRef } from 'react';
import BackgroundGeolocation, {
  Location as BGLocation,
} from '@transistorsoft/capacitor-background-geolocation';
import type { State as BGState } from '@transistorsoft/capacitor-background-geolocation';
import { isNativePlatform } from '@/lib/capacitorBridge';
import { supabase } from '@/integrations/supabase/client';
import { useDriverStore } from '@/stores/driverStore';
import { saveLastKnownLocation } from '@/services/lastKnownLocationService';
import { toast } from '@/hooks/use-toast';

/** حد أدنى 30 ثانية بين كتابات قاعدة البيانات (تقليل IO) */
const MIN_DB_INTERVAL_MS = 30_000;

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'تحقق من صلاحيات الموقع في إعدادات الجهاز';
}

function hasMoved(
  prev: { lat: number; lng: number } | null,
  next: { lat: number; lng: number },
  thresholdMeters: number,
): boolean {
  if (!prev) return true;
  const R = 6_371_000;
  const dLat = ((next.lat - prev.lat) * Math.PI) / 180;
  const dLng = ((next.lng - prev.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((prev.lat * Math.PI) / 180) *
      Math.cos((next.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) >= thresholdMeters;
}

export function useDriverBackgroundGeolocation(): void {
  const bgGeoInitializedRef = useRef(false);
  const bgGeoSubRef = useRef<{ remove: () => void } | null>(null);
  const bgGeoHeartbeatSubRef = useRef<{ remove: () => void } | null>(null);

  const driverIdRef = useRef<string | null>(null);
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastDbUpdateRef = useRef<number>(0);
  const prevIsActiveRef = useRef(false);

  const resolveDriverId = async (userId: string | null): Promise<void> => {
    if (!userId) {
      driverIdRef.current = null;
      return;
    }

    const cachedDriver = useDriverStore.getState().driver;
    if (cachedDriver?.userId === userId) {
      driverIdRef.current = cachedDriver.id;
      return;
    }

    const { data, error } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[BGGeo] Failed to resolve driver id:', error);
      driverIdRef.current = null;
      return;
    }

    driverIdRef.current = data?.id ?? null;
  };

  // ── Auth session → drivers.id ref ─────────────────────────────────────────
  useEffect(() => {
    if (!isNativePlatform) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      resolveDriverId(session?.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evt, session) => {
      resolveDriverId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── DB update (throttled, reads refs → never stale) ───────────────────────
  const updateInDb = async (
    lat: number,
    lng: number,
    heading: number | null,
    force: boolean = false,
  ): Promise<void> => {
    if (!driverIdRef.current) return;

    const now = Date.now();
    const timePassed = now - lastDbUpdateRef.current >= MIN_DB_INTERVAL_MS;

    const newLoc = { lat, lng };
    const movedSignificant = hasMoved(lastLocationRef.current, newLoc, 30);

    // تحديث قاعدة البيانات فقط عند الاتصال/الإيقاف الإجباري (force) أو عند مرور 30 ثانية مع تحرك السائق 30 متر
    if (!force && (!timePassed || !movedSignificant)) {
      return;
    }

    lastDbUpdateRef.current = now;
    lastLocationRef.current = newLoc;

    const preciseLat = Math.round(lat * 1_000_000) / 1_000_000;
    const preciseLng = Math.round(lng * 1_000_000) / 1_000_000;
    const preciseHeading = heading !== null ? Math.round(heading) : null;
    const isOnline = useDriverStore.getState().isOnline;
    const timestamp = new Date().toISOString();

    try {
      // 1. تحديث جدول driver_locations الجغرافي لـ PostGIS (المصدر الرئيسي الجديد)
      const { error: geoError } = await (supabase as any)
        .from('driver_locations')
        .upsert({
          driver_id: driverIdRef.current,
          location: `POINT(${preciseLng} ${preciseLat})`,
          heading: preciseHeading,
          is_online: isOnline,
          updated_at: timestamp,
        });

      if (geoError) {
        console.error('[BGGeo] Failed to update driver_locations:', geoError);
      } else {
        console.log('[BGGeo] 📍 Geospatial position updated in driver_locations');
      }

      // 2. تحديث drivers.current_location للتوافقية مع الواجهات القديمة (لوحة الأدمن وتتبع الراكب)
      const { error: driverError } = await supabase
        .from('drivers')
        .update({
          current_location: {
            lat: preciseLat,
            lng: preciseLng,
            heading: preciseHeading,
          },
          updated_at: timestamp,
        })
        .eq('id', driverIdRef.current);

      if (driverError) {
        console.error('[BGGeo] Failed to update drivers table:', driverError);
      }
    } catch (err) {
      console.error('[BGGeo] DB update error:', err);
    }
  };

  // ── BGGeo init (native only, once per DriverLayout mount) ─────────────────
  useEffect(() => {
    if (!isNativePlatform) return;

    let cancelled = false;

    BackgroundGeolocation.ready({
      license: (import.meta.env.VITE_BG_GEO_LICENSE || undefined) as any,
      transistorAuthorizationToken: (import.meta.env.VITE_TRANSISTOR_BG_GEO_TOKEN || undefined) as any,
      reset: true,
      geolocation: {
        desiredAccuracy: BackgroundGeolocation.DesiredAccuracy.High,
        distanceFilter: 30, // تحديث الفلتر ليكون 30 متر لتوفير البطارية وتقليل التحديثات غير الضرورية
        stopTimeout: 0,
        locationAuthorizationRequest: 'Always',
      },
      app: {
        stopOnTerminate: false,
        startOnBoot: false,
        heartbeatInterval: 60,
        backgroundPermissionRationale: {
          title: 'ران يحتاج موقعك دائماً',
          message:
            'لاستقبال طلبات الرحلات عند تخليف التطبيق، اسمح بالوصول للموقع "دائماً" من إعدادات التطبيق.',
          positiveAction: 'اذهب للإعدادات',
          negativeAction: 'لاحقاً',
        },
        notification: {
          title: 'ران — تتبع موقعك',
          text: 'أنت متصل ومستعد لاستقبال الرحلات',
          smallIcon: 'mipmap/ic_launcher_monochrome',
        },
      },
      logger: {
        debug: false,
        logLevel: BackgroundGeolocation.LogLevel.Warning,
      },
    })
      .then((_state: BGState) => {
        if (cancelled) return;
        if (bgGeoInitializedRef.current) return;
        bgGeoInitializedRef.current = true;

        // ── onLocation ──────────────────────────────────────────────────────
        bgGeoSubRef.current = BackgroundGeolocation.onLocation(
          (loc: BGLocation) => {
            const { latitude, longitude, heading, speed } = loc.coords;
            const newLoc = { lat: latitude, lng: longitude, heading, speed };

            // تحديث store (يُشغّل re-render للمكونات المشتركة به مثل DriverHome)
            useDriverStore.getState().setLocation(newLoc);

            if (hasMoved(lastLocationRef.current, { lat: latitude, lng: longitude }, 30)) {
              saveLastKnownLocation(latitude, longitude);
            }

            updateInDb(latitude, longitude, heading ?? null, false);
          },
          (err: unknown) => console.error('[BGGeo] Location error:', err),
        );

        // ── onHeartbeat (يضمن تحديث DB عند التوقف) ─────────────────────────
        bgGeoHeartbeatSubRef.current = BackgroundGeolocation.onHeartbeat(() => {
          const loc = lastLocationRef.current;
          if (!loc) return;
          // تجاوز الـ throttle لأن الـ heartbeat بطبعه نادر (كل 60 ثانية) والسائق واقف
          updateInDb(loc.lat, loc.lng, null, true);
        });

        // إذا كان السائق نشطاً قبل انتهاء ready() → ابدأ الآن
        const { isOnline, activeRide } = useDriverStore.getState();
        if (isOnline || activeRide !== null) {
          BackgroundGeolocation.start().catch((err: unknown) =>
            console.error('[BGGeo] initial start() failed:', err),
          );
        }
      })
      .catch((err: unknown) => {
        console.error('[BGGeo] ready() failed:', err);
      });

    return () => {
      cancelled = true;
      bgGeoSubRef.current?.remove();
      bgGeoHeartbeatSubRef.current?.remove();
      BackgroundGeolocation.stop();
      bgGeoInitializedRef.current = false;
    };
  }, []);

  // ── Start/stop driven by store subscription (صفر re-renders على DriverLayout)
  useEffect(() => {
    if (!isNativePlatform) return;

    // تهيئة الحالة الأولية
    const initial = useDriverStore.getState();
    prevIsActiveRef.current = initial.isOnline || initial.activeRide !== null;

    const unsubscribe = useDriverStore.subscribe((state) => {
      const isActive = state.isOnline || state.activeRide !== null;
      if (isActive === prevIsActiveRef.current) return;
      prevIsActiveRef.current = isActive;

      // إذا لم تنته ready() بعد → ستتحقق بنفسها عند انتهائها
      if (!bgGeoInitializedRef.current) return;

      if (isActive) {
        BackgroundGeolocation.start().catch((err: unknown) => {
          console.error('[BGGeo] start() failed:', err);
          toast({
            title: '⚠️ فشل تفعيل GPS الخلفية',
            description: getErrorMessage(err),
            variant: 'destructive',
          });
        });
      } else {
        BackgroundGeolocation.stop().catch((err: unknown) =>
          console.error('[BGGeo] stop() failed:', err),
        );
      }
    });

    return () => unsubscribe();
  }, []);
}
