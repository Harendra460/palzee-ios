import { Platform, Share } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

/**
 * Write-only gallery permission for photos + videos. The image-picker permission is not enough on
 * Android 13+ (the photo picker needs none, so MediaLibrary writes would still be denied).
 */
export async function ensureMediaSavePermission(): Promise<boolean> {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync(true, ['photo', 'video']);
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Shares a local video file. RN's Share.share ignores `url` on Android, so use expo-sharing there. */
export async function shareVideoFile(fileUri: string, title: string): Promise<void> {
  if (Platform.OS === 'ios' || !(await Sharing.isAvailableAsync())) {
    await Share.share({ url: fileUri, title, message: title }, { dialogTitle: title, subject: title });
    return;
  }
  await Sharing.shareAsync(fileUri, { mimeType: 'video/mp4', dialogTitle: title, UTI: 'public.mpeg-4' });
}
