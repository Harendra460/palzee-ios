import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { storageService } from './storageService';
import { palsService } from './palsService';
import {
  ClipPayload,
  decodeAuthor,
  decodeClip,
  encodeAuthor,
  encodeClip,
  PROFILE_AVATAR_SENTINEL,
  VLOG_PAL_CODE,
} from './encoding';

/** A clip posted to a group (or to the personal vlog when palCode === 'vlog'). */
export interface Moment {
  id: string;
  palCode: string;
  userId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  clip: ClipPayload;
  createdAt: Date;
  /** True while the clip only exists locally and is waiting in the upload queue. */
  pending?: boolean;
}

export interface NewMoment {
  localUri: string;
  caption: string;
  durationMs: number;
  zoomFactor?: number;
  /** 270 when the source was recorded portrait (Android stores it so every client rotates alike). */
  rotation?: number;
  isMuted?: boolean;
  capturedAt?: Date;
}

interface PendingUpload {
  id: string;
  palCode: string;
  userId: string;
  author: string;
  localUri: string;
  clip: Omit<ClipPayload, 'videoUrl'>;
  createdAt: string;
  attempts: number;
}

const QUEUE_KEY = 'palzee_pending_submissions';
const PENDING_DIR = `${FileSystem.documentDirectory}pending_uploads/`;
let draining: Promise<void> | null = null;
const listeners = new Set<() => void>();

function rowToMoment(row: any): Moment | null {
  const clip = decodeClip(row.image_url);
  if (!clip) return null;
  const author = decodeAuthor(row.user_display_name);
  return {
    id: String(row.id),
    palCode: row.pal_code,
    userId: row.user_id,
    authorName: author.firstName,
    authorAvatarUrl: author.avatarUrl,
    clip,
    createdAt: new Date(row.created_at),
  };
}

async function readQueue(): Promise<PendingUpload[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) || '[]');
  } catch {
    return [];
  }
}

async function writeQueue(queue: PendingUpload[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  listeners.forEach((l) => l());
}

function pendingToMoment(p: PendingUpload): Moment {
  const author = decodeAuthor(p.author);
  return {
    id: p.id,
    palCode: p.palCode,
    userId: p.userId,
    authorName: author.firstName,
    authorAvatarUrl: author.avatarUrl,
    clip: { ...p.clip, videoUrl: p.localUri },
    createdAt: new Date(p.createdAt),
    pending: true,
  };
}

async function uploadOne(item: PendingUpload): Promise<void> {
  const videoUrl =
    item.palCode === VLOG_PAL_CODE
      ? await storageService.uploadVlogClip(item.localUri, item.userId)
      : await storageService.uploadGroupClip(item.localUri);

  if (item.palCode === VLOG_PAL_CODE) await palsService.ensureVlogPal();

  const { error } = await supabase.from('submissions').insert({
    pal_code: item.palCode,
    user_id: item.userId,
    user_display_name: item.author,
    image_url: encodeClip({ ...item.clip, videoUrl }),
    created_at: item.createdAt,
  });
  if (error) {
    await storageService.deleteByUrl(videoUrl).catch(() => {});
    throw error;
  }
}

export const momentsService = {
  /** All clips of a group (or the user's vlog), newest first. Placeholder avatar rows are skipped. */
  async listMoments(palCode: string, opts: { userId?: string; since?: Date } = {}): Promise<Moment[]> {
    let query = supabase.from('submissions').select('*').eq('pal_code', palCode).order('created_at', { ascending: false });
    if (opts.userId) query = query.eq('user_id', opts.userId);
    if (opts.since) query = query.gte('created_at', opts.since.toISOString());
    const { data, error } = await query;
    if (error) throw error;
    const remote = (data ?? []).filter((r: any) => r.image_url !== PROFILE_AVATAR_SENTINEL).map(rowToMoment);
    const pending = (await readQueue()).filter((p) => p.palCode === palCode && (!opts.userId || p.userId === opts.userId));
    return [...pending.map(pendingToMoment), ...(remote.filter(Boolean) as Moment[])];
  },

  /** Clips from every group the user belongs to, for a combined home feed. */
  async listFeed(palCodes: string[], since?: Date): Promise<Moment[]> {
    if (palCodes.length === 0) return [];
    let query = supabase.from('submissions').select('*').in('pal_code', palCodes).order('created_at', { ascending: false });
    if (since) query = query.gte('created_at', since.toISOString());
    const { data, error } = await query.limit(500);
    if (error) throw error;
    return (data ?? []).map(rowToMoment).filter(Boolean) as Moment[];
  },

  /**
   * Queues a capture for each target (group codes and/or 'vlog') and starts uploading. The file is
   * copied out of the camera cache first so the OS can't purge it before the upload finishes.
   */
  async post(
    targets: string[],
    moment: NewMoment,
    me: { userId: string; firstName: string; avatarUrl: string | null }
  ): Promise<void> {
    await FileSystem.makeDirectoryAsync(PENDING_DIR, { intermediates: true }).catch(() => {});
    const createdAt = (moment.capturedAt ?? new Date()).toISOString();
    const queue = await readQueue();
    for (const palCode of targets) {
      const id = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const localUri = `${PENDING_DIR}${id}.mp4`;
      await FileSystem.copyAsync({ from: moment.localUri, to: localUri });
      queue.push({
        id,
        palCode,
        userId: me.userId,
        author: encodeAuthor(me.firstName, me.avatarUrl),
        localUri,
        clip: {
          caption: moment.caption,
          durationMs: moment.durationMs,
          zoomFactor: moment.zoomFactor ?? 1,
          rotation: moment.rotation ?? 0,
          isMuted: moment.isMuted ?? false,
        },
        createdAt,
        attempts: 0,
      });
    }
    await writeQueue(queue);
    void this.drainQueue();
  },

  /** Uploads queued clips one by one; failures stay queued for the next call (app start / foreground). */
  drainQueue(): Promise<void> {
    if (draining) return draining;
    draining = (async () => {
      try {
        for (const item of await readQueue()) {
          try {
            await uploadOne(item);
            await writeQueue((await readQueue()).filter((q) => q.id !== item.id));
            await FileSystem.deleteAsync(item.localUri, { idempotent: true });
          } catch (e) {
            console.warn('[moments] upload failed, will retry', e);
            await writeQueue((await readQueue()).map((q) => (q.id === item.id ? { ...q, attempts: q.attempts + 1 } : q)));
          }
        }
      } finally {
        draining = null;
      }
    })();
    return draining;
  },

  pendingCount: async () => (await readQueue()).length,

  /** Called whenever the upload queue changes. */
  onQueueChange(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async updateCaption(moment: Moment, caption: string): Promise<void> {
    const { error } = await supabase
      .from('submissions')
      .update({ image_url: encodeClip({ ...moment.clip, caption }) })
      .eq('id', moment.id);
    if (error) throw error;
  },

  async deleteMoment(moment: Moment): Promise<void> {
    if (moment.pending) {
      await writeQueue((await readQueue()).filter((q) => q.id !== moment.id));
      await FileSystem.deleteAsync(moment.clip.videoUrl, { idempotent: true });
      return;
    }
    const { error } = await supabase.from('submissions').delete().eq('id', moment.id);
    if (error) throw error;
    await storageService.deleteByUrl(moment.clip.videoUrl).catch(() => {});
  },
};
