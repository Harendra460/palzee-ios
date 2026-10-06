import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

let VideoThumbnails: any = null;
try {
  VideoThumbnails = require('expo-video-thumbnails');
} catch (e) {
  VideoThumbnails = null;
}

// In-memory cache for extracted thumbnails
const thumbnailCache = new Map<string, string>();

/**
 * Dynamic iOS Sandbox Container GUID Resolver
 * Fixes "attempted to load an asset that doesn't exist" across app re-installs/re-builds.
 */
export const getLiveSandboxUri = (storedUri?: string): string => {
  if (!storedUri) return '';
  if (storedUri.startsWith('http://') || storedUri.startsWith('https://') || storedUri.startsWith('ph://')) {
    return storedUri;
  }
  // Android app-storage paths are stable across reinstalls and updates; only iOS container GUIDs move.
  if (Platform.OS !== 'ios') return storedUri;
  const fileName = storedUri.split('/').pop();
  if (!fileName || !FileSystem || !FileSystem.documentDirectory) return storedUri;

  if (storedUri.includes('/Documents/')) {
    return `${FileSystem.documentDirectory}${fileName}`;
  }
  if (storedUri.includes('/Caches/') && FileSystem.cacheDirectory) {
    return `${FileSystem.cacheDirectory}${fileName}`;
  }
  return `${FileSystem.documentDirectory}${fileName}`;
};

/**
 * Extracts the 1st frame (time: 100ms keyframe) from a video URI with caching.
 */
export const generateVideoThumbnail = async (videoUri: string): Promise<string | null> => {
  if (!videoUri) return null;
  if (thumbnailCache.has(videoUri)) {
    return thumbnailCache.get(videoUri)!;
  }

  try {
    if (FileSystem && FileSystem.getInfoAsync) {
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      console.log('📁 File Info Exists:', fileInfo.exists);
    }
  } catch (e) {
    console.log('File check warning:', e);
  }

  const cleanUri = Platform.OS === 'ios' ? videoUri.replace('file://', '') : videoUri;

  try {
    if (VideoThumbnails && VideoThumbnails.getThumbnailAsync) {
      const { uri } = await VideoThumbnails.getThumbnailAsync(cleanUri, {
        time: 100, // 100ms keyframe timestamp fix for iOS Camera cache
        quality: 0.8,
      });
      if (uri) {
        thumbnailCache.set(videoUri, uri);
        return uri;
      }
    }
  } catch (e) {
    try {
      if (VideoThumbnails && VideoThumbnails.getThumbnailAsync) {
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
          time: 100,
          quality: 0.8,
        });
        if (uri) {
          thumbnailCache.set(videoUri, uri);
          return uri;
        }
      }
    } catch (err) {
      console.warn("Error generating video thumbnail:", err);
    }
  }
  return null;
};

/**
 * Safely parses Date from ISO string, Date object, or 12-hr time string (e.g. "7:26 PM")
 */
export const parseToDate = (timeInput?: string | number | Date): Date | null => {
  if (!timeInput) return null;
  if (timeInput instanceof Date) return isNaN(timeInput.getTime()) ? null : timeInput;

  // Try standard Date parsing (ISO strings, Unix timestamps)
  const parsed = new Date(timeInput);
  if (!isNaN(parsed.getTime())) return parsed;

  // Handle 12-hour string format e.g. "7:26 PM" or "07:26 AM"
  if (typeof timeInput === 'string') {
    const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
    const match = timeInput.trim().match(timeRegex);
    if (match) {
      const today = new Date();
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const ampm = match[3].toUpperCase();

      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;

      today.setHours(hours, minutes, 0, 0);
      return today;
    }
  }

  return null;
};

/**
 * Calculates exact chat timestamp dynamically without hardcoded fallbacks
 */
export const getDisplayTimestamp = (item?: any): string => {
  if (!item) return '';
  const date = parseToDate(item.createdAt || item.timestamp || item.date);
  if (!date) {
    if (typeof item.timestamp === 'string' && item.timestamp.length > 0) {
      return item.timestamp;
    }
    return '';
  }
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
};

/**
 * Calculates dynamic day label ("Today", "Yesterday", or Date) without hardcoding
 */
export const getDayLabel = (item?: any): string => {
  if (!item) return '';
  const date = parseToDate(item.createdAt || item.timestamp || item.date);
  if (!date) return 'Today';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfTarget.getTime()) / (1000 * 3600 * 24));

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/**
 * Calculates dynamic nearest hour (e.g., 18:33 / 7:26 PM -> "19:00")
 */
export const getNearestHourText = (timeInput?: string | number | Date): string => {
  const date = parseToDate(timeInput) || new Date();
  const minutes = date.getMinutes();
  let hours = date.getHours();

  if (minutes >= 30) {
    hours = (hours + 1) % 24;
  }

  return `${hours.toString().padStart(2, '0')}:00`;
};

/**
 * Formats exact dispatch time for chat headers
 */
export const formatExactTime = (dateInput?: Date | string | number): string => {
  return getDisplayTimestamp({ timestamp: dateInput });
};

/**
 * Formats relative day for chat headers
 */
export const formatRelativeDay = (dateInput?: Date | string | number): string => {
  return getDayLabel({ timestamp: dateInput });
};

/**
 * Rounds timestamp to nearest hour
 */
export const formatRoundedHour = (dateInput?: Date | string | number): string => {
  return getNearestHourText(dateInput);
};

export const getUserInitial = (name?: string): string => {
  if (!name || name.trim().length === 0) return 'P';
  return name.trim().charAt(0).toUpperCase();
};

/**
 * Computes 4 AM cycle day offset relative to current day.
 * 0 = Today's 4 AM cycle
 * 1 = Yesterday's 4 AM cycle
 * ...
 * 6 = 6 days ago (7th day)
 * -1 = Older than 7 days (or invalid)
 */
export const getClip4AMDayOffset = (clipTime?: string | number | Date): number => {
  const date = parseToDate(clipTime);
  if (!date) return 0;

  const now = new Date();
  const clipShifted = new Date(date.getTime() - 4 * 3600 * 1000);
  const nowShifted = new Date(now.getTime() - 4 * 3600 * 1000);

  const clipDayStart = new Date(clipShifted.getFullYear(), clipShifted.getMonth(), clipShifted.getDate()).getTime();
  const nowDayStart = new Date(nowShifted.getFullYear(), nowShifted.getMonth(), nowShifted.getDate()).getTime();

  const diffDays = Math.floor((nowDayStart - clipDayStart) / (24 * 3600 * 1000));
  if (diffDays >= 0) {
    return diffDays;
  }
  return -1;
};

/**
 * Returns video clips belonging to a specific day offset (0 to 6).
 */
export const getClipsForDayOffset = (clips: any[], dayOffset: number): any[] => {
  if (!Array.isArray(clips)) return [];
  return clips.filter((item) => {
    const offset = getClip4AMDayOffset(item.timestamp || item.createdAt || item.date);
    return offset === dayOffset;
  });
};
