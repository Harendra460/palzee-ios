import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fonts, gradients, useTheme } from '../../theme/tokens';
import { PzText } from './Typography';

/** Per-person colour identity (Setlog gives every member a colour that marks them in grids). */
const IDENTITY_COLORS = ['#FF7A59', '#C443FF', '#4C8DFF', '#18B97F', '#F5B700', '#FF4D8D', '#6C3CF4', '#00A6C8'];

export function identityColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return IDENTITY_COLORS[Math.abs(h) % IDENTITY_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function Avatar({
  name,
  uri,
  size = 40,
  seed,
  style,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  seed?: string;
  style?: ViewStyle;
}) {
  const bg = identityColor(seed ?? name);
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: bg }, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <PzText style={{ fontFamily: fonts.bold, fontSize: size * 0.38, color: '#FFFFFF' }}>{initials(name)}</PzText>
        </View>
      )}
    </View>
  );
}

/** Story-style ring (Home header row). `seen` swaps the gradient ring for a muted one. */
export function StoryAvatar({
  name,
  uri,
  label,
  seed,
  onPress,
  showAdd,
  seen,
  size = 62,
}: {
  name: string;
  uri?: string | null;
  label: string;
  seed?: string;
  onPress: () => void;
  showAdd?: boolean;
  seen?: boolean;
  size?: number;
}) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: 'center', width: size + 14 }}>
      <View style={{ width: size + 6, height: size + 6 }}>
        {seen ? (
          <View style={[StyleSheet.absoluteFill, { borderRadius: (size + 6) / 2, borderWidth: 2, borderColor: c.border }]} />
        ) : (
          <LinearGradient colors={gradients.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: (size + 6) / 2 }]} />
        )}
        <View style={{ position: 'absolute', top: 3, left: 3, padding: 2, borderRadius: size / 2, backgroundColor: c.bg }}>
          <Avatar name={name} uri={uri} size={size - 4} seed={seed} />
        </View>
        {showAdd && (
          <View style={[styles.add, { backgroundColor: c.primary, borderColor: c.bg }]}>
            <Ionicons name="add" size={14} color="#FFFFFF" />
          </View>
        )}
      </View>
      <PzText variant="caption" numberOfLines={1} style={{ marginTop: 6, fontSize: 11.5 }}>
        {label}
      </PzText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  add: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
