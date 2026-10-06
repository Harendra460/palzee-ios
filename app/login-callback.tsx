import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../services/supabase';
import { authService } from '../services/authService';
import { usePalzeeStore } from '../stores/palzeeStore';
import { useTheme } from '../theme/tokens';

/**
 * Deep link target for io.supabase.pals://login-callback. OAuth started in-app is finished by the
 * auth browser session in authService; links opened from the mail app (email confirmation,
 * password reset) arrive here with a ?code= that still needs exchanging.
 */
export default function LoginCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { c } = useTheme();
  const [done, setDone] = useState(!code);

  useEffect(() => {
    if (!code) return;
    (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && !usePalzeeStore.getState().user) {
        const user = await authService.currentUser();
        if (user) await usePalzeeStore.getState().signedIn(user);
      }
      setDone(true);
    })();
  }, [code]);

  if (!done) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }
  return <Redirect href="/" />;
}
