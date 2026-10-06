import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chips, PhotoSlot, PzText } from '../../components/pz';
import { MomentMedia } from '../../components/moments/MomentMedia';
import { Moment } from '../../services/momentsService';
import { usePalzeeStore } from '../../stores/palzeeStore';
import { palDayKey, palDayOf } from '../../utils/palDay';
import { gradients, radius, shadow, useTheme } from '../../theme/tokens';

/** Days between today's pal day and the pal day of `date`. */
function dayOffset(date: Date): number {
  return Math.round((palDayOf(new Date()).getTime() - palDayOf(date).getTime()) / 86_400_000);
}

function dayTitle(offset: number, date: Date): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Yesterday';
  return palDayOf(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

/** Mockup "Memories" tab: daily recaps (Setlog's auto daily log) and this week's moments. */
export default function Memories() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, groups, feed, loading, refresh } = usePalzeeStore();
  const [filter, setFilter] = useState<string>('all');

  const scoped = useMemo(
    () => feed.filter((m) => (filter === 'all' ? true : filter === 'mine' ? m.userId === user?.id : m.palCode === filter)),
    [feed, filter, user?.id]
  );

  const days = useMemo(() => {
    const byDay = new Map<string, Moment[]>();
    for (const m of scoped) {
      const key = palDayKey(m.createdAt);
      byDay.set(key, [...(byDay.get(key) ?? []), m]);
    }
    return [...byDay.entries()].map(([key, moments]) => ({
      key,
      offset: dayOffset(moments[0].createdAt),
      moments,
      people: new Set(moments.map((m) => m.userId)).size,
    }));
  }, [scoped]);

  const today = days.find((d) => d.offset === 0);
  const hero = today ?? days[0];
  const tile = (width - 16 * 2 - 8 * 2) / 3;
  const openRecap = (offset: number, start?: string) =>
    router.push({ pathname: '/recap/[code]', params: { code: filter, day: String(offset), ...(start ? { start } : {}) } });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
    >
      <View style={styles.header}>
        <PzText variant="title">Memories</PzText>
      </View>
      <Chips
        options={[{ key: 'all', label: 'All' }, { key: 'mine', label: 'Mine' }, ...groups.map((g) => ({ key: g.code, label: g.name }))]}
        value={filter}
        onChange={setFilter}
        style={{ paddingBottom: 14 }}
      />

      <Pressable
        onPress={() => hero && openRecap(hero.offset)}
        disabled={!hero}
        accessibilityRole="button"
        accessibilityLabel="Play recap"
        style={[styles.hero, shadow.card]}
      >
        <LinearGradient colors={['#FDE6F1', '#E9E3FF', '#DCE9FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.heroCollage}>
          {(hero?.moments ?? []).slice(0, 3).map((m, i) => (
            <View key={m.id} style={[styles.heroTile, { transform: [{ rotate: `${[-8, 3, 9][i]}deg` }], left: 16 + i * 92, top: [18, 8, 22][i] }]}>
              <MomentMedia clip={m.clip} style={{ width: 100, height: 76 }} radius={10} />
            </View>
          ))}
          {!hero && <PhotoSlot tone="sunset" style={{ position: 'absolute', left: 16, right: 16, top: 12, height: 86 }} radius={12} doodle={require('../../assets/images/dm_moon.png')} />}
        </View>
        <View style={{ padding: 16, flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <PzText variant="heading">{hero ? `${dayTitle(hero.offset, hero.moments[0].createdAt)}'s Recap` : 'Your recap lives here'}</PzText>
            <PzText variant="caption" color="muted" style={{ marginTop: 4 }}>
              {hero ? `${hero.moments.length} moments · ${hero.people} ${hero.people === 1 ? 'person' : 'people'}` : 'Log moments today and replay the whole day after 4 AM.'}
            </PzText>
          </View>
          {hero && (
            <LinearGradient colors={gradients.primary} style={styles.play}>
              <Ionicons name="play" size={20} color="#FFFFFF" />
            </LinearGradient>
          )}
        </View>
      </Pressable>

      {days.length > 0 && (
        <>
          <View style={styles.sectionHead}>
            <PzText variant="subheading">This Week</PzText>
          </View>
          <View style={styles.grid}>
            {scoped.slice(0, 9).map((m) => (
              <Pressable key={m.id} onPress={() => openRecap(dayOffset(m.createdAt), m.id)} accessibilityRole="button" accessibilityLabel={`Moment by ${m.authorName}`}>
                <MomentMedia clip={m.clip} style={{ width: tile, height: tile }} radius={12} />
              </Pressable>
            ))}
          </View>

          <View style={styles.sectionHead}>
            <PzText variant="subheading">Daily Logs</PzText>
          </View>
          {days.map((d) => (
            <Pressable
              key={d.key}
              onPress={() => openRecap(d.offset)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.dayRow, { backgroundColor: c.surface, opacity: pressed ? 0.9 : 1 }]}
            >
              <MomentMedia clip={d.moments[0].clip} style={{ width: 64, height: 48 }} radius={10} />
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <PzText variant="bodyStrong">{dayTitle(d.offset, d.moments[0].createdAt)}</PzText>
                <PzText variant="caption" color="muted">
                  {d.moments.length} moments · {d.people} {d.people === 1 ? 'person' : 'people'}
                </PzText>
              </View>
              <Ionicons name="play-circle" size={28} color={c.primary} />
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 10 },
  hero: { marginHorizontal: 16, borderRadius: radius.xl, overflow: 'hidden', minHeight: 196 },
  heroCollage: { height: 112 },
  heroTile: { position: 'absolute', padding: 3, backgroundColor: '#FFFFFF', borderRadius: 12 },
  play: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { paddingHorizontal: 16, marginTop: 22, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  dayRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, padding: 10, borderRadius: radius.lg, ...shadow.card },
});
