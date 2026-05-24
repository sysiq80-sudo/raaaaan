/**
 * ران - خدمة الإشعارات (React Native / Expo)
 * إعداد FCM + تسجيل التوكن + معالجة الإشعارات
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

// إعداد كيفية عرض الإشعارات أثناء فتح التطبيق
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * تسجيل التوكن وإرساله لـ Supabase
 */
export async function registerForPushNotifications(
  userId: string,
): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  // طلب إذن الإشعارات
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission not granted');
    return null;
  }

  // إعداد قناة Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('rides', {
      name: 'الرحلات',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 200, 300],
      lightColor: '#00d9a5',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('general', {
      name: 'عام',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    // حفظ التوكن في Supabase
    await supabase
      .from('profiles')
      .update({
        fcm_token: token.data,
        device_platform: Platform.OS,
      })
      .eq('id', userId);

    return token.data;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

/**
 * معالجة الإشعار عند الضغط عليه
 */
export function setupNotificationListeners() {
  // عند الضغط على إشعار
  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;

      if (data?.ride_id) {
        // الانتقال لشاشة الرحلة
        if (data?.type === 'ride_request') {
          router.push('/(driver)/(tabs)/home');
        } else if (data?.type === 'ride_update') {
          router.push('/(rider)/(tabs)/home');
        }
      }
    });

  // عند استلام إشعار أثناء فتح التطبيق
  const notificationSubscription =
    Notifications.addNotificationReceivedListener((notification) => {
      // يمكن إضافة معالجة إضافية هنا
      console.log('Notification received:', notification.request.content.title);
    });

  return () => {
    responseSubscription.remove();
    notificationSubscription.remove();
  };
}

/**
 * إرسال إشعار محلي (للاختبار أو أحداث محلية)
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: 'rides' }),
    },
    trigger: null, // فوري
  });
}
