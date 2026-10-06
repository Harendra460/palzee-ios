import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chips, GradientButton, IconButton, PhotoSlot, PzText } from '../../components/pz';
import { MomentMedia } from '../../components/moments/MomentMedia';
import { palsService } from '../../services/palsService';
import { usePalzeeStore } from '../../stores/palzeeStore';
import { radius, shadow, useTheme } from '../../theme/tokens';

type Filter = 'all' | 'created' | 'joined';

/** Mockup "PAls" tab: the user's private groups. */
export default function Pals() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { groups, feed, loading, refresh } = usePalzeeStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    palsService.memberCounts(groups.map((g) => g.code)).then(setCounts).catch(() => {});
  }, [groups]);

  const latestByGroup = useMemo(() => {
    const map: Record<string, (typeof feed)[number]> = {};
    for (const m of feed) if (!map[m.palCode]) map[m.palCode] = m;
    return map;
  }, [feed]);

  const visible = groups.filter((g) => filter === 'all' || (filter === 'created' ? g.isCreator : !g.isCreator));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 6 }}>
      <View style={styles.header}>
        <PzText variant="title">PAls</PzText>
        <IconButton name="add-circle-outline" size={26} label="New PAl" onPress={() => router.push('/new-pal')} />
      </View>
      <Chips
        options={[
          { key: 'all', label: 'All' },
          { key: 'created', label: 'Created' },
          { key: 'joined', label: 'Joined' },
        ]}
        value={filter}
        onChange={setFilter}
        style={{ paddingBottom: 12 }}
      />
      <FlatList
        data={visible}
        keyExtractor={(g) => g.code}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: 16 }}>
            <PzText variant="heading">No PAls here yet</PzText>
            <PzText variant="body" color="muted" align="center" style={{ marginTop: 6, marginBottom: 20 }}>
              A PAl is a private room for up to 20 people. Everyone logs a moment each hour.
            </PzText>
            <GradientButton label="Create or join a PAl" onPress={() => router.push('/new-pal')} style={{ alignSelf: 'stretch' }} />
          </View>
        }
        renderItem={({ item }) => {
          const latest = latestByGroup[item.code];
          const members = counts[item.code];
          return (
            <Pressable
              onPress={() => router.push(`/pal/${item.code}`)}
              accessibilityRole="button"
              accessibilityLabel={item.name}
              style={({ pressed }) => [styles.row, { backgroundColor: c.surface, opacity: pressed ? 0.9 : 1 }]}
            >
              {latest ? (
                <MomentMedia clip={latest.clip} style={styles.thumb} radius={14} />
              ) : (
                <PhotoSlot tone="dusk" style={styles.thumb} radius={14} doodle={require('../../assets/images/smile_small.png')} />
              )}
              <View style={{ flex: 1, marginHorizontal: 14 }}>
                <PzText variant="subheading" numberOfLines={1}>{item.name}</PzText>
                <PzText variant="caption" color="muted" style={{ marginTop: 3 }}>
                  {[members ? `${members} member${members > 1 ? 's' : ''}` : null, item.isCreator ? 'Owner' : null].filter(Boolean).join(' · ') || ' '}
                </PzText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: radius.lg, ...shadow.card },
  thumb: { width: 76, height: 64 },
});
