import * as SecureStore from 'expo-secure-store';
import { NativeModules } from 'react-native';

/**
 * Biometric auth helper. Stores saved credentials in SecureStore, uses
 * expo-local-authentication to unlock them. Loads the package lazily so
 * the app still runs if the native module isn't in this build (Expo Go,
 * or a dev client built before biometric was added).
 */

const CRED_KEY  = 'hitchlink.biometric.creds';
const ENABLE_KEY = 'hitchlink.biometric.enabled';

// Check the native module exists before we even try to import the JS
// wrapper — touching it without the native side throws on require.
const HAS_NATIVE = !!NativeModules.ExpoLocalAuthentication;

let _la = null;
async function localAuth() {
  if (!HAS_NATIVE) return false;
  if (_la !== null) return _la;
  try {
    _la = await import('expo-local-authentication');
  } catch {
    _la = false;
  }
  return _la;
}

export async function isBiometricSupported() {
  const la = await localAuth();
  if (!la) return { available: false, reason: 'package-missing' };
  try {
    const hasHw = await la.hasHardwareAsync();
    if (!hasHw) return { available: false, reason: 'no-hardware' };
    const enrolled = await la.isEnrolledAsync();
    if (!enrolled) return { available: false, reason: 'not-enrolled' };
    const types = await la.supportedAuthenticationTypesAsync();
    // 1=FINGERPRINT, 2=FACIAL_RECOGNITION, 3=IRIS
    const isFace = types.includes(2);
    const isFinger = types.includes(1);
    return {
      available: true,
      label: isFace ? 'Face ID' : isFinger ? 'Touch ID' : 'Biometrics',
    };
  } catch {
    return { available: false, reason: 'error' };
  }
}

export async function isBiometricEnabled() {
  try {
    const v = await SecureStore.getItemAsync(ENABLE_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function enableBiometric(email, password) {
  try {
    await SecureStore.setItemAsync(CRED_KEY, JSON.stringify({ email, password }));
    await SecureStore.setItemAsync(ENABLE_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export async function disableBiometric() {
  try {
    await SecureStore.deleteItemAsync(CRED_KEY);
    await SecureStore.deleteItemAsync(ENABLE_KEY);
  } catch {}
}

export async function getStoredCreds() {
  try {
    const raw = await SecureStore.getItemAsync(CRED_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function authenticateBiometric(promptMessage = 'Sign in to HitchLink') {
  const la = await localAuth();
  if (!la) return { success: false, error: 'unavailable' };
  try {
    const result = await la.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use password',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result;
  } catch (e) {
    return { success: false, error: e?.message || 'failed' };
  }
}
