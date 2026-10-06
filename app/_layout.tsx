import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Caveat_600SemiBold } from '@expo-google-fonts/caveat';
import { usePalzeeStore } from '../stores/palzeeStore';
import { pushService } from '../services/pushService';
import { supabase } from '../services/supabase';
import { useTheme } from '../theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { c, isDark } = useTheme();
  const ready = usePalzeeStore((s) => s.ready);
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Caveat_600SemiBold,
  });

  useEffect(() => {
    void usePalzeeStore.getState().restoreSession();
    let stopPush: (() => void) | undefined;
    pushService.init().then((stop) => (stopPush = stop)).catch(() => {});
    // A refresh-token failure or a sign-out on another device ends the session here too.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && usePalzeeStore.getState().user) {
        void usePalzeeStore.getState().signOut();
      }
    });
    return () => {
      stopPush?.();
      data.subscription.unsubscribe();
    };
  }, []);

  const loaded = (fontsLoaded || !!fontError) && ready;
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="camera" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="pal/[code]" />
          <Stack.Screen name="chat/[code]" />
          <Stack.Screen name="recap/[code]" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="new-pal" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="login-callback" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
