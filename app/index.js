import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { userId, userRole, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#08090e' }}>
        <ActivityIndicator size="large" color="#1fb6ce" />
      </View>
    );
  }

  if (!userId) return <Redirect href="/(auth)/login" />;
  if (userRole === 'driver') return <Redirect href="/(driver)" />;
  if (userRole === 'broker') return <Redirect href="/(broker)" />;
  return <Redirect href="/(app)/home" />;
}
