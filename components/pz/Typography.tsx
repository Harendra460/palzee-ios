import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { fonts, useTheme } from '../../theme/tokens';

type Variant = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyStrong' | 'caption' | 'label' | 'hand';

const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 38, letterSpacing: -0.6 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 31, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 25, letterSpacing: -0.2 },
  subheading: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 16 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17 },
  hand: { fontFamily: fonts.hand, fontSize: 24, lineHeight: 26 },
};

export interface PzTextProps extends TextProps {
  variant?: Variant;
  color?: 'text' | 'muted' | 'subtle' | 'primary' | 'onPrimary' | 'danger' | string;
  align?: TextStyle['textAlign'];
}

export function PzText({ variant = 'body', color = 'text', align, style, ...rest }: PzTextProps) {
  const { c } = useTheme();
  const resolved =
    color === 'text' ? c.text
    : color === 'muted' ? c.textMuted
    : color === 'subtle' ? c.textSubtle
    : color === 'primary' ? c.primary
    : color === 'onPrimary' ? c.onPrimary
    : color === 'danger' ? c.danger
    : color;
  return <Text {...rest} style={[VARIANTS[variant], { color: resolved, textAlign: align }, style]} />;
}
