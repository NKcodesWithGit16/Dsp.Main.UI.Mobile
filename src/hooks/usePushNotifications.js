import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { registerPushToken } from '../api/main';

const PROJECT_ID = 'da84094d-9cb8-4847-9416-984dd766ba83';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications(userId, onForegroundNotification) {
  const router = useRouter();
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  useEffect(() => {
    if (!userId) return;

    async function register() {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'HitchLink',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#0193ab',
          });
        }

        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
        registerPushToken(userId, tokenData.data).catch(() => {});
      } catch (err) {
        // Android: throws if FCM creds aren't uploaded to Expo yet.
        // iOS: throws on simulator / when APNs entitlement is missing.
        // In both cases push is unavailable but the app should keep working.
        if (__DEV__) console.warn('[push] disabled:', err?.message || err);
      }
    }

    register();

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      onForegroundNotification?.(notification.request.content.title, notification.request.content.body);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.type === 'LoadAssigned') {
        router.replace('/(driver)');
      } else if (data?.type === 'chat' || data?.chatDriverId) {
        // Driver-side chat tap → open the driver chat screen.
        // Dispatcher-side chat tap (no chatDriverId on driver tokens) → dispatcher home.
        if (data?.chatDriverId) {
          // This notification was sent to a dispatcher device referencing a specific driver.
          router.push('/(app)/');
        } else {
          // Driver device receiving a chat notification → open chat with dispatcher.
          router.push('/(driver)/chat');
        }
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [userId]);
}
