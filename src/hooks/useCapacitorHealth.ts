/**
 * useCapacitorHealth — فحص شامل لحالة إضافات Capacitor عند بدء التطبيق
 *
 * يتحقق من:
 * - المنصة (android / web)
 * - حالة الشبكة
 * - أذونات الموقع والإشعارات
 * - معلومات الجهاز
 *
 * الاستخدام:
 *   const health = useCapacitorHealth();
 *   if (!health.isLoading) console.log(health.network.connected);
 */
import { useState, useEffect } from 'react';

export interface CapacitorHealthStatus {
  /** المنصة الحالية: 'android' | 'ios' | 'web' */
  platform: string;
  /** حالة الشبكة */
  network: {
    connected: boolean;
    connectionType: string;
  };
  /** أذونات مُراجَعة */
  permissions: {
    geolocation: string;    // 'granted' | 'denied' | 'prompt' | 'unknown'
    notifications: string;  // 'granted' | 'denied' | 'prompt' | 'unknown'
  };
  /** معلومات الجهاز — null في بيئة الويب */
  device: {
    manufacturer: string;
    model: string;
    os: string;
    osVersion: string;
  } | null;
  /** true طالما لم تكتمل عملية الفحص بعد */
  isLoading: boolean;
}

const initialStatus: CapacitorHealthStatus = {
  platform: 'unknown',
  network: { connected: typeof navigator !== 'undefined' ? navigator.onLine : true, connectionType: 'unknown' },
  permissions: { geolocation: 'unknown', notifications: 'unknown' },
  device: null,
  isLoading: true,
};

/**
 * فحص شامل لصحة Capacitor plugins — يُستدعى مرة عند mount
 */
export const useCapacitorHealth = (): CapacitorHealthStatus => {
  const [status, setStatus] = useState<CapacitorHealthStatus>(initialStatus);

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        const platform = Capacitor.getPlatform();
        const isNative = Capacitor.isNativePlatform();

        let networkInfo = {
          connected: typeof navigator !== 'undefined' ? navigator.onLine : true,
          connectionType: 'unknown',
        };
        let geoPermission = 'unknown';
        let notifPermission = 'unknown';
        let deviceInfo: CapacitorHealthStatus['device'] = null;

        if (isNative) {
          // ── حالة الشبكة ──
          try {
            const { Network } = await import('@capacitor/network');
            const net = await Network.getStatus();
            networkInfo = { connected: net.connected, connectionType: net.connectionType };
          } catch (e) {
            console.warn('useCapacitorHealth: Network check failed', e);
          }

          // ── إذن الموقع ──
          try {
            const { Geolocation } = await import('@capacitor/geolocation');
            const geo = await Geolocation.checkPermissions();
            geoPermission = geo.location;
          } catch (e) {
            console.warn('useCapacitorHealth: Geolocation check failed', e);
          }

          // ── إذن الإشعارات ──
          try {
            const { LocalNotifications } = await import('@capacitor/local-notifications');
            const notif = await LocalNotifications.checkPermissions();
            notifPermission = notif.display;
          } catch (e) {
            console.warn('useCapacitorHealth: Notifications check failed', e);
          }

          // ── معلومات الجهاز ──
          try {
            const { Device } = await import('@capacitor/device');
            const info = await Device.getInfo();
            deviceInfo = {
              manufacturer: info.manufacturer,
              model: info.model,
              os: info.operatingSystem,
              osVersion: info.osVersion,
            };
          } catch (e) {
            console.warn('useCapacitorHealth: Device info failed', e);
          }
        }

        if (!isMounted) return;

        const result: CapacitorHealthStatus = {
          platform,
          network: networkInfo,
          permissions: { geolocation: geoPermission, notifications: notifPermission },
          device: deviceInfo,
          isLoading: false,
        };

        setStatus(result);

        // ── ملخص في الكونسول ──
        console.group('🏥 Capacitor Health Check');
        console.log(`📱 Platform: ${platform}`);
        console.log(`🌐 Network: ${networkInfo.connected ? '✅ متصل' : '❌ غير متصل'} (${networkInfo.connectionType})`);
        console.log(`📍 GPS Permission: ${geoPermission}`);
        console.log(`🔔 Notifications Permission: ${notifPermission}`);
        if (deviceInfo) {
          console.log(`📱 Device: ${deviceInfo.manufacturer} ${deviceInfo.model} | ${deviceInfo.os} ${deviceInfo.osVersion}`);
        }
        console.groupEnd();
      } catch (err) {
        console.warn('useCapacitorHealth: check failed', err);
        if (isMounted) {
          setStatus(s => ({ ...s, isLoading: false }));
        }
      }
    };

    checkHealth();

    return () => {
      isMounted = false;
    };
  }, []);

  return status;
};
