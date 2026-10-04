import { useState, useEffect } from 'react';
import { Appearance, ColorSchemeName, useColorScheme } from 'react-native';

/**
 * Returns the current device color scheme with 0ms INSTANT real-time updates
 * combining React Native useColorScheme() hook with direct Appearance listeners.
 */
export function useFastColorScheme(): 'dark' | 'light' {
  const nativeHookScheme = useColorScheme();
  const [scheme, setScheme] = useState<'dark' | 'light'>(() => {
    return (nativeHookScheme || Appearance.getColorScheme()) === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const active = (nativeHookScheme || Appearance.getColorScheme()) === 'dark' ? 'dark' : 'light';
    setScheme(active);
  }, [nativeHookScheme]);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return scheme;
}
