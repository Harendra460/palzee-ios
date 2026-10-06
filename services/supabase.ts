import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// One Supabase project backs both the iOS and Android builds. Override per environment with
// EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (e.g. in .env or EAS env vars).
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ufxwbuxixdlxmuwvrdxz.supabase.co';
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_rDUV2lsgdNJ8VlLFZRUYYQ_EhpqbUc0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE so browser-based OAuth (Apple on Android, Google on iOS) returns a ?code= we can exchange.
    flowType: 'pkce',
  },
});
