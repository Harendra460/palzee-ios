import { useColorScheme } from 'react-native';

/** PalZee design tokens (light/dark), taken from the 2026 redesign mockups. */
const light = {
  bg: '#F6F4FF',
  surface: '#FFFFFF',
  surfaceMuted: '#F1EEFA',
  border: '#E7E3F5',
  text: '#14112B',
  textMuted: '#6E6A85',
  textSubtle: '#9A96AE',
  primary: '#6C3CF4',
  primaryAlt: '#8B5CFF',
  accentBlue: '#4C8DFF',
  onPrimary: '#FFFFFF',
  danger: '#E5484D',
  heart: '#F0325A',
  overlay: 'rgba(20,17,43,0.45)',
  camera: '#0B0A12',
};

const dark: typeof light = {
  bg: '#0E0C18',
  surface: '#181527',
  surfaceMuted: '#221E36',
  border: '#2C2742',
  text: '#F4F2FF',
  textMuted: '#A9A4C2',
  textSubtle: '#76718F',
  primary: '#8B63FF',
  primaryAlt: '#A47BFF',
  accentBlue: '#5E9BFF',
  onPrimary: '#FFFFFF',
  danger: '#FF6369',
  heart: '#FF4D73',
  overlay: 'rgba(0,0,0,0.6)',
  camera: '#000000',
};

export type Palette = typeof light;

export const gradients = {
  /** Primary CTA (mockup buttons). */
  primary: ['#6C3CF4', '#8B5CFF'] as const,
  /** Brand sweep used on the wordmark and auth CTA (purple -> blue). */
  brand: ['#6C3CF4', '#4C8DFF'] as const,
  /** Story ring. */
  ring: ['#FF7A59', '#C443FF', '#6C3CF4'] as const,
  /** Image placeholders until real photography is supplied. */
  sunset: ['#2B1B5A', '#C2577A', '#F6A75B'] as const,
  dusk: ['#3A2C7A', '#7A5CD6', '#F2B5C8'] as const,
  sky: ['#9CC7FF', '#D9E8FF', '#F6F4FF'] as const,
};

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
  hand: 'Caveat_600SemiBold',
};

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const shadow = {
  card: {
    shadowColor: '#2A1B6B',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  fab: {
    shadowColor: '#6C3CF4',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
};

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { c: isDark ? dark : light, isDark };
}
