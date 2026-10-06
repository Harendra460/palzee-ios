import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { User, UserRouteState } from '../types';

/** Web OAuth client ID registered for Google sign-in in Supabase (Android's GOOGLE_WEB_CLIENT_ID). */
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

type AuthResult = { success: true; user: User; route: UserRouteState } | { success: false; error: string };

function toAppUser(u: SupabaseUser, provider: string): User {
  const meta = u.user_metadata ?? {};
  const displayName =
    meta.full_name || meta.name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || u.email?.split('@')[0] || 'Pal';
  return {
    id: u.id,
    email: u.email ?? '',
    displayName,
    avatarUrl: meta.avatar_url || meta.picture || null,
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
  isGoogleSignInAvailable(): boolean {
    return Platform.OS === 'android' && !!GOOGLE_WEB_CLIENT_ID;
  },

  /** Native Google account picker -> ID token -> Supabase session (Android Credential Manager flow). */
  async signInWithGoogle(): Promise<AuthResult> {
    if (!this.isGoogleSignInAvailable()) {
      return { success: false, error: 'Google sign-in is not configured for this build.' };
    }
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
  async updateProfileMetadata(changes: { displayName?: string; avatarUrl?: string | null }): Promise<void> {
    const data: Record<string, string | null> = {};
    if (changes.displayName !== undefined) {
      const [first, ...rest] = changes.displayName.trim().split(' ');
      Object.assign(data, { full_name: changes.displayName.trim(), first_name: first, last_name: rest.join(' ') });
    }
    if (changes.avatarUrl !== undefined) data.avatar_url = changes.avatarUrl;
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
