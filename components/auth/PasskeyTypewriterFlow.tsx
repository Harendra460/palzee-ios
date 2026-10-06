import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { DynamicGlowContainer } from '../ui/DynamicGlowContainer';
import { passkeyService } from '../../services/passkeyService';
import { authService } from '../../services/authService';
import { cameraWarmupStore } from '../../utils/cameraWarmupStore';
import { User } from '../../types';
import { useFastColorScheme } from '../../hooks/useFastColorScheme';

const AnimatedText = Animated.createAnimatedComponent(Text);

interface PasskeyTypewriterFlowProps {
  visible: boolean;
  themeColor?: string;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

type FlowStep =
  | 'FIRST_NAME'
  | 'LAST_NAME'
  | 'CONFIRM'
  | 'CREATING'
  | 'PERMISSIONS'
  | 'FAILED';

type PermSubStep = 'CAMERA' | 'MICROPHONE' | 'NOTIFICATIONS' | 'DONE';

export const PasskeyTypewriterFlow: React.FC<PasskeyTypewriterFlowProps> = ({
  visible,
  themeColor = 'green',
  onClose,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [step, setStep] = useState<FlowStep>('FIRST_NAME');

  // Android hardware back steps back through the name screens instead of exiting the app; it is
  // swallowed while the account is being created or permissions are being requested.
  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'LAST_NAME') setStep('FIRST_NAME');
      else if (step === 'CONFIRM') setStep('LAST_NAME');
      else if (step === 'FIRST_NAME' || step === 'FAILED') onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, step, onClose]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dots, setDots] = useState('.');
  const [createdUser, setCreatedUser] = useState<User | null>(null);

  // Typewriter states for Name steps
  const [line1Typed, setLine1Typed] = useState('');
  const [line2Typed, setLine2Typed] = useState('');
  const [line1Done, setLine1Done] = useState(false);
  const [line2Done, setLine2Done] = useState(false);

  // Permissions step states
  const [permSubStep, setPermSubStep] = useState<PermSubStep>('CAMERA');
  const [permTitleTyped, setPermTitleTyped] = useState('');
  const [permSubtitleTyped, setPermSubtitleTyped] = useState('');
  const [permDescTyped, setPermDescTyped] = useState('');
  const [permDescDone, setPermDescDone] = useState(false);

  const [cameraDone, setCameraDone] = useState(false);
  const [micDone, setMicDone] = useState(false);
  const [notifDone, setNotifDone] = useState(false);

  const firstInputRef = useRef<TextInput>(null);
  const lastInputRef = useRef<TextInput>(null);

  // Blinking green cursor animation (500ms toggle for 100% reliable blinking in React Native Modal on iOS)
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setCursorVisible(true);
    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, [visible]);

  const fullLine1 = '→ welcome to palzee';
  const fullLine2 = 'to get started we need your first and last name...';

  const fullPermTitle = '→ permissions';
  // English version of Korean text "먼저 몇 가지 권한이 필요해요..."
  const fullPermSubtitle = 'first, we need a few permissions...';

  const cameraDescText =
    'camera capture photos and videos to share with close friends.\n\nphotos and videos are end-to-end encrypted, only you and friends you share with can see them.';

  const micDescText = 'microphone record audio while capturing videos.';

  // User requested: "instead of snaps write pals"
  const notifDescText =
    'notifications see when close friends send pals or reply to your messages.';

  // Character-by-character Typewriter effect on open
  useEffect(() => {
    if (!visible) return;
    setStep('FIRST_NAME');
    setFirstName('');
    setLastName('');
    setLine1Typed('');
    setLine2Typed('');
    setLine1Done(false);
    setLine2Done(false);
    setCreatedUser(null);
    setCameraDone(false);
    setMicDone(false);
    setNotifDone(false);
    setPermSubStep('CAMERA');

    let idx1 = 0;
    const timer1 = setInterval(() => {
      if (idx1 < fullLine1.length) {
        setLine1Typed(fullLine1.substring(0, idx1 + 1));
        idx1++;
      } else {
        clearInterval(timer1);
        setLine1Done(true);
      }
    }, 70);

    return () => clearInterval(timer1);
  }, [visible]);

  // Line 2 typewriter after Line 1 finishes
  useEffect(() => {
    if (!line1Done) return;

    let idx2 = 0;
    const timer2 = setInterval(() => {
      if (idx2 < fullLine2.length) {
        setLine2Typed(fullLine2.substring(0, idx2 + 1));
        idx2++;
      } else {
        clearInterval(timer2);
        setLine2Done(true);
        setTimeout(() => {
          firstInputRef.current?.focus();
        }, 150);
      }
    }, 70);

    return () => clearInterval(timer2);
  }, [line1Done]);

  // Animated dots for CREATING step
  useEffect(() => {
    if (step !== 'CREATING') return;
    const dotTimer = setInterval(() => {
      setDots((d) => (d === '...' ? '.' : d + '.'));
    }, 450);
    return () => clearInterval(dotTimer);
  }, [step]);

  // Start Permissions Flow Typewriter
  const startPermissionsFlow = async () => {
    setStep('PERMISSIONS');

    const hasCam = cameraPermission?.granted;
    const hasMic = micPermission?.granted;
    let hasNotif = false;
    try {
      const notifStatus = await Notifications.getPermissionsAsync();
      hasNotif = notifStatus.granted;
    } catch (e) {
      console.warn('[PERMISSIONS] Check notifications error:', e);
    }

    if (hasCam && hasMic && hasNotif) {
      setPermTitleTyped(fullPermTitle);
      setPermSubtitleTyped(fullPermSubtitle);
      setCameraDone(true);
      setMicDone(true);
      setNotifDone(true);
      setPermSubStep('DONE');
      setPermDescDone(true);
    } else {
      setPermSubStep('CAMERA');
      setPermTitleTyped('');
      setPermSubtitleTyped('');
      setPermDescTyped('');
      setPermDescDone(false);

      let tIdx = 0;
      const tTimer = setInterval(() => {
        if (tIdx < fullPermTitle.length) {
          setPermTitleTyped(fullPermTitle.substring(0, tIdx + 1));
          tIdx++;
        } else {
          clearInterval(tTimer);
          let sIdx = 0;
          const sTimer = setInterval(() => {
            if (sIdx < fullPermSubtitle.length) {
              setPermSubtitleTyped(fullPermSubtitle.substring(0, sIdx + 1));
              sIdx++;
            } else {
              clearInterval(sTimer);
              typePermDesc(cameraDescText);
            }
          }, 70);
        }
      }, 70);
    }
  };

  const typePermDesc = (text: string) => {
    setPermDescTyped('');
    setPermDescDone(false);
    let dIdx = 0;
    const dTimer = setInterval(() => {
      if (dIdx < text.length) {
        setPermDescTyped(text.substring(0, dIdx + 1));
        dIdx++;
      } else {
        clearInterval(dTimer);
        setPermDescDone(true);
      }
    }, 70);
  };

  const handleFirstNameSubmit = () => {
    if (firstName.trim().length > 0) {
      setStep('LAST_NAME');
      setTimeout(() => {
        lastInputRef.current?.focus();
      }, 150);
    }
  };

  const handleLastNameSubmit = () => {
    if (lastName.trim().length > 0) {
      setStep('CONFIRM');
    }
  };

  const handleCreateAccount = async () => {
    setStep('CREATING');
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const email = `${firstName.toLowerCase().replace(/\s/g, '')}@palzee.app`;
      const res = await passkeyService.promptNativePasskey(email, fullName);
      if (res.success && res.passkeyUser) {
        setCreatedUser(res.passkeyUser);
        startPermissionsFlow();
      } else {
        const fallbackRes = await authService.registerTemporaryPasskey(firstName, lastName, email);
        if (fallbackRes.success) {
          setCreatedUser(fallbackRes.user);
          startPermissionsFlow();
        } else {
          setStep('FAILED');
        }
      }
    } catch (e) {
      setStep('FAILED');
    }
  };

  // Handle Permissions Sequence (Camera -> Mic -> Notifications -> Done)
  const handleNextPermission = async () => {
    if (permSubStep === 'CAMERA') {
      try {
        console.log('[PERMISSIONS] Requesting iOS Camera permission...');
        const res = await requestCameraPermission();
        console.log('[PERMISSIONS] Camera response:', res);
        if (res?.granted) {
          cameraWarmupStore.setCameraGranted(true);
        } else if (!res?.canAskAgain) {
          Alert.alert(
            'Camera Access Required',
            'Palzee needs Camera access to capture moments with friends. Please enable Camera in Settings.',
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
      } catch (e) {
        console.warn('[PERMISSIONS] Camera permission error:', e);
      }
      setCameraDone(true);
      setPermSubStep('MICROPHONE');
      typePermDesc(micDescText);
    } else if (permSubStep === 'MICROPHONE') {
      try {
        console.log('[PERMISSIONS] Requesting iOS Microphone permission...');
        const res = await requestMicPermission();
        console.log('[PERMISSIONS] Mic response:', res);
        if (res?.granted) {
          cameraWarmupStore.setMicGranted(true);
        } else if (!res?.canAskAgain) {
          Alert.alert(
            'Microphone Access Required',
            'Palzee needs Microphone access to record sound with your videos. Please enable Microphone in Settings.',
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
      } catch (e) {
        console.warn('[PERMISSIONS] Microphone permission error:', e);
      }
      setMicDone(true);
      setPermSubStep('NOTIFICATIONS');
      typePermDesc(notifDescText);
    } else if (permSubStep === 'NOTIFICATIONS') {
      try {
        console.log('[PERMISSIONS] Requesting iOS Push Notifications permission...');
        const res = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        console.log('[PERMISSIONS] Notifications response:', res);
      } catch (e) {
        console.warn('[PERMISSIONS] Notifications permission error:', e);
      }
      setNotifDone(true);
      setPermSubStep('DONE');
    } else if (permSubStep === 'DONE') {
      if (createdUser) {
        onSuccess(createdUser);
      } else {
        onClose();
      }
    }
  };

  const THEME_ACCENTS: Record<string, string> = {
    green: '#2EE99C',
    pink: '#FF69B4',
    yellow: '#FFD700',
    blue: '#00BFFF',
    orange: '#FF8C00',
    purple: '#8A2BE2',
  };
  const accentColor = THEME_ACCENTS[themeColor] || themeColor || '#2EE99C';

  const systemScheme = useFastColorScheme();
  const isDark = systemScheme === 'dark';
  const flowBg = isDark ? '#000000' : '#FFFFF2';
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const subtextColor = isDark ? '#8E8E93' : '#6E6E73';
  const termsLinkColor = isDark ? '#CCCCCC' : '#333333';

  if (!visible) return null;

  return (
    <View
      key={`typewriter_view_${isDark ? 'dark' : 'light'}`}
      style={[
        StyleSheet.absoluteFill,
        styles.container,
        { backgroundColor: flowBg, zIndex: 99999, elevation: 99999 },
      ]}
    >
      <View
        style={[
          styles.content,
          {
            backgroundColor: flowBg,
            paddingTop: Math.max(insets.top, 20) + 23,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
            {/* TOP HEADER: DOODLE & NEED HELP LINK */}
            <View style={styles.topRow}>
              <Image
                source={require('../../assets/images/onboarding_logo.png')}
                style={styles.cloudLogo}
                contentFit="contain"
              />
              {step !== 'PERMISSIONS' && (
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={() => Linking.openURL('https://palzee.app/help')}
                >
                  <Text style={[styles.needHelpText, { color: textColor }]}>
                    need help?
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* MAIN TYPEWRITER BODY */}
            <View style={styles.body}>
              {step !== 'PERMISSIONS' ? (
                <>
                  {/* Line 1: → welcome to palzee */}
                  <Text
                    style={[
                      styles.monoText,
                      { color: textColor },
                      step === 'CREATING' && styles.greyText,
                    ]}
                  >
                    {line1Typed}
                    {!line1Done && (
                      <Text style={{ color: accentColor, opacity: cursorVisible ? 1 : 0 }}>
                        {'█'}
                      </Text>
                    )}
                  </Text>

                  {/* Line 2: to get started we need your first and last name... */}
                  {line1Done && (
                    <Text
                      style={[
                        styles.monoText,
                        { marginTop: 20, color: textColor },
                        step === 'CREATING' && styles.greyText,
                      ]}
                    >
                      {line2Typed}
                      {!line2Done && (
                        <Text style={{ color: accentColor, opacity: cursorVisible ? 1 : 0 }}>
                          {'█'}
                        </Text>
                      )}
                    </Text>
                  )}

                  {/* STEP 1: FIRST NAME INPUT */}
                  {line2Done && step === 'FIRST_NAME' && (
                    <View style={styles.inputSection}>
                      <View style={styles.inputRow}>
                        <TextInput
                          ref={firstInputRef}
                          style={styles.hiddenInput}
                          value={firstName}
                          onChangeText={setFirstName}
                          onSubmitEditing={handleFirstNameSubmit}
                          returnKeyType="next"
                          autoCapitalize="words"
                          autoCorrect={false}
                        />

                        {firstName ? (
                          <Text style={[styles.inputText, { color: textColor }]}>
                            {firstName}
                            <Text style={{ color: accentColor, opacity: cursorVisible ? 1 : 0 }}>
                              {'█'}
                            </Text>
                          </Text>
                        ) : (
                          <Text style={[styles.inputText, styles.placeholderText, { color: subtextColor }]}>
                            <Text style={{ color: accentColor, opacity: cursorVisible ? 1 : 0 }}>
                              {'█'}
                            </Text>
                            {'First'}
                          </Text>
                        )}
                      </View>

                      {/* Continue or Cancel Button */}
                      {firstName.trim().length > 0 ? (
                        <TouchableOpacity
                          style={styles.continueButton}
                          activeOpacity={0.7}
                          onPress={handleFirstNameSubmit}
                        >
                          <Text style={[styles.continueText, { color: textColor }]}>continue &#8594;</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.cancelButton}
                          activeOpacity={0.7}
                          onPress={onClose}
                        >
                          <Text style={[styles.cancelText, { color: textColor }]}>cancel</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* STEP 2: LAST NAME INPUT */}
                  {step === 'LAST_NAME' && (
                    <View style={styles.inputSection}>
                      <Text style={[styles.monoText, { color: textColor }]}>{firstName}</Text>
                      <View style={[styles.inputRow, { marginTop: 14 }]}>
                        <TextInput
                          ref={lastInputRef}
                          style={styles.hiddenInput}
                          value={lastName}
                          onChangeText={setLastName}
                          onSubmitEditing={handleLastNameSubmit}
                          returnKeyType="done"
                          autoCapitalize="words"
                          autoCorrect={false}
                        />

                        {lastName ? (
                          <Text style={[styles.inputText, { color: textColor }]}>
                            {lastName}
                            <Text style={{ color: accentColor, opacity: cursorVisible ? 1 : 0 }}>
                              {'█'}
                            </Text>
                          </Text>
                        ) : (
                          <Text style={[styles.inputText, styles.placeholderText, { color: subtextColor }]}>
                            <Text style={{ color: accentColor, opacity: cursorVisible ? 1 : 0 }}>
                              {'█'}
                            </Text>
                            {'Last'}
                          </Text>
                        )}
                      </View>

                      {/* Continue or Cancel Button */}
                      {lastName.trim().length > 0 ? (
                        <TouchableOpacity
                          style={styles.continueButton}
                          activeOpacity={0.7}
                          onPress={handleLastNameSubmit}
                        >
                          <Text style={[styles.continueText, { color: textColor }]}>continue &#8594;</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.cancelButton}
                          activeOpacity={0.7}
                          onPress={onClose}
                        >
                          <Text style={[styles.cancelText, { color: textColor }]}>cancel</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* STEP 3: CONFIRMATION STEP */}
                  {step === 'CONFIRM' && (
                    <View style={styles.confirmSection}>
                      <Text style={[styles.monoText, { color: textColor }]}>{`${firstName} ${lastName} :)`}</Text>

                      <TouchableOpacity
                        style={styles.continueButton}
                        activeOpacity={0.7}
                        onPress={handleCreateAccount}
                      >
                        <Text style={[styles.continueText, { color: textColor }]}>continue &#8594;</Text>
                      </TouchableOpacity>

                      {/* Terms of Service Notice below continue button */}
                      <View style={styles.inlineTermsSection}>
                        <Text style={[styles.footerText, { color: subtextColor }]}>
                          by continuing you agree to the{' '}
                          <Text style={[styles.termsLink, { color: termsLinkColor }]}>
                            terms of service.
                          </Text>
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* STEP 4: CREATING ACCOUNT */}
                  {step === 'CREATING' && (
                    <View style={styles.creatingSection}>
                      <Text style={[styles.monoText, { color: textColor }]}>{`${firstName} ${lastName} :)`}</Text>
                      <Text
                        style={[
                          styles.monoText,
                          { marginTop: 24, fontWeight: '600', color: textColor },
                        ]}
                      >
                        creating account{dots}
                      </Text>
                    </View>
                  )}

                  {/* STEP 5: FAILED SCREEN */}
                  {step === 'FAILED' && (
                    <View style={styles.failedSection}>
                      <Text style={[styles.monoText, { color: textColor }]}>
                        {`${firstName} ${lastName} :)`}
                      </Text>
                      <Text
                        style={[
                          styles.monoText,
                          { marginTop: 24, textDecorationLine: 'line-through', color: textColor },
                        ]}
                      >
                        creating account...
                      </Text>

                      <Text style={[styles.monoText, { marginTop: 16, color: textColor }]}>
                        sign up failed. please try again.
                      </Text>

                      <TouchableOpacity
                        style={styles.continueButton}
                        activeOpacity={0.7}
                        onPress={handleCreateAccount}
                      >
                        <Text style={[styles.continueText, { color: textColor }]}>try again &#8594;</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.cancelButton}
                        activeOpacity={0.7}
                        onPress={onClose}
                      >
                        <Text style={[styles.cancelText, { color: textColor }]}>cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              ) : (
                /* STEP 6: PERMISSIONS FLOW */
                <View style={styles.permissionsContainer}>
                  {/* Header: → permissions */}
                  <Text style={[styles.monoText, { color: textColor }]}>
                    {permTitleTyped}
                    {permTitleTyped.length < fullPermTitle.length && (
                      <Text style={{ color: accentColor, opacity: cursorVisible ? 1 : 0 }}>
                        {'█'}
                      </Text>
                    )}
                  </Text>

                  {/* Subtitle */}
                  {permTitleTyped.length === fullPermTitle.length && (
                    <Text style={[styles.monoText, { marginTop: 16, color: textColor }]}>
                      {permSubtitleTyped}
                      {permSubtitleTyped.length < fullPermSubtitle.length && (
                        <Text style={{ color: accentColor, opacity: cursorVisible ? 1 : 0 }}>
                          {'█'}
                        </Text>
                      )}
                    </Text>
                  )}

                  {permSubtitleTyped.length === fullPermSubtitle.length && (
                    <View style={{ marginTop: 28 }}>
                      {/* CAMERA ITEM */}
                      {cameraDone ? (
                        <Text style={[styles.monoText, { color: textColor }]}>
                          <Text style={{ color: accentColor }}>✓ </Text>
                          <Text style={{ color: textColor }}>camera</Text>
                        </Text>
                      ) : (
                        permSubStep === 'CAMERA' && (
                          <Text style={[styles.monoText, { color: textColor }]}>
                            {permDescTyped.length <= 'camera '.length ? (
                              <Text style={{ color: textColor }}>{permDescTyped}</Text>
                            ) : (
                              <>
                                <Text style={{ color: textColor }}>
                                  {permDescTyped.substring(0, 'camera '.length)}
                                </Text>
                                <Text style={{ color: subtextColor }}>
                                  {permDescTyped.substring('camera '.length)}
                                </Text>
                              </>
                            )}
                            {!permDescDone && (
                              <Text style={{ color: accentColor, opacity: cursorVisible ? 1 : 0 }}>
                                {'█'}
                              </Text>
                            )}
                          </Text>
                        )
                      )}

                      {/* MICROPHONE ITEM */}
                      {micDone ? (
                        <Text style={[styles.monoText, { marginTop: 16, color: textColor }]}>
                          <Text style={{ color: accentColor }}>✓ </Text>
                          <Text style={{ color: textColor }}>microphone</Text>
                        </Text>
                      ) : (
                        permSubStep === 'MICROPHONE' && (
                          <Text style={[styles.monoText, { marginTop: 16, color: textColor }]}>
                            {permDescTyped.length <= 'microphone '.length ? (
                              <Text style={{ color: textColor }}>{permDescTyped}</Text>
                            ) : (
                              <>
                                <Text style={{ color: textColor }}>
                                  {permDescTyped.substring(0, 'microphone '.length)}
                                </Text>
                                <Text style={{ color: subtextColor }}>
                                  {permDescTyped.substring('microphone '.length)}
                                </Text>
                              </>
                            )}
                            {!permDescDone && (
                              <Text style={{ color: accentColor, opacity: cursorVisible ? 1 : 0 }}>
                                {'█'}
                              </Text>
                            )}
                          </Text>
                        )
                      )}

                      {/* NOTIFICATIONS ITEM */}
                      {notifDone ? (
                        <Text style={[styles.monoText, { marginTop: 16, color: textColor }]}>
                          <Text style={{ color: accentColor }}>✓ </Text>
                          <Text style={{ color: textColor }}>notifications</Text>
                        </Text>
                      ) : (
                        permSubStep === 'NOTIFICATIONS' && (
                          <Text style={[styles.monoText, { marginTop: 16, color: textColor }]}>
                            {permDescTyped.length <= 'notifications '.length ? (
                              <Text style={{ color: textColor }}>{permDescTyped}</Text>
                            ) : (
                              <>
                                <Text style={{ color: textColor }}>
                                  {permDescTyped.substring(0, 'notifications '.length)}
                                </Text>
                                <Text style={{ color: subtextColor }}>
                                  {permDescTyped.substring('notifications '.length)}
                                </Text>
                              </>
                            )}
                            {!permDescDone && (
                              <Text style={{ color: accentColor, opacity: cursorVisible ? 1 : 0 }}>
                                {'█'}
                              </Text>
                            )}
                          </Text>
                        )
                      )}

                      {/* ACTION LINK */}
                      {(permDescDone || permSubStep === 'DONE') && (
                        <TouchableOpacity
                          style={styles.continueButton}
                          activeOpacity={0.7}
                          onPress={handleNextPermission}
                        >
                          <Text style={[styles.continueText, { color: textColor }]}>
                            {permSubStep === 'DONE' ? 'done →' : 'continue →'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
  },
  cloudLogo: {
    width: 54,
    height: 50,
  },
  needHelpText: {
    fontFamily: 'ibm_plex_mono',
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  body: {
    flex: 1,
    marginTop: 10,
  },
  monoText: {
    fontFamily: 'ibm_plex_mono',
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 28,
    fontWeight: '500',
  },
  greyText: {
    color: '#8E8E93',
  },
  checkedText: {
    color: '#00E676',
    fontWeight: '600',
  },
  permissionsContainer: {
    flex: 1,
  },
  inputSection: {
    marginTop: 28,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenCursor: {
    width: 14,
    height: 24,
    backgroundColor: '#00E676',
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: 44,
    opacity: 0.01,
  },
  inputText: {
    fontFamily: 'ibm_plex_mono',
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  placeholderText: {
    color: '#8E8E93',
  },
  cancelButton: {
    marginTop: 28,
  },
  cancelText: {
    fontFamily: 'ibm_plex_mono',
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  confirmSection: {
    marginTop: 24,
  },
  creatingSection: {
    marginTop: 24,
  },
  failedSection: {
    marginTop: 10,
  },
  continueButton: {
    marginTop: 28,
  },
  continueText: {
    fontFamily: 'ibm_plex_mono',
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  inlineTermsSection: {
    marginTop: 32,
  },
  bottomTermsSection: {
    marginTop: 'auto',
    marginBottom: 8,
  },
  footerText: {
    fontFamily: 'ibm_plex_mono',
    fontSize: 15,
    color: '#8E8E93',
    lineHeight: 22,
    fontWeight: '500',
  },
  termsLink: {
    color: '#CCCCCC',
    textDecorationLine: 'underline',
  },
});
