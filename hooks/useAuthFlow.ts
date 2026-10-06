import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { AuthResult } from '../services/authService';
import { usePalzeeStore } from '../stores/palzeeStore';
import { UserRouteState } from '../types';

/** Runs a sign-in call, then routes like Android: new accounts -> permissions, returning -> home. */
export function useAuthFlow() {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, attempt: () => Promise<AuthResult>) {
    if (busy) return;
    setBusy(key);
    try {
      const res = await attempt();
      if (!res.success) {
        if (res.error !== 'cancelled') Alert.alert('Sign-in failed', res.error);
        return;
      }
      await usePalzeeStore.getState().signedIn(res.user);
      router.replace(res.route === UserRouteState.NEW_USER ? '/(onboarding)/permissions' : '/(tabs)/home');
    } finally {
      setBusy(null);
    }
  }

  return { busy, run };
}
