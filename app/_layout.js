import { Stack } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../src/context/ThemeContext';
import { AuthProvider } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';
import { StatusBar } from 'expo-status-bar';
import ErrorBoundary from '../src/components/shared/ErrorBoundary';
import OfflineBanner from '../src/components/shared/OfflineBanner';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <ToastProvider>
                <StatusBar style="light" />
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(app)" />
                  <Stack.Screen name="(driver)" />
                  <Stack.Screen name="(broker)" />
                </Stack>
                <OfflineBanner />
              </ToastProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </View>
    </ErrorBoundary>
  );
}
