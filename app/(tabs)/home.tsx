import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Platform, RefreshControl, ScrollView, StyleSheet, View, ViewToken } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton, IconButton, PzText, StoryAvatar, Wordmark } from '../../components/pz';
import { MomentCard } from '../../components/moments/MomentCard';
import { Moment, momentsService } from '../../services/momentsService';
import { usePalzeeStore } from '../../stores/palzeeStore';
import { isInPalDay } from '../../utils/palDay';
import { radius, useTheme } from '../../theme/tokens';

export default function Home() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, groups, feed, interactions, pendingUploads, loading, refresh, react } = usePalzeeStore();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const groupName = useMemo(() => Object.fromEntries(groups.map((g) => [g.code, g.name])), [groups]);
  const loggedToday = useMemo(() => new Set(feed.filter((m) => isInPalDay(m.createdAt)).map((m) => m.palCode)), [feed]);

  const viewability = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken<Moment>[] }) => {
    setPlayingId(viewableItems[0]?.item?.id ?? null);
  }, []);

  const momentMenu = (m: Moment) => {
    if (m.userId !== user?.id) return undefined;
    return () => {
      const remove = () =>
        Alert.alert('Delete this moment?', 'It will be removed for everyone in the PAl.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await momentsService.deleteMoment(m).catch((e) => Alert.alert('Could not delete', e.message));
              void refresh();
            },
          },
        ]);
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions({ options: ['Cancel', 'Delete moment'], destructiveButtonIndex: 1, cancelButtonIndex: 0 }, (i) => i === 1 && remove());
      } else {
        remove();
      }
    };
  };

  const header = (
    <View>
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Wordmark size={30} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <IconButton name="search" label="Join a PAl by code" onPress={() => router.push({ pathname: '/new-pal', params: { tab: 'join' } })} />
          <IconButton name="notifications-outline" label="Notifications" onPress={() => router.push('/settings')} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}>
        <StoryAvatar name={user?.displayName ?? 'Me'} uri={user?.avatarUrl} seed={user?.id} label="Add Moment" showAdd seen onPress={() => router.push('/camera')} />
        {groups.map((g) => (
          <StoryAvatar key={g.code} name={g.name} seed={g.code} label={g.name} seen={!loggedToday.has(g.code)} onPress={() => router.push(`/pal/${g.code}`)} />
        ))}
      </ScrollView>

      {pendingUploads > 0 && (
        <View style={[styles.banner, { backgroundColor: c.surfaceMuted }]}>
          <Ionicons name="cloud-upload-outline" size={18} color={c.primary} />
          <PzText variant="label" style={{ marginLeft: 8 }}>
            Uploading {pendingUploads} moment{pendingUploads > 1 ? 's' : ''}…
          </PzText>
        </View>
      )}
    </View>
  );

  const empty = (
    <View style={styles.empty}>
      <PzText variant="heading" align="center">{groups.length ? 'No moments yet today' : 'Start your first PAl'}</PzText>
      <PzText variant="body" color="muted" align="center" style={{ marginTop: 6, marginBottom: 20 }}>
        {groups.length
          ? 'Capture a quick clip and your PAls will see it here.'
          : 'Create a private group for your people, or join one with a code.'}
      </PzText>
      <GradientButton
        label={groups.length ? 'Capture a moment' : 'Create or join a PAl'}
        onPress={() => router.push(groups.length ? '/camera' : '/new-pal')}
        style={{ alignSelf: 'stretch' }}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={feed}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={header}
        ListEmptyComponent={loading ? null : empty}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={viewability}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <MomentCard
            moment={item}
            groupName={groupName[item.palCode]}
            interactions={interactions[item.clip.videoUrl]}
            myUserId={user?.id ?? ''}
            playing={item.id === playingId}
            onReact={(emoji) => react(item, emoji).catch((e) => Alert.alert('Could not react', e.message))}
            onOpenReplies={() => router.push(`/chat/${item.palCode}`)}
            onOpenGroup={() => router.push(`/pal/${item.palCode}`)}
            onMore={momentMenu(item)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: radius.md },
  empty: { paddingHorizontal: 32, paddingTop: 48, alignItems: 'center' },
});
