import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
  Animated,
  Easing,
  KeyboardAvoidingView,
  TextInput,
  Platform,
  Keyboard,
  PanResponder,
  NativeModules,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Pattern, Rect, Circle, Path, Line } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '../../constants/typography';
import { Colors } from '../../constants/colors';
import { VideoExporter } from '../../modules/video-exporter';
import { ensureMediaSavePermission } from '../../utils/mediaSave';
import { LiquidGlassIconButton, LiquidGlassCapsule, DynamicGlowContainer } from '../ui';
import { ActivityIndicator } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

import { CRTStaticCard } from './CRTStaticCard';
import { BouncingSmileyView, SmileyTouchInfo } from './BouncingSmileyView';
import { ChatDrawer } from '../home/ChatDrawer';
import { EditExportSheet } from './EditExportSheet';
import { ViewingPalsInstructionModal } from './ViewingPalsInstructionModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNearestHourText, formatExactTime, getClipsForDayOffset, parseToDate, getLiveSandboxUri } from '../../utils/mediaUtils';
import { useFastColorScheme } from '../../hooks/useFastColorScheme';

export interface VlogSheetProps {
  visible: boolean;
  onClose: () => void;
  user?: any;
  selectedThemeColor?: string;
  onOpenCamera?: () => void;
  onOpenChat?: () => void;
  vlogList?: Array<{ id: string; uri: string; caption?: string; timestamp: string; isMuted?: boolean; rate?: number; mode?: string }>;
  activeVideoUri?: string | null;
  caption?: string;
  timestamp?: string;
  isVertical?: boolean;
  isMuted?: boolean;
  onDeleteVideo?: (id?: string) => void;
  onUpdateCaption?: (newCaption: string, id?: string) => void;
  initialOpenExport?: boolean;
  selectedDayOffset?: number;
  onSelectDayOffset?: (offset: number) => void;
}

export const VlogSheet: React.FC<VlogSheetProps> = ({
  visible,
  onClose,
  activeVideoUri,
  caption = '',
  timestamp = '',
  isMuted = false,
  onDeleteVideo,
  onUpdateCaption,
  selectedThemeColor = 'cyan',
  vlogList = [],
  user,
  initialOpenExport = false,
  onOpenCamera,
  onOpenChat,
  selectedDayOffset = 0,
  onSelectDayOffset,
}) => {
  const insets = useSafeAreaInsets();
  const colorScheme = useFastColorScheme();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - 20;
  const cardHeight = cardWidth * (9.5 / 16) + 20;
  const isDark = colorScheme === 'dark';
  const username = user?.displayName || user?.email?.split('@')[0] || 'apple_user';
  const edgeColor = Colors.BorderGlow[selectedThemeColor as keyof typeof Colors.BorderGlow] || '#FE9068';
  const palzeeTextColor = Colors.LogoTextAccent[selectedThemeColor as keyof typeof Colors.LogoTextAccent] || '#11D5F3';

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

  const [showVlogDropdown, setShowVlogDropdown] = useState(false);
  const [showEditCaptionBox, setShowEditCaptionBox] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [show0Logs, setShow0Logs] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [isSheetVideoVertical, setIsSheetVideoVertical] = useState(true);
  const vlogVideoRef = useRef<Video>(null);
  const [currentVlogIndex, setCurrentVlogIndex] = useState(0);
  const [dayOffset, setDayOffset] = useState(selectedDayOffset);
  const [showInstructions, setShowInstructions] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [smileyTouch, setSmileyTouch] = useState<SmileyTouchInfo | null>(null);
  const rippleOpacityAnim = useRef(new Animated.Value(0)).current;

  const handleSmileyHover = useCallback((info: SmileyTouchInfo | null) => {
    if (info) {
      setSmileyTouch(info);
      Animated.timing(rippleOpacityAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(rippleOpacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start(() => {
        setSmileyTouch(null);
      });
    }
  }, [rippleOpacityAnim]);

  const vlogFadeAnim = useRef(new Animated.Value(1)).current;

  const formatExportTime = (ts?: string, rawDisplay?: string) => {
    if (rawDisplay) return rawDisplay;
    if (!ts) return '7:26 PM';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '7:26 PM';
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  const hasPalOnDate = (y: number, m: number, d: number) => {
    if (!Array.isArray(vlogList) || vlogList.length === 0) return false;
    return vlogList.some((vlog: any) => {
      if (!vlog) return false;
      const rawDate = parseToDate(
        vlog.timestamp ||
        vlog.createdAt ||
        vlog.date ||
        (typeof vlog.id === 'string' && /^\d{13}$/.test(vlog.id) ? Number(vlog.id) : null)
      );
      if (!rawDate || isNaN(rawDate.getTime())) return false;
      return (
        rawDate.getFullYear() === y &&
        rawDate.getMonth() === m &&
        rawDate.getDate() === d
      );
    });
  };

  const renderCalendarGridDays = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const todayDate = today.getDate();
    const todayDayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    // Active selected day offset
    const selectedDateObj = new Date(todayDayStart - (dayOffset || 0) * 24 * 3600 * 1000);
    const isSelectedMonth = selectedDateObj.getFullYear() === year && selectedDateObj.getMonth() === month;
    const selectedDay = selectedDateObj.getDate();

    const gridCells = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      gridCells.push(<View key={`empty-${i}`} style={{ width: `${100 / 7}%`, height: 56 }} />);
    }

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const isToday = isCurrentMonth && day === todayDate;
      const isSelected = isSelectedMonth && day === selectedDay && !isToday;
      const hasPalClip = hasPalOnDate(year, month, day);

      gridCells.push(
        <TouchableOpacity
          key={`day-${day}`}
          activeOpacity={0.7}
          onPress={() => {
            const clickedDayStart = new Date(year, month, day).getTime();
            const diffDays = Math.round((todayDayStart - clickedDayStart) / (24 * 3600 * 1000));
            if (diffDays >= 0 && diffDays < 7) {
              setDayOffset(diffDays);
              if (onSelectDayOffset) onSelectDayOffset(diffDays);
              setShowCalendarModal(false);
            }
          }}
          style={{
            width: `${100 / 7}%`,
            height: 58,
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingTop: 3,
          }}
        >
          <View
            style={[
              {
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
              },
              isToday && { backgroundColor: palzeeTextColor },
              isSelected && {
                borderWidth: 1.5,
                borderColor: edgeColor,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
              },
            ]}
          >
            <Text
              style={{
                fontSize: 15,
                fontFamily: isToday || isSelected ? Fonts.SystemRoundedBold : Fonts.SystemRoundedMedium,
                fontWeight: isToday || isSelected ? '700' : '500',
                color: isToday
                  ? (isDark ? '#000000' : '#FFFFFF')
                  : (isDark ? '#FFFFFF' : '#000000'),
              }}
            >
              {day}
            </Text>
          </View>

          {hasPalClip ? (
            <View
              style={{
                width: 16.5,
                height: 16.5,
                borderRadius: 8.25,
                backgroundColor: edgeColor,
                justifyContent: 'center',
                alignItems: 'center',
                marginTop: 3,
                overflow: 'hidden',
              }}
            >
              <Image
                source={require('../../assets/images/custom_rotate_smiley.png')}
                style={{
                  width: 16.5,
                  height: 16.5,
                  tintColor: '#000000',
                  transform: [{ scale: 1.1 }],
                }}
                contentFit="contain"
              />
            </View>
          ) : (
            <View style={{ height: 16.5, marginTop: 3 }} />
          )}
        </TouchableOpacity>
      );
    }

    return gridCells;
  };

  const handleDirectSave = async () => {
    if (!currentUri) return;
    if (saveState === 'saved') {
      setSaveState('idle');
      setShowOptionsMenu(false);
      return;
    }
    if (saveState === 'saving') return;
    setSaveState('saving');
    try {
      if (await ensureMediaSavePermission()) {
        const TargetExporter = VideoExporter;
        if (TargetExporter && TargetExporter.exportPortraitVideoWithCaption) {
          const formattedTimeText = formatExportTime(currentClip?.timestamp || timestamp, (currentClip as any)?.displayTime);
          const exportedUri = await TargetExporter.exportPortraitVideoWithCaption(
            currentUri,
            currentClip?.caption || caption || '',
            formattedTimeText || '7:26 PM'
          );
          if (exportedUri) {
            await MediaLibrary.saveToLibraryAsync(exportedUri);
          } else {
            await MediaLibrary.saveToLibraryAsync(currentUri);
          }
        } else {
          await MediaLibrary.saveToLibraryAsync(currentUri);
        }
        setSaveState('saved');
      } else {
        setShowExportModal(true);
        setSaveState('idle');
        setShowOptionsMenu(false);
      }
    } catch (e) {
      console.log('Direct save error:', e);
      setShowExportModal(true);
      setSaveState('idle');
    }
  };

  useEffect(() => {
    setSaveState('idle');
  }, [currentVlogIndex, dayOffset]);

  useEffect(() => {
    if (visible) {
      AsyncStorage.getItem('@palzee_has_seen_vlog_instructions').then((val) => {
        if (!val) {
          setShowInstructions(true);
        }
      });
    }
  }, [visible]);

  const handleDismissInstructions = () => {
    setShowInstructions(false);
    AsyncStorage.setItem('@palzee_has_seen_vlog_instructions', 'true');
  };

  useEffect(() => {
    setDayOffset(selectedDayOffset);
  }, [selectedDayOffset, visible]);

  const getAccountMaxDays = () => {
    try {
      const created = user?.metadata?.creationTime || user?.createdAt || (user as any)?.created_at;
      if (created) {
        const createdMs = new Date(created).getTime();
        if (!isNaN(createdMs)) {
          const days = Math.ceil((Date.now() - createdMs) / (1000 * 60 * 60 * 24));
          return Math.max(days, 30);
        }
      }
    } catch (e) {}
    return 365;
  };
  const maxDayOffset = getAccountMaxDays();

  const formatDatePillText = (offset: number) => {
    if (offset === 1) return 'Yesterday';
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const day = d.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const datePillOpacityAnim = useRef(new Animated.Value(0)).current;
  const datePillTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerDatePillOverlay = () => {
    if (datePillTimerRef.current) clearTimeout(datePillTimerRef.current);
    datePillOpacityAnim.setValue(1);
    datePillTimerRef.current = setTimeout(() => {
      Animated.timing(datePillOpacityAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }, 2000);
  };

  useEffect(() => {
    if (visible && dayOffset > 0) {
      triggerDatePillOverlay();
    }
  }, [visible, dayOffset]);

  const getDayHeaderTitle = (offset: number) => {
    return 'vlog';
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dy) < 30;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dy) < 30;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -30) {
          // SWIPE LEFT -> Move to Previous Day (older, up to account creation date)
          if (dayOffset < maxDayOffset) {
            const nextOffset = dayOffset + 1;
            setDayOffset(nextOffset);
            setCurrentVlogIndex(0);
            triggerDatePillOverlay();
            if (onSelectDayOffset) onSelectDayOffset(nextOffset);
          }
        } else if (gestureState.dx > 30) {
          // SWIPE RIGHT -> Move to Next Day (towards 0)
          if (dayOffset > 0) {
            const prevOffset = dayOffset - 1;
            setDayOffset(prevOffset);
            setCurrentVlogIndex(0);
            triggerDatePillOverlay();
            if (onSelectDayOffset) onSelectDayOffset(prevOffset);
          }
        }
      },
    })
  ).current;

  // Filter clips strictly for the active 4 AM - 4 AM cycle day offset
  const dayClips = getClipsForDayOffset(vlogList, dayOffset);
  const list = dayClips;
  const currentClip = list.length > 0 ? list[Math.min(currentVlogIndex, list.length - 1)] : null;
  const currentUri = currentClip ? getLiveSandboxUri(currentClip.uri) : null;
  const currentCaption = currentClip ? (currentClip.caption || '') : '';
  const currentTimestamp = getNearestHourText(currentClip ? ((currentClip as any).displayTime || currentClip.timestamp) : timestamp);
  const currentIsMuted = currentClip ? (currentClip.isMuted ?? false) : isMuted;

  const [editingCaptionText, setEditingCaptionText] = useState(currentCaption);

  useEffect(() => {
    if (visible) {
      setCurrentVlogIndex(0);
      setShowExportModal(Boolean(initialOpenExport));
      setShowVlogDropdown(false);
      setShowEditCaptionBox(false);
      setShowDeleteDialog(false);
      setIsEditingCaption(false);
      setShow0Logs(false);
    }
  }, [visible, dayOffset, initialOpenExport]);

  const prevVlogUriRef = useRef<string | null>(null);

  useEffect(() => {
    setEditingCaptionText(currentCaption);

    if (currentUri && prevVlogUriRef.current && currentUri !== prevVlogUriRef.current && vlogVideoRef.current) {
      prevVlogUriRef.current = currentUri;
      vlogVideoRef.current.loadAsync(
        { uri: currentUri },
        {
          shouldPlay: visible && !showEditCaptionBox && !showDeleteDialog && !showChatDrawer && !showExportModal,
          isLooping: true,
          positionMillis: 0,
          rate: currentClip?.rate || 1.0,
          isMuted: currentIsMuted,
        },
        false
      ).then(() => {
        vlogVideoRef.current?.playAsync().catch(() => {});
      }).catch(() => {});
    } else if (currentUri && !prevVlogUriRef.current) {
      prevVlogUriRef.current = currentUri;
    }
  }, [currentCaption, currentVlogIndex, currentUri, visible]);

  const handleConfirmDelete = () => {
    setShowDeleteDialog(false);
    setShowEditCaptionBox(false);
    if (onDeleteVideo) {
      if (currentClip?.id && currentClip.id !== 'default') {
        onDeleteVideo(currentClip.id);
      } else {
        onDeleteVideo();
      }
    }
  };

  const handleSaveCaption = () => {
    setIsEditingCaption(false);
    if (onUpdateCaption) {
      if (currentClip?.id && currentClip.id !== 'default') {
        onUpdateCaption(editingCaptionText, currentClip.id);
      } else {
        onUpdateCaption(editingCaptionText);
      }
    }
  };

  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

  const handleTouchStart = (e: any) => {
    touchStartRef.current = {
      x: e.nativeEvent.pageX,
      y: e.nativeEvent.pageY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e: any) => {
    const dx = e.nativeEvent.pageX - touchStartRef.current.x;
    const dy = e.nativeEvent.pageY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // 1. HORIZONTAL SWIPE (ONLY NAVIGATES BETWEEN DAYS, NEVER BETWEEN VIDEO PALS)
    if (absDx > 25 && absDx > absDy && dt < 600) {
      if (dx < 0) {
        // SWIPE LEFT -> NEXT DAY (towards today 0)
        if (dayOffset > 0) {
          const nextOffset = dayOffset - 1;
          setDayOffset(nextOffset);
          setCurrentVlogIndex(0);
          triggerDatePillOverlay();
          if (onSelectDayOffset) onSelectDayOffset(nextOffset);
        }
      } else if (dx > 0) {
        // SWIPE RIGHT -> PREVIOUS DAY (away from today, up to account creation date)
        if (dayOffset < maxDayOffset) {
          const prevOffset = dayOffset + 1;
          setDayOffset(prevOffset);
          setCurrentVlogIndex(0);
          triggerDatePillOverlay();
          if (onSelectDayOffset) onSelectDayOffset(prevOffset);
        }
      }
      return; // SWIPES NEVER CHANGE VIDEO PAL INDEX WITHIN THE DAY!
    }

    // 2. TAP GESTURE (ONLY NAVIGATES BETWEEN VIDEO PALS WITHIN THE ACTIVE DAY)
    if (absDx <= 15 && absDy <= 15 && dt < 400) {
      if (showOptionsMenu) {
        setShowOptionsMenu(false);
        return;
      }
      if (showEditCaptionBox) {
        setShowEditCaptionBox(false);
        return;
      }
      if (showDeleteDialog || isEditingCaption || showVlogDropdown) return;
      if (list.length <= 1) return;

      const touchX = e.nativeEvent.locationX;
      if (touchX < cardWidth / 2) {
        // Tap LEFT -> Navigate to MORE RECENT (newer) video pal
        // If at index 0 (most recent), DO NOTHING!
        if (currentVlogIndex > 0) {
          setCurrentVlogIndex((prev) => prev - 1);
        }
      } else {
        // Tap RIGHT -> Navigate to PREVIOUS (older) video pal
        if (currentVlogIndex < list.length - 1) {
          setCurrentVlogIndex((prev) => prev + 1);
        }
      }
    }
  };

  const logsRotateAnim = useRef(new Animated.Value(0)).current;
  const logsOpacityAnim = useRef(new Animated.Value(1)).current;
  const rotateLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const trigger0PalsEffect = () => {
    if (rotateLoopRef.current) rotateLoopRef.current.stop();
    if (timerRef.current) clearTimeout(timerRef.current);

    setShow0Logs(true);
    logsOpacityAnim.setValue(1);
    logsRotateAnim.setValue(0);

    rotateLoopRef.current = Animated.loop(
      Animated.timing(logsRotateAnim, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotateLoopRef.current.start();

    timerRef.current = setTimeout(() => {
      Animated.timing(logsOpacityAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }).start(() => {
        setShow0Logs(false);
        if (rotateLoopRef.current) rotateLoopRef.current.stop();
      });
    }, 3000);
  };

  const handleClose = () => {
    setShowChatDrawer(false);
    setShowEditCaptionBox(false);
    setShowDeleteDialog(false);
    setIsEditingCaption(false);
    setShowVlogDropdown(false);
    onClose();
  };

  useEffect(() => {
    if (!visible) {
      setShowChatDrawer(false);
      setShowEditCaptionBox(false);
      setShowDeleteDialog(false);
      setIsEditingCaption(false);
      setShowVlogDropdown(false);
      return;
    }
    setShow0Logs(false);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rotateLoopRef.current) rotateLoopRef.current.stop();
    };
  }, [visible]);

  const logoTextColor = Colors.LogoTextAccent[selectedThemeColor as keyof typeof Colors.LogoTextAccent] || '#310BED';

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, backgroundColor: isDark ? '#000000' : '#F5F5F7' }]}>
      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F5F5F7' }]}>
          {/* 1. TOP NAVIGATION HEADER BAR */}
          <View
            style={[styles.headerBar, { paddingTop: Math.max(insets.top - 1, 7) }]}
            pointerEvents="box-none"
          >
            <View style={{ minWidth: 45, height: 45, justifyContent: 'center' }}>
              {show0Logs ? (
                <Animated.View style={{ opacity: logsOpacityAnim }}>
                  <TouchableOpacity
                    style={styles.zeroLogsPillBtn}
                    activeOpacity={0.8}
                    onPress={handleClose}
                  >
                    <BlurView
                      key={`blur_logs_${isDark ? 'dark' : 'light'}`}
                      intensity={Platform.OS === 'ios' ? 45 : 30}
                      tint={isDark ? 'dark' : 'light'}
                      style={StyleSheet.absoluteFill}
                    />
                    <Svg width={96} height={42} style={StyleSheet.absoluteFill}>
                      <Defs>
                        <LinearGradient id="logsPillRim" x1="0%" y1="0%" x2="0%" y2="100%">
                          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.45 : 0.85} />
                          <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.15 : 0.40} />
                          <Stop offset="100%" stopColor={isDark ? '#FFFFFF' : '#000000'} stopOpacity={isDark ? 0.05 : 0.08} />
                        </LinearGradient>
                      </Defs>
                      <Rect
                        x="0.75"
                        y="0.75"
                        width="94.5"
                        height="40.5"
                        rx="20.25"
                        fill="none"
                        stroke="url(#logsPillRim)"
                        strokeWidth={1.2}
                      />
                    </Svg>
                    <View style={[styles.logsSmileyCircle, { backgroundColor: '#FF3B30' }]}>
                      <Animated.View
                        style={{
                          transform: [
                            { scale: 1.22 },
                            {
                              rotate: logsRotateAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0deg', '360deg'],
                              }),
                            },
                          ],
                        }}
                      >
                        <Image
                          source={require('../../assets/images/custom_rotate_smiley.png')}
                          style={[
                            styles.logsSmileyImg,
                            {
                              tintColor: '#000000',
                            },
                          ]}
                          contentFit="contain"
                        />
                      </Animated.View>
                    </View>
                    <Text
                      style={[
                        styles.zeroLogsText,
                        { color: isDark ? '#FFFFFF' : '#000000' },
                      ]}
                    >
                      0 logs
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              ) : (
                <LiquidGlassIconButton idPrefix="btnVlogBack" isDark={isDark} size={45} onPress={handleClose}>
                  <Ionicons name="chevron-back" size={30} color={isDark ? '#FFFFFF' : '#000000'} style={{ marginLeft: -1.5 }} />
                </LiquidGlassIconButton>
              )}
            </View>

            <View style={[styles.centerHeaderGroup, { top: Math.max(insets.top - 1, 7) }]} pointerEvents="box-none">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowVlogDropdown(!showVlogDropdown)}
              >
                <LiquidGlassCapsule
                  idPrefix="vlogSheetHeader"
                  isDark={isDark}
                  width={110}
                  height={45}
                >
                  <Text
                    style={[
                      styles.vlogPillText,
                      { color: isDark ? '#FFFFFF' : '#000000', textAlign: 'center', zIndex: 10 },
                    ]}
                    numberOfLines={1}
                  >
                    vlog
                  </Text>
                </LiquidGlassCapsule>
              </TouchableOpacity>

            {list.length > 0 && (
              <View style={{ position: 'absolute', top: 51, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                {Array.from({ length: list.length }).map((_, idx) => {
                  const isActive = idx === Math.min(currentVlogIndex, list.length - 1);
                  return (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.7}
                      onPress={() => setCurrentVlogIndex(idx)}
                      style={{
                        width: isActive ? 24 : 22,
                        height: isActive ? 24 : 22,
                        borderRadius: isActive ? 12 : 11,
                        backgroundColor: edgeColor,
                        borderWidth: isActive ? 2.5 : 1.5,
                        borderColor: isActive ? logoTextColor : (isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.15)'),
                        justifyContent: 'center',
                        alignItems: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <Image
                        source={require('../../assets/images/custom_rotate_smiley.png')}
                        style={{
                          width: isActive ? 16 : 15.05,
                          height: isActive ? 16 : 15.05,
                          tintColor: '#000000',
                          transform: [{ scale: 1.035 }],
                        }}
                        contentFit="contain"
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            </View>

            <View style={styles.headerRightIcons}>
              <LiquidGlassIconButton
                idPrefix="btnVlogShare"
                isDark={isDark}
                size={45}
                onPress={() => {
                  if (currentUri) {
                    setShowExportModal(true);
                  } else {
                    setShow0Logs(true);
                    trigger0PalsEffect();
                  }
                }}
              >
                <Ionicons name="share-outline" size={30} color={isDark ? '#FFFFFF' : '#000000'} />
              </LiquidGlassIconButton>
            </View>
          </View>

          {/* DATE OVERLAY PILL (VANISHES AFTER 2s, ADAPTS LIGHT/DARK CONSTRAINTS) */}
          {dayOffset > 0 && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: Math.max(insets.top + 4, 12) + (dayOffset === 1 ? 12.5 : 15.0),
                alignSelf: 'center',
                zIndex: 99999,
                opacity: datePillOpacityAnim,
                backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
                paddingHorizontal: 24.5,
                paddingVertical: 11.5,
                borderRadius: 24.5,
                borderWidth: 1.2,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.08)',
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.45 : 0.18,
                shadowRadius: 10,
                elevation: 8,
              }}
            >
              <Text
                style={{
                  color: isDark ? '#FFFFFF' : '#000000',
                  fontFamily: Fonts.SystemRoundedMedium,
                  fontSize: 19.0,
                  fontWeight: '600',
                  textAlign: 'center',
                }}
              >
                {formatDatePillText(dayOffset)}
              </Text>
            </Animated.View>
          )}

          {/* 2. MAIN 16:9 CARD VIEW CONTAINER */}
          <View
            style={styles.cardContainer}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <View style={[styles.cardOuter, { width: cardWidth, height: cardHeight }]}>
              <CRTStaticCard
                isDark={isDark}
                width={cardWidth}
                height={cardHeight}
                borderRadius={28}
                showBouncingSmiley={false}
              />
              {!currentUri && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <BouncingSmileyView
                    cardWidth={cardWidth}
                    cardHeight={cardHeight}
                    onSmileyHover={handleSmileyHover}
                  />
                </View>
              )}
              {!!currentUri && (
                <Video
                  ref={vlogVideoRef}
                  source={{ uri: currentUri }}
                  style={isSheetVideoVertical ? rotatedStyle : styles.videoBackground}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={visible && !showEditCaptionBox && !showDeleteDialog && !showChatDrawer && !showExportModal}
                  isLooping={true}
                  isMuted={currentIsMuted}
                  rate={currentClip?.rate || 1.0}
                  useNativeControls={false}
                  onLoad={() => {
                    vlogVideoRef.current?.playAsync().catch(() => {});
                  }}
                  onPlaybackStatusUpdate={(status) => {
                    if (status.isLoaded && status.didJustFinish) {
                      vlogVideoRef.current?.setPositionAsync(0).then(() => {
                        vlogVideoRef.current?.playAsync();
                      }).catch(() => {});
                    }
                  }}
                  onReadyForDisplay={() => {
                    vlogVideoRef.current?.playAsync().catch(() => {});
                  }}
                />
              )}

              <View style={styles.cardHeaderRow} pointerEvents="box-none">
                <View style={styles.userInfoBadge}>
                  <View style={[styles.avatarCircle, { backgroundColor: edgeColor }]}>
                    {user?.photoURL ? (
                      <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
                    ) : (
                      <Image
                        source={require('../../assets/images/capture_smile.png')}
                        style={styles.smileyIcon}
                        contentFit="contain"
                      />
                    )}
                  </View>
                  <Text style={[styles.userNameText, { color: currentUri ? '#FFFFFF' : (isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)') }]}>{username}</Text>
                </View>
              </View>

              <View style={styles.cardMiddleRow} pointerEvents="box-none">
                {!!currentUri ? (
                  <>
                    <Text
                      style={{
                        fontSize: 23.5,
                        fontWeight: '900',
                        color: '#FFFFFF',
                        marginLeft: -5,
                      }}
                    >
                      Vlog
                    </Text>
                    {!!currentCaption && (
                      <Text style={{ color: '#FFFFFF', fontSize: 25, fontFamily: Fonts.SystemRoundedBold, textAlign: 'center', flex: 1, marginHorizontal: 8 }}>
                        {currentCaption}
                      </Text>
                    )}
                    <Text
                      style={{
                        fontSize: 21,
                        fontFamily: Fonts.SystemRoundedSemibold,
                        fontWeight: '600',
                        color: '#FFFFFF',
                        marginRight: -5,
                      }}
                    >
                      {formatExactTime((currentClip as any)?.displayTime || currentClip?.timestamp || timestamp)}
                    </Text>
                  </>
                ) : dayOffset === 0 ? (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 0, zIndex: 30 }} pointerEvents="box-none">
                    {/* Middle Left: Vlog text in standard SF Pro Heavy/Black (shifted 5dp left) */}
                    <Text
                      style={{
                        fontSize: 23.5,
                        fontWeight: '900',
                        color: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)',
                        marginLeft: -5,
                      }}
                    >
                      Vlog
                    </Text>

                    {/* Center: Tap To Capture Pill */}
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 22,
                        paddingVertical: 12,
                        borderRadius: 22,
                        justifyContent: 'center',
                        alignItems: 'center',
                        position: 'relative',
                        zIndex: 35,
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.12,
                        shadowRadius: 10,
                        elevation: 4,
                      }}
                      activeOpacity={0.8}
                      onPress={() => {
                        onClose();
                        if (onOpenCamera) onOpenCamera();
                      }}
                    >
                      <View
                        style={{
                          ...StyleSheet.absoluteFillObject,
                          borderRadius: 22,
                          overflow: 'hidden',
                          backgroundColor: isDark ? 'transparent' : 'rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <BlurView
                          key={`blur_tap_capture_${isDark ? 'dark' : 'light'}`}
                          intensity={Platform.OS === 'ios' ? 45 : 30}
                          tint={isDark ? 'dark' : 'light'}
                          style={StyleSheet.absoluteFill}
                        />

                        {/* LOCALIZED WATER RIPPLE ILLUMINATION AT EXACT POINT OF CONTACT */}
                        {smileyTouch && (
                          <Animated.View
                            style={[
                              StyleSheet.absoluteFillObject,
                              {
                                opacity: rippleOpacityAnim,
                              },
                            ]}
                            pointerEvents="none"
                          >
                            <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
                              <Defs>
                                <RadialGradient
                                  id="vlogSmileyRippleGlow"
                                  cx={`${smileyTouch.relX || 0}`}
                                  cy={`${smileyTouch.relY || 0}`}
                                  r="46"
                                  gradientUnits="userSpaceOnUse"
                                >
                                  <Stop offset="0%" stopColor={smileyTouch.color || '#FE75F5'} stopOpacity={isDark ? 0.70 : 0.60} />
                                  <Stop offset="45%" stopColor={smileyTouch.color || '#FE75F5'} stopOpacity={isDark ? 0.28 : 0.22} />
                                  <Stop offset="100%" stopColor={smileyTouch.color || '#FE75F5'} stopOpacity={0.0} />
                                </RadialGradient>
                              </Defs>
                              <Rect width="100%" height="100%" fill="url(#vlogSmileyRippleGlow)" />
                            </Svg>
                          </Animated.View>
                        )}

                        <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
                          <Defs>
                            <LinearGradient id="tapCapRim" x1="0%" y1="0%" x2="0%" y2="100%">
                              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.45 : 0.85} />
                              <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.15 : 0.40} />
                              <Stop offset="100%" stopColor={isDark ? '#FFFFFF' : '#000000'} stopOpacity={isDark ? 0.05 : 0.08} />
                            </LinearGradient>
                          </Defs>
                          <Rect
                            x="0.75"
                            y="0.75"
                            width="98.5%"
                            height="96.5%"
                            rx={21.25}
                            ry={21.25}
                            fill="none"
                            stroke="url(#tapCapRim)"
                            strokeWidth={1.2}
                          />
                        </Svg>
                      </View>
                      <Text style={{ color: isDark ? '#FFFFFF' : '#000000', fontSize: 16, fontFamily: Fonts.SystemRoundedSemibold, zIndex: 10 }}>
                        tap to capture
                      </Text>
                    </TouchableOpacity>

                    {/* Middle Right: Time text in SF Rounded Semibold (shifted 5dp right) */}
                    <Text
                      style={{
                        fontSize: 21,
                        fontFamily: Fonts.SystemRoundedSemibold,
                        fontWeight: '600',
                        color: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)',
                        marginRight: -5,
                      }}
                    >
                      {getNearestHourText() || '0:00'}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* BOTTOM RIGHT TRIPLE DOT BUTTON (ALWAYS SHOWN) */}
              <TouchableOpacity
                style={styles.cardBottomRightDots}
                activeOpacity={0.7}
                onPress={() => setShowOptionsMenu(true)}
              >
                <Ionicons name="ellipsis-horizontal" size={29.5} color={currentUri ? '#FFFFFF' : (isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)')} />
              </TouchableOpacity>

              {/* IN-CARD EDIT CAPTION OVERLAY WITH CENTER BLINKING CURSOR & TOP CONTROLS */}
              {showEditCaptionBox && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 100, justifyContent: 'center', alignItems: 'center' }]}>
                  {/* TOP LEFT CROSS BUTTON */}
                  <View style={{ position: 'absolute', top: 9.5, left: 11.5, zIndex: 110 }}>
                    <TouchableOpacity
                      style={{
                        width: 45,
                        height: 45,
                        borderRadius: 22.5,
                        overflow: 'hidden',
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.94)' : 'rgba(255, 255, 255, 0.94)',
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.12,
                        shadowRadius: 8,
                        elevation: 4,
                      }}
                      activeOpacity={0.8}
                      onPress={() => {
                        Keyboard.dismiss();
                        setShowEditCaptionBox(false);
                      }}
                    >
                      <BlurView
                        key={`blur_vlog_caption_close_${isDark ? 'dark' : 'light'}`}
                        intensity={Platform.OS === 'ios' ? 40 : 30}
                        tint={isDark ? 'dark' : 'light'}
                        style={StyleSheet.absoluteFill}
                      />
                      <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
                        <Defs>
                          <LinearGradient id="vlogCaptionCloseRim" x1="0%" y1="0%" x2="0%" y2="100%">
                            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.45 : 0.85} />
                            <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.15 : 0.40} />
                            <Stop offset="100%" stopColor={isDark ? '#FFFFFF' : '#000000'} stopOpacity={isDark ? 0.05 : 0.08} />
                          </LinearGradient>
                        </Defs>
                        <Rect x="0.75" y="0.75" width="43.5" height="43.5" rx="21.75" ry="21.75" fill="none" stroke="url(#vlogCaptionCloseRim)" strokeWidth={1.2} />
                      </Svg>
                      <Ionicons name="close-sharp" size={27} color={isDark ? '#FFFFFF' : '#000000'} />
                    </TouchableOpacity>
                  </View>

                  {/* TOP RIGHT TICK BUTTON */}
                  <View style={{ position: 'absolute', top: 9.5, right: 11.5, zIndex: 110 }}>
                    <TouchableOpacity
                      style={{
                        width: 45,
                        height: 45,
                        borderRadius: 22.5,
                        overflow: 'hidden',
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.94)' : 'rgba(255, 255, 255, 0.94)',
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.12,
                        shadowRadius: 8,
                        elevation: 4,
                      }}
                      activeOpacity={0.8}
                      onPress={() => {
                        Keyboard.dismiss();
                        setShowEditCaptionBox(false);
                        handleSaveCaption();
                      }}
                    >
                      <BlurView
                        key={`blur_vlog_caption_save_${isDark ? 'dark' : 'light'}`}
                        intensity={Platform.OS === 'ios' ? 40 : 30}
                        tint={isDark ? 'dark' : 'light'}
                        style={StyleSheet.absoluteFill}
                      />
                      <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
                        <Defs>
                          <LinearGradient id="vlogCaptionSaveRim" x1="0%" y1="0%" x2="0%" y2="100%">
                            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.45 : 0.85} />
                            <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.15 : 0.40} />
                            <Stop offset="100%" stopColor={isDark ? '#FFFFFF' : '#000000'} stopOpacity={isDark ? 0.05 : 0.08} />
                          </LinearGradient>
                        </Defs>
                        <Rect x="0.75" y="0.75" width="43.5" height="43.5" rx="21.75" ry="21.75" fill="none" stroke="url(#vlogCaptionSaveRim)" strokeWidth={1.2} />
                      </Svg>
                      <Ionicons name="checkmark-sharp" size={27} color={isDark ? '#FFFFFF' : '#000000'} />
                    </TouchableOpacity>
                  </View>

                  {/* CENTER BLINKING CURSOR CAPTION INPUT */}
                  <TextInput
                    style={{
                      width: '85%',
                      textAlign: 'center',
                      color: '#FFFFFF',
                      fontSize: 25,
                      fontFamily: Fonts.SystemRoundedBold,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                    }}
                    value={editingCaptionText}
                    onChangeText={setEditingCaptionText}
                    placeholder=""
                    placeholderTextColor="transparent"
                    autoFocus={true}
                    selectionColor="#4FFFB0"
                  />
                </View>
              )}
            </View>
          </View>

          {/* BOTTOM BAR FOR VLOGSHEET MATCHING HOMESCREEN FOOTER (CALENDAR ON BOTTOM-LEFT, CHAT ON BOTTOM-RIGHT) */}
          <View
            style={{
              position: 'absolute',
              bottom: 24,
              left: 0,
              right: 0,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              zIndex: 100,
            }}
            pointerEvents="box-none"
          >
            {/* BOTTOM LEFT CALENDAR BUTTON (ARCHIVE) */}
            <LiquidGlassIconButton
              idPrefix="btnVlogCalendar"
              isDark={isDark}
              size={45}
              onPress={() => setShowCalendarModal(true)}
            >
              <Ionicons name="calendar-outline" size={30} color={isDark ? '#FFFFFF' : '#000000'} />
            </LiquidGlassIconButton>

            {/* BOTTOM RIGHT CHAT BUTTON */}
            <LiquidGlassIconButton
              idPrefix="btnVlogChatBottom"
              isDark={isDark}
              size={45}
              onPress={() => setShowChatDrawer(true)}
            >
              <Ionicons name="chatbubble-outline" size={30} color={isDark ? '#FFFFFF' : '#000000'} />
            </LiquidGlassIconButton>
          </View>

          <EditExportSheet
            visible={showExportModal}
            onClose={() => setShowExportModal(false)}
            vlogList={vlogList}
            selectedDayOffset={dayOffset}
            selectedThemeColor={selectedThemeColor}
            onDeleteVideo={onDeleteVideo}
            onUpdateCaption={onUpdateCaption}
          />

          {/* TRIPLE DOT 3-OPTIONS MENU POPUP SHEET */}
          <Modal
            visible={showOptionsMenu && !showDeleteDialog}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowOptionsMenu(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                justifyContent: 'flex-end',
                alignItems: 'flex-end',
                paddingBottom: !currentUri ? 322.6 : 320.0,
                paddingRight: 10.0,
              }}
              activeOpacity={1}
              onPress={() => setShowOptionsMenu(false)}
            >
              <View
                style={{
                  width: 155,
                  borderRadius: 20,
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.12,
                  shadowRadius: 14,
                  elevation: 6,
                  backgroundColor: 'transparent',
                  position: 'relative',
                }}
              >
                <View
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    borderRadius: 20,
                    overflow: 'hidden',
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.94)' : 'rgba(255, 255, 255, 0.94)',
                  }}
                >
                  <BlurView
                    key={`blur_vlog_opts_${isDark ? 'dark' : 'light'}`}
                    intensity={Platform.OS === 'ios' ? 40 : 30}
                    tint={isDark ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFill}
                  />
                  <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
                    <Defs>
                      <LinearGradient id="vlogOptsRim" x1="0%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.45 : 0.85} />
                        <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.15 : 0.40} />
                        <Stop offset="100%" stopColor={isDark ? '#FFFFFF' : '#000000'} stopOpacity={isDark ? 0.05 : 0.08} />
                      </LinearGradient>
                    </Defs>
                    <Rect
                      x="0.75"
                      y="0.75"
                      width="99%"
                      height="98.5%"
                      rx="19.25"
                      ry="19.25"
                      fill="none"
                      stroke="url(#vlogOptsRim)"
                      strokeWidth={1.2}
                    />
                  </Svg>
                </View>

                {/* 1. Edit Caption */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    paddingLeft: 18.5,
                    paddingRight: 12,
                    gap: 10,
                    zIndex: 10,
                  }}
                  activeOpacity={0.7}
                  onPress={() => {
                    setShowOptionsMenu(false);
                    setShowEditCaptionBox(true);
                  }}
                >
                  <Ionicons name="create-outline" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
                  <Text style={{ fontSize: 16.5, fontFamily: Fonts.SystemRoundedSemibold, color: isDark ? '#FFFFFF' : '#000000' }}>
                    edit caption
                  </Text>
                </TouchableOpacity>

                {!!currentUri && (
                  <>
                    {/* 2. Save */}
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 10,
                        paddingLeft: 18.5,
                        paddingRight: 12,
                        gap: 10,
                        zIndex: 10,
                      }}
                      activeOpacity={0.7}
                      onPress={handleDirectSave}
                    >
                      {saveState === 'saving' ? (
                        <ActivityIndicator size="small" color={isDark ? '#FFFFFF' : '#000000'} style={{ width: 20, height: 20 }} />
                      ) : (
                        <Ionicons name={saveState === 'saved' ? "checkmark" : "download-outline"} size={20} color={isDark ? '#FFFFFF' : '#000000'} />
                      )}
                      <Text style={{ fontSize: 16.5, fontFamily: Fonts.SystemRoundedSemibold, color: isDark ? '#FFFFFF' : '#000000' }}>
                        {saveState === 'saved' ? 'saved' : 'save'}
                      </Text>
                    </TouchableOpacity>

                    {/* 3. Delete */}
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 10,
                        paddingLeft: 18.5,
                        paddingRight: 12,
                        gap: 10,
                        zIndex: 10,
                      }}
                      activeOpacity={0.7}
                      onPress={() => {
                        setShowOptionsMenu(false);
                        setTimeout(() => {
                          setShowDeleteDialog(true);
                        }, 50);
                      }}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                      <Text style={{ fontSize: 16.5, fontFamily: Fonts.SystemRoundedSemibold, color: '#FF3B30' }}>
                        delete
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </Modal>

          <ChatDrawer
            visible={showChatDrawer}
            onClose={() => setShowChatDrawer(false)}
            onOpenCamera={() => {
              setShowChatDrawer(false);
              onClose();
              if (onOpenCamera) onOpenCamera();
            }}
            onOpenVlog={() => {
              setShowChatDrawer(false);
              setShowExportModal(true);
            }}
            palCode="palzee_space"
            user={user}
            isDark={isDark}
            selectedThemeColor={selectedThemeColor}
            vlogList={vlogList}
            activeVideoUri={activeVideoUri}
          />

          <ViewingPalsInstructionModal
            visible={showInstructions}
            onContinue={handleDismissInstructions}
          />

          {/* ARCHIVE CALENDAR MODAL / SHEET (MATCHING IMAGE 1 & DESIGN SYSTEM) */}
          <Modal
            visible={showCalendarModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowCalendarModal(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                justifyContent: 'flex-end',
                paddingHorizontal: 8,
                paddingBottom: Math.max(insets.bottom - 26.5, 0),
              }}
              activeOpacity={1}
              onPress={() => setShowCalendarModal(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  backgroundColor: isDark ? '#1C1C20' : '#F7F6F3',
                  borderRadius: 36,
                  borderWidth: 1.2,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.10)',
                  paddingTop: 14,
                  paddingBottom: 18,
                  paddingHorizontal: 16,
                  overflow: 'hidden',
                }}
              >
                <BlurView key={isDark ? 'dark' : 'light'} intensity={60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />

                {/* Drag Handle */}
                <View
                  style={{
                    width: 36,
                    height: 4.5,
                    borderRadius: 2.25,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)',
                    alignSelf: 'center',
                    marginBottom: 16,
                  }}
                />

                {/* Calendar Header Row: Month Title & Nav Arrows */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 18,
                    paddingHorizontal: 4,
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <Text
                      style={{
                        fontSize: 20,
                        fontFamily: Fonts.SystemRoundedBold,
                        fontWeight: '700',
                        color: isDark ? '#FFFFFF' : '#000000',
                      }}
                    >
                      {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={edgeColor} />
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <TouchableOpacity
                      onPress={() => {
                        const newD = new Date(calendarDate);
                        newD.setMonth(newD.getMonth() - 1);
                        setCalendarDate(newD);
                      }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="chevron-back" size={22} color={isDark ? '#D1D1D6' : '#636366'} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        const newD = new Date(calendarDate);
                        newD.setMonth(newD.getMonth() + 1);
                        setCalendarDate(newD);
                      }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="chevron-forward" size={22} color={isDark ? '#D1D1D6' : '#636366'} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Weekday Headers */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-around',
                    marginBottom: 14,
                  }}
                >
                  {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
                    <Text
                      key={day}
                      style={{
                        width: 40,
                        textAlign: 'center',
                        fontSize: 13,
                        fontFamily: Fonts.SystemRoundedBold,
                        fontWeight: '600',
                        color: isDark ? '#8E8E93' : '#636366',
                      }}
                    >
                      {day}
                    </Text>
                  ))}
                </View>

                {/* Calendar Days Grid */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {renderCalendarGridDays()}
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          {/* DELETE DIALOG MODAL */}
          <Modal
            visible={showDeleteDialog}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowDeleteDialog(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.55)',
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingBottom: 30,
              }}
              activeOpacity={1}
              onPress={() => setShowDeleteDialog(false)}
            >
              <TouchableOpacity
                style={{
                  width: Math.min(cardWidth * 0.88, 270),
                  borderRadius: 24,
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.16,
                  shadowRadius: 16,
                  elevation: 8,
                  backgroundColor: 'transparent',
                  position: 'relative',
                }}
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
              >
                <View
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    borderRadius: 24,
                    overflow: 'hidden',
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                  }}
                >
                  <BlurView
                    key={`blur_del_card_${isDark ? 'dark' : 'light'}`}
                    intensity={Platform.OS === 'ios' ? 45 : 30}
                    tint={isDark ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFill}
                  />
                  <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
                    <Defs>
                      <LinearGradient id="delCardRim" x1="0%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.45 : 0.85} />
                        <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.15 : 0.40} />
                        <Stop offset="100%" stopColor={isDark ? '#FFFFFF' : '#000000'} stopOpacity={isDark ? 0.05 : 0.08} />
                      </LinearGradient>
                    </Defs>
                    <Rect
                      x="0.75"
                      y="0.75"
                      width="99.2%"
                      height="98.5%"
                      rx={23.25}
                      ry={23.25}
                      fill="none"
                      stroke="url(#delCardRim)"
                      strokeWidth={1.2}
                    />
                  </Svg>
                </View>

                <View style={{ paddingHorizontal: 14, paddingTop: 18, paddingBottom: 16, alignItems: 'center', zIndex: 10 }}>
                  <Text
                    style={{
                      fontSize: 15.5,
                      fontFamily: Fonts.SystemRoundedBold,
                      fontWeight: 'bold',
                      color: isDark ? '#FFFFFF' : '#000000',
                      textAlign: 'center',
                      lineHeight: 21,
                      marginBottom: 16,
                    }}
                  >
                    are you sure you want to delete this pal completely?
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                    {/* Cancel Button */}
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        height: 44,
                        borderRadius: 22,
                        overflow: 'hidden',
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: isDark ? 'transparent' : 'rgba(255, 255, 255, 0.08)',
                      }}
                      activeOpacity={0.7}
                      onPress={() => setShowDeleteDialog(false)}
                    >
                      <BlurView
                        key={`blur_cancel_${isDark ? 'dark' : 'light'}`}
                        intensity={Platform.OS === 'ios' ? 45 : 30}
                        tint={isDark ? 'dark' : 'light'}
                        style={StyleSheet.absoluteFill}
                      />
                      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                        <Defs>
                          <LinearGradient id="cancelDelRim" x1="0%" y1="0%" x2="0%" y2="100%">
                            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.45 : 0.85} />
                            <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.15 : 0.40} />
                            <Stop offset="100%" stopColor={isDark ? '#FFFFFF' : '#000000'} stopOpacity={isDark ? 0.05 : 0.08} />
                          </LinearGradient>
                        </Defs>
                        <Rect x="0.75" y="0.75" width="99%" height="42.5" rx={21.25} fill="none" stroke="url(#cancelDelRim)" strokeWidth={1.2} />
                      </Svg>
                      <Text style={{ fontSize: 14.5, fontFamily: Fonts.SystemRoundedBold, fontWeight: 'bold', color: isDark ? '#FFFFFF' : '#000000', zIndex: 10 }}>
                        cancel
                      </Text>
                    </TouchableOpacity>

                    {/* Delete Pal Button (Liquid Glass + Red Text) */}
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        height: 44,
                        borderRadius: 22,
                        overflow: 'hidden',
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: isDark ? 'transparent' : 'rgba(255, 255, 255, 0.08)',
                      }}
                      activeOpacity={0.7}
                      onPress={handleConfirmDelete}
                    >
                      <BlurView
                        key={`blur_del_btn_${isDark ? 'dark' : 'light'}`}
                        intensity={Platform.OS === 'ios' ? 45 : 30}
                        tint={isDark ? 'dark' : 'light'}
                        style={StyleSheet.absoluteFill}
                      />
                      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                        <Defs>
                          <LinearGradient id="delBtnRim" x1="0%" y1="0%" x2="0%" y2="100%">
                            <Stop offset="0%" stopColor="#FF3B30" stopOpacity={isDark ? 0.6 : 0.85} />
                            <Stop offset="100%" stopColor="#FF3B30" stopOpacity={0.15} />
                          </LinearGradient>
                        </Defs>
                        <Rect x="0.75" y="0.75" width="99%" height="42.5" rx={21.25} fill="none" stroke="url(#delBtnRim)" strokeWidth={1.2} />
                      </Svg>
                      <Text style={{ fontSize: 14.5, fontFamily: Fonts.SystemRoundedBold, fontWeight: 'bold', color: '#FF3B30', zIndex: 10 }}>
                        delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
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
  zeroLogsPillBtn: {
    width: 96,
    height: 42,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    overflow: 'hidden',
  },
  logsSmileyCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logsSmileyImg: {
    width: 27,
    height: 27,
  },
  zeroLogsText: {
    fontSize: 14,
    fontFamily: Fonts.SystemRoundedBold,
    marginLeft: 6,
  },
  centerHeaderGroup: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  vlogLiquidPillBtn: {
    width: 110,
    height: 45,
    borderRadius: 22.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  vlogPillText: {
    fontSize: 22.5,
    fontFamily: Fonts.SystemRoundedBold,
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -40,
  },
  cardOuter: {
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000000',
  },
  videoBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  cardHeaderRow: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  userInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarCircle: {
    width: 23.0,
    height: 23.0,
    borderRadius: 11.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  smileyIcon: {
    width: 23.0,
    height: 23.0,
  },
  userNameText: {
    color: '#636366',
    fontSize: 23.0,
    fontFamily: Fonts.SystemRoundedSemibold,
  },
  cardBottomRightDots: {
    position: 'absolute',
    bottom: 10.0,
    right: 16.0,
    padding: 6,
    zIndex: 20,
  },
  cardMiddleRow: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  cardVlogTitle: {
    fontSize: 25,
    fontFamily: Fonts.SystemRoundedBold,
  },
  timestampText: {
    fontSize: 20,
    fontFamily: Fonts.SystemRoundedMedium,
  },
  centerCaptureBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  centerCaptureBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: Fonts.SystemRoundedBold,
  },
});
