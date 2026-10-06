import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, IconButton, PzText } from '../../components/pz';
import { MomentMedia } from '../../components/moments/MomentMedia';
import { Moment, momentsService } from '../../services/momentsService';
import { usePalzeeStore } from '../../stores/palzeeStore';
import { palDayKey } from '../../utils/palDay';
import { gradients, useTheme } from '../../theme/tokens';
import { VLOG_PAL_CODE } from '../../services/encoding';

type Tab = 'moments' | 'vlog';

/** Mockup "Profile" tab. */
export default function Profile() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, groups } = usePalzeeStore();
  const [mine, setMine] = useState<Moment[]>([]);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState<Tab>('moments');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await momentsService.listMine(user.id);
      setMine(res.moments);
      setTotal(res.total);
    } catch (e) {
      console.warn('[profile] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const daysLogged = useMemo(() => new Set(mine.map((m) => palDayKey(m.createdAt))).size, [mine]);
  const shown = mine.filter((m) => (tab === 'vlog' ? m.palCode === VLOG_PAL_CODE : true));
  const tile = (width - 4 * 2) / 3;
  const handle = user?.email ? `@${user.email.split('@')[0]}` : '';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.primary} colors={[c.primary]} />}
    >
      <View style={{ height: 170 + insets.top }}>
        <LinearGradient colors={gradients.sunset} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <IconButton
          name="settings-outline"
          color="#FFFFFF"
          label="Settings"
          onPress={() => router.push('/settings')}
          style={{ position: 'absolute', right: 12, top: insets.top + 6 }}
        />
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: -54 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={[styles.avatarRing, { backgroundColor: c.bg }]}>
            <Avatar name={user?.displayName ?? 'Me'} uri={user?.avatarUrl} seed={user?.id} size={100} />
          </View>
          <Pressable onPress={() => router.push('/edit-profile')} style={[styles.edit, { backgroundColor: c.surface, borderColor: c.border }]} accessibilityRole="button">
            <Ionicons name="pencil" size={14} color={c.text} />
            <PzText variant="label" style={{ marginLeft: 6 }}>Edit</PzText>
          </Pressable>
        </View>
        <PzText variant="heading" style={{ marginTop: 10 }}>{user?.displayName}</PzText>
        {!!handle && <PzText variant="caption" color="muted">{handle}</PzText>}
        <PzText variant="body" color={user?.bio ? 'text' : 'muted'} style={{ marginTop: 10 }}>
          {user?.bio || 'Turning everyday moments into memories.'}
        </PzText>

        <View style={styles.stats}>
          {[
            { label: 'Moments', value: total },
            { label: 'PAls', value: groups.length },
            { label: 'Days logged', value: daysLogged },
          ].map((s) => (
            <View key={s.label} style={{ alignItems: 'center', flex: 1 }}>
              <PzText variant="heading">{s.value}</PzText>
              <PzText variant="caption" color="muted">{s.label}</PzText>
            </View>
          ))}
        </View>

        <View style={[styles.tabs, { borderBottomColor: c.border }]}>
          {(['moments', 'vlog'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && { borderBottomColor: c.primary }]} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
              <PzText variant="label" color={tab === t ? 'primary' : 'muted'}>{t === 'moments' ? 'Moments' : 'My Vlog'}</PzText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.grid}>
        {shown.map((m) => (
          <MomentMedia key={m.id} clip={m.clip} style={{ width: tile, height: tile }} radius={4} />
        ))}
      </View>
      {shown.length === 0 && !loading && (
        <PzText variant="body" color="muted" align="center" style={{ marginTop: 24 }}>
          {tab === 'vlog' ? 'Moments you keep just for yourself show up here.' : 'Your moments will show up here.'}
        </PzText>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatarRing: { padding: 4, borderRadius: 60 },
  edit: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 34, borderRadius: 17, borderWidth: 1, marginBottom: 8 },
  stats: { flexDirection: 'row', marginTop: 20, marginBottom: 8 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 12 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
});
