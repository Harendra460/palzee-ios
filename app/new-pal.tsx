import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field, GradientButton, IconButton, PzText, Segmented } from '../components/pz';
import { usePalzeeStore } from '../stores/palzeeStore';
import { PalGroup } from '../services/palsService';
import { radius, useTheme } from '../theme/tokens';
import { shareInvite } from '../utils/invite';

const SIZES = [2, 3, 4, 6, 8, 12, 20];

/** Create a PAl (private group) or join one with a code. */
export default function NewPal() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string; code?: string }>();
  const { createGroup, joinGroup } = usePalzeeStore();
  const [tab, setTab] = useState<'create' | 'join'>(params.tab === 'join' || params.code ? 'join' : 'create');
  const [name, setName] = useState('');
  const [size, setSize] = useState(4);
  const [code, setCode] = useState(params.code ?? '');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<PalGroup | null>(null);

  const create = async () => {
    if (name.trim().length < 2) return Alert.alert('Name your PAl', 'Give your group a name.');
    setBusy(true);
    try {
      setCreated(await createGroup(name, size));
    } catch (e: any) {
      Alert.alert('Could not create PAl', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setBusy(true);
    try {
      const group = await joinGroup(code);
      if (!group) return Alert.alert('No group found', 'Check the code and try again.');
      router.replace(`/pal/${group.code}`);
    } catch (e: any) {
      Alert.alert('Could not join', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: 24, paddingTop: insets.top + 24 }}>
        <PzText variant="title">{created.name} is ready 🎉</PzText>
        <PzText variant="body" color="muted" style={{ marginTop: 6 }}>Invite your people with this code.</PzText>
        <View style={[styles.codeBox, { backgroundColor: c.surface, borderColor: c.border }]}>
          <PzText variant="display" color="primary" style={{ letterSpacing: 4 }}>#{created.code}</PzText>
        </View>
        <GradientButton label="Share invite" trailingIcon="share-outline" onPress={() => shareInvite(created)} />
        <Pressable onPress={() => router.replace(`/pal/${created.code}`)} style={{ alignSelf: 'center', marginTop: 18 }}>
          <PzText variant="bodyStrong" color="primary">Open {created.name}</PzText>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingTop: insets.top + 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <PzText variant="title">New PAl</PzText>
          <IconButton name="close" label="Close" onPress={() => router.back()} />
        </View>
        <View style={{ marginTop: 16, marginBottom: 20 }}>
          <Segmented options={[{ key: 'create', label: 'Create' }, { key: 'join', label: 'Join with code' }]} value={tab} onChange={setTab} />
        </View>

        {tab === 'create' ? (
          <>
            <Field label="PAl name" icon="people-outline" value={name} onChangeText={setName} placeholder="College Buddies" maxLength={40} />
            <PzText variant="subheading" style={{ marginTop: 22, marginBottom: 10 }}>Room size</PzText>
            <View style={styles.sizes}>
              {SIZES.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setSize(s)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: s === size }}
                  style={[styles.size, { backgroundColor: s === size ? c.primary : c.surface, borderColor: s === size ? c.primary : c.border }]}
                >
                  <PzText variant="bodyStrong" color={s === size ? '#FFFFFF' : c.text}>{s}</PzText>
                </Pressable>
              ))}
            </View>
            <PzText variant="caption" color="muted" style={{ marginTop: 8 }}>Up to {size} people can log together.</PzText>
            <GradientButton label="Create PAl" onPress={create} loading={busy} style={{ marginTop: 28 }} />
          </>
        ) : (
          <>
            <Field
              label="Invite code"
              icon="key-outline"
              value={code}
              onChangeText={setCode}
              placeholder="#abc123"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={12}
            />
            <View style={[styles.hint, { backgroundColor: c.surfaceMuted }]}>
              <Ionicons name="information-circle-outline" size={18} color={c.textMuted} />
              <PzText variant="caption" color="muted" style={{ marginLeft: 8, flex: 1 }}>Ask a friend in the PAl to share its code with you.</PzText>
            </View>
            <GradientButton label="Join PAl" onPress={join} loading={busy} disabled={code.trim().length < 3} style={{ marginTop: 28 }} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  size: { width: 52, height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  codeBox: { marginVertical: 28, paddingVertical: 28, borderRadius: radius.xl, borderWidth: 1, alignItems: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: radius.md, marginTop: 12 },
});
