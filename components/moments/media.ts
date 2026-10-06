import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { storageService } from '../../services/storageService';

const SIGNED_TTL_SEC = 3600;
const signedCache = new Map<string, { url: string; expiresAt: number }>();
const inflight = new Map<string, Promise<string>>();

/** Playable URL for a stored clip URL (signed for private buckets, cached until shortly before expiry). */
export async function resolvePlayableUrl(storedUrl: string): Promise<string> {
  if (!storedUrl.startsWith('http')) return storedUrl;
  const hit = signedCache.get(storedUrl);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.url;
  const pending = inflight.get(storedUrl);
  if (pending) return pending;
  const p = storageService
    .playableUrl(storedUrl, SIGNED_TTL_SEC)
    .then((url) => {
      signedCache.set(storedUrl, { url, expiresAt: Date.now() + SIGNED_TTL_SEC * 1000 });
      return url;
    })
    .finally(() => inflight.delete(storedUrl));
  inflight.set(storedUrl, p);
  return p;
}

export function usePlayableUrl(storedUrl: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(storedUrl && !storedUrl.startsWith('http') ? storedUrl : null);
  useEffect(() => {
    let alive = true;
    if (!storedUrl) return setUrl(null);
    resolvePlayableUrl(storedUrl).then((u) => alive && setUrl(u)).catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [storedUrl]);
  return url;
}

// Thumbnails are keyed by the *stored* URL (signed URLs change) and kept on disk across launches.
const THUMB_DIR = `${FileSystem.cacheDirectory}moment_thumbs/`;
const thumbMemo = new Map<string, Promise<string | null>>();

function thumbPath(storedUrl: string): string {
  let h = 0;
  for (let i = 0; i < storedUrl.length; i++) h = (h * 31 + storedUrl.charCodeAt(i)) | 0;
  return `${THUMB_DIR}${Math.abs(h).toString(36)}_${storedUrl.length}.jpg`;
}

export function getThumbnail(storedUrl: string): Promise<string | null> {
  const memo = thumbMemo.get(storedUrl);
  if (memo) return memo;
  const p = (async () => {
    const target = thumbPath(storedUrl);
    if ((await FileSystem.getInfoAsync(target)).exists) return target;
    const source = await resolvePlayableUrl(storedUrl);
    const { uri } = await VideoThumbnails.getThumbnailAsync(source, { time: 100, quality: 0.6 });
    await FileSystem.makeDirectoryAsync(THUMB_DIR, { intermediates: true }).catch(() => {});
    await FileSystem.moveAsync({ from: uri, to: target }).catch(() => {});
    return (await FileSystem.getInfoAsync(target)).exists ? target : uri;
  })().catch(() => {
    thumbMemo.delete(storedUrl);
    return null;
  });
  thumbMemo.set(storedUrl, p);
  return p;
}

export function useThumbnail(storedUrl: string | null | undefined): string | null {
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!storedUrl) return setThumb(null);
    getThumbnail(storedUrl).then((t) => alive && setThumb(t));
    return () => {
      alive = false;
    };
  }, [storedUrl]);
  return thumb;
}

export function timeAgo(date: Date, now = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d ago` : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
