import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HandNote, LightButton, PhotoSlot, PzText, Wordmark } from '../../components/pz';

/** Mockup 1, screen 1: full-bleed photo, wordmark and "Get Started". */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#14112B' }}>
      <PhotoSlot tone="sunset" radius={0} style={StyleSheet.absoluteFillObject} doodle={require('../../assets/images/onboarding_logo.png')} />
      <LinearGradient
        colors={['rgba(20,17,43,0)', 'rgba(20,17,43,0.15)', 'rgba(20,17,43,0.85)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <HandNote
        lines={['Real', 'People', 'Better', 'Days ♡']}
        color="#FFFFFF"
        size={30}
        rotate={-10}
        style={{ position: 'absolute', top: insets.top + 36, left: 28 }}
      />
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
        <Wordmark size={54} inverted />
        <PzText variant="bodyStrong" color="#FFFFFF" style={{ marginTop: 6, marginBottom: 28, opacity: 0.92 }}>
          A social diary for your real life.
        </PzText>
        <LightButton label="Get Started" onPress={() => router.push('/(onboarding)/intro')} />
      </View>
    </View>
  );
}
