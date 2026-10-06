import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton, PzText } from '../../components/pz';
import { pushService, ReminderInterval } from '../../services/pushService';
import { radius, shadow, useTheme } from '../../theme/tokens';

const REMINDERS: { key: ReminderInterval; label: string; hint: string }[] = [
  { key: 'every 1hr', label: 'Every hour', hint: 'The full PalZee day' },
  { key: 'every 3hrs', label: 'Every 3 hours', hint: 'A lighter rhythm' },
  { key: 'off', label: 'Off', hint: 'I’ll open it myself' },
];

/** First-run setup after sign-up: capture permissions and the hourly reminder cadence. */
export default function Permissions() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [camera, requestCamera] = useCameraPermissions();
  const [mic, requestMic] = useMicrophonePermissions();
  const [notifGranted, setNotifGranted] = useState(false);
  const [reminder, setReminder] = useState<ReminderInterval>('every 1hr');
  const [saving, setSaving] = useState(false);

  const rows = [
    { key: 'camera', icon: 'camera-outline' as const, title: 'Camera', body: 'Capture a quick clip of your moment.', granted: !!camera?.granted, request: requestCamera },
    { key: 'mic', icon: 'mic-outline' as const, title: 'Microphone', body: 'Your clips include sound.', granted: !!mic?.granted, request: requestMic },
    {
      key: 'notif',
      icon: 'notifications-outline' as const,
      title: 'Notifications',
      body: 'A gentle nudge when it’s time to log.',
      granted: notifGranted,
      request: async () => setNotifGranted(await pushService.requestPermission()),
    },
  ];

  const finish = async () => {
    setSaving(true);
    try {
      await pushService.setInterval(notifGranted ? reminder : 'off');
    } catch (e) {
      console.warn('[permissions] reminder setup failed', e);
    } finally {
      setSaving(false);
      router.replace('/(tabs)/home');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 16, paddingHorizontal: 24 }}>
      <PzText variant="display">Let’s get you</PzText>
      <PzText variant="display" color="primary">ready to log</PzText>
      <PzText variant="body" color="muted" style={{ marginTop: 8 }}>PalZee works best with these on. You can change them later in Settings.</PzText>

      <View style={{ gap: 12, marginTop: 28 }}>
        {rows.map((r) => (
          <Pressable
            key={r.key}
            onPress={() => !r.granted && r.request()}
            accessibilityRole="button"
            style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <View style={[styles.icon, { backgroundColor: c.surfaceMuted }]}>
              <Ionicons name={r.icon} size={22} color={c.primary} />
            </View>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <PzText variant="subheading">{r.title}</PzText>
              <PzText variant="caption" color="muted">{r.body}</PzText>
            </View>
            {r.granted ? (
              <Ionicons name="checkmark-circle" size={24} color="#18B97F" />
            ) : (
              <PzText variant="label" color="primary">Allow</PzText>
            )}
          </Pressable>
        ))}
      </View>

      {notifGranted && (
        <View style={{ marginTop: 24 }}>
          <PzText variant="subheading" style={{ marginBottom: 10 }}>Remind me to log</PzText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {REMINDERS.map((r) => {
              const active = r.key === reminder;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => setReminder(r.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.choice, { backgroundColor: active ? c.primary : c.surface, borderColor: active ? c.primary : c.border }]}
                >
                  <PzText variant="label" color={active ? '#FFFFFF' : c.text}>{r.label}</PzText>
                  <PzText variant="caption" color={active ? 'rgba(255,255,255,0.8)' : c.textMuted} style={{ fontSize: 11 }}>{r.hint}</PzText>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={{ flex: 1 }} />
      <GradientButton label="Start Logging" onPress={finish} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: radius.lg, borderWidth: 1, ...shadow.card },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  choice: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 10, gap: 2 },
});
