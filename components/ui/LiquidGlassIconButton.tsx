import React, { useState, useEffect } from 'react';
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  AccessibilityInfo,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { LiquidGlassVariant } from './LiquidGlassView';

export interface LiquidGlassIconButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  isDark?: boolean;
  idPrefix?: string;
  size?: number;
  disabled?: boolean;
  variant?: LiquidGlassVariant;
  style?: any;
}

export const LiquidGlassIconButton: React.FC<LiquidGlassIconButtonProps> = ({
  onPress,
  children,
  isDark = true,
  idPrefix = 'btn',
  size = 45,
  disabled = false,
  variant = 'regular',
  style,
}) => {
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => {
        if (mounted) setReduceTransparency(enabled);
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      (enabled) => {
        if (mounted) setReduceTransparency(enabled);
      }
    );

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  const btnRadius = size / 2;
  const isClear = variant === 'clear';
  const blurIntensity = Platform.OS === 'ios' ? (isClear ? 25 : 45) : (isClear ? 18 : 30);

  const bg = reduceTransparency
    ? isDark
      ? '#1C1C1E'
      : '#F2F2F7'
    : isDark
    ? isClear
      ? 'rgba(255, 255, 255, 0.02)'
      : 'rgba(255, 255, 255, 0.04)'
    : isClear
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(255, 255, 255, 0.14)';

  const rimTop = isDark ? (isClear ? 0.35 : 0.48) : (isClear ? 0.65 : 0.85);
  const rimMid = isDark ? (isClear ? 0.10 : 0.16) : (isClear ? 0.20 : 0.38);
  const rimBot = isDark ? 0.04 : 0.08;

  return (
    <TouchableOpacity
      style={[
        styles.liquidCircleWrapper,
        {
          width: size,
          height: size,
          borderRadius: btnRadius,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
      activeOpacity={0.75}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
    >
      <View
        style={[
          styles.liquidCircleInner,
          {
            borderRadius: btnRadius,
            backgroundColor: bg,
            // @ts-ignore iOS continuous curvature squircle
            borderCurve: 'continuous',
          },
        ]}
      >
        {!reduceTransparency && (
          <BlurView
            key={`blur_${idPrefix}_${variant}_${isDark ? 'dark' : 'light'}`}
            intensity={blurIntensity}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`${idPrefix}GlassRim`} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={rimTop} />
              <Stop offset="45%" stopColor="#FFFFFF" stopOpacity={rimMid} />
              <Stop offset="100%" stopColor={isDark ? '#FFFFFF' : '#000000'} stopOpacity={rimBot} />
            </LinearGradient>
          </Defs>
          <Rect
            x="0.75"
            y="0.75"
            width={size - 1.5}
            height={size - 1.5}
            rx={Math.max(0, btnRadius - 0.75)}
            fill="none"
            stroke={`url(#${idPrefix}GlassRim)`}
            strokeWidth={0.9}
          />
        </Svg>
        <View style={styles.contentContainer}>{children}</View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  liquidCircleWrapper: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
    backgroundColor: 'transparent',
  },
  liquidCircleInner: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});
