import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field, GoogleG, GradientButton, IconButton, OptionButton, PzText, Segmented } from '../../components/pz';
import { authService } from '../../services/authService';
import { useAuthFlow } from '../../hooks/useAuthFlow';
import { gradients, useTheme } from '../../theme/tokens';

type Mode = 'login' | 'signup';
type LoginMethod = 'password' | 'code';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mockup 2 screen 3 ("Welcome Back") + mockup 1 screen 5 ("Create your account"). */
export default function EmailAuth() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { busy, run } = useAuthFlow();
  const [mode, setMode] = useState<Mode>('signup');
  const [method, setMethod] = useState<LoginMethod>('password');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [sending, setSending] = useState(false);

  const emailOk = EMAIL_RE.test(email.trim());

  const submit = async () => {
    if (!emailOk) return Alert.alert('Check your email', 'Please enter a valid email address.');
    if (mode === 'signup') {
      if (fullName.trim().length < 2) return Alert.alert('Your name', 'Please enter your full name.');
      if (password.length < 8) return Alert.alert('Password', 'Use at least 8 characters.');
      if (!agreed) return Alert.alert('Terms', 'Please agree to the Terms & Privacy Policy.');
      await run('submit', async () => {
        const res = await authService.signUpWithPassword(fullName, email, password);
        if (res.success && 'needsConfirmation' in res) {
          Alert.alert('Confirm your email', `We sent a confirmation link to ${email.trim()}. Open it on this phone to finish.`);
          return { success: false, error: 'cancelled' };
        }
        return res;
      });
      return;
    }
    if (method === 'password') {
      await run('submit', () => authService.signInWithPassword(email, password));
      return;
    }
    if (!codeSent) {
      setSending(true);
      const res = await authService.sendEmailOtp(email);
      setSending(false);
      if (res.success) setCodeSent(true);
      else Alert.alert('Could not send code', res.error);
      return;
    }
    await run('submit', () => authService.verifyEmailOtp(email, code));
  };

  const forgot = async () => {
    if (!emailOk) return Alert.alert('Forgot password', 'Enter your email above first.');
    const res = await authService.sendPasswordReset(email);
    Alert.alert(res.success ? 'Check your inbox' : 'Could not send email', res.success ? 'We sent you a link to reset your password.' : res.error);
  };

  const ctaLabel =
    mode === 'signup' ? 'Sign Up' : method === 'password' ? 'Log In' : codeSent ? 'Verify Code' : 'Send Code';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}
      >
        <View style={styles.topBar}>
          <IconButton name="arrow-back" label="Back" onPress={() => router.back()} />
          <Pressable onPress={() => setMode(mode === 'login' ? 'signup' : 'login')} hitSlop={10} accessibilityRole="button">
            <PzText variant="bodyStrong" color="primary">{mode === 'login' ? 'Sign Up' : 'Log In'}</PzText>
          </Pressable>
        </View>

        <PzText variant="display" style={{ marginTop: 24 }}>{mode === 'login' ? 'Welcome Back' : 'Create your account'}</PzText>
        <PzText variant="body" color="muted" style={{ marginTop: 6 }}>
          {mode === 'login' ? 'Good people make better days.' : 'Join your people and start logging real moments.'}
        </PzText>

        {mode === 'login' && (
          <View style={{ marginTop: 24 }}>
            <Segmented
              options={[
                { key: 'password', label: 'Password' },
                { key: 'code', label: 'Email Code' },
              ]}
              value={method}
              onChange={(m) => {
                setMethod(m);
                setCodeSent(false);
              }}
            />
          </View>
        )}

        <View style={{ gap: 12, marginTop: 20 }}>
          {mode === 'signup' && (
            <Field label="Full Name" icon="person-outline" value={fullName} onChangeText={setFullName} autoComplete="name" textContentType="name" />
          )}
          <Field
            label="Email address"
            icon="mail-outline"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setCodeSent(false);
            }}
            placeholder="you@palzee.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          {(mode === 'signup' || method === 'password') && (
            <Field
              label="Password"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              secure
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              textContentType={mode === 'signup' ? 'newPassword' : 'password'}
            />
          )}
          {mode === 'login' && method === 'code' && codeSent && (
            <Field
              label={`6-digit code sent to ${email.trim()}`}
              icon="keypad-outline"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
            />
          )}
        </View>

        {mode === 'login' && method === 'password' && (
          <Pressable onPress={forgot} style={{ alignSelf: 'flex-end', marginTop: 12 }} hitSlop={8}>
            <PzText variant="label" color="primary">Forgot password?</PzText>
          </Pressable>
        )}

        {mode === 'signup' && (
          <Pressable onPress={() => setAgreed((a) => !a)} style={styles.agree} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
            <Ionicons name={agreed ? 'checkbox' : 'square-outline'} size={20} color={c.primary} />
            <PzText variant="caption" color="muted" style={{ marginLeft: 8, flex: 1 }}>
              I agree to the <PzText variant="caption" color="primary">Terms & Privacy Policy</PzText>
            </PzText>
          </Pressable>
        )}

        <GradientButton
          label={ctaLabel}
          onPress={submit}
          loading={busy === 'submit' || sending}
          colors={gradients.brand}
          style={{ marginTop: 24 }}
        />

        <View style={styles.or}>
          <View style={[styles.rule, { backgroundColor: c.border }]} />
          <PzText variant="caption" color="subtle" style={{ marginHorizontal: 12 }}>or continue with</PzText>
          <View style={[styles.rule, { backgroundColor: c.border }]} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <OptionButton
            label="Google"
            icon={<GoogleG size={20} />}
            style={{ flex: 1 }}
            loading={busy === 'google'}
            onPress={() => run('google', () => authService.signInWithGoogle())}
          />
          <OptionButton
            label="Apple"
            icon="logo-apple"
            style={{ flex: 1 }}
            loading={busy === 'apple'}
            onPress={() => run('apple', () => authService.signInWithApple())}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  agree: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  or: { flexDirection: 'row', alignItems: 'center', marginVertical: 22 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
});
