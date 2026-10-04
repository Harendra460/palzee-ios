import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Audio } from 'expo-av';

LogBox.ignoreLogs([
  '[expo-av]',
  'Expo AV has been deprecated',
  'Video component from `expo-av` is deprecated',
  'expo-av',
  'expo-video',
  'deprecated in favor of `expo-video`',
  'SDK 54',
]);

import { ActivityIndicator, View } from 'react-native';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    bricolage_grotesque_variable: require('../assets/fonts/bricolage_grotesque_variable.ttf'),
    dela_gothic_one_regular: require('../assets/fonts/dela_gothic_one_regular.ttf'),
    google_sans_regular: require('../assets/fonts/google_sans_regular.ttf'),
    ownglyph: require('../assets/fonts/ownglyph.ttf'),
    roboto_medium_numbers: require('../assets/fonts/roboto_medium_numbers.ttf'),
    unpack: require('../assets/fonts/unpack.otf'),
    courier_prime: require('../assets/fonts/courier_prime.ttf'),
    jetbrains_mono_regular: require('../assets/fonts/jetbrains_mono_regular.ttf'),
    ibm_plex_mono: require('../assets/fonts/ibm_plex_mono.ttf'),
    space_mono_regular: require('../assets/fonts/space_mono_regular.ttf'),
    roboto_mono_regular: require('../assets/fonts/roboto_mono_regular.ttf'),
  });

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    }).catch(() => {});

    // Safety timeout to guarantee splash screen dismisses and never gets stuck
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 600);

    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }

    return () => clearTimeout(timer);
  }, [loaded, error]);

  if (!loaded && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#090A0E', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF5232" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
