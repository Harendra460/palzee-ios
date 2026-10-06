import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, PzText } from '../components/pz';
import { pushService, ReminderInterval } from '../services/pushService';
import { usePalzeeStore } from '../stores/palzeeStore';
import { radius, shadow, useTheme } from '../theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

const REMINDERS: { key: ReminderInterval; label: string }[] = [
  { key: 'every 1hr', label: 'Every hour' },
  { key: 'every 3hrs', label: 'Every 3 hours' },
  { key: 'off', label: 'Off' },
];

function Row({ icon, label, onPress, danger, trailing }: { icon: IconName; label: string; onPress: () => void; danger?: boolean; trailing?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={20} color={danger ? c.danger : c.text} />
      <PzText variant="bodyStrong" color={danger ? 'danger' : 'text'} style={{ flex: 1, marginLeft: 14 }}>{label}</PzText>
      {trailing ?? <Ionicons name="chevron-forward" size={18} color={c.textSubtle} />}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ marginTop: 22 }}>
      <PzText variant="label" color="muted" style={{ marginLeft: 20, marginBottom: 8 }}>{title}</PzText>
      <View style={[styles.card, { backgroundColor: c.surface }]}>{children}</View>
    </View>
  );
}

export default function Settings() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut, deleteAccount } = usePalzeeStore();
  const [interval, setIntervalState] = useState<ReminderInterval>('every 1hr');

  useEffect(() => {
    pushService.getInterval().then(setIntervalState);
  }, []);

  const chooseReminder = async (value: ReminderInterval) => {
    if (value !== 'off' && !(await pushService.requestPermission())) {
      return Alert.alert('Notifications are off', 'Turn on notifications for PalZee in your phone settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
      ]);
    }
    setIntervalState(value);
    await pushService.setInterval(value).catch((e) => Alert.alert('Could not update reminders', e.message));
  };

  const open = (url: string) => WebBrowser.openBrowserAsync(url);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: insets.bottom + 32 }}>
      <View style={styles.header}>
        <IconButton name="arrow-back" label="Back" onPress={() => router.back()} />
        <PzText variant="heading" style={{ marginLeft: 8 }}>Settings</PzText>
      </View>

      <Section title="REMIND ME TO LOG">
        {REMINDERS.map((r) => (
          <Row
            key={r.key}
            icon={r.key === 'off' ? 'notifications-off-outline' : 'notifications-outline'}
            label={r.label}
            onPress={() => chooseReminder(r.key)}
            trailing={<Ionicons name={interval === r.key ? 'radio-button-on' : 'radio-button-off'} size={20} color={interval === r.key ? c.primary : c.textSubtle} />}
          />
        ))}
        {!pushService.isRemotePushAvailable() && (
          <PzText variant="caption" color="muted" style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            Hourly reminders need push notifications, which aren't set up in this build yet.
          </PzText>
        )}
      </Section>

      <Section title="ACCOUNT">
        <Row icon="person-circle-outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
        <Row
          icon="log-out-outline"
          label="Log out"
          onPress={() =>
            Alert.alert('Log out?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log out', style: 'destructive', onPress: () => signOut().then(() => router.replace('/(onboarding)/welcome')) },
            ])
          }
        />
      </Section>

      <Section title="ABOUT">
        <Row icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => open('https://palzee.fun/privacy.html')} />
        <Row icon="document-text-outline" label="Terms of Service" onPress={() => open('https://palzee.fun/tos.html')} />
        <Row icon="hand-left-outline" label="Child Safety Policy" onPress={() => open('https://palzee.fun/csampolicy.html')} />
        <Row icon="chatbox-ellipses-outline" label="Send feedback" onPress={() => open('https://palzee.fun/feedback.html')} />
      </Section>

      <Section title="DANGER ZONE">
        <Row
          icon="trash-outline"
          label="Delete account"
          danger
          onPress={() =>
            Alert.alert('Delete your account?', 'Your moments and PAl memberships are removed. This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => deleteAccount().then(() => router.replace('/(onboarding)/welcome'), (e) => Alert.alert('Could not delete account', e.message)),
              },
            ])
          }
        />
      </Section>

      <PzText variant="caption" color="subtle" align="center" style={{ marginTop: 24 }}>
        PalZee {Constants.expoConfig?.version ?? ''}
      </PzText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  card: { marginHorizontal: 16, borderRadius: radius.lg, overflow: 'hidden', ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 54 },
});
