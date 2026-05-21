// Secure storage for the auth token. AsyncStorage is unencrypted on Android,
// so any process with file-system access could read JWTs from it. SecureStore
// uses Android Keystore / iOS Keychain, which is the right primitive here.
//
// The first call to readToken() also migrates any legacy token left behind
// in AsyncStorage so existing logged-in users don't get bounced.

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'userToken';

let migrated = false;

async function migrateLegacyToken() {
  if (migrated) return;
  migrated = true;
  try {
    const legacy = await AsyncStorage.getItem(TOKEN_KEY);
    if (legacy) {
      await SecureStore.setItemAsync(TOKEN_KEY, legacy);
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // best-effort
  }
}

export async function readToken() {
  await migrateLegacyToken();
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function writeToken(token) {
  if (!token) return clearToken();
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {}
}

export async function clearToken() {
  try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch {}
  // Also clear any legacy copy.
  try { await AsyncStorage.removeItem(TOKEN_KEY); } catch {}
}
