import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  DeviceEventEmitter,
  Dimensions,
  Easing,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useColorScheme,
  useWindowDimensions,
  NativeModules,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useFastColorScheme } from '../../hooks/useFastColorScheme';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { PlatformSymbol as SymbolView } from '../../components/ui/PlatformSymbol';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { InAppBrowserModal } from '../../components/ui/InAppBrowserModal';
import { Fonts } from '../../constants/typography';
import { Colors } from '../../constants/colors';
import { VideoExporter } from '../../modules/video-exporter';
import { ensureMediaSavePermission } from '../../utils/mediaSave';
import { getNearestHourText, formatExactTime, generateVideoThumbnail, getLiveSandboxUri, getClipsForDayOffset, parseToDate } from '../../utils/mediaUtils';
import { DynamicGlowContainer } from '../../components/ui/DynamicGlowContainer';
import { LiquidGlass } from '../../components/ui/LiquidGlassView';
import { CreatePalModal, PalGroupDetailsSheet } from '../../components/palsgroup';
import { ChatDrawer } from '../../components/home/ChatDrawer';
import { ActivityDrawer } from '../../components/home/ActivityDrawer';
import { VlogSheet, EditExportSheet, CRTStaticCard } from '../../components/vlog';
import { ViewingPalsInstructionModal } from '../../components/vlog/ViewingPalsInstructionModal';
import { Video, ResizeMode, Audio } from 'expo-av';
import { LiquidGlassIconButton } from '../../components/ui/LiquidGlassIconButton';
import CameraScreen from './camera';
import PalCameraPreview from '../../components/camera/PalCameraPreview';
import { CameraPrewarmer } from '../../components/camera/CameraPrewarmer';
import PalGroupGridScreen from './groups';
import { User } from '../../types';

const LucidePlus = ({
  size = 26,
  color = '#FFFFFF',
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) => <SymbolView name="plus" size={size} tintColor={color} />;

const LucideBell = ({
  size = 25,
  color = '#FFFFFF',
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) => <SymbolView name="bell" size={size} tintColor={color} />;

const MaterialPersonIcon = ({ size = 25, color = '#FFFFFF' }) => (
  <SymbolView name="person" size={size} tintColor={color} />
);

const LiquidGlassPillButton = ({
  onPress,
  text,
  textColor,
  idPrefix,
  isDark = true,
}: {
  onPress: () => void;
  text: string;
  textColor: string;
  idPrefix: string;
  isDark?: boolean;
}) => (
  <View
    style={[
      styles.liquidCircleWrapper,
      {
        width: 118,
        height: 36,
        borderRadius: 18,
      },
    ]}
  >
    <TouchableOpacity
      style={[
        styles.actionPillContainer,
        {
          width: 118,
          height: 36,
          borderRadius: 18,
          backgroundColor: isDark ? 'transparent' : 'rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
        },
      ]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <BlurView
        key={`blur_${idPrefix}_${isDark ? 'dark' : 'light'}`}
        intensity={Platform.OS === 'ios' ? 45 : 30}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={118} height={36} style={StyleSheet.absoluteFill}>
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
          width="116.5"
          height="34.5"
          rx="17.25"
          fill="none"
          stroke={`url(#${idPrefix}GlassRim)`}
          strokeWidth={1.0}
        />
      </Svg>
      <Text style={[styles.actionPillText, { color: textColor }]}>{text}</Text>
    </TouchableOpacity>
  </View>
);

const LiquidGlassNavPillBar = ({
  activeTab,
  onSelectTab,
  isDark = true,
  accentColor = '#8A2BE2',
}: {
  activeTab: 'camera' | 'pals';
  onSelectTab: (tab: 'camera' | 'pals') => void;
  isDark?: boolean;
  accentColor?: string;
}) => (
  <View style={styles.bottomSwitcherContainer}>
    <View
      style={[
        styles.liquidNavShadowWrapper,
        {
          width: 167.5,
          height: 50,
          borderRadius: 25,
        },
      ]}
    >
      <View
        style={[
          styles.liquidOuterCapsule,
          {
            backgroundColor: isDark ? 'transparent' : 'rgba(255, 255, 255, 0.08)',
          },
        ]}
      >
        <BlurView
          key={`blur_capsule_${isDark ? 'dark' : 'light'}`}
          intensity={Platform.OS === 'ios' ? 45 : 30}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <Svg width={167.5} height={50} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="capsuleRim" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop
                offset="0%"
                stopColor="#FFFFFF"
                stopOpacity={isDark ? 0.45 : 0.85}
              />
              <Stop
                offset="40%"
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
            width="166"
            height="48.5"
            rx="24.25"
            fill="none"
            stroke="url(#capsuleRim)"
            strokeWidth={1.0}
          />
        </Svg>

        <View style={styles.liquidCapsuleRow}>
          {/* CAMERA TAB */}
          <TouchableOpacity
            style={styles.liquidTabButton}
            activeOpacity={0.8}
            onPress={() => onSelectTab('camera')}
          >
            {activeTab === 'camera' && (
              <Svg width={82.25} height={48} style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="actBdr1" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop
                      offset="0%"
                      stopColor="#FFFFFF"
                      stopOpacity={isDark ? 0.50 : 0.85}
                    />
                    <Stop
                      offset="40%"
                      stopColor="#FFFFFF"
                      stopOpacity={isDark ? 0.20 : 0.45}
                    />
                    <Stop
                      offset="100%"
                      stopColor={isDark ? '#FFFFFF' : '#000000'}
                      stopOpacity={isDark ? 0.08 : 0.08}
                    />
                  </LinearGradient>
                </Defs>
                <Rect
                  x="0.75"
                  y="0.75"
                  width="80.75"
                  height="46.5"
                  rx="23.25"
                  fill={isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.65)'}
                  stroke={`url(#actBdr1)`}
                  strokeWidth={1.0}
                />
              </Svg>
            )}
            <Text
              style={[
                activeTab === 'camera'
                  ? [styles.activeSegmentText, { color: isDark ? '#FFFFFF' : '#000000', fontWeight: '700' }]
                  : [styles.inactiveSegmentText, { color: isDark ? '#8E8E93' : '#666666' }],
              ]}
            >
              camera
            </Text>
          </TouchableOpacity>

          {/* PALS TAB */}
          <TouchableOpacity
            style={styles.liquidTabButton}
            activeOpacity={0.8}
            onPress={() => onSelectTab('pals')}
          >
            {activeTab === 'pals' && (
              <Svg width={82.25} height={48} style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="actBdr2" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop
                      offset="0%"
                      stopColor="#FFFFFF"
                      stopOpacity={isDark ? 0.50 : 0.85}
                    />
                    <Stop
                      offset="40%"
                      stopColor="#FFFFFF"
                      stopOpacity={isDark ? 0.20 : 0.45}
                    />
                    <Stop
                      offset="100%"
                      stopColor={isDark ? '#FFFFFF' : '#000000'}
                      stopOpacity={isDark ? 0.08 : 0.08}
                    />
                  </LinearGradient>
                </Defs>
                <Rect
                  x="0.75"
                  y="0.75"
                  width="80.75"
                  height="46.5"
                  rx="23.25"
                  fill={isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.65)'}
                  stroke={`url(#actBdr2)`}
                  strokeWidth={1.0}
                />
              </Svg>
            )}
            <Text
              style={[
                activeTab === 'pals'
                  ? [styles.activeSegmentText, { color: isDark ? '#FFFFFF' : '#000000', fontWeight: '700' }]
                  : [styles.inactiveSegmentText, { color: isDark ? '#8E8E93' : '#666666' }],
              ]}
            >
              pals
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </View>
);

interface PalRoom {
  id: string;
  name: string;
  maxCount: number;
  code: string;
  size?: number;
  members?: string[];
}

interface HomeScreenProps {
  user: User;
  selectedThemeColor: string;
  onSelectedThemeColorChange: (color: string) => void;
  onSignOut: () => void;
  autoOpenCreateModal?: boolean;
}

export default function HomeScreen({
  user,
  selectedThemeColor,
  onSelectedThemeColorChange,
  onSignOut,
  autoOpenCreateModal = false,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const systemScheme = useFastColorScheme();
  const isDark = systemScheme === 'dark';
  const accentColor =
    Colors.BorderGlow[selectedThemeColor as keyof typeof Colors.BorderGlow] || '#11D5F3';
  const [showGroupsView, setShowGroupsView] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(autoOpenCreateModal);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [createModalInitialTab, setCreateModalInitialTab] = useState<'create' | 'join'>('create');
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [showEditExportSheet, setShowEditExportSheet] = useState(false);
  const [activePalGroupDetails, setActivePalGroupDetails] = useState<any | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profileSubMenu, setProfileSubMenu] = useState<'main' | 'editProfile' | 'color' | 'logNotifications' | 'account'>('main');
  const [notificationFreq, setNotificationFreq] = useState<'1hr' | '3hrs' | 'off'>('off');
  const [showViewingPalsGuide, setShowViewingPalsGuide] = useState(false);
  const [inAppBrowserUrl, setInAppBrowserUrl] = useState<string | null>(null);
  const [inAppBrowserTitle, setInAppBrowserTitle] = useState<string>('');
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const homeVideoRef = useRef<Video>(null);
  const [editFirstName, setEditFirstName] = useState(() => {
    const name = user?.displayName || 'apple_user';
    return name.includes('_') ? name.split('_')[0] : name.split(' ')[0] || 'apple';
  });
  const [editLastName, setEditLastName] = useState(() => {
    const name = user?.displayName || 'apple_user';
    return name.includes('_') ? name.split('_').slice(1).join(' ') : name.split(' ').slice(1).join(' ') || 'user';
  });
  const [activeTab, setActiveTab] = useState<'camera' | 'pals'>('pals');
  const [isManualNavLock, setIsManualNavLock] = useState(false);
  const [userPalRooms, setUserPalRooms] = useState<PalRoom[]>([]);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);

  // Load userPalRooms from AsyncStorage on startup so groups never disappear
  useEffect(() => {
    const loadUserPalRooms = async () => {
      try {
        const stored = await AsyncStorage.getItem('@palzee_user_pal_rooms');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setUserPalRooms(parsed);
          }
        }
      } catch (e) {
        console.log('Error loading userPalRooms:', e);
      }
    };
    loadUserPalRooms();
  }, []);

  const handleChoosePhoto = async () => {
    try {
      setShowProfileMenu(false);
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        alert('Permission to access photos is required to update profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProfilePhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error selecting profile photo:', error);
    }
  };

  useEffect(() => {
    if (autoOpenCreateModal) {
      setShowCreateModal(true);
    }
  }, [autoOpenCreateModal]);

  const handleCreateRoom = async (name: string, maxCount: number) => {
    const code = Math.random().toString(36).substring(2, 9).toLowerCase();
    const newRoom: PalRoom = {
      id: Date.now().toString(),
      name,
      maxCount,
      code,
    };
    setUserPalRooms((prev) => {
      const updated = [...prev, newRoom];
      AsyncStorage.setItem('@palzee_user_pal_rooms', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    return { code, name };
  };

  const handleJoinRoom = async (code: string) => {
    const cleanCode = code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const joinedRoom: PalRoom = {
      id: Date.now().toString(),
      name: `Pal ${cleanCode}`,
      maxCount: 10,
      code: cleanCode,
    };
    setUserPalRooms((prev) => {
      const exists = prev.some((r) => r.code === cleanCode);
      const updated = exists ? prev : [...prev, joinedRoom];
      AsyncStorage.setItem('@palzee_user_pal_rooms', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    setShowCreateModal(false);
  };

  // Deep linking handler: Automatically join pal group when opening an invite link
  useEffect(() => {
    const handleDeepLinkUrl = (url: string | null) => {
      if (!url) return;
      try {
        const match = url.match(/join\/([a-zA-Z0-9]+)/i) || url.match(/[?&]code=([a-zA-Z0-9]+)/i);
        if (match && match[1]) {
          const inviteCode = match[1];
          handleJoinRoom(inviteCode);
        }
      } catch (err) {
        console.warn('Error handling deep link:', err);
      }
    };

    Linking.getInitialURL().then(handleDeepLinkUrl);
    const sub = Linking.addEventListener('url', (event) => {
      handleDeepLinkUrl(event.url);
    });
    return () => {
      sub.remove();
    };
  }, []);

  const screenBg = isDark ? '#000000' : Colors.PalBackground;
  const iconColor = isDark ? '#FFFFFF' : Colors.PalTextDark;
  const mainTextColor = isDark ? '#FFFFFF' : Colors.PalTextDark;
  const subtextColor = isDark ? '#8E8E93' : Colors.PalTextMuted;
  const cardBg = isDark ? '#161616' : '#FFFFFF';
  const pillBg = isDark ? '#262626' : 'rgba(255, 255, 255, 0.65)';
  const pillBorder = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.85)';
  const logoTextColor =
    Colors.LogoTextAccent[selectedThemeColor as keyof typeof Colors.LogoTextAccent] ||
    '#310BED';

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const screenWidth = windowWidth > 0 ? windowWidth : 390;
  const screenHeight = windowHeight > 0 ? windowHeight : 844;

  const [cameraTimerMode, setCameraTimerMode] = useState<'off' | '3s' | '5s' | 'timelapse' | 'jump_cut'>('off');
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');

  const tabTransitionAnim = useRef(new Animated.Value(activeTab === 'camera' ? 0 : 1)).current;

  // DEVICE ORIENTATION SENSOR: ONLY SWITCHES ON EXPLICIT HARDWARE LANDSCAPE/PORTRAIT ROTATION
  useEffect(() => {
    const handleOrientation = (orientation: string) => {
      const o = (orientation || '').toUpperCase();
      if (o.includes('LANDSCAPE')) {
        setActiveTab('camera');
      }
    };

    const sub2 = DeviceEventEmitter.addListener('namedOrientationDidChange', (data) => {
      if (data && data.orientation) handleOrientation(data.orientation);
    });
    const sub3 = DeviceEventEmitter.addListener('orientationDidChange', (data) => {
      if (typeof data === 'string') handleOrientation(data);
      else if (data && data.orientation) handleOrientation(data.orientation);
    });

    return () => {
      sub2?.remove();
      sub3?.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(tabTransitionAnim, {
      toValue: activeTab === 'camera' ? 0 : 1,
      duration: 340,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
      useNativeDriver: true,
    }).start();

    if (activeTab === 'pals') {
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      }).then(() => {
        homeVideoRef.current?.playAsync().catch(() => {});
      }).catch(() => {});
    }
  }, [activeTab]);

  // Android hardware back: close the top-most overlay instead of exiting the app. Most sheets here
  // are absolutely-positioned views rather than <Modal>s, so they never receive onRequestClose.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (inAppBrowserUrl) { setInAppBrowserUrl(null); return true; }
      if (showEditNameModal) { setShowEditNameModal(false); return true; }
      if (showViewingPalsGuide) { setShowViewingPalsGuide(false); return true; }
      if (showProfileMenu) {
        if (profileSubMenu !== 'main') setProfileSubMenu('main');
        else setShowProfileMenu(false);
        return true;
      }
      if (showAddMenu) { setShowAddMenu(false); return true; }
      if (showEditExportSheet) { setShowEditExportSheet(false); return true; }
      if (showExportSheet) { setShowExportSheet(false); return true; }
      if (showChatDrawer) { setShowChatDrawer(false); return true; }
      if (showActivityDrawer) { setShowActivityDrawer(false); return true; }
      if (showCreateModal) { setShowCreateModal(false); return true; }
      if (activePalGroupDetails) { setActivePalGroupDetails(null); return true; }
      if (showCamera) { setShowCamera(false); return true; }
      if (showGroupsView) { setShowGroupsView(false); return true; }
      if (activeTab === 'camera') { setActiveTab('pals'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [
    inAppBrowserUrl,
    showEditNameModal,
    showViewingPalsGuide,
    showProfileMenu,
    profileSubMenu,
    showAddMenu,
    showEditExportSheet,
    showExportSheet,
    showChatDrawer,
    showActivityDrawer,
    showCreateModal,
    activePalGroupDetails,
    showCamera,
    showGroupsView,
    activeTab,
  ]);

  // Accelerometer tilt detection for "rotate to capture"
  useEffect(() => {
    let subscription: { remove: () => void } | null = null;

    try {
      // Dynamic safe require to avoid module-load crashes when native sensors are missing
      const Sensors = require('expo-sensors');
      const Accelerometer = Sensors?.Accelerometer;
      if (!Accelerometer || typeof Accelerometer.addListener !== 'function') return;

      Accelerometer.setUpdateInterval(120);

      let isTilted = false;

      subscription = Accelerometer.addListener((data: any) => {
        // Android reports the reaction to gravity (upright y ≈ +1), iOS reports gravity itself
        // (upright y ≈ -1); flip Android so the iOS-calibrated thresholds below apply to both.
        const sign = Platform.OS === 'android' ? -1 : 1;
        const x = sign * (data?.x ?? 0);
        const y = sign * (data?.y ?? 0);
        const z = sign * (data?.z ?? 0);

        // Disable tilt if user manually selected tab via bottom nav bar or if any modal/view is active
        if (
          isManualNavLock ||
          showExportSheet ||
          showEditExportSheet ||
          showChatDrawer ||
          showCamera ||
          showCreateModal ||
          showEditNameModal ||
          showGroupsView ||
          showProfileMenu ||
          showViewingPalsGuide ||
          !!inAppBrowserUrl
        ) {
          return;
        }

        // Smooth omnidirectional tilt detection (sideways left/right, up/down, top/bottom)
        // Measures 3D tilt deviation away from upright portrait vector (0, -1, 0)
        const tiltDev = Math.sqrt(x * x + (y + 1) * (y + 1) + z * z);
        const tiltedNow = tiltDev > 0.55;

        if (tiltedNow && !isTilted) {
          isTilted = true;
          setActiveTab('camera');
        } else if (tiltDev < 0.38 && isTilted) {
          isTilted = false;
          setActiveTab('pals');
        }
      });
    } catch (e) {
      // Safe fallback if native module ExponentAccelerometer is not linked
    }

    return () => {
      subscription?.remove();
    };
  }, [
    isManualNavLock,
    showExportSheet,
    showEditExportSheet,
    showChatDrawer,
    showCamera,
    showCreateModal,
    showEditNameModal,
    showGroupsView,
    showProfileMenu,
    showViewingPalsGuide,
    inAppBrowserUrl,
  ]);

  const toggleTimerMode = () => {
    setCameraTimerMode((current) => {
      if (current === 'off') return '3s';
      if (current === '3s') return '5s';
      if (current === '5s') return 'timelapse';
      if (current === 'timelapse') return 'jump_cut';
      return 'off';
    });
  };

  const toggleFacing = () => {
    setCameraFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const [vlogList, setVlogList] = useState<
    Array<{
      id: string;
      uri: string;
      thumbnailUri?: string;
      needsRotation?: boolean;
      caption?: string;
      timestamp: string;
      displayTime?: string;
      isMuted?: boolean;
      rate?: number;
      mode?: string;
    }>
  >([]);

  const loadCachedVlogs = async () => {
    try {
      const cached = await AsyncStorage.getItem('@palzee_vlog_list');
      if (!cached) return;
      const parsed = JSON.parse(cached);
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      const nowInput = new Date();
      const valid7DayList = parsed.filter((item: any) => {
        const d = item.timestamp ? new Date(item.timestamp) : new Date();
        const validDate = isNaN(d.getTime()) ? new Date() : d;
        const clipShifted = new Date(validDate.getTime() - 4 * 3600 * 1000);
        const nowShifted = new Date(nowInput.getTime() - 4 * 3600 * 1000);
        const clipDayStart = new Date(clipShifted.getFullYear(), clipShifted.getMonth(), clipShifted.getDate()).getTime();
        const nowDayStart = new Date(nowShifted.getFullYear(), nowShifted.getMonth(), nowShifted.getDate()).getTime();
        const diffDays = Math.floor((nowDayStart - clipDayStart) / (24 * 3600 * 1000));
        return diffDays >= 0 && diffDays < 7;
      });

      // 1. Instantly map live URIs and render on frame 1 without delay
      const liveClips = valid7DayList.map((item: any) => ({
        ...item,
        uri: getLiveSandboxUri(item.uri),
        thumbnailUri: item.thumbnailUri ? getLiveSandboxUri(item.thumbnailUri) : '',
      }));
      setVlogList(liveClips);

      // 2. Background verification for deleted files
      const verifiedClips: any[] = [];
      for (const item of liveClips) {
        try {
          const info = await FileSystem.getInfoAsync(item.uri);
          if (info && info.exists) {
            verifiedClips.push(item);
          }
        } catch (e) {
          verifiedClips.push(item);
        }
      }
      if (verifiedClips.length !== parsed.length) {
        AsyncStorage.setItem('@palzee_vlog_list', JSON.stringify(verifiedClips));
      }
    } catch (e) {}
  };

  const [groupClipsMap, setGroupClipsMap] = useState<Record<string, any[]>>({});

  const loadCachedGroupClips = async () => {
    try {
      const cached = await AsyncStorage.getItem('@palzee_group_clips_map');
      if (!cached) return;
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') {
        const liveMapped: Record<string, any[]> = {};
        for (const [key, clips] of Object.entries(parsed)) {
          if (Array.isArray(clips)) {
            liveMapped[key] = clips.map((item: any) => ({
              ...item,
              uri: getLiveSandboxUri(item.uri),
              thumbnailUri: item.thumbnailUri ? getLiveSandboxUri(item.thumbnailUri) : '',
            }));
          }
        }
        setGroupClipsMap(liveMapped);
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadCachedVlogs();
    loadCachedGroupClips();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        loadCachedVlogs();
        loadCachedGroupClips();
        homeVideoRef.current?.playAsync().catch(() => {});
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
  const [selectedDayOffset, setSelectedDayOffset] = useState(0);
  const [homeVlogIndex, setHomeVlogIndex] = useState(0);
  const homeProgressAnim = useRef(new Animated.Value(0)).current;
  const [isHomeVlogVertical, setIsHomeVlogVertical] = useState(true);
  const vlogFadeAnim = useRef(new Animated.Value(1)).current;
  const isHomeVlogAdvancingRef = useRef(false);

  const prevClipUriRef = useRef<string | null>(null);

  useEffect(() => {
    const todayList = getClipsForDayOffset(vlogList, 0);
    const clip = todayList[Math.min(homeVlogIndex, todayList.length - 1)];
    const liveUri = clip?.uri ? getLiveSandboxUri(clip.uri) : null;

    if (liveUri && prevClipUriRef.current && liveUri !== prevClipUriRef.current && homeVideoRef.current) {
      vlogFadeAnim.setValue(0.7);
      Animated.timing(vlogFadeAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      prevClipUriRef.current = liveUri;
      homeVideoRef.current.loadAsync(
        { uri: liveUri },
        {
          shouldPlay: true,
          isLooping: todayList.length === 1,
          positionMillis: 0,
          rate: clip?.rate || 1.0,
          isMuted: !(activeTab === 'pals' && !showExportSheet && !showEditExportSheet && !showChatDrawer && !showCamera && !showCreateModal && !showEditNameModal && !showGroupsView) || (clip?.isMuted ?? false),
        },
        false
      ).then(() => {
        homeVideoRef.current?.playAsync().catch(() => {});
      }).catch(() => {});
    } else if (liveUri && !prevClipUriRef.current) {
      prevClipUriRef.current = liveUri;
    }
  }, [homeVlogIndex, vlogList, activeTab]);

  useEffect(() => {
    if (
      showAddMenu ||
      showProfileMenu ||
      showActivityDrawer ||
      showChatDrawer ||
      showExportSheet ||
      showEditExportSheet ||
      showCreateModal ||
      activeTab !== 'pals'
    ) {
      homeVideoRef.current?.pauseAsync().catch(() => {});
    } else if (activeTab === 'pals') {
      homeVideoRef.current?.playAsync().catch(() => {});
    }
  }, [
    showAddMenu,
    showProfileMenu,
    showActivityDrawer,
    showChatDrawer,
    showExportSheet,
    showEditExportSheet,
    showCreateModal,
    activeTab,
  ]);

  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    rotateAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2333,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      { iterations: -1 }
    );
    loop.start();
  }, []);

  const [homeSaveState, setHomeSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleHomeCardSave = async () => {
    const activeVideoUri = vlogList[homeVlogIndex]?.uri;
    const activeCaption = vlogList[homeVlogIndex]?.caption || '';
    if (!activeVideoUri) return;
    if (homeSaveState === 'saved') {
      setHomeSaveState('idle');
      return;
    }
    if (homeSaveState === 'saving') return;
    setHomeSaveState('saving');
    try {
      if (await ensureMediaSavePermission()) {
        const TargetExporter = VideoExporter;
        if (TargetExporter && TargetExporter.exportRotatedCardVideoOnly) {
          const exportedUri = await TargetExporter.exportRotatedCardVideoOnly(String(activeVideoUri || ''), String(activeCaption || ''));
          if (exportedUri) {
            await MediaLibrary.saveToLibraryAsync(exportedUri);
          } else {
            await MediaLibrary.saveToLibraryAsync(activeVideoUri);
          }
        } else {
          await MediaLibrary.saveToLibraryAsync(activeVideoUri);
        }
        setHomeSaveState('saved');
      } else {
        setHomeSaveState('idle');
      }
    } catch (e) {
      console.log('Home card save error:', e);
      setHomeSaveState('idle');
    }
  };
  useEffect(() => {
    setHomeSaveState('idle');
  }, [homeVlogIndex]);

  const handleVideoSent = async (
    uri: string,
    caption?: string,
    isMuted?: boolean,
    rate?: number,
    mode?: string,
    targets: string[] = ['vlog']
  ) => {
    console.log('🎥 [handleVideoSent] Processing video:', uri, 'targets:', targets);

    let permanentUri = uri;
    let thumbnailUri = '';

    try {
      // 1. Copy video to permanent Documents directory
      const fileName = `vlog_${Date.now()}.${Platform.OS === 'android' ? 'mp4' : 'mov'}`;
      const destPath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.copyAsync({ from: uri, to: destPath });
      permanentUri = destPath;
      console.log('💾 Permanent Video Saved:', permanentUri);

      // 2. Extract thumbnail and persist to permanent Documents directory
      const thumbResultUri = await generateVideoThumbnail(permanentUri);

      if (thumbResultUri) {
        const thumbFileName = `vlog_thumb_${Date.now()}.jpg`;
        const permThumbPath = `${FileSystem.documentDirectory}${thumbFileName}`;
        await FileSystem.copyAsync({ from: thumbResultUri, to: permThumbPath });
        thumbnailUri = permThumbPath;
        console.log('✅ PERMANENT THUMBNAIL CREATED:', thumbnailUri);
      }
    } catch (err) {
      console.error('Thumbnail generation error:', err);
    }

    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedTime = `${hours}:${minutes} ${ampm}`;

    const isPortrait = mode === 'portrait' || mode === 'vertical' || mode === 'off';

    // 3. Payload with guaranteed thumbnailUri
    const newLog = {
      id: Date.now().toString(),
      uri: permanentUri,
      thumbnailUri: thumbnailUri || '',
      needsRotation: isPortrait,
      caption: caption || '',
      timestamp: now.toISOString(),
      displayTime: formattedTime,
      isMuted: isMuted ?? false,
      rate: rate || 1.0,
      mode: mode || 'off',
    };

    console.log('📦 Vlog State Saved:', newLog);

    const isSendToVlog = targets.includes('vlog') || targets.length === 0;
    const groupTargets = targets.filter((t) => t !== 'vlog');

    if (isSendToVlog) {
      setVlogList((prev) => {
        const updated = [newLog, ...prev];
        AsyncStorage.setItem('@palzee_vlog_list', JSON.stringify(updated));
        return updated;
      });
      setHomeVlogIndex(0);
      homeProgressAnim.setValue(0);
    }

    if (groupTargets.length > 0) {
      setGroupClipsMap((prev) => {
        const updated = { ...prev };
        for (const grpId of groupTargets) {
          updated[grpId] = [newLog, ...(updated[grpId] || [])];
        }
        AsyncStorage.setItem('@palzee_group_clips_map', JSON.stringify(updated));
        return updated;
      });
    }

    setShowCamera(false);
    setShowExportSheet(false);
    setShowChatDrawer(false);
    setActiveTab('pals');
  };

  const handleDeleteVideo = async (targetId?: string) => {
    let updatedList: typeof vlogList = [];
    if (targetId) {
      const targetClip = vlogList.find((item) => item.id === targetId);
      if (targetClip) {
        if (targetClip.uri) {
          try { await FileSystem.deleteAsync(getLiveSandboxUri(targetClip.uri), { idempotent: true }); } catch (e) {}
        }
        if (targetClip.thumbnailUri) {
          try { await FileSystem.deleteAsync(getLiveSandboxUri(targetClip.thumbnailUri), { idempotent: true }); } catch (e) {}
        }
      }
      updatedList = vlogList.filter((item) => item.id !== targetId);
    } else {
      for (const item of vlogList) {
        if (item.uri) {
          try { await FileSystem.deleteAsync(getLiveSandboxUri(item.uri), { idempotent: true }); } catch (e) {}
        }
        if (item.thumbnailUri) {
          try { await FileSystem.deleteAsync(getLiveSandboxUri(item.thumbnailUri), { idempotent: true }); } catch (e) {}
        }
      }
      updatedList = [];
    }
    setVlogList(updatedList);
    AsyncStorage.setItem('@palzee_vlog_list', JSON.stringify(updatedList));
    setHomeVlogIndex(0);
  };

  const handleUpdateCaption = async (newCaption: string, targetId?: string) => {
    let updatedList: typeof vlogList = [];
    if (targetId) {
      updatedList = vlogList.map((item) =>
        item.id === targetId ? { ...item, caption: newCaption } : item
      );
    } else {
      if (vlogList.length === 0) return;
      updatedList = vlogList.map((item, index) =>
        index === homeVlogIndex ? { ...item, caption: newCaption } : item
      );
    }

    setVlogList(updatedList);
    AsyncStorage.setItem('@palzee_vlog_list', JSON.stringify(updatedList));
  };

  return (
    <DynamicGlowContainer selectedThemeColor={selectedThemeColor || 'cyan'} showBorder={true}>
      <>
        <CameraPrewarmer />
        <View
          style={[
            styles.container,
            {
              backgroundColor: screenBg,
              paddingTop: activeTab === 'camera' ? Math.max(insets.top, 8) : insets.top,
              paddingBottom: 0,
            },
          ]}
        >
        {/* HORIZONTAL SWIPE VIEW: INDEX 0 = HOME/CAMERA, INDEX 1 = PALS MENU */}
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {/* 1. PERSISTENT LIVE CAMERA PREVIEW LAYER (ALWAYS MOUNTED & READY) */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                paddingTop: Math.max(insets.top, 8),
                paddingBottom: Math.max(insets.bottom, 8) + 60,
                opacity: tabTransitionAnim.interpolate({
                  inputRange: [0, 0.8, 1],
                  outputRange: [1, 0.2, 0],
                }),
                transform: [
                  {
                    scale: tabTransitionAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.94],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents={activeTab === 'camera' ? 'auto' : 'none'}
          >
            <PalCameraPreview
              isActive={activeTab === 'camera'}
              selectedThemeColor={selectedThemeColor}
              timerMode={cameraTimerMode}
              onToggleTimerMode={toggleTimerMode}
              facing={cameraFacing}
              onToggleFacing={toggleFacing}
              autoTickVlog={false}
              palCount={getClipsForDayOffset(vlogList, 0).length}
              palGroups={userPalRooms.map((r: PalRoom) => {
                const currentFirstName = user?.displayName ? user.displayName.split(' ')[0] : (user?.email?.split('@')[0] || 'apple_user');
                const memberFirstNames = (r.members && r.members.length > 0)
                  ? r.members.map((m) => m.split(' ')[0])
                  : [currentFirstName];

                const groupClips = groupClipsMap[r.code] || groupClipsMap[r.name] || [];
                const latestClip = groupClips[0];
                let isCooldownActive = false;
                let cooldownRemainingMinutes = 0;
                let lastSentHourText = '';
                if (latestClip) {
                  const clipDate = parseToDate(
                    latestClip.timestamp ||
                    latestClip.createdAt ||
                    latestClip.date ||
                    (typeof latestClip.id === 'string' && /^\d{13}$/.test(latestClip.id) ? Number(latestClip.id) : null)
                  );
                  if (clipDate && !isNaN(clipDate.getTime())) {
                    const elapsed = Date.now() - clipDate.getTime();
                    if (elapsed < 3600 * 1000 && elapsed >= 0) {
                      isCooldownActive = true;
                      cooldownRemainingMinutes = Math.ceil((3600 * 1000 - elapsed) / 60000);
                      const hours = clipDate.getHours().toString().padStart(2, '0');
                      lastSentHourText = `${hours}:00`;
                    }
                  }
                }

                return {
                  id: r.code,
                  name: r.name,
                  members: memberFirstNames,
                  size: memberFirstNames.length,
                  maxCount: r.maxCount || 5,
                  isCooldownActive,
                  cooldownRemainingMinutes,
                  lastSentHourText,
                  lastSentTimestamp: latestClip?.timestamp,
                };
              })}
              onCaptureSuccess={(uri, caption, isMuted, rate, mode, targets) => handleVideoSent(uri, caption, isMuted, rate, mode, targets)}
            />
          </Animated.View>

        {/* 2. PALS MENU / FEED SLIDING OVERLAY LAYER */}
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: screenBg,
            opacity: tabTransitionAnim.interpolate({
              inputRange: [0, 0.25, 1],
              outputRange: [0, 0.5, 1],
            }),
            transform: [
              {
                translateX: tabTransitionAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [screenWidth, 0],
                }),
              },
            ],
          }}
          pointerEvents={activeTab === 'pals' ? 'auto' : 'none'}
        >
          {/* TOP HEADER: PALZEE LOGO & RIGHT CIRCLE ICONS */}
          <View style={styles.topHeader}>
            <Text
              style={[
                styles.palzeeLogoText,
                {
                  color: logoTextColor,
                },
              ]}
            >
              PALZEE
            </Text>

            <View style={styles.headerRightIcons}>
              {/* 1. PLUS BUTTON (+ Icon) */}
              <LiquidGlassIconButton idPrefix="btnPlus" isDark={isDark} onPress={() => setShowAddMenu(true)}>
                <LucidePlus size={30} color={iconColor} strokeWidth={1.8} />
              </LiquidGlassIconButton>

              {/* 2. NOTIFICATION BELL ICON */}
              <LiquidGlassIconButton idPrefix="btnBell" isDark={isDark} onPress={() => setShowActivityDrawer(true)}>
                <LucideBell size={30} color={iconColor} strokeWidth={1.8} />
              </LiquidGlassIconButton>

              {/* 3. USER PROFILE PERSON ICON OR CHOSEN PFP */}
              <LiquidGlassIconButton
                idPrefix="btnUser"
                isDark={isDark}
                onPress={() => {
                  setProfileSubMenu('main');
                  setShowProfileMenu(true);
                }}
              >
                {profilePhotoUri ? (
                  <Image
                    source={{ uri: profilePhotoUri }}
                    style={{ width: 30, height: 30, borderRadius: 15 }}
                    contentFit="cover"
                  />
                ) : (
                  <MaterialPersonIcon size={30} color={iconColor} />
                )}
              </LiquidGlassIconButton>
            </View>
          </View>

          <ScrollView style={StyleSheet.absoluteFill} contentContainerStyle={{ paddingTop: 52.5, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
            <View style={styles.vlogFeedSection}>
              {/* ROTATE TO CAPTURE HEADER ROW (DISPLAYED BY DEFAULT ON HOMESCREEN ALWAYS ABOVE VLOG BOX) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -12.5, marginBottom: 6, paddingLeft: 4 }}>
                <Animated.View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: Colors.BorderGlow[selectedThemeColor as keyof typeof Colors.BorderGlow] || '#FE9068',
                    justifyContent: 'center',
                    alignItems: 'center',
                    overflow: 'hidden',
                    transform: [
                      {
                        rotate: rotateAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                    ],
                  }}
                >
                  <Image
                    source={require('../../assets/images/custom_rotate_smiley.png')}
                    style={{ width: 15.5, height: 15.5, tintColor: '#000000' }}
                    contentFit="contain"
                  />
                </Animated.View>
                <Text style={{ fontSize: 16, color: isDark ? '#8E8E93' : '#636366', fontFamily: Fonts.SystemRoundedMedium }}>
                  rotate to capture
                </Text>
              </View>

              {/* IF VIDEO IS SENT TO VLOG: ENLARGED 16:9 VLOG CARD */}
              {(() => {
                const todayVlogList = getClipsForDayOffset(vlogList, 0);
                if (todayVlogList.length === 0 || !todayVlogList[homeVlogIndex]?.uri) return null;

                const activeTodayClip = todayVlogList[Math.min(homeVlogIndex, todayVlogList.length - 1)];
                const isClipVertical = activeTodayClip?.mode === 'landscape' ? false : true;

                const currentVideoLiveUri = getLiveSandboxUri(activeTodayClip?.uri);
                const currentThumbLiveUri = getLiveSandboxUri(activeTodayClip?.thumbnailUri);

                const cardWidth = screenWidth - 20;
                const cardHeight = cardWidth * (9.5 / 16) + 20;
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

                const isHomeScreenActive =
                  activeTab === 'pals' &&
                  !activePalGroupDetails &&
                  !showExportSheet &&
                  !showEditExportSheet &&
                  !showChatDrawer &&
                  !showActivityDrawer &&
                  !showCamera &&
                  !showCreateModal &&
                  !showAddMenu &&
                  !showProfileMenu &&
                  !showEditNameModal &&
                  !showGroupsView &&
                  !showViewingPalsGuide &&
                  !inAppBrowserUrl;

                return (
                  <View style={{ width: '100%', marginBottom: 16 }}>
                    {/* SCALED UP 16:9 VLOG CARD */}
                    <TouchableOpacity
                      style={{
                        width: '100%',
                        height: cardHeight,
                        borderRadius: 28,
                        overflow: 'hidden',
                        position: 'relative',
                        backgroundColor: '#000000',
                        alignSelf: 'center',
                      }}
                      activeOpacity={0.9}
                      onPress={() => setShowExportSheet(true)}
                    >
                      <Video
                        ref={homeVideoRef}
                        source={{ uri: currentVideoLiveUri }}
                        style={isClipVertical ? rotatedStyle : StyleSheet.absoluteFill}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={isHomeScreenActive}
                        isLooping={todayVlogList.length === 1}
                        isMuted={!isHomeScreenActive || (activeTodayClip?.isMuted ?? false)}
                        rate={activeTodayClip?.rate || 1.0}
                        shouldCorrectPitch={true}
                        useNativeControls={false}
                        progressUpdateIntervalMillis={16}
                        onLoad={() => {
                          if (isHomeScreenActive) {
                            homeVideoRef.current?.playAsync().catch(() => {});
                          }
                        }}
                        onPlaybackStatusUpdate={(status) => {
                          if (status.isLoaded) {
                            if (status.durationMillis && status.durationMillis > 0) {
                              const p = Math.min(Math.max(status.positionMillis / status.durationMillis, 0), 1);
                              homeProgressAnim.setValue(p);
                            }
                            if (
                              status.didJustFinish &&
                              !isHomeVlogAdvancingRef.current &&
                              status.positionMillis > 300
                            ) {
                              isHomeVlogAdvancingRef.current = true;
                              setTimeout(() => {
                                isHomeVlogAdvancingRef.current = false;
                              }, 200);
                              homeProgressAnim.setValue(0);
                              if (todayVlogList.length > 1) {
                                setHomeVlogIndex((prev) => (prev + 1) % todayVlogList.length);
                              } else {
                                homeVideoRef.current?.setPositionAsync(0).then(() => {
                                  homeVideoRef.current?.playAsync();
                                }).catch(() => {});
                              }
                            }
                          }
                        }}
                        onReadyForDisplay={() => {
                          if (isHomeScreenActive) {
                            homeVideoRef.current?.playAsync().catch(() => {});
                          }
                        }}
                      />
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.15)' }]} pointerEvents="none" />

                      {/* CENTER OVERLAY: VLOG (LEFT) | CAPTION (CENTER) | TIMESTAMP (RIGHT) */}
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
                          zIndex: 10,
                        }}
                        pointerEvents="none"
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 25, fontFamily: Fonts.SystemRoundedBold }}>
                          vlog
                        </Text>
                        {!!activeTodayClip?.caption && (
                          <Text style={{ color: '#FFFFFF', fontSize: 25, fontFamily: Fonts.SystemRoundedBold }}>
                            {activeTodayClip?.caption}
                          </Text>
                        )}
                        <Text style={{ color: '#FFFFFF', fontSize: 20, fontFamily: Fonts.SystemRoundedSemibold }}>
                          {getNearestHourText(activeTodayClip?.timestamp || activeTodayClip?.displayTime)}
                        </Text>
                      </View>

                      {/* BOTTOM CENTER: HORIZONTAL SEGMENTED PROGRESSIVE SEEK BAR */}
                      {todayVlogList.length > 0 && (
                        <View
                          style={{
                            position: 'absolute',
                            bottom: 20,
                            alignSelf: 'center',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            zIndex: 15,
                          }}
                          pointerEvents="none"
                        >
                          {todayVlogList.map((_, index) => {
                            const isCurrent = index === homeVlogIndex;
                            const isPast = index < homeVlogIndex;
                            const barWidth = todayVlogList.length === 1 ? 32 : 24;

                            return (
                              <View
                                key={index}
                                style={{
                                  width: barWidth,
                                  height: 3.5,
                                  borderRadius: 2,
                                  backgroundColor: 'rgba(255, 255, 255, 0.40)',
                                  overflow: 'hidden',
                                }}
                              >
                                <Animated.View
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    backgroundColor: '#FFFFFF',
                                    borderRadius: 2,
                                    transform: [
                                      {
                                        translateX: isCurrent
                                          ? homeProgressAnim.interpolate({
                                              inputRange: [0, 1],
                                              outputRange: [-barWidth, 0],
                                              extrapolate: 'clamp',
                                            })
                                          : isPast
                                          ? 0
                                          : -barWidth,
                                      },
                                    ],
                                  }}
                                />
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {/* BOTTOM RIGHT: SAVE BUTTON */}
                      <TouchableOpacity
                        style={{
                        position: 'absolute',
                        bottom: 12,
                        right: 14,
                        padding: 6,
                        zIndex: 20,
                      }}
                      activeOpacity={0.7}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleHomeCardSave();
                      }}
                    >
                      {homeSaveState === 'saving' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons
                          name={homeSaveState === 'saved' ? 'checkmark' : 'download-outline'}
                          size={22}
                          color="#FFFFFF"
                        />
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              );
            })()}

            {/* DEFAULT STAR-DOODLE VLOG CARD (WHEN NO VIDEO SENT FOR TODAY'S 4 AM CYCLE) */}
            {getClipsForDayOffset(vlogList, 0).length === 0 && (
              <TouchableOpacity
                style={[
                  styles.vlogCard,
                  {
                    width: '100%',
                    alignSelf: 'center',
                    backgroundColor: isDark ? '#161616' : '#F5F5F7',
                    overflow: 'hidden',
                    position: 'relative',
                  },
                ]}
                activeOpacity={0.9}
                onPress={() => setShowExportSheet(true)}
              >
                <View style={styles.vlogTextSection}>
                  <Text style={[styles.vlogTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                    vlog
                  </Text>
                  <Text style={[styles.vlogSubtext, { color: '#8E8E93' }]}>
                    your space. Each day runs 4am{'\n'}to 4am.
                  </Text>
                </View>

                <Image
                  source={require('../../assets/images/dm_star_4.png')}
                  style={styles.starDoodleImage}
                  contentFit="contain"
                />
              </TouchableOpacity>
            )}

              {/* 2. ADDITIONAL PAL ROOM CARDS (EXACT MATCH TO REFERENCE SCREENSHOTS) */}
              {userPalRooms.map((room) => (
                <TouchableOpacity
                  key={room.id}
                  style={[
                    styles.palGroupCard,
                    {
                      width: '100%',
                      alignSelf: 'center',
                      backgroundColor: isDark ? '#161616' : '#F5F5F7',
                    },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => setActivePalGroupDetails(room)}
                >
                  {/* Left: Group Name */}
                  <Text style={[styles.palGroupTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                    {room.name}
                  </Text>

                  {/* Right: Actions Cluster (Circular Outline Smiley | Camera) */}
                  <View style={styles.palGroupActionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setActivePalGroupDetails(room)}
                      style={[
                        styles.smileyCircleOutline,
                        {
                          backgroundColor: isDark ? '#5C5C5E' : '#FFFFFF',
                        },
                      ]}
                    >
                      <Image
                        source={require('../../assets/images/custom_rotate_smiley.png')}
                        style={[
                          styles.palGroupSmileyIcon,
                          {
                            tintColor: '#000000',
                          },
                        ]}
                        contentFit="contain"
                      />
                    </TouchableOpacity>

                    <View
                      style={[
                        styles.palGroupDivider,
                        { backgroundColor: isDark ? '#2C2C2E' : '#D1D1D6' },
                      ]}
                    />

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setActiveTab('camera')}
                    >
                      <Image
                        source={require('../../assets/images/camera_list_icon.png')}
                        style={[styles.palGroupActionIcon, { tintColor: isDark ? '#5C5C5E' : '#FFFFFF' }]}
                        contentFit="contain"
                      />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
                {/* INSTRUCTION STEPS, DAY RESET BLOB & DOODLE FOOTER (DISAPPEARS WHEN VIDEO SENT TO VLOG) */}
                {vlogList.length === 0 && (
                  <>
                    <View style={styles.instructionsContainer}>
                      <Text style={[styles.sideBySideHeader, { color: mainTextColor }]}>
                        your day, side by side.
                      </Text>

                      {/* STEP 1 */}
                      <View style={styles.stepRow}>
                        <View
                          style={[
                            styles.stepBadge,
                            { backgroundColor: isDark ? '#FFFFFF' : '#1A1A1A' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.stepBadgeText,
                              { color: isDark ? '#000000' : '#FFFFFF' },
                            ]}
                          >
                            1
                          </Text>
                        </View>
                        <View style={styles.stepContent}>
                          <Text style={[styles.stepTitle, { color: mainTextColor }]}>
                            tap <Text style={styles.plusSymbolText}>⊕</Text> to start
                          </Text>

                          <View style={styles.pillActionRow}>
                            <LiquidGlassPillButton
                              idPrefix="pillCreate"
                              text="create pal"
                              isDark={isDark}
                              textColor={mainTextColor}
                              onPress={() => {
                                setCreateModalInitialTab('create');
                                setShowCreateModal(true);
                              }}
                            />
                            <Text style={[styles.actionHintText, { color: mainTextColor }]}>
                              (new group)
                            </Text>
                          </View>

                          <View style={[styles.pillActionRow, { marginTop: 8 }]}>
                            <LiquidGlassPillButton
                              idPrefix="pillJoin"
                              text="join pal"
                              isDark={isDark}
                              textColor={mainTextColor}
                              onPress={() => {
                                setCreateModalInitialTab('join');
                                setShowCreateModal(true);
                              }}
                            />
                            <Text style={[styles.actionHintText, { color: mainTextColor }]}>
                              (with a code)
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* STEP 2 */}
                      <View style={[styles.stepRow, { marginTop: 24 }]}>
                        <View
                          style={[
                            styles.stepBadge,
                            { backgroundColor: isDark ? '#FFFFFF' : '#1A1A1A' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.stepBadgeText,
                              { color: isDark ? '#000000' : '#FFFFFF' },
                            ]}
                          >
                            2
                          </Text>
                        </View>
                        <View style={styles.stepContent}>
                          <Text style={[styles.stepTitle, { color: mainTextColor }]}>
                            add a 2s clip every hour.
                          </Text>
                          <Text style={[styles.stepSubtext, { color: mainTextColor }]}>
                            see everyone's day come together.
                          </Text>
                          <Text style={[styles.stepSubtext, { color: mainTextColor }]}>
                            solo pals don't have limits.
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* DAY RESET PAINTED BLOB CONTAINER */}
                    <ImageBackground
                      source={
                        isDark
                          ? require('../../assets/images/blob_dark.png')
                          : require('../../assets/images/blob_light.png')
                      }
                      style={styles.blobContainer}
                      resizeMode="contain"
                    >
                      <Text style={[styles.resetTitle, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>
                        day resets at{' '}
                        <Text style={{ fontFamily: Fonts.DelaGothicOne, fontSize: 20 }}>4</Text>
                        AM.
                      </Text>
                      <Text style={[styles.resetSubtext, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>
                        find past days in history.
                      </Text>
                    </ImageBackground>

                    {/* BOTTOM UFO & TURTLE DOODLE */}
                    <View style={styles.doodleFooter}>
                      <Image
                        source={require('../../assets/images/ufo_turtle.png')}
                        style={styles.ufoTurtleImage}
                        contentFit="contain"
                      />
                      <View style={styles.groundLine} />
                    </View>
                  </>
                )}
          </ScrollView>
        </Animated.View>
      </View>

        {/* 3. UNIFIED BOTTOM LIQUID GLASS NAVIGATION BAR */}
        <View style={styles.unifiedBottomRow}>
          {/* LEFT TIMER BUTTON (CAMERA TAB ONLY, SMOOTH FADE) */}
          <Animated.View
            style={{
              opacity: tabTransitionAnim.interpolate({
                inputRange: [0, 0.4, 1],
                outputRange: [1, 0.2, 0],
              }),
            }}
            pointerEvents={activeTab === 'camera' ? 'auto' : 'none'}
          >
            <LiquidGlassIconButton
              idPrefix="btnCameraTimer"
              isDark={isDark}
              onPress={toggleTimerMode}
            >
              {cameraTimerMode === '3s' ? (
                <Svg width={30} height={30} viewBox="0 0 24 24" style={{ transform: [{ rotate: '90deg' }] }}>
                  <Circle cx="12" cy="12" r="9.5" stroke={iconColor} strokeWidth="1.8" fill="none" />
                  <SvgText
                    x="12"
                    y="15.8"
                    fontSize="11"
                    fontWeight="bold"
                    fill={iconColor}
                    textAnchor="middle"
                    fontFamily="System"
                  >
                    3
                  </SvgText>
                </Svg>
              ) : cameraTimerMode === '5s' ? (
                <Svg width={30} height={30} viewBox="0 0 24 24" style={{ transform: [{ rotate: '90deg' }] }}>
                  <Circle cx="12" cy="12" r="9.5" stroke={iconColor} strokeWidth="1.8" fill="none" />
                  <SvgText
                    x="12"
                    y="15.8"
                    fontSize="11"
                    fontWeight="bold"
                    fill={iconColor}
                    textAnchor="middle"
                    fontFamily="System"
                  >
                    5
                  </SvgText>
                </Svg>
              ) : cameraTimerMode === 'timelapse' ? (
                <Svg width={30} height={30} viewBox="0 0 24 24" style={{ transform: [{ rotate: '90deg' }] }}>
                  {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => {
                    const rad = (deg * Math.PI) / 180;
                    const x1 = 12 + 5.5 * Math.cos(rad);
                    const y1 = 12 + 5.5 * Math.sin(rad);
                    const x2 = 12 + 9 * Math.cos(rad);
                    const y2 = 12 + 9 * Math.sin(rad);
                    return (
                      <Path
                        key={i}
                        d={`M${x1},${y1} L${x2},${y2}`}
                        stroke={iconColor}
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    );
                  })}
                </Svg>
              ) : cameraTimerMode === 'jump_cut' ? (
                <Ionicons name="cut-outline" size={30} color={iconColor} style={{ transform: [{ rotate: '90deg' }] }} />
              ) : (
                <Image
                  source={require('../../assets/images/custom_timer_icon.png')}
                  style={{ width: 30, height: 30, tintColor: iconColor, transform: [{ rotate: '90deg' }] }}
                  contentFit="contain"
                />
              )}
            </LiquidGlassIconButton>
          </Animated.View>

          {/* CENTER TAB SWITCHER (CAMERA / PALS) */}
          <LiquidGlassNavPillBar
            activeTab={activeTab}
            onSelectTab={(t) => {
              if (t === 'camera') {
                setIsManualNavLock(true);
              } else {
                setIsManualNavLock(false);
              }
              setActiveTab(t);
            }}
            isDark={isDark}
            accentColor={accentColor}
          />

          {/* RIGHT CAMERA ROTATE BUTTON (CAMERA TAB ONLY, SMOOTH FADE) */}
          <Animated.View
            style={{
              opacity: tabTransitionAnim.interpolate({
                inputRange: [0, 0.4, 1],
                outputRange: [1, 0.2, 0],
              }),
            }}
            pointerEvents={activeTab === 'camera' ? 'auto' : 'none'}
          >
            <LiquidGlassIconButton
              idPrefix="btnCameraFlip"
              isDark={isDark}
              onPress={toggleFacing}
            >
              <Image
                source={require('../../assets/images/custom_flip_icon.png')}
                style={{ width: 35, height: 35, tintColor: iconColor }}
                contentFit="contain"
              />
            </LiquidGlassIconButton>
          </Animated.View>
        </View>

        {/* EXACT LIQUID GLASS ADD DROPDOWN MENU MATCHING ATTACHED REFERENCE IMAGE */}
        <Modal
          visible={showAddMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAddMenu(false)}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'transparent' }}
            activeOpacity={1}
            onPress={() => setShowAddMenu(false)}
          >
            <TouchableWithoutFeedback>
              <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
                <View
                  style={[
                    styles.addDropdownCard,
                    {
                      top: insets.top + 1,
                      right: 130,
                      backgroundColor: 'transparent',
                      shadowColor: '#000000',
                    },
                  ]}
                >
                  {/* 1. FROSTED BACKDROP BLUR */}
                  <BlurView
                    key={`blur_add_${isDark ? 'dark' : 'light'}`}
                    intensity={Platform.OS === 'ios' ? 65 : 45}
                    tint={isDark ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFill}
                  />

                  {/* 2. INNER SLANTING DIAGONAL FROSTED GRADIENT */}
                  <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
                    <Defs>
                      <LinearGradient
                        id="addMenuSlantingFrostedGlow"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.16 : 0.65} />
                        <Stop offset="45%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.06 : 0.28} />
                        <Stop offset="100%" stopColor={isDark ? '#000000' : '#FFFFFF'} stopOpacity={isDark ? 0.20 : 0.05} />
                      </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" fill="url(#addMenuSlantingFrostedGlow)" />
                  </Svg>

                  {/* 3. SPECULAR RIM HIGHLIGHT */}
                  <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
                    <Defs>
                      <LinearGradient id="addMenuRim" x1="0%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.45 : 0.85} />
                        <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.15 : 0.40} />
                        <Stop offset="100%" stopColor={isDark ? '#FFFFFF' : '#000000'} stopOpacity={isDark ? 0.05 : 0.06} />
                      </LinearGradient>
                    </Defs>
                    <Rect
                      x="0.75"
                      y="0.75"
                      width="99.2%"
                      height="98.5%"
                      rx="25.25"
                      ry="25.25"
                      fill="none"
                      stroke="url(#addMenuRim)"
                      strokeWidth={1.0}
                    />
                  </Svg>

                  {/* ADD MENU ITEMS LIST */}
                  <View style={{ paddingTop: 11.5, paddingBottom: 12.0, paddingLeft: 20.0, paddingRight: 12 }}>
                    {/* Option 1: create a pal */}
                    <TouchableOpacity
                      style={{ paddingVertical: 7.5 }}
                      activeOpacity={0.7}
                      onPress={() => {
                        setShowAddMenu(false);
                        setCreateModalInitialTab('create');
                        setShowCreateModal(true);
                      }}
                    >
                      <Text style={[styles.addMenuText, { color: isDark ? '#FFFFFF' : '#000000', fontFamily: Fonts.SystemRoundedSemibold }]}>
                        create a pal
                      </Text>
                    </TouchableOpacity>

                    {/* Option 2: join a pal */}
                    <TouchableOpacity
                      style={{ paddingVertical: 7.5 }}
                      activeOpacity={0.7}
                      onPress={() => {
                        setShowAddMenu(false);
                        setCreateModalInitialTab('join');
                        setShowCreateModal(true);
                      }}
                    >
                      <Text style={[styles.addMenuText, { color: isDark ? '#FFFFFF' : '#000000', fontFamily: Fonts.SystemRoundedSemibold }]}>
                        join a pal
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>

        {/* EXACT LIQUID GLASS PROFILE DROPDOWN MENU MATCHING REFERENCE IMAGES */}
        <Modal
          visible={showProfileMenu}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowProfileMenu(false);
            setProfileSubMenu('main');
          }}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'transparent' }}
            activeOpacity={1}
            onPress={() => {
              setShowProfileMenu(false);
              setProfileSubMenu('main');
            }}
          >
            <TouchableWithoutFeedback>
              <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
                <View
                  style={[
                    styles.profileDropdownCard,
                    {
                      top: insets.top + 2,
                      right: 10,
                      backgroundColor: 'transparent',
                      shadowColor: '#000000',
                    },
                  ]}
                >
                  <View
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      borderRadius: 24,
                      overflow: 'hidden',
                      backgroundColor: isDark ? 'rgba(32, 28, 44, 0.88)' : 'rgba(255, 255, 255, 0.94)',
                    }}
                  >
                    {/* 1. FROSTED GLASS BACKDROP BLUR */}
                    <BlurView
                      key={`blur_profile_${isDark ? 'dark' : 'light'}`}
                      intensity={Platform.OS === 'ios' ? 80 : 50}
                      tint={isDark ? 'dark' : 'light'}
                      style={StyleSheet.absoluteFill}
                    />

                    {/* 2. INNER DIAGONAL AMBIENT THEME GLOW (MATCHING EDIT PROFILE SUBMENU EXACTLY) */}
                    <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
                      <Defs>
                        <LinearGradient
                          id="dropdownDiagonalGlow"
                          x1="100%"
                          y1="0%"
                          x2="0%"
                          y2="100%"
                        >
                          <Stop offset="0%" stopColor={accentColor} stopOpacity={isDark ? 0.625 : 0.21} />
                          <Stop offset="40%" stopColor={accentColor} stopOpacity={isDark ? 0.35 : 0.116} />
                          <Stop offset="75%" stopColor={accentColor} stopOpacity={isDark ? 0.125 : 0.042} />
                          <Stop offset="100%" stopColor={accentColor} stopOpacity={isDark ? 0.04 : 0.015} />
                        </LinearGradient>
                      </Defs>
                      <Rect width="100%" height="100%" fill="url(#dropdownDiagonalGlow)" />
                    </Svg>

                    {/* 3. SPECULAR RIM GRADIENT HIGHLIGHT */}
                    <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
                      <Defs>
                        <LinearGradient
                          id="profileRimGrad"
                          x1="0%"
                          y1="0%"
                          x2="0%"
                          y2="100%"
                        >
                          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.45 : 0.85} />
                          <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.15 : 0.40} />
                          <Stop offset="100%" stopColor={isDark ? '#FFFFFF' : '#000000'} stopOpacity={isDark ? 0.05 : 0.08} />
                        </LinearGradient>
                      </Defs>
                      <Rect
                        x="0.75"
                        y="0.75"
                        width="99.2%"
                        height="99.0%"
                        rx="23.25"
                        ry="23.25"
                        fill="none"
                        stroke="url(#profileRimGrad)"
                        strokeWidth={1.2}
                      />
                    </Svg>
                  </View>

                {/* BASE CARD HEADER: UPRIGHT SMILEY AVATAR OR CHOSEN PFP + USERNAME (DIMMED FOR EDIT PROFILE, HIDDEN FOR COLOR) */}
                <View
                  style={[
                    styles.dropdownHeaderRow,
                    {
                      opacity: profileSubMenu === 'color' ? 0.0 : profileSubMenu === 'editProfile' ? 0.40 : 1.0,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: accentColor,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                      overflow: 'hidden',
                    }}
                  >
                    {profilePhotoUri ? (
                      <Image
                        source={{ uri: profilePhotoUri }}
                        style={{ width: 31.6, height: 31.6, borderRadius: 15.8 }}
                        contentFit="cover"
                      />
                    ) : (
                      <Image
                        source={require('../../assets/images/capture_smile.png')}
                        style={{ width: 31.8, height: 31.8 }}
                        contentFit="contain"
                      />
                    )}
                  </View>

                  <Text style={[styles.dropdownUsernameText, { color: isDark ? '#FFFFFF' : '#1C1C1E' }]}>
                    {user?.authProvider === 'apple' || user?.displayName === 'apple_user'
                      ? 'apple_user'
                      : user?.displayName || 'apple_user'}
                  </Text>
                </View>

                {/* MAIN MENU OPTIONS (DIMMED FOR SUB-MENUS, HIDDEN FOR COLOR) */}
                <View
                  style={[
                    styles.dropdownMenuList,
                    {
                      opacity: profileSubMenu === 'color' ? 0.0 : profileSubMenu !== 'main' ? 0.40 : 1.0,
                    },
                  ]}
                >
                  {/* Option 1: edit profile */}
                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    activeOpacity={0.7}
                    onPress={() => setProfileSubMenu('editProfile')}
                  >
                    <View style={styles.dropdownMenuLeft}>
                      <Ionicons name="person-outline" size={20} color={isDark ? '#FFFFFF' : '#1C1C1E'} />
                      <Text style={[styles.dropdownMenuText, { color: isDark ? '#FFFFFF' : '#1C1C1E' }]}>
                        edit profile
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'} />
                  </TouchableOpacity>

                  {/* Option 2: log notifications */}
                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    activeOpacity={0.7}
                    onPress={() => setProfileSubMenu('logNotifications')}
                  >
                    <View style={styles.dropdownMenuLeft}>
                      <Ionicons name="notifications-outline" size={20} color={isDark ? '#FFFFFF' : '#1C1C1E'} />
                      <Text style={[styles.dropdownMenuText, { color: isDark ? '#FFFFFF' : '#1C1C1E' }]}>
                        log notifications
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'} />
                  </TouchableOpacity>

                  {/* Option 3: account */}
                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    activeOpacity={0.7}
                    onPress={() => setProfileSubMenu('account')}
                  >
                    <View style={styles.dropdownMenuLeft}>
                      <Ionicons name="person-circle-outline" size={20} color={isDark ? '#FFFFFF' : '#1C1C1E'} />
                      <Text style={[styles.dropdownMenuText, { color: isDark ? '#FFFFFF' : '#1C1C1E' }]}>
                        account
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'} />
                  </TouchableOpacity>

                  {/* Option 4: feedback */}
                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      setShowProfileMenu(false);
                      setProfileSubMenu('main');
                      setInAppBrowserTitle('feedback');
                      setInAppBrowserUrl('https://palzee.fun/feedback.html');
                    }}
                  >
                    <View style={styles.dropdownMenuLeft}>
                      <Ionicons name="add-circle-outline" size={20} color={isDark ? '#FFFFFF' : '#1C1C1E'} />
                      <Text style={[styles.dropdownMenuText, { color: isDark ? '#FFFFFF' : '#1C1C1E' }]}>
                        feedback
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Option 5: guide */}
                  <TouchableOpacity
                    style={styles.dropdownMenuItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      setShowProfileMenu(false);
                      setProfileSubMenu('main');
                      setActiveTab('pals');
                      setShowViewingPalsGuide(true);
                    }}
                  >
                    <View style={styles.dropdownMenuLeft}>
                      <Ionicons name="help-circle-outline" size={20} color={isDark ? '#FFFFFF' : '#1C1C1E'} />
                      <Text style={[styles.dropdownMenuText, { color: isDark ? '#FFFFFF' : '#1C1C1E' }]}>
                        guide
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* OVERLAPPING SUB-DROPDOWN CARD ("DROPDOWN IN DROPDOWN") */}
              {(profileSubMenu === 'editProfile' || profileSubMenu === 'color') && (
                <View
                  style={[
                    styles.profileSubDropdownCard,
                    {
                      top: insets.top + 48,
                      backgroundColor: isDark ? 'rgba(32, 28, 44, 0.88)' : 'rgba(255, 255, 255, 0.94)',
                      shadowColor: isDark ? accentColor : 'rgba(138, 43, 226, 0.30)',
                    },
                  ]}
                >
                  <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />

                  <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
                    <Defs>
                      <LinearGradient id="subDropdownDiagonalGlow" x1="100%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor={accentColor} stopOpacity={isDark ? 0.625 : 0.21} />
                        <Stop offset="40%" stopColor={accentColor} stopOpacity={isDark ? 0.35 : 0.116} />
                        <Stop offset="75%" stopColor={accentColor} stopOpacity={isDark ? 0.125 : 0.042} />
                        <Stop offset="100%" stopColor={accentColor} stopOpacity={isDark ? 0.04 : 0.015} />
                      </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" fill="url(#subDropdownDiagonalGlow)" />
                  </Svg>

                  {/* SMOOTH SLANTING EDGE HIGHLIGHT ON TOP-RIGHT SIDES */}
                  <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
                    <Defs>
                      <LinearGradient id="subCardBorderGradient" x1="100%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor={isDark ? accentColor : '#FFFFFF'} stopOpacity={isDark ? 0.50 : 0.80} />
                        <Stop offset="45%" stopColor={isDark ? accentColor : '#FFFFFF'} stopOpacity={isDark ? 0.22 : 0.38} />
                        <Stop offset="100%" stopColor={isDark ? '#FFFFFF' : '#FFFFFF'} stopOpacity={isDark ? 0.06 : 0.10} />
                      </LinearGradient>
                    </Defs>
                    <Rect x="1" y="1" width="99.1%" height="99.1%" rx="23" ry="23" fill="none" stroke="url(#subCardBorderGradient)" strokeWidth="1.0" />
                  </Svg>

                  {/* Sub-Card Header Row: edit profile + down chevron v (DIMMED WHEN COLOR MENU IS ACTIVE) */}
                  <TouchableOpacity
                    style={[styles.dropdownHeaderRow, { opacity: profileSubMenu === 'color' ? 0.35 : 1.0 }]}
                    activeOpacity={0.7}
                    onPress={() => setProfileSubMenu('main')}
                  >
                    <View style={styles.dropdownMenuLeft}>
                      <Ionicons name="person-outline" size={20} color={isDark ? '#FFFFFF' : '#1C1C1E'} />
                      <Text style={[styles.dropdownUsernameText, { color: isDark ? '#FFFFFF' : '#1C1C1E', marginLeft: 10 }]}>
                        edit profile
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={17} color={isDark ? '#FFFFFF' : '#1C1C1E'} />
                  </TouchableOpacity>

                  {/* Hairline Separator Line */}
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)',
                      marginHorizontal: 16,
                      marginTop: 4,
                      marginBottom: 12,
                      opacity: profileSubMenu === 'color' ? 0.35 : 1.0,
                    }}
                  />

                  {/* Edit Profile Sub-Menu Items List (DIMMED WHEN COLOR MENU IS ACTIVE) */}
                  <View style={[styles.dropdownMenuList, { paddingTop: 4, paddingBottom: 16, opacity: profileSubMenu === 'color' ? 0.35 : 1.0 }]}>
                    {/* Sub-Option 1: display name */}
                    <TouchableOpacity
                      style={styles.dropdownMenuItem}
                      activeOpacity={0.7}
                      onPress={() => {
                        const currentName = user?.displayName || 'apple_user';
                        if (currentName.includes('_')) {
                          const parts = currentName.split('_');
                          setEditFirstName(parts[0] || 'apple');
                          setEditLastName(parts.slice(1).join('_') || 'user');
                        } else if (currentName.includes(' ')) {
                          const parts = currentName.split(' ');
                          setEditFirstName(parts[0] || 'apple');
                          setEditLastName(parts.slice(1).join(' ') || 'user');
                        } else {
                          setEditFirstName(currentName);
                          setEditLastName('');
                        }
                        setShowProfileMenu(false);
                        setShowEditNameModal(true);
                      }}
                    >
                      <Text style={[styles.dropdownMenuText, { color: isDark ? '#FFFFFF' : '#1C1C1E', marginLeft: 4 }]}>
                        display name
                      </Text>
                    </TouchableOpacity>

                    {/* Sub-Option 2: choose photo */}
                    <TouchableOpacity style={styles.dropdownMenuItem} activeOpacity={0.7} onPress={handleChoosePhoto}>
                      <Text style={[styles.dropdownMenuText, { color: isDark ? '#FFFFFF' : '#1C1C1E', marginLeft: 4 }]}>
                        choose photo
                      </Text>
                    </TouchableOpacity>

                    {/* Sub-Option 3: color -> opens color palette dropdown */}
                    <TouchableOpacity
                      style={styles.dropdownMenuItem}
                      activeOpacity={0.7}
                      onPress={() => setProfileSubMenu('color')}
                    >
                      <Text style={[styles.dropdownMenuText, { color: isDark ? '#FFFFFF' : '#1C1C1E', marginLeft: 4 }]}>
                        color
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* OVERLAPPING LOG NOTIFICATIONS SUB-DROPDOWN CARD */}
              {profileSubMenu === 'logNotifications' && (
                <View
                  style={[
                    styles.profileSubDropdownCard,
                    {
                      top: insets.top + 99,
                      backgroundColor: isDark ? 'rgba(32, 28, 44, 0.88)' : 'rgba(255, 255, 255, 0.94)',
                      shadowColor: isDark ? accentColor : 'rgba(138, 43, 226, 0.30)',
                    },
                  ]}
                >
                  <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />

                  <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
                    <Defs>
                      <LinearGradient id="notifSubDiagonalGlow" x1="100%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor={accentColor} stopOpacity={isDark ? 0.50 : 0.40} />
                        <Stop offset="40%" stopColor={accentColor} stopOpacity={isDark ? 0.28 : 0.22} />
                        <Stop offset="75%" stopColor={accentColor} stopOpacity={isDark ? 0.10 : 0.08} />
                        <Stop offset="100%" stopColor={accentColor} stopOpacity={0.03} />
                      </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" fill="url(#notifSubDiagonalGlow)" />
                  </Svg>

                  <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
                    <Defs>
                      <LinearGradient id="notifSubCardBorder" x1="100%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor={isDark ? accentColor : '#FFFFFF'} stopOpacity={isDark ? 0.50 : 0.80} />
                        <Stop offset="45%" stopColor={isDark ? accentColor : '#FFFFFF'} stopOpacity={isDark ? 0.22 : 0.38} />
                        <Stop offset="100%" stopColor={isDark ? '#FFFFFF' : '#FFFFFF'} stopOpacity={isDark ? 0.06 : 0.10} />
                      </LinearGradient>
                    </Defs>
                    <Rect x="1" y="1" width="99.1%" height="99.1%" rx="23" ry="23" fill="none" stroke="url(#notifSubCardBorder)" strokeWidth="1.0" />
                  </Svg>

                  {/* Header: bell icon + log notifications + down chevron */}
                  <TouchableOpacity
                    style={styles.dropdownHeaderRow}
                    activeOpacity={0.7}
                    onPress={() => setProfileSubMenu('main')}
                  >
                    <View style={styles.dropdownMenuLeft}>
                      <Ionicons name="notifications-outline" size={20} color={isDark ? '#FFFFFF' : '#1C1C1E'} />
                      <Text style={[styles.dropdownUsernameText, { color: isDark ? '#FFFFFF' : '#1C1C1E', marginLeft: 10 }]}>
                        log notifications
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={17} color={isDark ? '#FFFFFF' : '#1C1C1E'} />
                  </TouchableOpacity>

                  {/* Hairline Separator Line */}
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)',
                      marginHorizontal: 16,
                      marginTop: 4,
                      marginBottom: 12,
                    }}
                  />

                  {/* Options List */}
                  <View style={[styles.dropdownMenuList, { paddingTop: 4, paddingBottom: 16 }]}>
                    <TouchableOpacity
                      style={styles.dropdownMenuItem}
                      activeOpacity={0.7}
                      onPress={() => setNotificationFreq('1hr')}
                    >
                      <View style={styles.dropdownMenuLeft}>
                        {notificationFreq === '1hr' ? (
                          <Ionicons name="checkmark" size={17} color={isDark ? '#FFFFFF' : '#1C1C1E'} style={{ marginRight: 8 }} />
                        ) : (
                          <View style={{ width: 25 }} />
                        )}
                        <Text style={[styles.dropdownMenuText, { color: isDark ? '#FFFFFF' : '#1C1C1E', marginLeft: 0 }]}>
                          every 1hr
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.dropdownMenuItem}
                      activeOpacity={0.7}
                      onPress={() => setNotificationFreq('3hrs')}
                    >
                      <View style={styles.dropdownMenuLeft}>
                        {notificationFreq === '3hrs' ? (
                          <Ionicons name="checkmark" size={17} color={isDark ? '#FFFFFF' : '#1C1C1E'} style={{ marginRight: 8 }} />
                        ) : (
                          <View style={{ width: 25 }} />
                        )}
                        <Text style={[styles.dropdownMenuText, { color: isDark ? '#FFFFFF' : '#1C1C1E', marginLeft: 0 }]}>
                          every 3hrs
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.dropdownMenuItem}
                      activeOpacity={0.7}
                      onPress={() => setNotificationFreq('off')}
                    >
                      <View style={styles.dropdownMenuLeft}>
                        {notificationFreq === 'off' ? (
                          <Ionicons name="checkmark" size={17} color={isDark ? '#FFFFFF' : '#1C1C1E'} style={{ marginRight: 8 }} />
                        ) : (
                          <View style={{ width: 25 }} />
                        )}
                        <Text style={[styles.dropdownMenuText, { color: isDark ? '#FFFFFF' : '#1C1C1E', marginLeft: 0 }]}>
                          off
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* OVERLAPPING ACCOUNT SUB-DROPDOWN CARD */}
              {profileSubMenu === 'account' && (
                <View
                  style={[
                    styles.profileSubDropdownCard,
                    {
                      top: insets.top + 143,
                      backgroundColor: isDark ? 'rgba(32, 28, 44, 0.88)' : 'rgba(255, 255, 255, 0.94)',
                      shadowColor: isDark ? accentColor : 'rgba(138, 43, 226, 0.30)',
                    },
                  ]}
                >
                  <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />

                  <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
                    <Defs>
                      <LinearGradient id="acctSubDiagonalGlow" x1="100%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor={accentColor} stopOpacity={isDark ? 0.50 : 0.40} />
                        <Stop offset="40%" stopColor={accentColor} stopOpacity={isDark ? 0.28 : 0.22} />
                        <Stop offset="75%" stopColor={accentColor} stopOpacity={isDark ? 0.10 : 0.08} />
                        <Stop offset="100%" stopColor={accentColor} stopOpacity={0.03} />
                      </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" fill="url(#acctSubDiagonalGlow)" />
                  </Svg>

                  <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
                    <Defs>
                      <LinearGradient id="acctSubCardBorder" x1="100%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor={isDark ? accentColor : '#FFFFFF'} stopOpacity={isDark ? 0.50 : 0.80} />
                        <Stop offset="45%" stopColor={isDark ? accentColor : '#FFFFFF'} stopOpacity={isDark ? 0.22 : 0.38} />
                        <Stop offset="100%" stopColor={isDark ? '#FFFFFF' : '#FFFFFF'} stopOpacity={isDark ? 0.06 : 0.10} />
                      </LinearGradient>
                    </Defs>
                    <Rect x="1" y="1" width="99.1%" height="99.1%" rx="23" ry="23" fill="none" stroke="url(#acctSubCardBorder)" strokeWidth="1.0" />
                  </Svg>

                  {/* Header: person circle icon + account + down chevron */}
                  <TouchableOpacity
                    style={styles.dropdownHeaderRow}
                    activeOpacity={0.7}
                    onPress={() => setProfileSubMenu('main')}
                  >
                    <View style={styles.dropdownMenuLeft}>
                      <Ionicons name="person-circle-outline" size={20} color={isDark ? '#FFFFFF' : '#1C1C1E'} />
                      <Text style={[styles.dropdownUsernameText, { color: isDark ? '#FFFFFF' : '#1C1C1E', marginLeft: 10 }]}>
                        account
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={17} color={isDark ? '#FFFFFF' : '#1C1C1E'} />
                  </TouchableOpacity>

                  {/* Hairline Separator Line */}
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)',
                      marginHorizontal: 16,
                      marginTop: 4,
                      marginBottom: 12,
                    }}
                  />

                  {/* Options List */}
                  <View style={[styles.dropdownMenuList, { paddingTop: 4, paddingBottom: 16 }]}>
                    <TouchableOpacity
                      style={styles.dropdownMenuItem}
                      activeOpacity={0.7}
                      onPress={() => {
                        setShowProfileMenu(false);
                        setProfileSubMenu('main');
                        setInAppBrowserTitle('terms of service');
                        setInAppBrowserUrl('https://palzee.fun/tos.html');
                      }}
                    >
                      <Text style={[styles.dropdownMenuText, { color: isDark ? '#FFFFFF' : '#1C1C1E', marginLeft: 4 }]}>
                        terms of service
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.dropdownMenuItem}
                      activeOpacity={0.7}
                      onPress={() => {
                        setShowProfileMenu(false);
                        setProfileSubMenu('main');
                        setInAppBrowserTitle('csam policy');
                        setInAppBrowserUrl('https://palzee.fun/csampolicy.html');
                      }}
                    >
                      <Text style={[styles.dropdownMenuText, { color: isDark ? '#FFFFFF' : '#1C1C1E', marginLeft: 4 }]}>
                        csam policy
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.dropdownMenuItem}
                      activeOpacity={0.7}
                      onPress={() => {
                        setShowProfileMenu(false);
                        setProfileSubMenu('main');
                        setInAppBrowserTitle('privacy policy');
                        setInAppBrowserUrl('https://palzee.fun/privacy.html');
                      }}
                    >
                      <Text style={[styles.dropdownMenuText, { color: isDark ? '#FFFFFF' : '#1C1C1E', marginLeft: 4 }]}>
                        privacy policy
                      </Text>
                    </TouchableOpacity>

                    {/* Log Out in Red in Account Sub-Menu */}
                    <TouchableOpacity
                      style={styles.dropdownMenuItem}
                      activeOpacity={0.7}
                      onPress={() => {
                        setShowProfileMenu(false);
                        setProfileSubMenu('main');
                        onSignOut?.();
                      }}
                    >
                      <Text style={[styles.dropdownMenuText, { color: '#FF3B30', marginLeft: 4 }]}>
                        log out
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* 3RD LEVEL OVERLAPPING COLOR PALETTE SUB-DROPDOWN CARD (EXACTLY MATCHING ATTACHED SCREENSHOT) */}
              {profileSubMenu === 'color' && (
                <View
                  style={[
                    styles.profileColorDropdownCard,
                    {
                      top: insets.top + 180,
                      backgroundColor: isDark ? 'rgba(32, 28, 44, 0.88)' : 'rgba(255, 255, 255, 0.94)',
                      shadowColor: isDark ? accentColor : 'rgba(138, 43, 226, 0.30)',
                    },
                  ]}
                >
                  <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />

                  <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
                    <Defs>
                      <LinearGradient id="colorSubDiagonalGlow" x1="100%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor={accentColor} stopOpacity={isDark ? 0.50 : 0.40} />
                        <Stop offset="40%" stopColor={accentColor} stopOpacity={isDark ? 0.28 : 0.22} />
                        <Stop offset="75%" stopColor={accentColor} stopOpacity={isDark ? 0.10 : 0.08} />
                        <Stop offset="100%" stopColor={accentColor} stopOpacity={0.03} />
                      </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" fill="url(#colorSubDiagonalGlow)" />
                  </Svg>

                  <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
                    <Defs>
                      <LinearGradient id="colorSubCardBorder" x1="100%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor={isDark ? accentColor : '#FFFFFF'} stopOpacity={isDark ? 0.50 : 0.80} />
                        <Stop offset="45%" stopColor={isDark ? accentColor : '#FFFFFF'} stopOpacity={isDark ? 0.22 : 0.38} />
                        <Stop offset="100%" stopColor={isDark ? '#FFFFFF' : '#FFFFFF'} stopOpacity={isDark ? 0.06 : 0.10} />
                      </LinearGradient>
                    </Defs>
                    <Rect x="1" y="1" width="99.1%" height="99.1%" rx="23" ry="23" fill="none" stroke="url(#colorSubCardBorder)" strokeWidth="1.0" />
                  </Svg>

                  <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
                    <Defs>
                      <LinearGradient id="colorSubCardBorder" x1="100%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor={isDark ? accentColor : '#FFFFFF'} stopOpacity={isDark ? 0.42 : 0.75} />
                        <Stop offset="45%" stopColor={isDark ? accentColor : '#FFFFFF'} stopOpacity={isDark ? 0.18 : 0.35} />
                        <Stop offset="100%" stopColor={isDark ? '#FFFFFF' : '#FFFFFF'} stopOpacity={isDark ? 0.06 : 0.10} />
                      </LinearGradient>
                    </Defs>
                    <Rect x="1" y="1" width="99.1%" height="99.1%" rx="23" ry="23" fill="none" stroke="url(#colorSubCardBorder)" strokeWidth="1.0" />
                  </Svg>

                  {/* Header Row: color title + down chevron v */}
                  <TouchableOpacity
                    style={styles.dropdownHeaderRow}
                    activeOpacity={0.7}
                    onPress={() => setProfileSubMenu('editProfile')}
                  >
                    <View style={styles.dropdownMenuLeft}>
                      <Text style={[styles.dropdownUsernameText, { color: isDark ? '#FFFFFF' : '#1C1C1E', marginLeft: 4 }]}>
                        color
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={17} color={isDark ? '#FFFFFF' : '#1C1C1E'} />
                  </TouchableOpacity>

                  {/* Hairline Separator Line */}
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)',
                      marginHorizontal: 16,
                      marginTop: 4,
                      marginBottom: 10,
                    }}
                  />

                  {/* 6 Color Palette Options List (Exact colors from reference screenshot) */}
                  <View style={[styles.dropdownMenuList, { paddingTop: 2, paddingBottom: 14 }]}>
                    {[
                      { key: 'blue', name: 'blue', hex: Colors.BorderGlow.blue },
                      { key: 'orange', name: 'orange', hex: Colors.BorderGlow.orange },
                      { key: 'purple', name: 'purple', hex: Colors.BorderGlow.purple },
                      { key: 'green', name: 'green', hex: Colors.BorderGlow.green },
                      { key: 'cyan', name: 'ocean', hex: Colors.BorderGlow.cyan },
                      { key: 'pink', name: 'pink', hex: Colors.BorderGlow.pink },
                    ].map((opt) => {
                      const isSelected = selectedThemeColor === opt.key;
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          style={styles.dropdownMenuItem}
                          activeOpacity={0.7}
                          onPress={() => onSelectedThemeColorChange(opt.key)}
                        >
                          <View style={styles.dropdownMenuLeft}>
                            {/* Checkmark Indicator Column */}
                            <View style={{ width: 20, alignItems: 'center', justifyContent: 'center' }}>
                              {isSelected && (
                                <Ionicons name="checkmark" size={16} color={isDark ? '#FFFFFF' : '#1C1C1E'} />
                              )}
                            </View>

                            {/* Color Dot Swatch Circle */}
                            <View
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor: opt.hex,
                                marginRight: 14,
                                marginLeft: 4,
                              }}
                            />

                            {/* Color Name */}
                            <Text style={[styles.dropdownMenuText, { color: isDark ? '#FFFFFF' : '#1C1C1E', marginLeft: 0 }]}>
                              {opt.name}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>

        {/* EXACT EDIT NAME MODAL MATCHING ATTACHED SCREENSHOT */}
        <Modal
          visible={showEditNameModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEditNameModal(false)}
        >
          <TouchableOpacity
            style={styles.dropdownModalOverlay}
            activeOpacity={1}
            onPress={() => setShowEditNameModal(false)}
          >
            <KeyboardAvoidingView
              behavior="padding"
              style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View
                  style={{
                    width: '86%',
                    maxWidth: 340,
                    borderRadius: 28,
                    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                    padding: 22,
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: isDark ? 0.35 : 0.15,
                    shadowRadius: 20,
                    elevation: 16,
                    borderWidth: 0,
                    overflow: 'hidden',
                  }}
                >

                  {/* Header Title */}
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: '700',
                      color: isDark ? '#FFFFFF' : '#1C1C1E',
                      marginBottom: 4,
                      letterSpacing: -0.2,
                      fontFamily: Fonts.SystemRoundedBold,
                    }}
                  >
                    edit name
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '400',
                      color: isDark ? 'rgba(255, 255, 255, 0.60)' : 'rgba(0, 0, 0, 0.55)',
                      marginBottom: 16,
                      letterSpacing: -0.1,
                      fontFamily: Fonts.SystemRoundedMedium,
                    }}
                  >
                    enter your name
                  </Text>

                  {/* Input Box Container */}
                  <View
                    style={{
                      borderRadius: 20,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      marginBottom: 18,
                    }}
                  >
                    <TextInput
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: isDark ? '#FFFFFF' : '#1C1C1E',
                        paddingVertical: 7,
                        letterSpacing: -0.1,
                        fontFamily: Fonts.SystemRoundedSemibold,
                      }}
                      value={editFirstName}
                      onChangeText={setEditFirstName}
                      placeholder="First name"
                      placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.35)'}
                      autoFocus
                      autoCorrect={false}
                    />

                    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)', marginVertical: 4 }} />

                    <TextInput
                      style={{
                        fontSize: 15,
                        fontWeight: '500',
                        color: isDark ? '#FFFFFF' : '#1C1C1E',
                        paddingVertical: 7,
                        letterSpacing: -0.1,
                        fontFamily: Fonts.SystemRoundedMedium,
                      }}
                      value={editLastName}
                      onChangeText={setEditLastName}
                      placeholder="Last"
                      placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.35)'}
                      autoCorrect={false}
                    />
                  </View>

                  {/* Action Buttons Row */}
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        height: 46,
                        borderRadius: 23,
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                      activeOpacity={0.7}
                      onPress={() => setShowEditNameModal(false)}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '600',
                          color: isDark ? '#FFFFFF' : '#1C1C1E',
                          letterSpacing: -0.1,
                          fontFamily: Fonts.SystemRoundedSemibold,
                        }}
                      >
                        cancel
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flex: 1,
                        height: 46,
                        borderRadius: 23,
                        backgroundColor: accentColor,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                      activeOpacity={0.8}
                      onPress={() => {
                        const updatedDisplayName = editLastName.trim()
                          ? `${editFirstName.trim()} ${editLastName.trim()}`
                          : editFirstName.trim();
                        if (user) {
                          user.displayName = updatedDisplayName;
                        }
                        setShowEditNameModal(false);
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '600',
                          color: '#FFFFFF',
                          letterSpacing: -0.1,
                          fontFamily: Fonts.SystemRoundedSemibold,
                        }}
                      >
                        save
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>
      </View>

    {/* OVERLAY MODALS (FULLSCREEN ROOT LEVEL) */}
    <CreatePalModal
      key={isDark ? 'create_dark' : 'create_light'}
      visible={showCreateModal}
      onClose={() => setShowCreateModal(false)}
      onCreate={handleCreateRoom}
      onJoin={handleJoinRoom}
      themeColor={selectedThemeColor}
      initialTab={createModalInitialTab}
    />

    <ActivityDrawer
      key={isDark ? 'act_dark' : 'act_light'}
      visible={showActivityDrawer}
      onClose={() => setShowActivityDrawer(false)}
      isDark={isDark}
      selectedThemeColor={selectedThemeColor}
    />

    <ChatDrawer
      key={isDark ? 'chat_dark' : 'chat_light'}
      visible={showChatDrawer}
      onClose={() => setShowChatDrawer(false)}
      onOpenVlog={() => {
        setShowChatDrawer(false);
        setShowEditExportSheet(true);
      }}
      palCode="palzee_space"
      user={user}
      isDark={isDark}
      selectedThemeColor={selectedThemeColor}
      vlogList={getClipsForDayOffset(vlogList, selectedDayOffset)}
      activeVideoUri={getClipsForDayOffset(vlogList, selectedDayOffset).length > 0 ? getClipsForDayOffset(vlogList, selectedDayOffset)[0]?.uri : undefined}
      selectedDayOffset={selectedDayOffset}
    />

    <VlogSheet
      key={isDark ? 'vlog_dark' : 'vlog_light'}
      visible={showExportSheet}
      onClose={() => {
        setShowChatDrawer(false);
        setShowExportSheet(false);
      }}
      user={user}
      selectedThemeColor={selectedThemeColor}
      vlogList={vlogList}
      activeVideoUri={vlogList.length > 0 ? vlogList[0]?.uri : null}
      caption={vlogList.length > 0 ? vlogList[0]?.caption : ''}
      timestamp={vlogList.length > 0 ? vlogList[0]?.timestamp : ''}
      isMuted={vlogList.length > 0 ? vlogList[0]?.isMuted : false}
      onDeleteVideo={handleDeleteVideo}
      onUpdateCaption={handleUpdateCaption}
      selectedDayOffset={selectedDayOffset}
      onSelectDayOffset={(offset) => setSelectedDayOffset(offset)}
      onOpenCamera={() => {
        setShowChatDrawer(false);
        setShowExportSheet(false);
        setActiveTab('camera');
      }}
      onOpenChat={() => {
        setShowChatDrawer(true);
      }}
    />

    <EditExportSheet
      key={isDark ? 'export_dark' : 'export_light'}
      visible={showEditExportSheet}
      onClose={() => setShowEditExportSheet(false)}
      vlogList={getClipsForDayOffset(vlogList, selectedDayOffset)}
      selectedThemeColor={selectedThemeColor}
      onDeleteVideo={handleDeleteVideo}
      onUpdateCaption={handleUpdateCaption}
    />

    <PalGroupDetailsSheet
      visible={!!activePalGroupDetails}
      onClose={() => setActivePalGroupDetails(null)}
      group={activePalGroupDetails}
      user={user}
      selectedThemeColor={selectedThemeColor}
      isDark={isDark}
      vlogList={
        activePalGroupDetails
          ? groupClipsMap[activePalGroupDetails.code] || groupClipsMap[activePalGroupDetails.name] || []
          : []
      }
      activeVideoUri={
        activePalGroupDetails
          ? groupClipsMap[activePalGroupDetails.code]?.[0]?.uri ||
            groupClipsMap[activePalGroupDetails.name]?.[0]?.uri ||
            null
          : null
      }
      onOpenCamera={() => {
        setActivePalGroupDetails(null);
        setActiveTab('camera');
      }}
      onDeleteGroup={(groupCode) => {
        setUserPalRooms((prev: PalRoom[]) => prev.filter((r: PalRoom) => r.code !== groupCode));
        setActivePalGroupDetails(null);
      }}
      onLeaveGroup={(groupCode) => {
        setUserPalRooms((prev: PalRoom[]) => prev.filter((r: PalRoom) => r.code !== groupCode));
        setActivePalGroupDetails(null);
      }}
      onUpdateGroup={(groupCode, newName, newSize) => {
        setUserPalRooms((prev: PalRoom[]) =>
          prev.map((r: PalRoom) =>
            r.code === groupCode ? { ...r, name: newName, size: newSize, maxCount: newSize } : r
          )
        );
        setActivePalGroupDetails((prev: any) =>
          prev && prev.code === groupCode ? { ...prev, name: newName, size: newSize, maxCount: newSize } : prev
        );
      }}
    />

    {/* VIEWING PALS GUIDE OVERLAY MODAL */}
    <ViewingPalsInstructionModal
      key={isDark ? 'guide_dark' : 'guide_light'}
      visible={showViewingPalsGuide}
      onContinue={() => setShowViewingPalsGuide(false)}
    />

      <InAppBrowserModal
        visible={!!inAppBrowserUrl}
        url={inAppBrowserUrl || ''}
        title={inAppBrowserTitle}
        onClose={() => setInAppBrowserUrl(null)}
        accentColor={accentColor}
      />
    </>
  </DynamicGlowContainer>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 10,
  },
  topHeader: {
    position: 'absolute',
    top: -1,
    left: 10,
    right: 10,
    height: 45,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 100,
  },
  palzeeLogoText: {
    fontFamily: Fonts.Unpack,
    fontSize: 47,
    color: '#4FFFB0',
    letterSpacing: 1.5,
    marginLeft: -5,
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 5,
  },
  circleIconBtnWrapper: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  circleIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  plusIconText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '400',
    marginTop: -2,
  },
  scrollBody: {
    flex: 1,
  },
  vlogFeedSection: {
    gap: 16,
    paddingVertical: 10,
  },
  vlogCard: {
    backgroundColor: '#161616',
    borderRadius: 24,
    marginHorizontal: 0,
    paddingHorizontal: 22,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  palGroupCard: {
    borderRadius: 24,
    marginHorizontal: 0,
    paddingHorizontal: 22,
    paddingVertical: 14,
    height: 84,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  palGroupTitle: {
    fontSize: 21,
    fontWeight: '700',
    fontFamily: Fonts.SystemRoundedBold,
    letterSpacing: -0.2,
  },
  palGroupActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smileyCircleOutline: {
    width: 22.5,
    height: 22.5,
    borderRadius: 11.25,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  palGroupSmileyIcon: {
    width: 19.5,
    height: 19.5,
  },
  palGroupActionIcon: {
    width: 25,
    height: 25,
  },
  palGroupDivider: {
    width: 1,
    height: 18,
    marginHorizontal: 12,
  },
  vlogTextSection: {
    flex: 1,
    paddingRight: 10,
  },
  vlogTitle: {
    color: '#FFFFFF',
    fontFamily: Fonts.SystemRoundedBold,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  vlogSubtext: {
    color: '#8E8E93',
    fontFamily: Fonts.SystemRoundedMedium,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
  },
  starDoodleImage: {
    width: 65.05,
    height: 65.05,
  },
  /* EMPTY FEED STYLES */
  emptyFeedContainer: {
    alignItems: 'center',
    paddingTop: 51,
    paddingBottom: 20,
  },
  instructionsContainer: {
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 28,
  },
  sideBySideHeader: {
    fontFamily: Fonts.Ownglyph,
    color: '#FFFFFF',
    fontSize: 20,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 29,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginTop: 5,
  },
  stepBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepBadgeText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: Fonts.SystemRoundedBold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  plusSymbolText: {
    fontSize: 15,
  },
  pillActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionPillContainer: {
    width: 118,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  actionPillText: {
    fontFamily: Fonts.SystemRoundedSemibold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionHintText: {
    fontFamily: Fonts.SystemRoundedSemibold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  stepSubtext: {
    fontFamily: Fonts.SystemRoundedMedium,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 2,
  },
  blobContainer: {
    width: '100%',
    height: 86,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  resetTitle: {
    fontFamily: Fonts.Ownglyph,
    color: '#FFFFFF',
    fontSize: 20,
  },
  resetSubtext: {
    fontFamily: Fonts.Ownglyph,
    color: '#FFFFFF',
    fontSize: 19,
    marginTop: 2,
  },
  doodleFooter: {
    width: '100%',
    alignItems: 'center',
    marginTop: 6,
  },
  ufoTurtleImage: {
    width: '100%',
    height: 90,
    opacity: 0.65,
  },
  groundLine: {
    width: '100%',
    height: 1.5,
    backgroundColor: '#2C2C2E',
    marginTop: -6,
  },
  /* 3. BOTTOM LIQUID GLASS TAB SWITCHER */
  unifiedBottomRow: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 100,
  },
  extControlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  bottomSwitcherContainer: {
    alignItems: 'center',
  },
  liquidNavShadowWrapper: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  liquidCircleWrapper: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  liquidOuterCapsule: {
    width: 167.5,
    height: 50,
    position: 'relative',
    borderRadius: 25,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  liquidCapsuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 1,
    height: 50,
  },
  liquidTabButton: {
    width: 82.25,
    height: 48,
    borderRadius: 24,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveSegmentText: {
    color: '#8E8E93',
    fontFamily: Fonts.SystemRoundedMedium,
    fontSize: 18.5,
    fontWeight: '400',
  },
  activeSegmentText: {
    color: '#FFFFFF',
    fontFamily: Fonts.SystemRoundedSemibold,
    fontSize: 18.5,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  profileCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  profileNameText: {
    color: '#FFFFFF',
    fontFamily: Fonts.IBMPlexMono,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileEmailText: {
    color: '#8E8E93',
    fontFamily: Fonts.IBMPlexMono,
    fontSize: 14,
    marginBottom: 16,
  },
  themeSectionLabel: {
    fontFamily: Fonts.IBMPlexMono,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  themeGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 24,
  },
  profileThemeSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeProfileThemeSwatch: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  themeSelectBtn: {
    backgroundColor: '#2C2C2E',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  menuBtnText: {
    color: '#FFFFFF',
    fontFamily: Fonts.IBMPlexMono,
    fontSize: 16,
    fontWeight: '500',
  },
  signOutBtn: {
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  signOutBtnText: {
    color: '#FFFFFF',
    fontFamily: Fonts.IBMPlexMono,
    fontSize: 16,
    fontWeight: '600',
  },
  themeCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  themeModalTitle: {
    color: '#FFFFFF',
    fontFamily: Fonts.IBMPlexMono,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  themeSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeThemeSwatch: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.1 }],
  },
  dropdownModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  profileDropdownCard: {
    position: 'absolute',
    top: 49.0,
    right: 10,
    width: 246.75,
    borderRadius: 24,
    borderWidth: 0,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarSmileyImage: {
    width: 22,
    height: 22,
    transform: [{ rotate: '90deg' }],
  },
  dropdownUsernameText: {
    fontSize: 19.0,
    fontWeight: '600',
    letterSpacing: 0.2,
    fontFamily: Fonts.SystemRoundedSemibold,
  },
  dropdownMenuList: {
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9.0,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  dropdownMenuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownMenuText: {
    fontSize: 18.0,
    fontWeight: '400',
    marginLeft: 13,
    letterSpacing: 0.1,
    fontFamily: Fonts.SystemRounded,
  },
  profileSubDropdownCard: {
    position: 'absolute',
    top: 95.0,
    right: 7,
    width: 253,
    borderRadius: 24,
    borderWidth: 0,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  profileColorDropdownCard: {
    position: 'absolute',
    top: 227.0,
    right: 4,
    width: 259.5,
    borderRadius: 24,
    borderWidth: 0,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.38,
    shadowRadius: 20,
    elevation: 14,
  },
  addDropdownCard: {
    position: 'absolute',
    top: 48.0,
    right: 130.0,
    width: 195.0,
    borderRadius: 26,
    borderWidth: 0,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 10,
  },
  addMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  addMenuText: {
    fontSize: 18.0,
    fontWeight: '400',
    letterSpacing: 0.1,
    fontFamily: Fonts.SystemRounded,
  },
});
