import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer } from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, IconButton, PzText } from '../../components/pz';
import { chatService, ChatMessage } from '../../services/chatService';
import { palsService, PalMember } from '../../services/palsService';
import { supabase } from '../../services/supabase';
import { usePalzeeStore } from '../../stores/palzeeStore';
import { MessageBody } from '../../services/encoding';
import { fonts, radius, useTheme } from '../../theme/tokens';

function describe(body: MessageBody, authorName: string): string {
  switch (body.kind) {
    case 'reaction':
      return `${authorName} reacted ${body.emoji} to ${body.targetFirstName}'s moment`;
    case 'reply':
      return `${authorName} replied to ${body.targetFirstName}'s moment: ${body.reply.kind === 'text' ? body.reply.text : '🔊 sound'}`;
    case 'sound':
      return `🔊 ${body.name}`;
    default:
      return body.text;
  }
}

function playSound(url: string) {
  try {
    const player = createAudioPlayer({ uri: url });
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        sub.remove();
        player.release();
      }
    });
    player.play();
  } catch (e) {
    console.warn('[chat] sound playback failed', e);
  }
}

/** Group chat for a PAl (messages table, with reactions/replies/sounds shared with Android). */
export default function Chat() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, groups } = usePalzeeStore();
  const group = groups.find((g) => g.code === code);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<Record<string, PalMember>>({});
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList<ChatMessage>>(null);

  const load = useCallback(async () => {
    if (!code) return;
    const [msgs, mem] = await Promise.all([chatService.listMessages(code), palsService.listMembers(code)]);
    setMessages(msgs);
    setMembers(Object.fromEntries(mem.map((m) => [m.userId, m])));
  }, [code]);

  useEffect(() => {
    load().catch((e) => Alert.alert('Could not load chat', e.message));
    const channel = supabase
      .channel(`chat_${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `pal_code=eq.${code}` }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, load]);

  const data = useMemo(() => [...messages].reverse(), [messages]);

  const send = async () => {
    const body = text.trim();
    if (!body || !user || !code) return;
    setSending(true);
    setText('');
    try {
      const msg = await chatService.send(code, user.id, { kind: 'text', text: body });
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    } catch (e: any) {
      setText(body);
      Alert.alert('Message not sent', e?.message);
    } finally {
      setSending(false);
    }
  };

  const remove = (m: ChatMessage) =>
    Alert.alert('Delete message?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => chatService.deleteMessage(m.id).then(load, (e) => Alert.alert('Could not delete', e.message)) },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 4, borderBottomColor: c.border }]}>
        <IconButton name="arrow-back" label="Back" onPress={() => router.back()} />
        <PzText variant="heading" numberOfLines={1} style={{ flex: 1, marginLeft: 8 }}>{group?.name ?? 'Chat'}</PzText>
      </View>
      <FlatList
        ref={list}
        data={data}
        inverted
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={
          <PzText variant="body" color="muted" align="center" style={{ transform: [{ scaleY: -1 }], marginTop: 40 }}>
            Say hi to your PAl 👋
          </PzText>
        }
        renderItem={({ item }) => {
          const mine = item.userId === user?.id;
          const author = members[item.userId]?.displayName ?? 'Someone';
          if (item.body.kind === 'reaction' || item.body.kind === 'reply') {
            return (
              <PzText variant="caption" color="muted" align="center" style={{ marginVertical: 2 }}>
                {describe(item.body, mine ? 'You' : author.split(' ')[0])}
              </PzText>
            );
          }
          const sound = item.body.kind === 'sound' ? item.body : null;
          return (
            <View style={[styles.row, mine && { justifyContent: 'flex-end' }]}>
              {!mine && <Avatar name={author} uri={members[item.userId]?.avatarUrl} seed={item.userId} size={28} style={{ marginRight: 8 }} />}
              <Pressable
                onPress={() => sound && playSound(sound.url)}
                onLongPress={() => mine && remove(item)}
                style={[styles.bubble, { backgroundColor: mine ? c.primary : c.surface, borderBottomRightRadius: mine ? 6 : 18, borderBottomLeftRadius: mine ? 18 : 6 }]}
              >
                {!mine && <PzText variant="caption" color="primary" style={{ marginBottom: 2 }}>{author.split(' ')[0]}</PzText>}
                <PzText variant="body" color={mine ? '#FFFFFF' : c.text}>{describe(item.body, author)}</PzText>
              </Pressable>
            </View>
          );
        }}
      />
      <View style={[styles.composer, { paddingBottom: insets.bottom + 8, borderTopColor: c.border, backgroundColor: c.surface }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message"
          placeholderTextColor={c.textSubtle}
          style={[styles.input, { color: c.text, backgroundColor: c.surfaceMuted }]}
          multiline
          maxLength={1000}
          cursorColor={c.primary}
        />
        <Pressable onPress={send} disabled={!text.trim() || sending} style={[styles.send, { backgroundColor: text.trim() ? c.primary : c.border }]} accessibilityLabel="Send">
          <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 42, maxHeight: 120, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 15 },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
