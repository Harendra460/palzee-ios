import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { SymbolView, SymbolViewProps, SFSymbol } from 'expo-symbols';

// SF Symbols only exist on iOS; on Android SymbolView renders its `fallback`, so every symbol
// the app uses maps to the closest Ionicons glyph.
const ANDROID_FALLBACK: Partial<Record<SFSymbol, keyof typeof Ionicons.glyphMap>> = {
  plus: 'add',
  bell: 'notifications-outline',
  person: 'person-outline',
  xmark: 'close',
  'arrow.up': 'arrow-up',
  checkmark: 'checkmark',
};

type Props = Omit<SymbolViewProps, 'fallback'> & { size?: number; tintColor?: string };

export function PlatformSymbol({ name, size = 24, tintColor, ...rest }: Props) {
  const sfName = name as SFSymbol;
  const fallbackName = ANDROID_FALLBACK[sfName] ?? 'ellipse-outline';
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={tintColor}
      {...rest}
      fallback={<Ionicons name={fallbackName} size={size} color={tintColor ?? '#000000'} />}
    />
  );
}
