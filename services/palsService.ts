import { supabase } from './supabase';
import { generatePalCode, normalizePalCode, VLOG_PAL_CODE } from './encoding';

export interface PalGroup {
  code: string;
  name: string;
  /** Grid size as stored in pals.size (Android treats empty / "1" as "4"). */
  size: number;
  isCreator: boolean;
}

export interface PalMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: string | null;
}

export interface Profile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

function normalizeSize(size: unknown): number {
  const n = Number(size);
  return !Number.isFinite(n) || n <= 1 ? 4 : n;
}

export const palsService = {
  /** Home dashboard via the same RPC Android uses. Excludes the personal "vlog" pseudo-group. */
  async listGroups(userId: string): Promise<{ groups: PalGroup[]; vlogBoxSize: number }> {
    const { data, error } = await supabase.rpc('get_clean_homescreen_dashboard', { current_user_uuid: userId });
    if (error) throw error;
    const groups: PalGroup[] = (data?.groups ?? [])
      .filter((g: any) => g?.code && g.code !== VLOG_PAL_CODE)
      .map((g: any) => ({ code: g.code, name: g.name ?? g.code, size: normalizeSize(g.size), isCreator: !!g.is_creator }));
    return { groups, vlogBoxSize: normalizeSize(data?.vlog_box_size) };
  },

  /** Android ensures a `pals` row for the personal vlog exists before the first vlog submission. */
  async ensureVlogPal(): Promise<void> {
    const { data } = await supabase.from('pals').select('pal_code').eq('pal_code', VLOG_PAL_CODE).maybeSingle();
    if (!data) await supabase.from('pals').insert({ pal_code: VLOG_PAL_CODE, name: VLOG_PAL_CODE });
  },

  async createGroup(name: string, size: number, me: Profile): Promise<PalGroup> {
    // Codes are client-generated (6 x [a-z0-9]); retry on the rare primary-key collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generatePalCode();
      const { error } = await supabase.from('pals').insert({ pal_code: code, name: name.trim(), size: String(size) });
      if (error) {
        if (error.code === '23505') continue;
        throw error;
      }
      const { error: memberError } = await supabase.from('user_pals').insert({
        user_id: me.userId,
        pal_code: code,
        user_display_name: me.displayName || 'Pal Member',
        user_avatar_url: me.avatarUrl,
      });
      if (memberError) throw memberError;
      return { code, name: name.trim(), size, isCreator: true };
    }
    throw new Error('Could not allocate a unique pal code, please try again.');
  },

  /** Returns null when no group has that code (Android shows "No group found"). */
  async joinGroup(rawCode: string, me: Profile): Promise<PalGroup | null> {
    const code = normalizePalCode(rawCode);
    if (!code) return null;
    const { data: pal, error } = await supabase.from('pals').select('pal_code, name, size').eq('pal_code', code).maybeSingle();
    if (error) throw error;
    if (!pal) return null;
    const { error: upsertError } = await supabase.from('user_pals').upsert(
      {
        user_id: me.userId,
        pal_code: code,
        user_display_name: me.displayName || 'Pal Member',
        user_avatar_url: me.avatarUrl,
      },
      { onConflict: 'pal_code,user_id' }
    );
    if (upsertError) throw upsertError;
    return { code, name: pal.name ?? code, size: normalizeSize(pal.size), isCreator: false };
  },

  async updateGroup(code: string, changes: { name?: string; size?: number }): Promise<void> {
    const patch: Record<string, string> = {};
    if (changes.name !== undefined) patch.name = changes.name.trim();
    if (changes.size !== undefined) patch.size = String(changes.size);
    const { error } = await supabase.from('pals').update(patch).eq('pal_code', code);
    if (error) throw error;
  },

  async leaveGroup(code: string, userId: string): Promise<void> {
    await supabase.from('user_pals').delete().eq('pal_code', code).eq('user_id', userId);
    await supabase.from('submissions').delete().eq('pal_code', code).eq('user_id', userId);
  },

  /** Creator-only delete, in Android's order: memberships, clips, chat, then the group. */
  async deleteGroup(code: string): Promise<void> {
    await supabase.from('user_pals').delete().eq('pal_code', code);
    await supabase.from('submissions').delete().eq('pal_code', code);
    await supabase.from('messages').delete().eq('pal_code', code);
    const { error } = await supabase.from('pals').delete().eq('pal_code', code);
    if (error) throw error;
  },

  async listMembers(code: string): Promise<PalMember[]> {
    const { data, error } = await supabase
      .from('user_pals')
      .select('user_id, user_display_name, user_avatar_url, joined_at')
      .eq('pal_code', code)
      .order('joined_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((m: any) => ({
      userId: m.user_id,
      displayName: m.user_display_name ?? 'Pal Member',
      avatarUrl: m.user_avatar_url ?? null,
      joinedAt: m.joined_at ?? null,
    }));
  },

  /** Profile edits propagate to every membership row, as on Android. */
  async updateMyProfile(userId: string, changes: { displayName?: string; avatarUrl?: string | null }): Promise<void> {
    const patch: Record<string, string | null> = {};
    if (changes.displayName !== undefined) patch.user_display_name = changes.displayName;
    if (changes.avatarUrl !== undefined) patch.user_avatar_url = changes.avatarUrl;
    const { error } = await supabase.from('user_pals').update(patch).eq('user_id', userId);
    if (error) throw error;
  },
};
