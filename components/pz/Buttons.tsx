import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { gradients, radius, shadow, useTheme } from '../../theme/tokens';
import { PzText } from './Typography';

type IconName = keyof typeof Ionicons.glyphMap;

/** Full-width gradient pill CTA ("Next →", "Sign Up →"). */
export function GradientButton({
  label,
  onPress,
  loading,
  disabled,
  trailingIcon = 'arrow-forward',
  colors = gradients.primary,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  trailingIcon?: IconName | null;
  colors?: readonly [string, string, ...string[]];
  style?: ViewStyle;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.pill, shadow.fab, { opacity: inactive ? 0.6 : pressed ? 0.88 : 1 }, style]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[StyleSheet.absoluteFill, styles.pill]} />
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <View style={styles.row}>
          <PzText variant="bodyStrong" color="onPrimary">
            {label}
          </PzText>
          {trailingIcon && <Ionicons name={trailingIcon} size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />}
        </View>
      )}
    </Pressable>
  );
}

/** White pill used for "Get Started →" on photo backgrounds. */
export function LightButton({ label, onPress, style }: { label: string; onPress: () => void; style?: ViewStyle }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.pill, { backgroundColor: '#FFFFFF', opacity: pressed ? 0.9 : 1 }, style]}
    >
      <View style={styles.row}>
        <PzText variant="bodyStrong" color="#14112B">
          {label}
        </PzText>
        <Ionicons name="arrow-forward" size={18} color="#14112B" style={{ marginLeft: 8 }} />
      </View>
    </Pressable>
  );
}

/** Card-style auth option ("Continue with Google", "Continue with Email ›"). */
export function OptionButton({
  label,
  icon,
  iconColor,
  onPress,
  variant = 'light',
  chevron,
  loading,
  style,
}: {
  label: string;
  icon: React.ReactNode | IconName;
  iconColor?: string;
  onPress: () => void;
  variant?: 'light' | 'dark';
  chevron?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const { c } = useTheme();
  const dark = variant === 'dark';
  const fg = dark ? '#FFFFFF' : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.option,
        dark ? { backgroundColor: '#14112B' } : { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 },
        !dark && shadow.card,
        { opacity: pressed ? 0.88 : 1 },
        style,
      ]}
    >
      <View style={styles.optionIcon}>
        {typeof icon === 'string' ? <Ionicons name={icon as IconName} size={22} color={iconColor ?? fg} /> : icon}
      </View>
      {loading ? (
        <ActivityIndicator color={fg} style={{ flex: 1 }} />
      ) : (
        <PzText variant="bodyStrong" color={fg} style={{ flex: 1, textAlign: chevron ? 'left' : 'center', marginRight: chevron ? 0 : 34 }}>
          {label}
        </PzText>
      )}
      {chevron && <Ionicons name="chevron-forward" size={18} color={c.textMuted} />}
    </Pressable>
  );
}

/** Round icon button for headers (search, bell, settings). */
export function IconButton({
  name,
  onPress,
  color,
  size = 22,
  label,
  badge,
  style,
}: {
  name: IconName;
  onPress: () => void;
  color?: string;
  size?: number;
  label: string;
  badge?: boolean;
  style?: ViewStyle;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.6 : 1 }, style]}
    >
      <Ionicons name={name} size={size} color={color ?? c.text} />
      {badge && <View style={[styles.badge, { backgroundColor: c.heart }]} />}
    </Pressable>
  );
}

/** Purple "+" capture button that floats in the middle of the tab bar. */
export function CaptureFab({ onPress, size = 58 }: { onPress: () => void; size?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Capture a moment"
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, transform: [{ scale: pressed ? 0.94 : 1 }] }, shadow.fab]}
    >
      <LinearGradient
        colors={gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="add" size={size * 0.52} color="#FFFFFF" />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  option: {
    height: 54,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  optionIcon: { width: 34, alignItems: 'flex-start' },
  badge: { position: 'absolute', top: 6, right: 7, width: 8, height: 8, borderRadius: 4 },
});
