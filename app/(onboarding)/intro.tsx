import React, { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, GradientButton, HandNote, PhotoSlot, PzText, TiltCard } from '../../components/pz';
import { radius, shadow, useTheme } from '../../theme/tokens';

type Slide = { key: string; title: string; highlight: string; body: string; Art: React.ComponentType<{ width: number }> };

function CaptureArt({ width }: { width: number }) {
  const w = width - 48;
  return (
    <View style={{ width: w, height: w * 0.86 }}>
      <TiltCard rotate={-8} style={{ left: 0, top: w * 0.08 }}>
        <PhotoSlot tone="dusk" style={{ width: w * 0.42, height: w * 0.36 }} radius={12} doodle={require('../../assets/images/dm_star_2.png')} />
      </TiltCard>
      <TiltCard rotate={7} style={{ right: w * 0.04, top: 0 }}>
        <PhotoSlot tone="sunset" style={{ width: w * 0.4, height: w * 0.4 }} radius={12} doodle={require('../../assets/images/dm_fire.png')} />
      </TiltCard>
      <TiltCard rotate={-3} style={{ left: w * 0.22, top: w * 0.38 }}>
        <PhotoSlot tone="sunset" style={{ width: w * 0.48, height: w * 0.4 }} radius={12} doodle={require('../../assets/images/dm_envalope.png')} />
      </TiltCard>
      <Image source={require('../../assets/images/smile_medium.png')} style={{ position: 'absolute', right: 0, top: -14, width: 40, height: 40 }} />
      <HandNote lines={['Good', 'Friends', 'Better', 'Days']} rotate={-12} size={22} style={{ position: 'absolute', right: 4, bottom: 0 }} />
    </View>
  );
}

function PalsArt({ width }: { width: number }) {
  const { c } = useTheme();
  const w = width - 48;
  const people = [
    { name: 'Aman', size: w * 0.26, left: w * 0.06, top: w * 0.12 },
    { name: 'Riya', size: w * 0.32, left: w * 0.33, top: 0 },
    { name: 'Kabir', size: w * 0.24, left: w * 0.28, top: w * 0.3 },
    { name: 'Meera', size: w * 0.24, left: w * 0.62, top: w * 0.22 },
  ];
  return (
    <View style={{ width: w, height: w * 0.86 }}>
      {people.map((p) => (
        <View key={p.name} style={{ position: 'absolute', left: p.left, top: p.top, padding: 3, borderRadius: p.size, backgroundColor: c.surface, ...shadow.card }}>
          <Avatar name={p.name} size={p.size} />
        </View>
      ))}
      <HandNote lines={['Same', 'People', 'Always']} rotate={-14} size={20} style={{ position: 'absolute', right: 0, top: 0 }} />
      <View style={[styles.groupCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Avatar name="Aman" size={30} />
        <Avatar name="Riya" size={30} style={{ marginLeft: -10 }} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <PzText variant="label">My PAl Group 🔥</PzText>
          <PzText variant="caption" color="muted">5 members</PzText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </View>
    </View>
  );
}

function MemoriesArt({ width }: { width: number }) {
  const w = width - 48;
  return (
    <View style={{ width: w, height: w * 0.86 }}>
      <TiltCard rotate={-6} style={{ left: 0, top: w * 0.12 }}>
        <PhotoSlot tone="dusk" style={{ width: w * 0.3, height: w * 0.3 }} radius={10} />
      </TiltCard>
      <TiltCard rotate={5} style={{ left: w * 0.24, top: 0 }}>
        <PhotoSlot tone="sunset" style={{ width: w * 0.38, height: w * 0.32 }} radius={10} doodle={require('../../assets/images/dm_moon.png')} />
      </TiltCard>
      <TiltCard rotate={-4} style={{ left: w * 0.08, top: w * 0.36 }}>
        <View>
          <PhotoSlot tone="sunset" style={{ width: w * 0.74, height: w * 0.42 }} radius={12} />
          <PzText variant="heading" color="#FFFFFF" style={{ position: 'absolute', left: 14, bottom: 14 }}>
            Today's Recap
          </PzText>
          <View style={styles.play}>
            <Ionicons name="play" size={18} color="#6C3CF4" />
          </View>
        </View>
      </TiltCard>
      <View style={styles.sticky}>
        <HandNote lines={['Good', 'Times', 'Always', 'Stay ♡']} rotate={0} size={18} color="#3A2C00" />
      </View>
    </View>
  );
}

const SLIDES: Slide[] = [
  { key: 'capture', title: 'Capture', highlight: 'Real Moments', body: 'A tiny clip every hour. The little things, big things and everything in between.', Art: CaptureArt },
  { key: 'pals', title: 'With Your', highlight: 'PAls', body: 'A private space for your groups, inside jokes and real memories.', Art: PalsArt },
  { key: 'memories', title: 'Turn Moments', highlight: 'into Memories', body: 'Every day at 4 AM, PalZee stitches your group’s moments into a recap you can relive anytime.', Art: MemoriesArt },
];

/** Mockup 1, screens 2-4. */
export default function Intro() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList<Slide>>(null);
  const last = index === SLIDES.length - 1;

  const next = () => {
    if (last) router.push('/(onboarding)/auth');
    else list.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}>
      <Pressable onPress={() => router.push('/(onboarding)/auth')} hitSlop={12} style={{ alignSelf: 'flex-end', padding: 16 }} accessibilityRole="button">
        <PzText variant="label" color="primary">Skip</PzText>
      </Pressable>
      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.key}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: 24 }}>
            <PzText variant="display">{item.title}</PzText>
            <PzText variant="display" color="primary">{item.highlight}</PzText>
            <PzText variant="body" color="muted" style={{ marginTop: 10, maxWidth: 320 }}>{item.body}</PzText>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
              <item.Art width={width} />
            </View>
          </View>
        )}
      />
      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View key={s.key} style={[styles.dot, { backgroundColor: i === index ? c.primary : c.border, width: i === index ? 18 : 7 }]} />
        ))}
      </View>
      <GradientButton label={last ? 'Create Account' : 'Next'} onPress={next} style={{ marginHorizontal: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: 20 },
  dot: { height: 7, borderRadius: 4 },
  groupCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    ...shadow.card,
  },
  play: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sticky: {
    position: 'absolute',
    right: 0,
    top: 4,
    backgroundColor: '#FFE27A',
    padding: 8,
    borderRadius: 6,
    transform: [{ rotate: '8deg' }],
    ...shadow.card,
  },
});
