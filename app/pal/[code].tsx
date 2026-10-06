import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Chips, Field, GradientButton, IconButton, PzText, identityColor } from '../../components/pz';
import { MomentMedia } from '../../components/moments/MomentMedia';
import { Moment, momentsService } from '../../services/momentsService';
import { PalMember, palsService } from '../../services/palsService';
import { usePalzeeStore } from '../../stores/palzeeStore';
import { hourLabel, isInPalDay, palDayRange, relativeHour } from '../../utils/palDay';
import { shareInvite } from '../../utils/invite';
import { radius, shadow, useTheme } from '../../theme/tokens';

const EMOJIS = ['❤️', '😂', '🔥', '😮', '🥹'];

function dayLabel(offset: number): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Yesterday';
  return palDayRange(offset).start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

/** A PAl room (Setlog's "Log"): one tile per member for every hour of the 4 AM-to-4 AM day. */
export default function PalRoom() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, groups, interactions, react, leaveGroup, deleteGroup, refresh } = usePalzeeStore();
  const group = groups.find((g) => g.code === code);
  const [members, setMembers] = useState<PalMember[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [reactingTo, setReactingTo] = useState<Moment | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(group?.name ?? '');

  const load = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    try {
      const since = palDayRange(6).start;
      const [m, mem] = await Promise.all([momentsService.listMoments(code, { since }), palsService.listMembers(code)]);
      setMoments(m);
      setMembers(mem);
    } catch (e: any) {
      Alert.alert('Could not load this PAl', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  // Hours of the selected day that have at least one clip, newest first; today also shows the current hour.
  const hours = useMemo(() => {
    const dayMoments = moments.filter((m) => isInPalDay(m.createdAt, offset));
    const byHour = new Map<number, Moment[]>();
    for (const m of dayMoments) {
      const h = relativeHour(m.createdAt);
      byHour.set(h, [...(byHour.get(h) ?? []), m]);
    }
    if (offset === 0 && !byHour.has(relativeHour(new Date()))) byHour.set(relativeHour(new Date()), []);
    return [...byHour.entries()].sort((a, b) => b[0] - a[0]);
  }, [moments, offset]);

  // Members plus anyone who posted (people who later left keep their clips in past days).
  const roster = useMemo(() => {
    const byId = new Map(members.map((m) => [m.userId, m]));
    for (const m of moments) {
      if (!byId.has(m.userId)) {
        byId.set(m.userId, { userId: m.userId, displayName: m.authorName, avatarUrl: m.authorAvatarUrl, joinedAt: null });
      }
    }
    return [...byId.values()];
  }, [members, moments]);

  const tileW = (width - 16 * 2 - 10) / 2;

  const menu = () => {
    if (!group) return;
    const actions: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [
      { text: 'Share invite code', onPress: () => shareInvite(group) },
    ];
    if (group.isCreator) actions.push({ text: 'Rename PAl', onPress: () => { setEditName(group.name); setEditing(true); } });
    actions.push(
      group.isCreator
        ? {
            text: 'Delete PAl',
            style: 'destructive',
            onPress: () =>
              Alert.alert('Delete this PAl?', 'All moments and chat in it are deleted for everyone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteGroup(group.code).then(() => router.back(), (e) => Alert.alert('Could not delete', e.message)) },
              ]),
          }
        : {
            text: 'Leave PAl',
            style: 'destructive',
            onPress: () => leaveGroup(group.code).then(() => router.back(), (e) => Alert.alert('Could not leave', e.message)),
          },
      { text: 'Cancel', style: 'cancel' }
    );
    Alert.alert(group.name, `Code #${group.code}`, actions);
  };

  const saveName = async () => {
    if (!group || editName.trim().length < 2) return;
    try {
      await palsService.updateGroup(group.code, { name: editName });
      setEditing(false);
      void refresh();
    } catch (e: any) {
      Alert.alert('Could not rename', e?.message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <IconButton name="arrow-back" label="Back" onPress={() => router.back()} />
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <PzText variant="heading" numberOfLines={1}>{group?.name ?? 'PAl'}</PzText>
          <PzText variant="caption" color="muted">{members.length} member{members.length === 1 ? '' : 's'} · #{code}</PzText>
        </View>
        <IconButton name="chatbubbles-outline" label="Chat" onPress={() => router.push(`/chat/${code}`)} />
        <IconButton name="ellipsis-horizontal" label="PAl options" onPress={menu} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingVertical: 6 }}>
        {members.map((m) => (
          <View key={m.userId} style={{ alignItems: 'center', width: 52 }}>
            <View style={{ borderWidth: 2, borderColor: identityColor(m.userId), borderRadius: 24, padding: 1 }}>
              <Avatar name={m.displayName} uri={m.avatarUrl} seed={m.userId} size={40} />
            </View>
            <PzText variant="caption" numberOfLines={1} style={{ fontSize: 10.5, marginTop: 3 }}>{m.displayName.split(' ')[0]}</PzText>
          </View>
        ))}
      </ScrollView>

      <Chips
        options={[0, 1, 2, 3, 4, 5, 6].map((o) => ({ key: String(o), label: dayLabel(o) }))}
        value={String(offset)}
        onChange={(k) => setOffset(Number(k))}
        style={{ paddingVertical: 8 }}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.primary} colors={[c.primary]} />}
      >
        {hours.length === 0 && !loading && (
          <PzText variant="body" color="muted" align="center" style={{ marginTop: 40 }}>No moments logged this day.</PzText>
        )}
        {hours.map(([hour, list]) => {
          const at = list[0]?.createdAt ?? new Date();
          return (
            <View key={hour} style={{ marginTop: 14 }}>
              <PzText variant="subheading" style={{ marginBottom: 8 }}>{hourLabel(at)}</PzText>
              <View style={styles.grid}>
                {roster.map((member) => {
                  const m = list.find((x) => x.userId === member.userId);
                  if (!m) {
                    return (
                      <View key={member.userId} style={[styles.emptyTile, { width: tileW, borderColor: c.border }]}>
                        <Avatar name={member.displayName} uri={member.avatarUrl} seed={member.userId} size={26} />
                        <PzText variant="caption" color="subtle" style={{ marginTop: 6 }}>{member.displayName.split(' ')[0]} hasn't logged</PzText>
                      </View>
                    );
                  }
                  const reactionsForClip = interactions[m.clip.videoUrl]?.reactions ?? [];
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => setPlayingId(playingId === m.id ? null : m.id)}
                      onLongPress={() => setReactingTo(m)}
                      accessibilityRole="button"
                      accessibilityLabel={`${m.authorName}'s moment`}
                      style={{ width: tileW }}
                    >
                      <MomentMedia clip={m.clip} playing={playingId === m.id} muted={false} style={{ width: tileW, aspectRatio: 16 / 10, borderWidth: 2, borderColor: identityColor(m.userId) }} radius={14} />
                      <View style={styles.tileMeta}>
                        <PzText variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                          <PzText variant="caption" style={{ fontWeight: '700' }}>{m.authorName}</PzText>
                          {m.clip.caption ? ` · ${m.clip.caption}` : ''}
                        </PzText>
                        <Pressable onPress={() => setReactingTo(m)} hitSlop={8} accessibilityLabel="React">
                          <PzText style={{ fontSize: 14 }}>{reactionsForClip.map((r) => r.emoji).slice(-3).join('') || '🙂'}</PzText>
                        </Pressable>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <GradientButton
          label={offset === 0 ? "Play today's recap" : offset === 1 ? "Play yesterday's recap" : `Play ${dayLabel(offset)} recap`}
          trailingIcon="play"
          onPress={() => router.push({ pathname: '/recap/[code]', params: { code: code!, day: String(offset) } })}
          style={{ flex: 1 }}
        />
      </View>

      <Modal visible={!!reactingTo} transparent animationType="fade" onRequestClose={() => setReactingTo(null)}>
        <Pressable style={[styles.scrim, { backgroundColor: c.overlay }]} onPress={() => setReactingTo(null)}>
          <View style={[styles.emojiBar, { backgroundColor: c.surface }]}>
            {EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => {
                  const target = reactingTo!;
                  setReactingTo(null);
                  react(target, e).catch((err) => Alert.alert('Could not react', err.message));
                }}
                hitSlop={6}
                accessibilityLabel={`React ${e}`}
              >
                <PzText style={{ fontSize: 30 }}>{e}</PzText>
              </Pressable>
            ))}
            {reactingTo?.userId === user?.id && (
              <Pressable
                onPress={() => {
                  const target = reactingTo!;
                  setReactingTo(null);
                  Alert.alert('Delete this moment?', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => momentsService.deleteMoment(target).then(load, (err) => Alert.alert('Could not delete', err.message)) },
                  ]);
                }}
                accessibilityLabel="Delete moment"
              >
                <Ionicons name="trash-outline" size={26} color={c.danger} />
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <View style={[styles.scrim, { backgroundColor: c.overlay }]}>
          <View style={[styles.dialog, { backgroundColor: c.bg }]}>
            <PzText variant="heading" style={{ marginBottom: 14 }}>Rename PAl</PzText>
            <Field label="PAl name" icon="people-outline" value={editName} onChangeText={setEditName} maxLength={40} autoFocus />
            <GradientButton label="Save" trailingIcon={null} onPress={saveName} style={{ marginTop: 18 }} />
            <Pressable onPress={() => setEditing(false)} style={{ alignSelf: 'center', marginTop: 12 }}>
              <PzText variant="label" color="muted">Cancel</PzText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emptyTile: { aspectRatio: 16 / 10, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  tileMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  footer: { position: 'absolute', left: 16, right: 16, bottom: 0, flexDirection: 'row' },
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emojiBar: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 14, borderRadius: radius.pill, ...shadow.card },
  dialog: { alignSelf: 'stretch', padding: 22, borderRadius: radius.xl },
});
