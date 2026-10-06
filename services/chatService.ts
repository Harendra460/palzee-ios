import { supabase } from './supabase';
import { decodeMessage, encodeMessage, MessageBody, reactionLikePattern } from './encoding';

export interface ChatMessage {
  id: string;
  palCode: string;
  userId: string;
  body: MessageBody;
  createdAt: Date;
}

function rowToMessage(row: any): ChatMessage {
  return {
    id: String(row.id),
    palCode: row.pal_code,
    userId: row.user_id,
    body: decodeMessage(row.message_text ?? ''),
    createdAt: new Date(row.created_at),
  };
}

/** Reactions and replies attached to one clip (keyed by the clip's stored video URL, like Android). */
export interface ClipInteractions {
  reactions: { userId: string; emoji: string; messageId: string }[];
  replies: ChatMessage[];
}

export const chatService = {
  /** Reactions/replies across several groups, grouped by clip path. */
  async listInteractions(palCodes: string[], since?: Date): Promise<Record<string, ClipInteractions>> {
    if (palCodes.length === 0) return {};
    let query = supabase
      .from('messages')
      .select('*')
      .in('pal_code', palCodes)
      .or('message_text.like.REACTION|||%,message_text.like.REPLY|||%')
      .order('created_at', { ascending: true });
    if (since) query = query.gte('created_at', since.toISOString());
    const { data, error } = await query.limit(2000);
    if (error) throw error;
    const byClip: Record<string, ClipInteractions> = {};
    for (const msg of (data ?? []).map(rowToMessage)) {
      const body = msg.body;
      if (body.kind !== 'reaction' && body.kind !== 'reply') continue;
      const entry = (byClip[body.clipPath] ??= { reactions: [], replies: [] });
      if (body.kind === 'reaction') entry.reactions.push({ userId: msg.userId, emoji: body.emoji, messageId: msg.id });
      else entry.replies.push(msg);
    }
    return byClip;
  },

  async listMessages(palCode: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('pal_code', palCode)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToMessage);
  },

  async send(palCode: string, userId: string, body: MessageBody): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from('messages')
      .insert({ pal_code: palCode, user_id: userId, message_text: encodeMessage(body) })
      .select()
      .single();
    if (error) throw error;
    return rowToMessage(data);
  },

  /** One reaction per user per clip: drop the previous one first, exactly like Android. */
  async react(
    palCode: string,
    userId: string,
    target: { userId: string; firstName: string; clipPath: string },
    emoji: string
  ): Promise<ChatMessage> {
    await supabase
      .from('messages')
      .delete()
      .eq('pal_code', palCode)
      .eq('user_id', userId)
      .like('message_text', reactionLikePattern(target.clipPath));
    return this.send(palCode, userId, {
      kind: 'reaction',
      targetUserId: target.userId,
      targetFirstName: target.firstName,
      clipPath: target.clipPath,
      emoji,
    });
  },

  async deleteMessage(id: string): Promise<void> {
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error) throw error;
  },
};
