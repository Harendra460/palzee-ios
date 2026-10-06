import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { User, UserRouteState } from '../types';

/** Web OAuth client ID registered for Google sign-in in Supabase (Android's GOOGLE_WEB_CLIENT_ID). */
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/** Must be listed under Supabase -> Auth -> URL Configuration -> Redirect URLs. */
export const AUTH_REDIRECT_URL = 'io.supabase.pals://login-callback';

export type AuthResult = { success: true; user: User; route: UserRouteState } | { success: false; error: string };

function toAppUser(u: SupabaseUser, provider: string): User {
  const meta = u.user_metadata ?? {};
  const displayName =
    meta.full_name || meta.name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || u.email?.split('@')[0] || 'Pal';
  return {
    id: u.id,
    email: u.email ?? '',
    displayName,
    avatarUrl: meta.avatar_url || meta.picture || null,
    bio: meta.bio || '',
    isPasskeyRegistered: provider === 'passkey',
    authProvider: provider,
  };
}

/** Android's routing: accounts older than 60s, or with any group membership, are returning users. */
async function routeFor(u: SupabaseUser): Promise<UserRouteState> {
  if (u.created_at && Date.now() - new Date(u.created_at).getTime() > 60_000) return UserRouteState.RETURNING_USER;
  const { data } = await supabase.from('user_pals').select('pal_code').eq('user_id', u.id).limit(1);
  return data && data.length > 0 ? UserRouteState.RETURNING_USER : UserRouteState.NEW_USER;
}

async function success(u: SupabaseUser, provider: string): Promise<AuthResult> {
  return { success: true, user: toAppUser(u, provider), route: await routeFor(u) };
}

function errorMessage(e: unknown, fallback: string): string {
  const msg = (e as any)?.message ?? '';
  if (/rate limit/i.test(msg)) return 'Too many attempts. Please wait a few minutes and try again.';
  return msg || fallback;
}

export const authService = {
  /** Google: native account picker on Android, Supabase browser OAuth elsewhere. */
  async signInWithGoogle(): Promise<AuthResult> {
    if (Platform.OS !== 'android' || !GOOGLE_WEB_CLIENT_ID) return this.signInWithOAuthBrowser('google');
    try {
      const { GoogleSignin, isSuccessResponse } = require('@react-native-google-signin/google-signin');
      GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return { success: false, error: 'cancelled' };
      const idToken = response.data.idToken;
      if (!idToken) return { success: false, error: 'Google did not return an ID token.' };
      const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
      if (error || !data.user) return { success: false, error: errorMessage(error, 'Google sign-in failed.') };
      return success(data.user, 'google');
    } catch (e) {
      return { success: false, error: errorMessage(e, 'Google sign-in failed.') };
    }
  },

  /** Apple: native sheet on iOS (ID token + nonce), Supabase browser OAuth on Android. */
  async signInWithApple(): Promise<AuthResult> {
    if (Platform.OS !== 'ios') return this.signInWithOAuthBrowser('apple');
    try {
      const AppleAuthentication = require('expo-apple-authentication');
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) return { success: false, error: 'Apple did not return an identity token.' };
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (error || !data.user) return { success: false, error: errorMessage(error, 'Apple sign-in failed.') };
      // Apple only shares the name on the very first authorization; keep it in metadata.
      const given = credential.fullName?.givenName;
      if (given && !data.user.user_metadata?.full_name) {
        const full = [given, credential.fullName?.familyName].filter(Boolean).join(' ');
        await supabase.auth.updateUser({ data: { full_name: full, first_name: given } });
        data.user.user_metadata = { ...data.user.user_metadata, full_name: full, first_name: given };
      }
      return success(data.user, 'apple');
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return { success: false, error: 'cancelled' };
      return { success: false, error: errorMessage(e, 'Apple sign-in failed.') };
    }
  },

  /** Supabase-hosted OAuth in an auth browser session, finished with a PKCE code exchange. */
  async signInWithOAuthBrowser(provider: 'google' | 'apple'): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: AUTH_REDIRECT_URL, skipBrowserRedirect: true },
      });
      if (error || !data.url) return { success: false, error: errorMessage(error, 'Could not start sign-in.') };
      const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT_URL);
      if (result.type !== 'success') return { success: false, error: 'cancelled' };
      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      const oauthError = url.searchParams.get('error_description');
      if (!code) return { success: false, error: oauthError || 'Sign-in was not completed.' };
      const { data: session, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError || !session.user) return { success: false, error: errorMessage(exchangeError, 'Sign-in failed.') };
      return success(session.user, provider);
    } catch (e) {
      return { success: false, error: errorMessage(e, 'Sign-in failed.') };
    }
  },

  async signUpWithPassword(fullName: string, email: string, password: string): Promise<AuthResult | { success: true; needsConfirmation: true }> {
    const [first, ...rest] = fullName.trim().split(/\s+/);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: fullName.trim(), first_name: first, last_name: rest.join(' ') }, emailRedirectTo: AUTH_REDIRECT_URL },
    });
    if (error || !data.user) return { success: false, error: errorMessage(error, 'Could not create your account.') };
    if (!data.session) return { success: true, needsConfirmation: true };
    return success(data.user, 'email');
  },

  async signInWithPassword(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error || !data.user) return { success: false, error: errorMessage(error, 'Wrong email or password.') };
    return success(data.user, 'email');
  },

  async sendPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: AUTH_REDIRECT_URL });
    return error ? { success: false, error: errorMessage(error, 'Could not send the reset email.') } : { success: true };
  },

  async sendEmailOtp(email: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    return error ? { success: false, error: errorMessage(error, 'Could not send the code.') } : { success: true };
  },

  async verifyEmailOtp(email: string, token: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'email',
    });
    if (error || !data.user) return { success: false, error: errorMessage(error, 'Invalid or expired code.') };
    return success(data.user, 'email');
  },

  /**
   * The "passkey" account: like Android's registerTemporaryPasskeyUser, an email/password signup
   * with a random password and `is_temporary` metadata. Fails loudly instead of inventing a local
   * user id, since a user without a session cannot read or write any group data.
   */
  async registerTemporaryPasskey(firstName: string, lastName: string, email: string): Promise<AuthResult> {
    const password = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}PassKey123!`;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { first_name: firstName.trim(), last_name: lastName.trim(), is_temporary: true } },
    });
    if (error || !data.user) return { success: false, error: errorMessage(error, 'Could not create your account.') };
    if (!data.session) {
      return { success: false, error: 'Check your inbox to confirm your email, then sign in with the code.' };
    }
    return success(data.user, 'passkey');
  },

  /** Restores the signed-in user from the persisted Supabase session, if any. */
  async currentUser(): Promise<User | null> {
    const { data } = await supabase.auth.getSession();
    const u = data.session?.user;
    return u ? toAppUser(u, (u.app_metadata?.provider as string) || 'email') : null;
  },

  /** Profile fields live in auth metadata so they come back with the restored session. */
  async updateProfileMetadata(changes: { displayName?: string; avatarUrl?: string | null; bio?: string }): Promise<void> {
    const data: Record<string, string | null> = {};
    if (changes.displayName !== undefined) {
      const [first, ...rest] = changes.displayName.trim().split(' ');
      Object.assign(data, { full_name: changes.displayName.trim(), first_name: first, last_name: rest.join(' ') });
    }
    if (changes.avatarUrl !== undefined) data.avatar_url = changes.avatarUrl;
    if (changes.bio !== undefined) data.bio = changes.bio.trim();
    const { error } = await supabase.auth.updateUser({ data });
    if (error) throw error;
  },

  /** Soft delete (same as Android): removes the user's clips and memberships, then signs out. */
  async softDeleteAccount(userId: string): Promise<void> {
    await supabase.from('submissions').delete().eq('user_id', userId);
    await supabase.from('user_pals').delete().eq('user_id', userId);
    await this.signOut();
  },

  /** Signs out and clears everything cached on the device for this user. */
  async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out error', e);
    }
    if (Platform.OS === 'android' && GOOGLE_WEB_CLIENT_ID) {
      try {
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        await GoogleSignin.signOut();
      } catch {}
    }
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => !k.startsWith('sb-') && k !== 'palzee_theme_color'));
    if (FileSystem.cacheDirectory) {
      await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}saved_pals/`, { idempotent: true }).catch(() => {});
    }
  },
};
