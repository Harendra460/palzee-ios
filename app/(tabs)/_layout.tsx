import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CaptureFab, PzText } from '../../components/pz';
import { usePalzeeStore } from '../../stores/palzeeStore';
import { useTheme } from '../../theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;
const TABS: Record<string, { label: string; icon: IconName; active: IconName }> = {
  home: { label: 'Home', icon: 'home-outline', active: 'home' },
  pals: { label: 'PAls', icon: 'people-outline', active: 'people' },
  memories: { label: 'Memories', icon: 'albums-outline', active: 'albums' },
  profile: { label: 'Profile', icon: 'person-outline', active: 'person' },
};

/** Mockup tab bar: Home · PAls · (+) · Memories · Profile. */
function PalzeeTabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const items = state.routes.map((route, index) => {
    const meta = TABS[route.name];
    const focused = state.index === index;
    return (
      <Pressable
        key={route.key}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        style={styles.item}
      >
        <Ionicons name={focused ? meta.active : meta.icon} size={23} color={focused ? c.primary : c.textMuted} />
        <PzText variant="caption" color={focused ? c.primary : c.textMuted} style={{ fontSize: 11, marginTop: 3 }}>
          {meta.label}
        </PzText>
      </Pressable>
    );
  });

  return (
    <View style={[styles.bar, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
      {items.slice(0, 2)}
      <View style={styles.fabSlot}>
        <View style={{ marginTop: -30 }}>
          <CaptureFab onPress={() => router.push('/camera')} />
        </View>
      </View>
      {items.slice(2)}
    </View>
  );
}

export default function TabsLayout() {
  const user = usePalzeeStore((s) => s.user);
  if (!user) return <Redirect href="/(onboarding)/welcome" />;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <PalzeeTabBar {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="pals" />
      <Tabs.Screen name="memories" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  fabSlot: { width: 76, alignItems: 'center' },
});
