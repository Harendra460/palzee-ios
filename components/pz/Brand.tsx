import React from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText, Rect, G } from 'react-native-svg';
import { fonts, gradients, useTheme } from '../../theme/tokens';
import { PzText } from './Typography';

/**
 * "PalZee" wordmark: "Pal" in the ink colour, "Zee" in the brand gradient, with the two accent
 * strokes from the mockups. Drawn in SVG so the gradient text needs no extra native module.
 */
export function Wordmark({ size = 40, inverted = false, style }: { size?: number; inverted?: boolean; style?: ViewStyle }) {
  const { c } = useTheme();
  const ink = inverted ? '#FFFFFF' : c.text;
  // On photos the brand gradient is too dark to read, so the inverted mark uses a lighter sweep.
  const zee = inverted ? (['#B69CFF', '#7DB8FF'] as const) : gradients.brand;
  const width = size * 3.55;
  const height = size * 1.35;
  const baseline = size * 1.05;
  return (
    <View style={style}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="zee" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={zee[0]} />
            <Stop offset="1" stopColor={zee[1]} />
          </LinearGradient>
        </Defs>
        <SvgText x={0} y={baseline} fontFamily={fonts.extrabold} fontSize={size} fill={ink} letterSpacing={-size * 0.03}>
          Pal
        </SvgText>
        <SvgText x={size * 1.43} y={baseline} fontFamily={fonts.extrabold} fontSize={size} fill="url(#zee)" letterSpacing={-size * 0.03}>
          Zee
        </SvgText>
        <G transform={`translate(${width - size * 0.42}, ${size * 0.08}) rotate(25)`}>
          <Rect width={size * 0.09} height={size * 0.34} rx={size * 0.045} fill={zee[0]} />
        </G>
        <G transform={`translate(${width - size * 0.22}, ${size * 0.3}) rotate(62)`}>
          <Rect width={size * 0.09} height={size * 0.28} rx={size * 0.045} fill={zee[1]} />
        </G>
      </Svg>
    </View>
  );
}

/** Handwritten margin note from the mockups ("Real People Better Days"). */
export function HandNote({
  lines,
  rotate = -8,
  color,
  size = 24,
  style,
}: {
  lines: string[];
  rotate?: number;
  color?: string;
  size?: number;
  style?: ViewStyle;
}) {
  const { c } = useTheme();
  return (
    <View style={[{ transform: [{ rotate: `${rotate}deg` }] }, style]} pointerEvents="none">
      {lines.map((line) => (
        <PzText key={line} variant="hand" color={color ?? c.text} style={{ fontSize: size, lineHeight: size * 1.05 }}>
          {line}
        </PzText>
      ))}
    </View>
  );
}
