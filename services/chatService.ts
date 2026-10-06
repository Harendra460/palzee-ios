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

export const chatService = {
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
