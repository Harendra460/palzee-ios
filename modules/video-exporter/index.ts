import { NativeModules, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export interface VideoExporterModule {
  exportPortraitVideoWithCaption(inputPath: string, caption: string, timestamp: string): Promise<string>;
  exportSlideshowVideo(inputPaths: string[], captions: string[], timestamps: string[]): Promise<string>;
  exportPortraitVideoSimple(inputPath: string): Promise<string>;
  exportRotatedCardVideoOnly(inputPath: string, caption: string): Promise<string>;
}

// iOS ships the bridge module in ios/Palzee/VideoExporter.swift; Android uses the Expo module in
// ./android. Both expose the same methods and resolve to a file:// URI of the exported mp4.
export const VideoExporter: VideoExporterModule | null =
  Platform.OS === 'ios'
    ? NativeModules.VideoExporter ?? null
    : requireOptionalNativeModule<VideoExporterModule>('VideoExporter');
