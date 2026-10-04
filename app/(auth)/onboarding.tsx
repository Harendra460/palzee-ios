import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { Fonts } from '../../constants/typography';
import { PasskeyTypewriterFlow } from '../../components/auth/PasskeyTypewriterFlow';
import { authService } from '../../services/authService';
import { passkeyService } from '../../services/passkeyService';
import { User } from '../../types';
import { useFastColorScheme } from '../../hooks/useFastColorScheme';

interface OnboardingProps {
  onAuthSuccess: (user: User) => void;
  themeColor?: string;
}

export default function OnboardingScreen({
  onAuthSuccess,
  themeColor = 'green',
}: OnboardingProps) {
  const { width, height } = useWindowDimensions();
  const [showPasskeyFlow, setShowPasskeyFlow] = useState(false);
  const [isPasskeyTriggered, setIsPasskeyTriggered] = useState(false);

  // Animated Entrance Values
  const cloudAnim = useRef(new Animated.Value(1)).current;
  const doodlesAnim = useRef(new Animated.Value(1)).current;
  const textAnim = useRef(new Animated.Value(1)).current;
  const buttonsAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Sequential pop-in entrance animation matching reference video
    Animated.sequence([
      Animated.timing(cloudAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(doodlesAnim, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(textAnim, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(buttonsAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePasskeyPress = async () => {
    if (isPasskeyTriggered) return;
    setIsPasskeyTriggered(true);

    try {
      // Show circular progress indicator inside the button for 1.5s while prompting passkey
      await Promise.all([
        passkeyService.promptNativePasskey(),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch (e) {
      console.warn('Passkey prompt notice:', e);
    } finally {
      setIsPasskeyTriggered(false);
      setShowPasskeyFlow(true);
    }
  };

  // Scaled dimensions matching reference design
  const W = width;
  const H = height;

  // Transform Interpolations
  const cloudScale = cloudAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const doodlesScale = doodlesAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const textTranslateY = textAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [15, 0],
  });

  const buttonsTranslateY = buttonsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const systemScheme = useFastColorScheme();
  const isDark = systemScheme === 'dark';
  const onboardingBg = isDark ? '#000000' : '#FFFFF2';
  const titleColor = isDark ? '#FFFFFF' : '#000000';
  const subtextColor = isDark ? '#E5E5EA' : '#1E1C1A';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: onboardingBg }]}>
      <View style={[styles.content, { backgroundColor: onboardingBg }]}>
        {/* 1. TOP DOODLES (Exact previous positions preserved) */}
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              opacity: doodlesAnim,
              transform: [{ scale: doodlesScale }],
            },
          ]}
          pointerEvents="none"
        >
          {/* Star 1 (top-left sparkle) */}
          <Image
            source={require('../../assets/images/dm_star_1.png')}
            style={{
              position: 'absolute',
              left: W * 0.08 - (W * 0.10) / 2,
              top: H * 0.10 - (W * 0.10) / 2 + 5,
              width: W * 0.10,
              height: W * 0.10,
            }}
            contentFit="contain"
          />

          {/* Star 2 (top-left happy star) */}
          <Image
            source={require('../../assets/images/dm_star_2.png')}
            style={{
              position: 'absolute',
              left: W * 0.28 - (W * 0.20) / 2,
              top: H * 0.07 - (W * 0.20) / 2,
              width: W * 0.20,
              height: W * 0.20,
            }}
            contentFit="contain"
          />

          {/* Star 3 (top-center small sparkle) */}
          <Image
            source={require('../../assets/images/dm_star_3.png')}
            style={{
              position: 'absolute',
              left: W * 0.52 - (W * 0.08) / 2,
              top: H * 0.08 - (W * 0.08) / 2,
              width: W * 0.08,
              height: W * 0.08,
            }}
            contentFit="contain"
          />

          {/* Star 4 (top-right happy star) */}
          <Image
            source={require('../../assets/images/dm_star_4.png')}
            style={{
              position: 'absolute',
              left: W * 0.72 - (W * 0.20) / 2,
              top: H * 0.07 - (W * 0.20) / 2,
              width: W * 0.20,
              height: W * 0.20,
            }}
            contentFit="contain"
          />

          {/* Star 5 (top-right sparkle) */}
          <Image
            source={require('../../assets/images/dm_star_5.png')}
            style={{
              position: 'absolute',
              left: W * 0.88 - (W * 0.10) / 2,
              top: H * 0.18 - (W * 0.10) / 2 - 15,
              width: W * 0.10,
              height: W * 0.10,
            }}
            contentFit="contain"
          />

          {/* Envelope (left side) */}
          <Image
            source={require('../../assets/images/dm_envalope.png')}
            style={{
              position: 'absolute',
              left: W * 0.12 - (W * 0.14 + 15) / 2,
              top: H * 0.276 - (W * 0.14 + 15) / 2 + 5,
              width: W * 0.14 + 15,
              height: W * 0.14 + 15,
            }}
            contentFit="contain"
          />

          {/* Moon (right side) */}
          <Image
            source={require('../../assets/images/dm_moon.png')}
            style={{
              position: 'absolute',
              left: W * 0.84 - (W * 0.17 + 15) / 2,
              top: H * 0.280 - (W * 0.17 + 15) / 2 + 5,
              width: W * 0.17 + 15,
              height: W * 0.17 + 15,
            }}
            contentFit="contain"
          />

          {/* Pizza Slice (lower-left) */}
          <Image
            source={require('../../assets/images/dm_pizza.png')}
            style={{
              position: 'absolute',
              left: W * 0.16 - (W * 0.25 + 10) / 2,
              top: H * 0.475 - (W * 0.25 + 10) / 2 + 8,
              width: W * 0.25 + 10,
              height: W * 0.25 + 10,
              transform: [{ rotate: '-15deg' }],
            }}
            contentFit="contain"
          />

          {/* Orange Fruit (center-bottom) */}
          <Image
            source={require('../../assets/images/dm_orange.png')}
            style={{
              position: 'absolute',
              left: W * 0.44 - (W * 0.11 + 10) / 2,
              top: H * 0.534 - (W * 0.11 + 10) / 2 - 7,
              width: W * 0.11 + 10,
              height: W * 0.11 + 10,
            }}
            contentFit="contain"
          />

          {/* Potted Plant (lower-right) */}
          <Image
            source={require('../../assets/images/dm_plant.png')}
            style={{
              position: 'absolute',
              left: W * 0.79 - (W * 0.41 + 25) / 2,
              top: H * 0.475 - (W * 0.41 + 25) / 2 + 18,
              width: W * 0.41 + 25,
              height: W * 0.41 + 25,
            }}
            contentFit="contain"
          />

          {/* Tea Cup (lower-left) */}
          <Image
            source={require('../../assets/images/dm_tea.png')}
            style={{
              position: 'absolute',
              left: W * 0.18 - (W * 0.186 + 25) / 2,
              top: H * 0.837 - (W * 0.25 + 25) / 2 + 3,
              width: W * 0.186 + 25,
              height: W * 0.25 + 25,
            }}
            contentFit="contain"
          />

          {/* Flames (lower-center) */}
          <Image
            source={require('../../assets/images/dm_fire.png')}
            style={{
              position: 'absolute',
              left: W * 0.52 - (W * 0.186) / 2,
              top: H * 0.87 - (W * 0.15) / 2 + 3,
              width: W * 0.186,
              height: W * 0.15,
            }}
            contentFit="contain"
          />

          {/* Bingsu Ice Cream Glass (lower-right) */}
          <Image
            source={require('../../assets/images/dm_bingsu.png')}
            style={{
              position: 'absolute',
              left: W * 0.84 - (W * 0.17 + 25) / 2,
              top: H * 0.85 - (W * 0.24 + 25) / 2 + 3,
              width: W * 0.17 + 25,
              height: W * 0.24 + 25,
            }}
            contentFit="contain"
          />
        </Animated.View>

        {/* 2. CENTRAL CLOUD CHARACTER (Pops in first) */}
        <Animated.View
          style={{
            position: 'absolute',
            left: W * 0.50 - (W * 0.365) / 2,
            top: H * 0.185 - 32.5,
            width: W * 0.365,
            height: W * 0.365,
            opacity: cloudAnim,
            transform: [{ scale: cloudScale }],
          }}
        >
          <Image
            source={require('../../assets/images/onboarding_logo.png')}
            style={{
              width: '100%',
              height: '100%',
            }}
            contentFit="contain"
          />
        </Animated.View>

        {/* 3. BRANDING & TAGLINE (Fades & slides up) */}
        <Animated.View
          style={{
            position: 'absolute',
            top: H * 0.375 - 35,
            left: 0,
            right: 0,
            alignItems: 'center',
            opacity: textAnim,
            transform: [{ translateY: textTranslateY }],
          }}
        >
          <Text
            style={{
              fontFamily: Fonts.Unpack,
              fontSize: Math.min(W * 0.08, 30),
              fontWeight: 'bold',
              color: titleColor,
              textAlign: 'center',
              letterSpacing: 1.2,
            }}
          >
            PALZEE
          </Text>

          <Text
            style={{
              fontFamily: Fonts.GoogleSans,
              fontSize: Math.min(W * 0.04, 16),
              lineHeight: Math.min(W * 0.055, 22),
              color: subtextColor,
              textAlign: 'center',
              marginTop: 5,
            }}
          >
            new moment every hour,{'\n'}vlog it with your friends.
          </Text>
        </Animated.View>

        {/* 4. AUTHENTICATION BUTTONS & HELP LINK */}
        <Animated.View
          style={{
            position: 'absolute',
            top: H * 0.629 - 27,
            left: W * 0.10,
            right: W * 0.10,
            gap: 12,
            alignItems: 'center',
            opacity: buttonsAnim,
            transform: [{ translateY: buttonsTranslateY }],
          }}
        >
          {/* Button 1: Connect with Passkey */}
          <TouchableOpacity
            style={[
              styles.liquidAuthPillWrapper,
              isPasskeyTriggered && styles.disabledPillButton,
            ]}
            activeOpacity={0.85}
            onPress={handlePasskeyPress}
            disabled={isPasskeyTriggered}
          >
            <View style={styles.liquidAuthPillInner}>
              <BlurView
                key={`blur_passkey_${isDark ? 'dark' : 'light'}`}
                intensity={Platform.OS === 'ios' ? 40 : 30}
                tint={isDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />
              <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="glassRim1" x1="0%" y1="0%" x2="0%" y2="100%">
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
                  width="99.5%"
                  height="53"
                  rx="26.5"
                  fill="none"
                  stroke="url(#glassRim1)"
                  strokeWidth={1.2}
                />
              </Svg>

              {isPasskeyTriggered ? (
                <ActivityIndicator size="small" color={isDark ? '#FFFFFF' : '#000000'} />
              ) : (
                <View style={styles.buttonInnerRow}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      fill={isDark ? '#FFFFFF' : '#000000'}
                      d="M3 20v-2.35c0 -0.63335 0.158335 -1.175 0.475 -1.625 0.316665 -0.45 0.725 -0.79165 1.225 -1.025 1.11665 -0.5 2.1875 -0.875 3.2125 -1.125S9.96665 13.5 11 13.5c0.43335 0 0.85415 0.02085 1.2625 0.0625s0.82915 0.10415 1.2625 0.1875c-0.08335 0.96665 0.09585 1.87915 0.5375 2.7375C14.50415 17.34585 15.15 18.01665 16 18.5v1.5H3Zm16 3.675 -1.5 -1.5v-4.65c-0.73335 -0.21665 -1.33335 -0.62915 -1.8 -1.2375 -0.46665 -0.60835 -0.7 -1.3125 -0.7 -2.1125 0 -0.96665 0.34165 -1.79165 1.025 -2.475 0.68335 -0.68335 1.50835 -1.025 2.475 -1.025s1.79165 0.34165 2.475 1.025c0.68335 0.68335 1.025 1.50835 1.025 2.475 0 0.75 -0.2125 1.41665 -0.6375 2 -0.425 0.58335 -0.9625 1 -1.6125 1.25l1.25 1.25 -1.5 1.5 1.5 1.5 -2 2ZM11 11.5c-1.05 0 -1.9375 -0.3625 -2.6625 -1.0875 -0.725 -0.725 -1.0875 -1.6125 -1.0875 -2.6625s0.3625 -1.9375 1.0875 -2.6625C9.0625 4.3625 9.95 4 11 4s1.9375 0.3625 2.6625 1.0875c0.725 0.725 1.0875 1.6125 1.0875 2.6625s-0.3625 1.9375 -1.0875 2.6625C12.9375 11.1375 12.05 11.5 11 11.5Zm7.5 3.175c0.28335 0 0.52085 -0.09585 0.7125 -0.2875S19.5 13.95835 19.5 13.675c0 -0.28335 -0.09585 -0.52085 -0.2875 -0.7125s-0.42915 -0.2875 -0.7125 -0.2875c-0.28335 0 -0.52085 0.09585 -0.7125 0.2875S17.5 13.39165 17.5 13.675c0 0.28335 0.09585 0.52085 0.2875 0.7125s0.42915 0.2875 0.7125 0.2875Z"
                    />
                  </Svg>
                  <Text style={[styles.buttonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>Connect with Passkey</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Button 2: Connect with Apple */}
          <TouchableOpacity
            style={[
              styles.liquidAuthPillWrapper,
              isPasskeyTriggered && styles.disabledPillButton,
            ]}
            activeOpacity={0.85}
            onPress={handlePasskeyPress}
            disabled={isPasskeyTriggered}
          >
            <View style={styles.liquidAuthPillInner}>
              <BlurView
                key={`blur_apple_${isDark ? 'dark' : 'light'}`}
                intensity={Platform.OS === 'ios' ? 40 : 30}
                tint={isDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />
              <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="glassRim2" x1="0%" y1="0%" x2="0%" y2="100%">
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
                  width="99.5%"
                  height="53"
                  rx="26.5"
                  fill="none"
                  stroke="url(#glassRim2)"
                  strokeWidth={1.2}
                />
              </Svg>

              <View style={styles.buttonInnerRow}>
                <Svg width={18} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.32c.67-.82 1.13-1.96.99-3.12-.99.04-2.2.67-2.9 1.49-.63.73-1.18 1.91-1.03 3.04 1.11.09 2.24-.58 2.94-1.41z"
                    fill={isDark ? '#FFFFFF' : '#000000'}
                  />
                </Svg>
                <Text style={[styles.buttonText, { color: isDark ? '#FFFFFF' : '#000000' }]}>Connect with Apple</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* LOGIN HELP LINK */}
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={handlePasskeyPress}
            style={styles.helpLinkContainer}
          >
            <Text style={[styles.helpLinkText, { color: isDark ? '#FFFFFF' : '#000000' }]}>having trouble logging in?</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <PasskeyTypewriterFlow
        visible={showPasskeyFlow}
        themeColor={themeColor}
        onClose={() => {
          setShowPasskeyFlow(false);
          setIsPasskeyTriggered(false);
        }}
        onSuccess={(user) => {
          setShowPasskeyFlow(false);
          setIsPasskeyTriggered(false);
          onAuthSuccess(user);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    position: 'relative',
  },
  liquidAuthPillWrapper: {
    borderRadius: 27,
    height: 54.5,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  liquidAuthPillInner: {
    borderRadius: 27,
    height: '100%',
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  disabledPillButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  helpLinkContainer: {
    alignItems: 'center',
    marginTop: 8,
    transform: [{ translateX: 15 }],
  },
  helpLinkText: {
    fontSize: 17,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});
