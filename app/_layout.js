import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../src/context/ThemeContext';
import { AuthProvider } from '../src/context/AuthContext';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
              <Stack.Screen name="(driver)" />
              <Stack.Screen name="(broker)" />
            </Stack>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
