import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useFastColorScheme } from '../../hooks/useFastColorScheme';

/**
 * Apple iOS 26/27 Liquid Glass Material Presets
 * - 'regular': Default balanced depth for floating UI, pills, and navigation bars.
 * - 'clear': Ultra-high transparency for media-rich overlays (camera, video preview).
 * - 'prominent': Higher opacity & deeper blur for elevated modal sheets & dialogs.
 */
export type LiquidGlassVariant = 'regular' | 'clear' | 'prominent';

interface MaterialConfig {
  blurIntensity: number;
  bgDark: string;
  bgLight: string;
  rimTopOpacityDark: number;
  rimTopOpacityLight: number;
  rimMidOpacityDark: number;
  rimMidOpacityLight: number;
  rimBotOpacityDark: number;
  rimBotOpacityLight: number;
  shadowOpacity: number;
  shadowRadius: number;
}

const MATERIAL_PRESETS: Record<LiquidGlassVariant, MaterialConfig> = {
  regular: {
    blurIntensity: Platform.OS === 'ios' ? 45 : 30,
    bgDark: 'rgba(255, 255, 255, 0.03)',
    bgLight: 'rgba(255, 255, 255, 0.12)',
    rimTopOpacityDark: 0.45,
    rimTopOpacityLight: 0.80,
    rimMidOpacityDark: 0.15,
    rimMidOpacityLight: 0.35,
    rimBotOpacityDark: 0.04,
    rimBotOpacityLight: 0.08,
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  clear: {
    blurIntensity: Platform.OS === 'ios' ? 25 : 18,
    bgDark: 'rgba(255, 255, 255, 0.015)',
    bgLight: 'rgba(255, 255, 255, 0.06)',
    rimTopOpacityDark: 0.35,
    rimTopOpacityLight: 0.65,
    rimMidOpacityDark: 0.10,
    rimMidOpacityLight: 0.20,
    rimBotOpacityDark: 0.02,
    rimBotOpacityLight: 0.04,
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  prominent: {
    blurIntensity: Platform.OS === 'ios' ? 65 : 45,
    bgDark: 'rgba(28, 28, 30, 0.40)',
    bgLight: 'rgba(255, 255, 255, 0.25)',
    rimTopOpacityDark: 0.55,
    rimTopOpacityLight: 0.90,
    rimMidOpacityDark: 0.22,
    rimMidOpacityLight: 0.45,
    rimBotOpacityDark: 0.08,
    rimBotOpacityLight: 0.12,
    shadowOpacity: 0.14,
    shadowRadius: 16,
  },
};

/**
 * Hook to monitor iOS system Reduce Transparency preference
 */
function useReduceTransparency(): boolean {
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

  return reduceTransparency;
}

// ---------------------------------------------------------------------------
// LiquidGlassPillBackground
// ---------------------------------------------------------------------------

export interface LiquidGlassPillBackgroundProps {
  isDark: boolean;
  idPrefix: string;
  borderRadius?: number;
  backgroundColor?: string;
  variant?: LiquidGlassVariant;
}

export const LiquidGlassPillBackground: React.FC<LiquidGlassPillBackgroundProps> = ({
  isDark,
  idPrefix,
  borderRadius,
  backgroundColor,
  variant = 'regular',
}) => {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const reduceTransparency = useReduceTransparency();
  const preset = MATERIAL_PRESETS[variant] || MATERIAL_PRESETS.regular;

  const rx = borderRadius !== undefined ? borderRadius : layout.height > 0 ? layout.height / 2 : 26;
  const bg =
    backgroundColor !== undefined
      ? backgroundColor
      : reduceTransparency
      ? isDark
        ? '#1C1C1E'
        : '#F2F2F7'
      : isDark
      ? preset.bgDark
      : preset.bgLight;

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: rx,
          backgroundColor: bg,
          overflow: 'hidden',
          // @ts-ignore iOS continuous curvature squircle
          borderCurve: 'continuous',
        },
      ]}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
          setLayout({ width, height });
        }
      }}
    >
      {!reduceTransparency && Platform.OS === 'ios' && (
        <BlurView
          key={`blur_${idPrefix}_${variant}_${isDark ? 'dark' : 'light'}`}
          intensity={preset.blurIntensity}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      )}
      {layout.width > 0 && (
        <Svg width={layout.width} height={layout.height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`${idPrefix}Rim`} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop
                offset="0%"
                stopColor="#FFFFFF"
                stopOpacity={isDark ? preset.rimTopOpacityDark : preset.rimTopOpacityLight}
              />
              <Stop
                offset="45%"
                stopColor="#FFFFFF"
                stopOpacity={isDark ? preset.rimMidOpacityDark : preset.rimMidOpacityLight}
              />
              <Stop
                offset="100%"
                stopColor={isDark ? '#FFFFFF' : '#000000'}
                stopOpacity={isDark ? preset.rimBotOpacityDark : preset.rimBotOpacityLight}
              />
            </LinearGradient>
          </Defs>
          <Rect
            x="0.6"
            y="0.6"
            width={layout.width - 1.2}
            height={layout.height - 1.2}
            rx={Math.max(0, rx - 0.6)}
            ry={Math.max(0, rx - 0.6)}
            fill="none"
            stroke={`url(#${idPrefix}Rim)`}
            strokeWidth={0.9}
          />
        </Svg>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// LiquidGlassCapsule
// ---------------------------------------------------------------------------

export interface LiquidGlassCapsuleProps {
  children: React.ReactNode;
  isDark?: boolean;
  idPrefix?: string;
  width?: number | string;
  height?: number;
  borderRadius?: number;
  variant?: LiquidGlassVariant;
  style?: ViewStyle | ViewStyle[];
}

export const LiquidGlassCapsule: React.FC<LiquidGlassCapsuleProps> = ({
  children,
  isDark: isDarkProp,
  idPrefix = 'capsule',
  width = 110,
  height = 45,
  borderRadius,
  variant = 'regular',
  style,
}) => {
  const systemScheme = useFastColorScheme();
  const isDark = isDarkProp ?? (systemScheme === 'dark');
  const reduceTransparency = useReduceTransparency();
  const preset = MATERIAL_PRESETS[variant] || MATERIAL_PRESETS.regular;
  const rx = borderRadius ?? height / 2;

  const bg = reduceTransparency
    ? isDark
      ? '#1C1C1E'
      : '#F2F2F7'
    : isDark
    ? preset.bgDark
    : preset.bgLight;

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius: rx,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: isDark ? preset.shadowOpacity * 0.7 : preset.shadowOpacity,
          shadowRadius: preset.shadowRadius,
          elevation: 3,
        },
        style,
      ]}
    >
      <View
        style={{
          flex: 1,
          borderRadius: rx,
          overflow: 'hidden',
          backgroundColor: bg,
          justifyContent: 'center',
          alignItems: 'center',
          // @ts-ignore iOS continuous curvature squircle
          borderCurve: 'continuous',
        }}
      >
        {!reduceTransparency && Platform.OS === 'ios' && (
          <BlurView
            key={`blur_${idPrefix}_${variant}_${isDark ? 'dark' : 'light'}`}
            intensity={preset.blurIntensity}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`${idPrefix}CapsuleRim`} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop
                offset="0%"
                stopColor="#FFFFFF"
                stopOpacity={isDark ? preset.rimTopOpacityDark : preset.rimTopOpacityLight}
              />
              <Stop
                offset="45%"
                stopColor="#FFFFFF"
                stopOpacity={isDark ? preset.rimMidOpacityDark : preset.rimMidOpacityLight}
              />
              <Stop
                offset="100%"
                stopColor={isDark ? '#FFFFFF' : '#000000'}
                stopOpacity={isDark ? preset.rimBotOpacityDark : preset.rimBotOpacityLight}
              />
            </LinearGradient>
          </Defs>
          <Rect
            x="0.75"
            y="0.75"
            width={typeof width === 'number' ? width - 1.5 : '98.5%'}
            height={height - 1.5}
            rx={Math.max(0, rx - 0.75)}
            ry={Math.max(0, rx - 0.75)}
            fill="none"
            stroke={`url(#${idPrefix}CapsuleRim)`}
            strokeWidth={0.9}
          />
        </Svg>
        {children}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// LiquidGlass
// ---------------------------------------------------------------------------

export interface LiquidGlassProps {
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
  isDark?: boolean;
  accentColor?: string;
  borderRadius?: number;
  variant?: LiquidGlassVariant;
  renderer?: 'auto' | 'native' | 'metal';
  cornerStyle?: 'continuous' | 'circular';
  tint?: string;
  interactive?: boolean;
  enableBackgroundExtension?: boolean;
}

export const LiquidGlass: React.FC<LiquidGlassProps> = ({
  style,
  children,
  isDark: isDarkProp,
  borderRadius = 26,
  variant = 'regular',
}) => {
  const systemScheme = useFastColorScheme();
  const isDark = isDarkProp ?? (systemScheme === 'dark');
  const reduceTransparency = useReduceTransparency();
  const preset = MATERIAL_PRESETS[variant] || MATERIAL_PRESETS.regular;

  const bg = reduceTransparency
    ? isDark
      ? '#1C1C1E'
      : '#F2F2F7'
    : isDark
    ? preset.bgDark
    : preset.bgLight;

  return (
    <View
      style={[
        styles.liquidWrapper,
        {
          borderRadius,
          shadowOpacity: isDark ? preset.shadowOpacity * 0.7 : preset.shadowOpacity,
          shadowRadius: preset.shadowRadius,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.liquidInner,
          {
            borderRadius,
            backgroundColor: bg,
            // @ts-ignore iOS continuous curvature squircle
            borderCurve: 'continuous',
          },
        ]}
      >
        {/* 1. Lensing Backdrop Blur */}
        {!reduceTransparency && Platform.OS === 'ios' && (
          <BlurView
            key={`blur_view_${variant}_${isDark ? 'dark' : 'light'}`}
            intensity={preset.blurIntensity}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* 2. Specular Light-Edge Highlight Rim */}
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Defs>
            <LinearGradient id="glassViewRim" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop
                offset="0%"
                stopColor="#FFFFFF"
                stopOpacity={isDark ? preset.rimTopOpacityDark : preset.rimTopOpacityLight}
              />
              <Stop
                offset="45%"
                stopColor="#FFFFFF"
                stopOpacity={isDark ? preset.rimMidOpacityDark : preset.rimMidOpacityLight}
              />
              <Stop
                offset="100%"
                stopColor={isDark ? '#FFFFFF' : '#000000'}
                stopOpacity={isDark ? preset.rimBotOpacityDark : preset.rimBotOpacityLight}
              />
            </LinearGradient>
          </Defs>
          <Rect
            x="0.75"
            y="0.75"
            width="99.2%"
            height="99.2%"
            rx={Math.max(0, borderRadius - 0.75)}
            ry={Math.max(0, borderRadius - 0.75)}
            fill="none"
            stroke="url(#glassViewRim)"
            strokeWidth={0.9}
          />
        </Svg>

        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  liquidWrapper: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    backgroundColor: 'transparent',
  },
  liquidInner: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    position: 'relative',
  },
});
