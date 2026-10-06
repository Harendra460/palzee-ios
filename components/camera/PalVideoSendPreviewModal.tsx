import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  useColorScheme,
  TextInput,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  LogBox,
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode, Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { PlatformSymbol as SymbolView } from '../ui/PlatformSymbol';
import { BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle, Path } from 'react-native-svg';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/typography';
import { useFastColorScheme } from '../../hooks/useFastColorScheme';
import { DynamicGlowContainer } from '../ui/DynamicGlowContainer';
import * as MediaLibrary from 'expo-media-library';
import { ensureMediaSavePermission } from '../../utils/mediaSave';

const shouldSuppressExpoAv = (...args: any[]) => {
  try {
    const fullMsg = args
      .map((a) => (typeof a === 'string' ? a : JSON.stringify(a || '')))
      .join(' ');
    return (
      fullMsg.includes('expo-av') ||
      fullMsg.includes('expo-video') ||
      fullMsg.includes('Video component') ||
      fullMsg.includes('deprecated in favor of')
    );
  } catch (e) {
    return false;
  }
};

const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (shouldSuppressExpoAv(...args)) return;
  originalWarn(...args);
};

const originalError = console.error;
console.error = (...args: any[]) => {
  if (shouldSuppressExpoAv(...args)) return;
  originalError(...args);
};

const originalLog = console.log;
console.log = (...args: any[]) => {
  if (shouldSuppressExpoAv(...args)) return;
  originalLog(...args);
};

const originalInfo = console.info;
console.info = (...args: any[]) => {
  if (shouldSuppressExpoAv(...args)) return;
  originalInfo(...args);
};

LogBox.ignoreLogs([
  '[expo-av]',
  'Expo AV has been deprecated',
  'Video component from `expo-av` is deprecated',
  'expo-av',
  'expo-video',
  'deprecated in favor of `expo-video`',
  'SDK 54',
]);

export interface PalGroupItem {
  id: string;
  name: string;
  subtitle?: string;
  members?: string[];
  maxCount?: number;
  size?: number;
  isCooldownActive?: boolean;
  cooldownRemainingMinutes?: number;
  lastSentHourText?: string;
}

interface PalVideoSendPreviewModalProps {
  visible: boolean;
  videoUri: string | null;
  timeText: string;
  selectedThemeColor?: string;
  isVerticalCapture?: boolean;
  autoTickVlog?: boolean;
  playbackRate?: number;
  timerMode?: string;
  userName?: string;
  palCount?: number;
  palGroups?: PalGroupItem[];
  onRetake: () => void;
  onSend: (uri: string, caption?: string, isMuted?: boolean, rate?: number, mode?: string, targets?: string[]) => void;
}

const LiquidGlassCircleButton = ({
  onPress,
  children,
  idPrefix = 'circle',
  isDark = false,
  size = 44,
}: {
  onPress: () => void;
  children: React.ReactNode;
  idPrefix?: string;
  isDark?: boolean;
  size?: number;
  accentColor?: string;
}) => (
  <TouchableOpacity
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 3,
      backgroundColor: 'transparent',
    }}
    activeOpacity={0.8}
    onPress={onPress}
  >
    <View
      style={{
        ...StyleSheet.absoluteFillObject,
        borderRadius: size / 2,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: isDark ? 'transparent' : 'rgba(255, 255, 255, 0.08)',
      }}
    >
      <BlurView
        key={`blur_${idPrefix}_${isDark ? 'dark' : 'light'}`}
        intensity={Platform.OS === 'ios' ? 45 : 30}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`${idPrefix}GlassRim`} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop
              offset="0%"
              stopColor="#FFFFFF"
              stopOpacity={isDark ? 0.45 : 0.85}
            />
            <Stop
              offset="35%"
              stopColor="#FFFFFF"
              stopOpacity={isDark ? 0.15 : 0.40}
            />
            <Stop
              offset="100%"
              stopColor={isDark ? '#FFFFFF' : '#000000'}
              stopOpacity={isDark ? 0.05 : 0.08}
            />
          </LinearGradient>
        </Defs>
        <Rect
          x="0.75"
          y="0.75"
          width={size - 1.5}
          height={size - 1.5}
          rx={(size - 1.5) / 2}
          fill="none"
          stroke={`url(#${idPrefix}GlassRim)`}
          strokeWidth={1.2}
        />
      </Svg>
      {children}
    </View>
  </TouchableOpacity>
);

export default function PalVideoSendPreviewModal({
  visible,
  videoUri,
  timeText,
  selectedThemeColor = 'cyan',
  isVerticalCapture = true,
  autoTickVlog = true,
  playbackRate = 1.0,
  timerMode = 'off',
  userName = 'apple_user',
  palCount = 0,
  palGroups = [],
  onRetake,
  onSend,
}: PalVideoSendPreviewModalProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [isMuted, setIsMuted] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [saveRawState, setSaveRawState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleSaveRawVideo = async () => {
    if (!videoUri) return;
    if (saveRawState === 'saved') {
      setSaveRawState('idle');
      return;
    }
    setSaveRawState('saving');
    try {
      if (!(await ensureMediaSavePermission())) {
        setSaveRawState('idle');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(videoUri);
      setSaveRawState('saved');
    } catch (err) {
      console.log('Save raw video error:', err);
      setSaveRawState('idle');
    }
  };

  useEffect(() => {
    if (visible) {
      setSaveRawState('idle');
    }
  }, [visible]);
  const [captionText, setCaptionText] = useState('');
  const [isVertical, setIsVertical] = useState(isVerticalCapture);
  const [selectedTargets, setSelectedTargets] = useState<string[]>(
    autoTickVlog ? ['vlog'] : []
  );

  useEffect(() => {
    if (visible) {
      setSelectedTargets(autoTickVlog ? ['vlog'] : []);
    }
  }, [visible, autoTickVlog]);
  const textInputRef = useRef<TextInput>(null);
  const videoPlayerRef = useRef<Video>(null);
  const slideAnim = useRef(new Animated.Value(screenWidth * 0.85)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const toggleTarget = (id: string) => {
    const grp = palGroups.find((g) => g.id === id);
    if (grp?.isCooldownActive) return;
    if (selectedTargets.includes(id)) {
      setSelectedTargets(selectedTargets.filter((t) => t !== id));
    } else {
      setSelectedTargets([...selectedTargets, id]);
    }
  };

  const isSendActive = selectedTargets.length > 0;
  const primaryTarget = selectedTargets.includes('vlog') ? 'vlog' : selectedTargets[0] || 'send';

  useEffect(() => {
    setIsVertical(isVerticalCapture);
  }, [isVerticalCapture, videoUri]);

  useEffect(() => {
    if (visible && videoUri) {
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      }).catch(() => {});
    }
    return () => {
      videoPlayerRef.current?.unloadAsync().catch(() => {});
    };
  }, [visible, videoUri]);

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(screenWidth * 0.85);
      scaleAnim.setValue(0.96);
      fadeAnim.setValue(0);

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.bezier(0.16, 1, 0.3, 1), // Apple native iOS bezier curve
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 350,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start(() => {
        textInputRef.current?.focus();
      });
    } else {
      setCaptionText('');
    }
  }, [visible]);

  const handleClose = () => {
    videoPlayerRef.current?.unloadAsync().catch(() => {});
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: screenWidth * 0.85,
        duration: 280,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.96,
        duration: 280,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onRetake();
    });
  };

  const handleSend = () => {
    videoPlayerRef.current?.unloadAsync().catch(() => {});
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: screenWidth * 0.85,
        duration: 280,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.96,
        duration: 280,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (videoUri) {
        onSend(videoUri, captionText, isMuted, playbackRate || 1.0, timerMode || 'off', selectedTargets);
      }
    });
  };

  const systemScheme = useFastColorScheme();
  const isDark = systemScheme === 'dark';
  const containerBg = isDark ? '#000000' : Colors.PalBackground;
  const titleColor = isDark ? '#FFFFFF' : '#000000';
  const iconColor = isDark ? '#FFFFFF' : '#000000';
  const sendToColor = isDark ? '#9E9EA5' : '#707070';
  const palzeeTextColor =
    Colors.LogoTextAccent[selectedThemeColor as keyof typeof Colors.LogoTextAccent] || '#77E4BE';

  if (!visible || !videoUri) return null;

  const baseAccentColor =
    Colors.BorderGlow[selectedThemeColor as keyof typeof Colors.BorderGlow] || '#11D5F3';

  // 16:9 Aspect Ratio Card Frame Dimensions
  const cardWidth = screenWidth - 20.0;
  const cardHeight = cardWidth * (9 / 16);

  // Exact 90° Rotated Dimensions for Vertical Captures to Fill 16:9 Frame
  const videoWidth = cardHeight;
  const videoHeight = cardWidth;
  const videoTop = (cardHeight - videoHeight) / 2;
  const videoLeft = (cardWidth - videoWidth) / 2;

  const rotatedStyle = {
    position: 'absolute' as const,
    top: videoTop,
    left: videoLeft,
    width: videoWidth,
    height: videoHeight,
    transform: [{ rotate: '270deg' }],
  };

  const horizontalStyle = {
    ...StyleSheet.absoluteFillObject,
    transform: [],
  };
  return (
    <Modal
      visible={visible && !!videoUri}
      animationType="none"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={handleClose}
    >
      <View style={[StyleSheet.absoluteFill, { zIndex: 99999, backgroundColor: containerBg }]}>
        <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim, transform: [{ translateX: slideAnim }, { scale: scaleAnim }] }]}>
          <DynamicGlowContainer selectedThemeColor={selectedThemeColor || 'cyan'} showBorder={true} showGlow={true}>
            <KeyboardAvoidingView
              behavior="padding"
              style={[styles.modalContainer, { backgroundColor: containerBg }]}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={{ flex: 1, paddingHorizontal: 10, paddingTop: Math.max(insets.top - 1, 7), paddingBottom: 20 }}>
                  {/* 1. HEADER ROW: HOMESCREEN EXACT LIQUID GLASS CLOSE (X), HEADER TITLE (vlog >) & LIQUID GLASS SEND ARROW (↑) */}
                  <View style={styles.headerRow}>
                  {/* Exact Home Screen Liquid Glass Close Button (X) */}
                  <LiquidGlassCircleButton onPress={handleClose} idPrefix="closeBtn" isDark={isDark}>
                    <SymbolView name="xmark" size={20} weight="semibold" tintColor={iconColor} />
                  </LiquidGlassCircleButton>

                  {/* Header Title Text: "vlog >" when vlog box is clicked/selected, "send" when unselected */}
                  <Text style={[styles.headerTitle, { color: titleColor }]}>
                    {selectedTargets.includes('vlog') ? 'vlog >' : 'send'}
                  </Text>

                  {/* Top Right Liquid Glass / Filled Action Button (Screen Edge Accent Color when Selected, Unfilled Liquid Glass when Unselected) */}
                  {isSendActive ? (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleSend}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: baseAccentColor,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <SymbolView name="arrow.up" size={22} weight="bold" tintColor="#FFFFFF" />
                    </TouchableOpacity>
                  ) : (
                    <LiquidGlassCircleButton
                      onPress={() => {}}
                      idPrefix="sendBtnInactive"
                      isDark={isDark}
                    >
                      <SymbolView
                        name="arrow.up"
                        size={22}
                        weight="medium"
                        tintColor={isDark ? '#8E8E93' : '#636366'}
                      />
                    </LiquidGlassCircleButton>
                  )}
                </View>

                {/* 2. 16:9 HORIZONTAL VIDEO CARD BOX */}
                <View style={styles.videoCardWrapper}>
                  <View
                    style={[
                      styles.videoCardContainer,
                      {
                        width: cardWidth,
                        height: cardHeight,
                      },
                    ]}
                  >
                    {/* Dynamic Video Player */}
                    {visible && !!videoUri && (
                      <Video
                        key={videoUri}
                        ref={videoPlayerRef}
                        source={{ uri: videoUri }}
                        style={isVertical ? rotatedStyle : horizontalStyle}
                        shouldPlay={true}
                        isLooping={true}
                        isMuted={isMuted}
                        rate={playbackRate}
                        shouldCorrectPitch={true}
                        useNativeControls={false}
                        resizeMode={ResizeMode.COVER}
                        onPlaybackStatusUpdate={(status) => {
                          if (status.isLoaded && status.didJustFinish) {
                            videoPlayerRef.current?.setPositionAsync(0).then(() => {
                              videoPlayerRef.current?.playAsync();
                            }).catch(() => {});
                          }
                        }}
                        onReadyForDisplay={(event) => {
                          if (event?.naturalSize) {
                            const { width, height } = event.naturalSize;
                            const detectedVertical = height > width;
                            if (isVertical !== detectedVertical) {
                              setIsVertical(detectedVertical);
                            }
                          }
                        }}
                      />
                    )}

                    {/* CENTER TIME TEXT + BLINKING CURSOR CAPTION INPUT DIRECTLY BELOW TIME TEXT */}
                    <View style={styles.centerTimeAndCaptionContainer}>
                      <Text style={styles.timeTextHorizontal}>{timeText}</Text>
                      <TextInput
                        ref={textInputRef}
                        style={styles.captionInputBelowTime}
                        value={captionText}
                        onChangeText={setCaptionText}
                        placeholder=""
                        selectionColor={baseAccentColor}
                        cursorColor={baseAccentColor}
                        multiline={false}
                        autoFocus={false}
                      />
                    </View>

                    {/* Bottom Left SOLID BOLD Volume Icon */}
                    <TouchableOpacity
                      style={styles.videoOverlayIconLeft}
                      activeOpacity={0.8}
                      onPress={() => setIsMuted(!isMuted)}
                    >
                      <Ionicons
                        name={isMuted ? 'volume-mute' : 'volume-high'}
                        size={24}
                        color="#FFFFFF"
                      />
                    </TouchableOpacity>

                    {/* Bottom Right Download / Save Icon: Saves raw video ONLY (NO overlays) */}
                    <TouchableOpacity
                      style={styles.videoOverlayIconRight}
                      activeOpacity={0.8}
                      onPress={handleSaveRawVideo}
                    >
                      {saveRawState === 'saving' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons
                          name={saveRawState === 'saved' ? 'checkmark' : 'download-outline'}
                          size={24}
                          color="#FFFFFF"
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 3. "send to:" SUBTITLE & RECIPIENT TARGET BOXES (VLOG BOX DEFAULT SELECTED) */}
                <View style={styles.captionSection}>
                  <Text style={[styles.sendToLabel, { color: sendToColor }]}>send to:</Text>
                </View>

                <View style={{ marginTop: 12 }}>
                  {/* 1. VLOG BOX (ALWAYS TOPMOST DESTINATION) */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => toggleTarget('vlog')}
                    style={[
                      styles.targetBoxContainer,
                      {
                        backgroundColor: selectedTargets.includes('vlog')
                          ? isDark
                            ? '#222226'
                            : '#E5E5EA'
                          : isDark
                          ? '#161616'
                          : '#F5F5F7',
                        marginBottom: palGroups.length > 0 ? 10 : 0,
                      },
                    ]}
                  >
                    {/* Left Selection Circle */}
                    <View style={styles.leftCircleWrapper}>
                      {selectedTargets.includes('vlog') ? (
                        <View style={[styles.selectedCircleFilled, { backgroundColor: baseAccentColor }]}>
                          <SymbolView name="checkmark" size={14} weight="bold" tintColor="#FFFFFF" />
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.unselectedCircleHollow,
                            { borderColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.18)' },
                          ]}
                        />
                      )}
                    </View>

                    {/* Middle Title & User's Name Subtitle */}
                    <View style={styles.targetTextWrapper}>
                      <Text style={[styles.targetTitle, { color: titleColor }]}>vlog</Text>
                      <Text style={[styles.targetSubtitle, { color: isDark ? '#9E9EA5' : '#8E8E93' }]}>
                        {userName}
                      </Text>
                    </View>

                    {/* Right Smiley Icon: Coloured upright if at least 1 video pal exists for current day, uncoloured upside-down if 0 video pals */}
                    {palCount > 0 ? (
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: baseAccentColor,
                          borderWidth: 1.5,
                          borderColor: palzeeTextColor,
                          justifyContent: 'center',
                          alignItems: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        <Image
                          source={require('../../assets/images/custom_rotate_smiley.png')}
                          style={{
                            width: 18.5,
                            height: 18.5,
                            transform: [{ rotate: '180deg' }],
                            tintColor: '#000000',
                          }}
                          contentFit="contain"
                        />
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.smileyBadgeContainer,
                          { borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.14)' },
                        ]}
                      >
                        <Image
                          source={require('../../assets/images/custom_rotate_smiley.png')}
                          style={{
                            width: 18.5,
                            height: 18.5,
                            transform: [{ rotate: '0deg' }],
                            tintColor: iconColor,
                          }}
                          contentFit="contain"
                        />
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* 2. PAL GROUPS / RECIPIENT BOXES (BELOW VLOG BOX) */}
                  {palGroups.map((group) => {
                    const isCooldown = Boolean(group.isCooldownActive);
                    const isSelected = !isCooldown && selectedTargets.includes(group.id);
                    return (
                      <TouchableOpacity
                        key={group.id}
                        activeOpacity={isCooldown ? 1 : 0.85}
                        disabled={isCooldown}
                        onPress={() => toggleTarget(group.id)}
                        style={[
                          styles.targetBoxContainer,
                          {
                            backgroundColor: isCooldown
                              ? isDark
                                ? '#121214'
                                : '#ECECEE'
                              : isSelected
                              ? isDark
                                ? '#222226'
                                : '#E5E5EA'
                              : isDark
                              ? '#161616'
                              : '#F5F5F7',
                            opacity: isCooldown ? 0.42 : 1,
                            marginBottom: 10,
                          },
                        ]}
                      >
                        {/* Left Selection Circle */}
                        <View style={styles.leftCircleWrapper}>
                          {isSelected ? (
                            <View style={[styles.selectedCircleFilled, { backgroundColor: baseAccentColor }]}>
                              <SymbolView name="checkmark" size={14} weight="bold" tintColor="#FFFFFF" />
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.unselectedCircleHollow,
                                {
                                  borderColor: isCooldown
                                    ? isDark
                                      ? 'rgba(255, 255, 255, 0.12)'
                                      : 'rgba(0, 0, 0, 0.10)'
                                    : isDark
                                    ? 'rgba(255, 255, 255, 0.25)'
                                    : 'rgba(0, 0, 0, 0.18)',
                                },
                              ]}
                            />
                          )}
                        </View>

                        {/* Middle Title & Subtitle */}
                        <View style={[styles.targetTextWrapper, { flex: 1, marginRight: 8 }]}>
                          <Text
                            style={[
                              styles.targetTitle,
                              {
                                color: isCooldown
                                  ? isDark
                                    ? '#636366'
                                    : '#8E8E93'
                                  : titleColor,
                              },
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {group.name}
                          </Text>
                          <Text
                            style={[
                              styles.targetSubtitle,
                              {
                                color: isCooldown
                                  ? isDark
                                    ? '#48484A'
                                    : '#AEAEB2'
                                  : isDark
                                  ? '#9E9EA5'
                                  : '#8E8E93',
                              },
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {isCooldown
                              ? `sent for ${group.lastSentHourText || 'this hour'}`
                              : group.members && group.members.length > 0
                              ? group.members.join(', ')
                              : (group.subtitle || userName || 'apple_user')}
                          </Text>
                        </View>

                        {/* Right: Row of member count smileys */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                          {Array.from({ length: group.size || group.members?.length || 1 }).map((_, idx) => {
                            // When pal is sent (cooldown active), show the exact same coloured illuminated smiley as vlog
                            const isMemberSent = isCooldown && idx === 0;
                            if (isMemberSent) {
                              return (
                                <View
                                  key={idx}
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 12,
                                    backgroundColor: baseAccentColor,
                                    borderWidth: 1.5,
                                    borderColor: palzeeTextColor,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <Image
                                    source={require('../../assets/images/custom_rotate_smiley.png')}
                                    style={{
                                      width: 18.5,
                                      height: 18.5,
                                      transform: [{ rotate: '180deg' }],
                                      tintColor: '#000000',
                                    }}
                                    contentFit="contain"
                                  />
                                </View>
                              );
                            }

                            return (
                              <View
                                key={idx}
                                style={[
                                  styles.smileyBadgeContainer,
                                  {
                                    borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.14)',
                                  },
                                ]}
                              >
                                <Image
                                  source={require('../../assets/images/custom_rotate_smiley.png')}
                                  style={{
                                    width: 18.5,
                                    height: 18.5,
                                    transform: [{ rotate: '0deg' }],
                                    tintColor: iconColor,
                                  }}
                                  contentFit="contain"
                                />
                              </View>
                            );
                          })}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </DynamicGlowContainer>
      </Animated.View>
    </View>
  </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#F7F7F8',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  liquidCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  liquidGlassHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  specularBorderHighlightHeader: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  headerTitle: {
    fontFamily: Fonts.SystemRoundedBold,
    fontSize: 23.0,
    fontWeight: '700',
    color: '#000000',
  },
  videoCardWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  videoCardContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000000',
  },
  centerTimeAndCaptionContainer: {
    position: 'absolute',
    top: '35%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  timeTextHorizontal: {
    color: '#FFFFFF',
    fontFamily: Fonts.DelaGothicOne,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  captionInputBelowTime: {
    fontSize: 25,
    fontFamily: Fonts.SystemRoundedBold,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 1,
    minWidth: 50,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  videoOverlayIconLeft: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    zIndex: 15,
  },
  videoOverlayIconRight: {
    position: 'absolute',
    bottom: 14,
    right: 16,
    zIndex: 15,
  },
  captionSection: {
    marginTop: 4,
    paddingHorizontal: 4,
  },
  sendToLabel: {
    fontFamily: Fonts.SystemRoundedSemibold,
    fontSize: 18,
    fontWeight: '600',
    color: '#909090',
  },
  sendArrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 24,
    marginBottom: 10,
    height: 84,
  },
  leftCircleWrapper: {
    marginRight: 14,
  },
  selectedCircleFilled: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF2A85',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unselectedCircleHollow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    backgroundColor: 'transparent',
  },
  targetTextWrapper: {
    flex: 1,
  },
  targetTitle: {
    fontFamily: Fonts.SystemRoundedBold,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  targetSubtitle: {
    fontFamily: Fonts.SystemRoundedMedium,
    fontSize: 15.5,
    fontWeight: '500',
    marginTop: 2,
  },
  smileyBadgeContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  smallSmileyBadgeContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  modeBadgeTopLeft: {
    position: 'absolute',
    top: 12,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    zIndex: 30,
  },
  modeBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.SystemRoundedBold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
