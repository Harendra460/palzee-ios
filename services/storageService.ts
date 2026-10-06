import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

/** Buckets used by the native Android app; both clients must write to the same places. */
export const Buckets = {
  groupClips: 'pals',
  vlogClips: 'pals_vlogs',
  avatars: 'avatars',
} as const;
export type Bucket = (typeof Buckets)[keyof typeof Buckets];

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function baseName(uri: string): string {
  return decodeURIComponent(uri.split('?')[0].split('/').pop() || 'clip.mp4');
}

/**
 * Streams a local file to Supabase Storage (no full read into JS memory, which matters for video)
 * and returns the object's public URL, which is what Android stores in the database.
 */
async function uploadFile(bucket: Bucket, objectPath: string, fileUri: string, contentType: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? SUPABASE_ANON_KEY;
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURIComponent(objectPath)}`;
  const res = await FileSystem.uploadAsync(url, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': contentType,
      'x-upsert': 'false',
    },
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Upload to ${bucket} failed (${res.status}): ${res.body}`);
  }
  return supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
}

export const storageService = {
  /** Group clip -> bucket `pals`, named `<uuid>_<file>` like Android. */
  uploadGroupClip(fileUri: string): Promise<string> {
    return uploadFile(Buckets.groupClips, `${uuid()}_${baseName(fileUri)}`, fileUri, 'video/mp4');
  },

  /** Personal vlog clip -> bucket `pals_vlogs`, named `<userId>_<epochMs>_<file>` like Android. */
  uploadVlogClip(fileUri: string, userId: string): Promise<string> {
    return uploadFile(Buckets.vlogClips, `${userId}_${Date.now()}_${baseName(fileUri)}`, fileUri, 'video/mp4');
  },

  /** Avatar -> bucket `avatars`, resized to max 1200px and JPEG q=0.75 (Android's compressImageBytes). */
  async uploadAvatar(imageUri: string): Promise<string> {
    const compressed = await ImageManipulator.manipulateAsync(imageUri, [{ resize: { width: 1200 } }], {
      compress: 0.75,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return uploadFile(Buckets.avatars, `${uuid()}_avatar.jpg`, compressed.uri, 'image/jpeg');
  },

  /** Splits a Supabase Storage URL (public or signed) into bucket + object path. */
  parseStorageUrl(url: string): { bucket: string; path: string } | null {
    const match = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
    return match ? { bucket: match[1], path: decodeURIComponent(match[2]) } : null;
  },

  /**
   * `pals` and `pals_vlogs` are private buckets: the stored public URL only works with auth, so
   * playback uses a short-lived signed URL. Non-storage URLs are returned unchanged.
   */
  async playableUrl(url: string, expiresInSec = 3600): Promise<string> {
    const parsed = this.parseStorageUrl(url);
    if (!parsed || parsed.bucket === Buckets.avatars) return url;
    const { data, error } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, expiresInSec);
    return error || !data ? url : data.signedUrl;
  },

  async deleteByUrl(url: string): Promise<void> {
    const parsed = this.parseStorageUrl(url);
    if (!parsed) return;
    await supabase.storage.from(parsed.bucket).remove([parsed.path]);
  },
};
