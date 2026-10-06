import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, ImageSource } from 'expo-image';
import { gradients } from '../../theme/tokens';

/**
 * Image slot for marketing photography. Until real photos are supplied it renders a gradient
 * with one of the app's existing doodles, so each slot is a single `source` swap later.
 */
export function PhotoSlot({
  source,
  tone = 'sunset',
  doodle,
  style,
  radius = 20,
}: {
  source?: ImageSource;
  tone?: keyof typeof gradients;
  doodle?: ImageSource;
  style?: ViewStyle;
  radius?: number;
}) {
  return (
    <View style={[{ overflow: 'hidden', borderRadius: radius }, style]}>
      {source ? (
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <>
          <LinearGradient colors={gradients[tone]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
          {doodle && <Image source={doodle} style={styles.doodle} contentFit="contain" />}
        </>
      )}
    </View>
  );
}

/** Tilted polaroid-style card used in the onboarding collages. */
export function TiltCard({
  rotate,
  style,
  children,
}: {
  rotate: number;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        {
          position: 'absolute',
          padding: 5,
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          transform: [{ rotate: `${rotate}deg` }],
          shadowColor: '#2A1B6B',
          shadowOpacity: 0.18,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  doodle: { position: 'absolute', width: '46%', height: '46%', right: '8%', bottom: '8%', opacity: 0.95 },
});
