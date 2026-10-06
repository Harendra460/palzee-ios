import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GoogleG, HandNote, OptionButton, PhotoSlot, PzText, TiltCard, Wordmark } from '../../components/pz';
import { authService } from '../../services/authService';
import { useAuthFlow } from '../../hooks/useAuthFlow';
import { useTheme } from '../../theme/tokens';

/** Mockup 2, screen 2: sign-in method picker. */
export default function AuthChooser() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { busy, run } = useAuthFlow();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16, paddingHorizontal: 24 }}>
      <View style={{ height: 220 }}>
        <TiltCard rotate={-10} style={{ left: 0, top: 70 }}>
          <PhotoSlot tone="dusk" style={{ width: 96, height: 112 }} radius={12} doodle={require('../../assets/images/smile_medium.png')} />
        </TiltCard>
        <TiltCard rotate={6} style={{ left: 86, top: 10 }}>
          <PhotoSlot tone="sunset" style={{ width: 110, height: 130 }} radius={12} doodle={require('../../assets/images/dm_star_3.png')} />
        </TiltCard>
        <TiltCard rotate={-4} style={{ left: 190, top: 40 }}>
          <PhotoSlot tone="sunset" style={{ width: 100, height: 120 }} radius={12} doodle={require('../../assets/images/dm_plant.png')} />
        </TiltCard>
        <HandNote lines={['Create', 'Share', 'Remember', 'Together.']} rotate={-10} size={20} style={{ position: 'absolute', right: 0, top: 96 }} />
      </View>

      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Wordmark size={46} />
        <PzText variant="body" color="muted" style={{ marginTop: 2 }}>A story every hour, with your people.</PzText>
      </View>

      <View style={{ gap: 12, marginTop: 28 }}>
        <OptionButton
          label="Continue with Google"
          icon={<GoogleG size={20} />}
          loading={busy === 'google'}
          onPress={() => run('google', () => authService.signInWithGoogle())}
        />
        <OptionButton
          label="Continue with Apple"
          icon="logo-apple"
          variant="dark"
          loading={busy === 'apple'}
          onPress={() => run('apple', () => authService.signInWithApple())}
        />
        <View style={styles.or}>
          <View style={[styles.rule, { backgroundColor: c.border }]} />
          <PzText variant="caption" color="subtle" style={{ marginHorizontal: 12 }}>or</PzText>
          <View style={[styles.rule, { backgroundColor: c.border }]} />
        </View>
        <OptionButton label="Continue with Email" icon={<Ionicons name="mail-outline" size={22} color={c.text} />} chevron onPress={() => router.push('/(onboarding)/email')} />
      </View>

      <View style={{ flex: 1 }} />
      <PzText variant="caption" color="muted" align="center" style={{ lineHeight: 18 }}>
        By continuing, you agree to PalZee's{'\n'}
        <PzText variant="caption" color="primary" onPress={() => Linking.openURL('https://palzee.fun/tos.html')}>Terms of Service</PzText>
        {' and '}
        <PzText variant="caption" color="primary" onPress={() => Linking.openURL('https://palzee.fun/privacy.html')}>Privacy Policy</PzText>
        .
      </PzText>
    </View>
  );
}

const styles = StyleSheet.create({
  or: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
});
