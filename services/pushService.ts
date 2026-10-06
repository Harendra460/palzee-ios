import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

/**
 * Reminders are server-driven: the `send-hourly-pal` edge function pushes to FCM *topics*, so the
 * client only chooses which topics it is subscribed to (same mapping as Android's
 * PalAlarmScheduler). Values are stored with Android's strings so the setting reads the same.
 */
export type ReminderInterval = 'every 1hr' | 'every 3hrs' | 'off';

const INTERVAL_KEY = 'palzee_notification_interval_v2';
const ALL_TOPICS = ['pals_first_time', 'pals_hourly', 'pals_three_hourly'];
const TOPICS_FOR: Record<ReminderInterval, string[]> = {
  'every 1hr': ['pals_hourly', 'pals_first_time'],
  'every 3hrs': ['pals_three_hourly', 'pals_first_time'],
  off: [],
};

/** Android notification channels, same IDs as the native app so user channel settings carry over. */
const CHANNELS: { id: string; name: string; importance: Notifications.AndroidImportance }[] = [
  { id: 'palzee_hourly_reminders', name: 'Hourly Pal Reminders', importance: Notifications.AndroidImportance.HIGH },
  { id: 'palzee_group_notifications', name: 'Pals Group Notifications', importance: Notifications.AndroidImportance.HIGH },
  { id: 'default_app_channel', name: 'General Notifications', importance: Notifications.AndroidImportance.DEFAULT },
];

type MessagingApi = typeof import('@react-native-firebase/messaging');

/** Firebase is Android-only for now and only configured when google-services.json was provided. */
function firebaseMessaging(): { api: MessagingApi; instance: ReturnType<MessagingApi['getMessaging']> } | null {
  if (Platform.OS !== 'android') return null;
  try {
    const api: MessagingApi = require('@react-native-firebase/messaging');
    return { api, instance: api.getMessaging() };
  } catch {
    return null;
  }
}

/** Unsubscribes every reminder topic, then subscribes the set for `interval`. */
async function applyTopics(interval: ReminderInterval): Promise<void> {
  const fb = firebaseMessaging();
  if (!fb) return;
  await Promise.all(ALL_TOPICS.map((t) => fb.api.unsubscribeFromTopic(fb.instance, t).catch(() => {})));
  await Promise.all(TOPICS_FOR[interval].map((t) => fb.api.subscribeToTopic(fb.instance, t)));
}

export const pushService = {
  isRemotePushAvailable(): boolean {
    return firebaseMessaging() !== null;
  },

  /**
   * Call once at startup. Channels must exist before Android 13+ will show the POST_NOTIFICATIONS
   * prompt, and foreground FCM messages are not displayed by the system, so mirror them locally.
   */
  async init(): Promise<() => void> {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Promise.all(
        CHANNELS.map((c) => Notifications.setNotificationChannelAsync(c.id, { name: c.name, importance: c.importance }))
      );
    }
    const fb = firebaseMessaging();
    if (!fb) return () => {};
    return fb.api.onMessage(fb.instance, async (message) => {
      const title = message.notification?.title ?? (message.data?.title as string | undefined);
      const body = message.notification?.body ?? (message.data?.body as string | undefined);
      if (!title && !body) return;
      const isGroup = ['group_join', 'new_pal'].includes(String(message.data?.type ?? ''));
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: message.data ?? {} },
        trigger: { channelId: isGroup ? 'palzee_group_notifications' : 'palzee_hourly_reminders' },
      });
    });
  },

  async requestPermission(): Promise<boolean> {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const res = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return res.granted;
  },

  async getInterval(): Promise<ReminderInterval> {
    const stored = (await AsyncStorage.getItem(INTERVAL_KEY)) as ReminderInterval | null;
    return stored && stored in TOPICS_FOR ? stored : 'every 1hr';
  },

  /** Persists the setting and re-subscribes topics accordingly. */
  async setInterval(interval: ReminderInterval): Promise<void> {
    await AsyncStorage.setItem(INTERVAL_KEY, interval);
    await applyTopics(interval);
  },

  /**
   * Re-applies the saved setting, e.g. after sign-in or app start (Android does this in onCreate).
   * Without notification permission no topics are subscribed, but the saved choice is kept.
   */
  async syncSubscriptions(): Promise<void> {
    const granted = (await Notifications.getPermissionsAsync()).granted;
    await applyTopics(granted ? await this.getInterval() : 'off').catch((e) => console.warn('[push] topic sync failed', e));
  },
};
