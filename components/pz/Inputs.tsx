import React, { forwardRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, radius, useTheme } from '../../theme/tokens';
import { PzText } from './Typography';

type IconName = keyof typeof Ionicons.glyphMap;

/** Labelled field from the auth mockups: icon on the left, small label above the value. */
export const Field = forwardRef<TextInput, TextInputProps & { label: string; icon: IconName; secure?: boolean; style?: ViewStyle }>(
  function Field({ label, icon, secure, style, ...inputProps }, ref) {
    const { c } = useTheme();
    const [hidden, setHidden] = useState(!!secure);
    const [focused, setFocused] = useState(false);
    return (
      <View
        style={[
          styles.field,
          { backgroundColor: c.surface, borderColor: focused ? c.primary : c.border },
          style,
        ]}
      >
        <Ionicons name={icon} size={20} color={c.textMuted} style={{ marginRight: 14 }} />
        <View style={{ flex: 1 }}>
          <PzText variant="caption" color="muted" style={{ fontSize: 11 }}>
            {label}
          </PzText>
          <TextInput
            ref={ref}
            {...inputProps}
            secureTextEntry={hidden}
            placeholderTextColor={c.textSubtle}
            cursorColor={c.primary}
            selectionColor={c.primary}
            onFocus={(e) => {
              setFocused(true);
              inputProps.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              inputProps.onBlur?.(e);
            }}
            style={[styles.input, { color: c.text }]}
          />
        </View>
        {secure && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={c.textMuted} />
          </Pressable>
        )}
      </View>
    );
  }
);

/** Horizontal filter chips ("All · Groups · Close Friends"). */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  style?: ViewStyle;
}) {
  const { c } = useTheme();
  return (
    // ScrollView defaults to flexGrow/flexShrink 1; a chip row must neither stretch nor be squeezed.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={[{ gap: 8, paddingHorizontal: 16 }, style]}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.chip, { backgroundColor: active ? c.primary : c.surfaceMuted }]}
          >
            <PzText variant="label" color={active ? '#FFFFFF' : c.textMuted} style={{ fontSize: 12.5 }}>
              {o.label}
            </PzText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Two-option segmented control ("Email · Passwordless Code"). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: c.surface, borderColor: c.border }]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && { backgroundColor: c.primary }]}
          >
            <PzText variant="label" color={active ? '#FFFFFF' : c.textMuted}>
              {o.label}
            </PzText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 62,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    fontFamily: fonts.medium,
    fontSize: 15,
    paddingVertical: 2,
    paddingHorizontal: 0,
    textAlignVertical: 'center',
  },
  chip: { paddingHorizontal: 16, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, padding: 4 },
  segment: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
