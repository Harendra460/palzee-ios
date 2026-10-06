import React, { useState, useRef, useEffect } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
  Platform,
  StyleProp,
  ViewStyle,
  ActivityIndicator,
  Share,
  NativeModules,
  Animated,
  Easing,
} from 'react-native';
import { Image } from 'expo-image';
import { ensureMediaSavePermission, shareVideoFile } from '../../utils/mediaSave';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '../../constants/typography';
import { Colors } from '../../constants/colors';
import { VideoExporter } from '../../modules/video-exporter';
import { LiquidGlassIconButton, DynamicGlowContainer } from '../ui';
import { getLiveSandboxUri, getClipsForDayOffset } from '../../utils/mediaUtils';


// Final Export Output Canvas Geometry: 9:16 Portrait (1080x1920)
export const EXPORT_CANVAS_WIDTH = 1080;
export const EXPORT_CANVAS_HEIGHT = 1920;
export const EXPORT_CLIP_WIDTH = 1080;
export const EXPORT_CLIP_HEIGHT = 607.5; // (1080 * 9 / 16)
export const EXPORT_CLIP_TOP_OFFSET = (EXPORT_CANVAS_HEIGHT - EXPORT_CLIP_HEIGHT) / 2; // 656.25px (Centered vertically)

// FFmpeg 9:16 Portrait Re-encoding Filter Command
export const FFMPEG_LETTERBOX_FILTER = `-i input.mp4 -vf "scale=1080:607:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black" -c:a copy collection_export.mp4`;

export interface EditExportSheetProps {
  visible: boolean;
  onClose: () => void;
  vlogList?: Array<{ id: string; uri: string; thumbnailUri?: string; caption?: string; timestamp: string; isMuted?: boolean; rate?: number; mode?: string }>;
  selectedThemeColor?: string;
  onDeleteVideo?: (id?: string) => void;
  onUpdateCaption?: (newCaption: string, id?: string) => void;
  selectedDayOffset?: number;
}

import { useFastColorScheme } from '../../hooks/useFastColorScheme';

export const EditExportSheet: React.FC<EditExportSheetProps> = ({
  visible,
  onClose,
  vlogList = [],
  selectedThemeColor = 'cyan',
  onDeleteVideo,
  onUpdateCaption,
  selectedDayOffset = 0,
}) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const screenWidth = windowWidth > 0 ? windowWidth : 390;
  const systemScheme = useFastColorScheme();
  const isDark = systemScheme === 'dark';
  const edgeColor = Colors.BorderGlow[selectedThemeColor as keyof typeof Colors.BorderGlow] || '#FE9068';

  const [currentIndex, setCurrentIndex] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Filter clips strictly for the active 4 AM - 4 AM timeline cycle for that day
  const filteredDayClips = getClipsForDayOffset(vlogList, selectedDayOffset);
  // Chronological order: oldest recorded clip first, newest ones after it
  const list = filteredDayClips.length > 0 ? [...filteredDayClips].reverse() : [];
  const currentClip = list.length > 0 ? list[Math.min(currentIndex, list.length - 1)] : null;

  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
    }
  }, [visible]);

  const exportVideoRef = useRef<Video>(null);
  const isAdvancingRef = useRef(false);

  const prevExportClipUriRef = useRef<string | null>(null);

  useEffect(() => {
    const liveUri = currentClip?.uri ? getLiveSandboxUri(currentClip.uri) : null;

    if (liveUri && prevExportClipUriRef.current && liveUri !== prevExportClipUriRef.current && exportVideoRef.current) {
      fadeAnim.setValue(0.7);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      prevExportClipUriRef.current = liveUri;
      exportVideoRef.current.loadAsync(
        { uri: liveUri },
        {
          shouldPlay: true,
          isLooping: list.length === 1,
          positionMillis: 0,
          rate: currentClip?.rate || 1.0,
          isMuted: currentClip?.isMuted ?? false,
        },
        false
      ).then(() => {
        exportVideoRef.current?.playAsync().catch(() => {});
      }).catch(() => {});
    } else if (liveUri && !prevExportClipUriRef.current) {
      prevExportClipUriRef.current = liveUri;
    }
  }, [currentIndex, currentClip?.uri]);

  const advanceSlide = (direction: 'next' | 'prev') => {
    if (list.length <= 1 || isAdvancingRef.current) return;
    isAdvancingRef.current = true;
    setTimeout(() => {
      isAdvancingRef.current = false;
    }, 450);

    if (direction === 'next') {
      setCurrentIndex((prev) => (prev + 1) % list.length);
    } else {
      setCurrentIndex((prev) => (prev - 1 + list.length) % list.length);
    }
  };

  const handlePlaybackStatusUpdate = (status: any) => {
    if (status && status.isLoaded) {
      if (
        status.didJustFinish &&
        !isAdvancingRef.current &&
        status.positionMillis > 500 &&
        status.durationMillis &&
        status.positionMillis >= status.durationMillis - 250
      ) {
        isAdvancingRef.current = true;
        setTimeout(() => {
          isAdvancingRef.current = false;
        }, 700);

        if (list.length > 1) {
          setCurrentIndex((prev) => (prev + 1) % list.length);
        } else {
          exportVideoRef.current?.setPositionAsync(0).then(() => {
            exportVideoRef.current?.playAsync();
          }).catch(() => {});
        }
      }
    }
  };

  const handleCardTap = (event: any) => {
    if (list.length <= 1) return;
    const touchX = event.nativeEvent.locationX;
    if (touchX > cardWidth / 2) {
      advanceSlide('next');
    } else {
      advanceSlide('prev');
    }
  };

  const formatExportTime = (ts?: string, displayTime?: string) => {
    if (displayTime && (displayTime.includes('AM') || displayTime.includes('PM'))) {
      return displayTime;
    }
    if (!ts) return '7:26 PM';
    if (ts.includes('AM') || ts.includes('PM')) return ts;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  // Native AVFoundation Video Processing to 1080x1920 9:16 Portrait Canvas Slideshow
  const processAndSaveVideo = async (): Promise<string> => {
    const TargetExporter = VideoExporter;

    if (list && list.length > 0) {
      const chronologicalList = list;
      const inputPaths: string[] = [];
      const captions: string[] = [];
      const timestamps: string[] = [];

      for (const clip of chronologicalList) {
        if (clip && clip.uri) {
          inputPaths.push(clip.uri);
          captions.push(clip.caption || '');
          timestamps.push(formatExportTime(clip.timestamp, (clip as any).displayTime) || '7:26 PM');
        }
      }

      if (TargetExporter && TargetExporter.exportSlideshowVideo && inputPaths.length > 0) {
        const exportedUri = await TargetExporter.exportSlideshowVideo(inputPaths, captions, timestamps);
        return exportedUri;
      }
    }

    if (!currentClip || !currentClip.uri) return '';

    if (TargetExporter && TargetExporter.exportPortraitVideoWithCaption) {
      const formattedTimeText = formatExportTime(currentClip.timestamp, (currentClip as any).displayTime);
      const exportedUri = await TargetExporter.exportPortraitVideoWithCaption(
        currentClip.uri,
        currentClip.caption || '',
        formattedTimeText || '7:26 PM'
      );
      return exportedUri;
    }

    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
    const outputUri = `${cacheDir}collection_export.mp4`;
    try {
      await FileSystem.copyAsync({
        from: currentClip.uri,
        to: outputUri,
      });
    } catch (copyErr) {}
    return outputUri;
  };

  // Save video directly into the device's iOS Photos app / Camera Roll gallery
  const handleSavePress = async () => {
    if (!currentClip || !currentClip.uri) return;
    if (saveState === 'saved') {
      setSaveState('idle');
      return;
    }
    if (saveState === 'saving') return;

    setSaveState('saving');
    try {
      if (!(await ensureMediaSavePermission())) {
        setSaveState('idle');
        return;
      }

      const processedUri = await processAndSaveVideo();

      if (processedUri) {
        try {
          await MediaLibrary.saveToLibraryAsync(processedUri);
        } catch (mediaErr) {
          console.log('MediaLibrary save exception:', mediaErr);
        }
        setSaveState('saved');
      } else {
        setSaveState('idle');
      }
    } catch (error) {
      console.log('Save error:', error);
      setSaveState('idle');
    }
  };

  // Launch iOS native Share Sheet with physical collection_export.mp4 file
  const handleSharePress = async () => {
    try {
      if (currentClip && currentClip.uri) {
        const processedUri = await processAndSaveVideo();

        if (processedUri) {
          await shareVideoFile(processedUri, 'collection_export');
        }
      }
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const isExportVideoVertical = currentClip?.mode === 'landscape' ? false : true;

  const cardWidth = screenWidth - 20;
  const cardHeight = cardWidth * (9.5 / 16) + 20;

  const rotatedStyle: StyleProp<ViewStyle> = {
    position: 'absolute',
    top: (cardHeight - cardWidth) / 2,
    left: (cardWidth - cardHeight) / 2,
    width: cardHeight,
    height: cardWidth,
    transform: [{ rotate: '270deg' }],
  };

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, backgroundColor: isDark ? '#000000' : '#F2F2F7' }]}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? '#000000' : '#F2F2F7',
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        {/* 1. TOP HEADER BAR: LEFT CHEVRON BACK ICON */}
        <View
          style={[styles.headerBar, { paddingTop: Math.max(insets.top - 1, 7) }]}
          pointerEvents="box-none"
        >
          <LiquidGlassIconButton idPrefix="btnExportBack" isDark={isDark} size={45} onPress={onClose}>
            <Ionicons name="chevron-back" size={30} color={isDark ? '#FFFFFF' : '#000000'} style={{ marginLeft: -1.5 }} />
          </LiquidGlassIconButton>
        </View>

          {/* 2. CENTER 16:9 VIDEO PREVIEW BOX */}
          <View style={styles.centerContent}>
            {currentClip && currentClip.uri ? (
              <TouchableOpacity
                activeOpacity={1}
                onPress={handleCardTap}
                style={{
                  width: cardWidth,
                  height: cardHeight,
                  borderRadius: 0,
                  overflow: 'hidden',
                  position: 'relative',
                  backgroundColor: '#000000',
                  shadowColor: isDark ? '#000000' : '#8E8E93',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 10,
                }}
              >
                <Video
                  ref={exportVideoRef}
                  source={{ uri: getLiveSandboxUri(currentClip.uri) }}
                  style={isExportVideoVertical ? (rotatedStyle as any) : StyleSheet.absoluteFill}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={true}
                  isLooping={list.length === 1}
                  isMuted={currentClip.isMuted ?? false}
                  rate={currentClip.rate || 1.0}
                  shouldCorrectPitch={true}
                  useNativeControls={false}
                  onLoad={() => {
                    exportVideoRef.current?.playAsync().catch(() => {});
                  }}
                  onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                  onReadyForDisplay={() => {
                    exportVideoRef.current?.playAsync().catch(() => {});
                  }}
                />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.15)' }]} pointerEvents="none" />

                {/* OVERLAY TEXT: VLOG (LEFT) | CAPTION (CENTER) | TIMESTAMP (RIGHT) */}
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 20,
                    right: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  pointerEvents="none"
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 25,
                      fontFamily: Fonts.SystemRoundedBold,
                      textShadowColor: 'rgba(0, 0, 0, 0.8)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 3,
                    }}
                  >
                    vlog
                  </Text>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 25,
                      fontFamily: Fonts.SystemRoundedBold,
                      textShadowColor: 'rgba(0, 0, 0, 0.8)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 3,
                    }}
                  >
                    {currentClip.caption || ''}
                  </Text>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 20,
                      fontFamily: Fonts.SystemRoundedSemibold,
                      textShadowColor: 'rgba(0, 0, 0, 0.8)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 3,
                    }}
                  >
                    {formatExportTime(currentClip.timestamp, (currentClip as any).displayTime)}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* 3. BOTTOM 4 ACTION BUTTONS ROW */}
          <View
            style={{
              position: 'absolute',
              bottom: Math.max(insets.bottom, 24) + 10,
              left: 0,
              right: 0,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-evenly',
              paddingHorizontal: 20,
              zIndex: 40,
            }}
            pointerEvents="box-none"
          >
            {/* 1. DISCARD BUTTON */}
            <View style={{ alignItems: 'center' }}>
              <LiquidGlassIconButton
                idPrefix="btnExportDiscard"
                isDark={isDark}
                size={54}
                onPress={onClose}
              >
                <Ionicons name="close" size={29} color={isDark ? '#FFFFFF' : '#000000'} />
              </LiquidGlassIconButton>
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 18.0,
                  fontFamily: Fonts.SystemRoundedMedium,
                  color: isDark ? '#8E8E93' : '#3A3A3C',
                  textAlign: 'center',
                }}
              >
                discard
              </Text>
            </View>

            {/* 2. EDIT BUTTON */}
            <View style={{ alignItems: 'center' }}>
              <LiquidGlassIconButton
                idPrefix="btnExportEdit"
                isDark={isDark}
                size={54}
                onPress={() => {}}
              >
                <Ionicons name="options-outline" size={29} color={isDark ? '#FFFFFF' : '#000000'} />
              </LiquidGlassIconButton>
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 18.0,
                  fontFamily: Fonts.SystemRoundedMedium,
                  color: isDark ? '#8E8E93' : '#3A3A3C',
                  textAlign: 'center',
                }}
              >
                edit
              </Text>
            </View>

            {/* 3. SAVE BUTTON */}
            <View style={{ alignItems: 'center' }}>
              <LiquidGlassIconButton
                idPrefix="btnExportSave"
                isDark={isDark}
                size={54}
                onPress={handleSavePress}
              >
                {saveState === 'saving' ? (
                  <ActivityIndicator size="small" color={isDark ? '#FFFFFF' : '#000000'} />
                ) : saveState === 'saved' ? (
                  <Ionicons name="checkmark" size={29} color={isDark ? '#FFFFFF' : '#000000'} />
                ) : (
                  <Ionicons name="download-outline" size={29} color={isDark ? '#FFFFFF' : '#000000'} />
                )}
              </LiquidGlassIconButton>
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 18.0,
                  fontFamily: Fonts.SystemRoundedMedium,
                  color: isDark ? '#8E8E93' : '#3A3A3C',
                  textAlign: 'center',
                }}
              >
                save
              </Text>
            </View>

            {/* 4. SHARE BUTTON */}
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  backgroundColor: edgeColor,
                  justifyContent: 'center',
                  alignItems: 'center',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 6,
                  elevation: 4,
                }}
                activeOpacity={0.85}
                onPress={handleSharePress}
              >
                <Ionicons name="share-outline" size={29} color="#FFFFFF" />
              </TouchableOpacity>
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 18.0,
                  fontFamily: Fonts.SystemRoundedMedium,
                  color: isDark ? '#8E8E93' : '#3A3A3C',
                  textAlign: 'center',
                }}
              >
                share
              </Text>
            </View>
          </View>
        </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  headerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    zIndex: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -40,
  },
});
