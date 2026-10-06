import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, PzText } from '../pz';
import { Moment } from '../../services/momentsService';
import { ClipInteractions } from '../../services/chatService';
import { radius, shadow, useTheme } from '../../theme/tokens';
import { hourLabel } from '../../utils/palDay';
import { MomentMedia } from './MomentMedia';
import { timeAgo } from './media';

export function MomentCard({
  moment,
  groupName,
  interactions,
  myUserId,
  playing,
  onReact,
  onOpenReplies,
  onOpenGroup,
  onMore,
}: {
  moment: Moment;
  groupName?: string;
  interactions?: ClipInteractions;
  myUserId: string;
  playing: boolean;
  onReact: (emoji: string) => void;
  onOpenReplies: () => void;
  onOpenGroup?: () => void;
  onMore?: () => void;
}) {
  const { c } = useTheme();
  const reactions = interactions?.reactions ?? [];
  const mine = reactions.find((r) => r.userId === myUserId);
  const topEmoji = reactions[reactions.length - 1]?.emoji ?? '❤️';

  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <View style={styles.header}>
        <Avatar name={moment.authorName} uri={moment.authorAvatarUrl} seed={moment.userId} size={38} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <PzText variant="bodyStrong">{moment.authorName}</PzText>
          <PzText variant="caption" color="muted">
            {moment.pending ? 'Uploading…' : `${timeAgo(moment.createdAt)} · ${hourLabel(moment.createdAt)} log`}
          </PzText>
        </View>
        {onMore && (
          <Pressable onPress={onMore} hitSlop={10} accessibilityLabel="More options">
            <Ionicons name="ellipsis-horizontal" size={20} color={c.text} />
          </Pressable>
        )}
      </View>

      <MomentMedia clip={moment.clip} playing={playing} style={{ aspectRatio: 16 / 10, marginHorizontal: 10 }} />

      <View style={{ paddingHorizontal: 14, paddingTop: 10 }}>
        {!!moment.clip.caption && <PzText variant="body">{moment.clip.caption}</PzText>}
        {groupName && (
          <Pressable onPress={onOpenGroup} disabled={!onOpenGroup} hitSlop={6}>
            <PzText variant="caption" color="muted" style={{ marginTop: 2 }}>
              {groupName}
            </PzText>
          </Pressable>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={() => onReact('❤️')} accessibilityLabel="React" hitSlop={6}>
          <PzText style={{ fontSize: 18 }}>{reactions.length ? topEmoji : '🤍'}</PzText>
          <PzText variant="label" style={{ marginLeft: 6 }}>{reactions.length}</PzText>
        </Pressable>
        <Pressable style={styles.action} onPress={onOpenReplies} accessibilityLabel="Replies" hitSlop={6}>
          <Ionicons name="chatbubble-outline" size={19} color={c.text} />
          <PzText variant="label" style={{ marginLeft: 6 }}>{interactions?.replies.length ?? 0}</PzText>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => onReact('❤️')} hitSlop={8} accessibilityLabel={mine ? 'Change reaction' : 'Like'}>
          <Ionicons name={mine ? 'heart' : 'heart-outline'} size={22} color={mine ? c.heart : c.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, paddingBottom: 6, marginHorizontal: 16, marginBottom: 16, ...shadow.card },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  action: { flexDirection: 'row', alignItems: 'center', marginRight: 18 },
});
