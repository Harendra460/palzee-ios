import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type RealtimeTable = 'pals' | 'user_pals' | 'submissions' | 'messages';
export type RealtimeEvent = { table: RealtimeTable; payload: RealtimePostgresChangesPayload<Record<string, any>> };

/**
 * One channel per signed-in user on the same tables Android listens to
 * (channel `pals_realtime_user_<uid>`). RLS decides which rows each user actually receives.
 */
export function subscribeToPalzeeChanges(userId: string, onEvent: (e: RealtimeEvent) => void): () => void {
  const tables: RealtimeTable[] = ['pals', 'user_pals', 'submissions', 'messages'];
  let channel = supabase.channel(`pals_realtime_user_${userId}`);
  for (const table of tables) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) =>
      onEvent({ table, payload })
    );
  }
  channel.subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
