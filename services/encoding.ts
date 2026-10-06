/**
 * Wire formats shared with the native Android app (com.finrein.pals). Both clients read and write
 * the same Supabase rows, so these encodings must stay byte-compatible with the Kotlin code.
 */

export const SEP = '|||';
export const VLOG_PAL_CODE = 'vlog';
export const PROFILE_AVATAR_SENTINEL = 'PROFILE_AVATAR';

// ---------------------------------------------------------------------------------------------
// submissions.image_url = videoUrl|||caption|||durationMs|||zoomFactor|||rotation|||isMuted
// Older Android builds wrote 3 or 5 fields; missing fields fall back to Android's defaults.
// ---------------------------------------------------------------------------------------------

export interface ClipPayload {
  videoUrl: string;
  caption: string;
  durationMs: number;
  zoomFactor: number;
  rotation: number;
  isMuted: boolean;
}

export function encodeClip(clip: ClipPayload): string {
  return [
    clip.videoUrl,
    clip.caption.replace(/\|\|\|/g, '|'),
    Math.round(clip.durationMs),
    clip.zoomFactor,
    clip.rotation,
    clip.isMuted,
  ].join(SEP);
}

export function decodeClip(imageUrl: string): ClipPayload | null {
  if (!imageUrl || imageUrl === PROFILE_AVATAR_SENTINEL) return null;
  const parts = imageUrl.split(SEP);
  return {
    videoUrl: parts[0],
    caption: parts[1] ?? '',
    durationMs: Number(parts[2] ?? '2000') || 2000,
    zoomFactor: Number(parts[3] ?? '1.0') || 1,
    rotation: Number(parts[4] ?? '0') || 0,
    isMuted: (parts[5] ?? 'false') === 'true',
  };
}

// ---------------------------------------------------------------------------------------------
// submissions.user_display_name = firstName|||avatarUrl   (or just firstName)
// ---------------------------------------------------------------------------------------------

export function encodeAuthor(firstName: string, avatarUrl?: string | null): string {
  return avatarUrl ? `${firstName}${SEP}${avatarUrl}` : firstName;
}

export function decodeAuthor(value: string): { firstName: string; avatarUrl: string | null } {
  const [name = '', avatar] = (value || '').split(SEP);
  return { firstName: firstNameOf(name), avatarUrl: avatar || null };
}

/** Android's parseUserDisplayName: first token, cut at space, underscore or dot. */
export function firstNameOf(displayName: string): string {
  return (displayName || '').trim().split(/[ _.]/)[0] || 'Pal';
}

// ---------------------------------------------------------------------------------------------
// messages.message_text
//   plain text
//   REACTION|||targetUserId|||targetFirstName|||clipPath|||emoji
//   REPLY|||targetUserId|||targetFirstName|||clipPath|||text   (text may itself be SOUND|||...)
//   SOUND|||soundName|||soundUrl
// ---------------------------------------------------------------------------------------------

export type MessageBody =
  | { kind: 'text'; text: string }
  | { kind: 'reaction'; targetUserId: string; targetFirstName: string; clipPath: string; emoji: string }
  | { kind: 'reply'; targetUserId: string; targetFirstName: string; clipPath: string; reply: MessageBody }
  | { kind: 'sound'; name: string; url: string };

export function encodeMessage(body: MessageBody): string {
  switch (body.kind) {
    case 'text':
      return body.text;
    case 'reaction':
      return ['REACTION', body.targetUserId, body.targetFirstName, body.clipPath, body.emoji].join(SEP);
    case 'reply':
      return ['REPLY', body.targetUserId, body.targetFirstName, body.clipPath, encodeMessage(body.reply)].join(SEP);
    case 'sound':
      return ['SOUND', body.name, body.url].join(SEP);
  }
}

export function decodeMessage(text: string): MessageBody {
  const parts = (text || '').split(SEP);
  switch (parts[0]) {
    case 'REACTION':
      if (parts.length >= 5) {
        return { kind: 'reaction', targetUserId: parts[1], targetFirstName: parts[2], clipPath: parts[3], emoji: parts[4] };
      }
      break;
    case 'REPLY':
      if (parts.length >= 5) {
        return {
          kind: 'reply',
          targetUserId: parts[1],
          targetFirstName: parts[2],
          clipPath: parts[3],
          reply: decodeMessage(parts.slice(4).join(SEP)),
        };
      }
      break;
    case 'SOUND':
      if (parts.length >= 3) return { kind: 'sound', name: parts[1], url: parts[2] };
      break;
  }
  return { kind: 'text', text };
}

/** LIKE pattern Android uses to find a user's previous reaction on a clip. */
export function reactionLikePattern(clipPath: string): string {
  return `REACTION${SEP}%${SEP}%${SEP}${clipPath}${SEP}%`;
}

// ---------------------------------------------------------------------------------------------
// Pal codes: 6 chars of [a-z0-9], generated client-side (matches Android's create flow).
// ---------------------------------------------------------------------------------------------

export function generatePalCode(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

/** Android's join normalisation: trim, strip a leading '#', lowercase. */
export function normalizePalCode(input: string): string {
  return (input || '').trim().replace(/^#/, '').toLowerCase();
}
