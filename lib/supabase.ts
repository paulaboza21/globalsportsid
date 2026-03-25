import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import appConfig from '../app.json';

const appExtra = appConfig?.expo?.extra ?? {};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? appExtra.supabaseUrl ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? appExtra.supabaseAnonKey ?? '';
const appUrlFromEnv = process.env.EXPO_PUBLIC_APP_URL ?? appExtra.appUrl ?? '';

const storage =
  Platform.OS === 'web'
    ? {
        getItem: async (key: string) => window.localStorage.getItem(key),
        setItem: async (key: string, value: string) => window.localStorage.setItem(key, value),
        removeItem: async (key: string) => window.localStorage.removeItem(key),
      }
    : {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const appRedirectUrl = appUrlFromEnv.trim();

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage,
    },
  },
);
