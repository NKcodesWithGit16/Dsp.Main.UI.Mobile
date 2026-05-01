import React from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

// UX-only role guard. The real boundary is the backend [Authorize(Roles=...)]
// on each endpoint — a determined user can patch this out of the bundle.
export default function RoleGate({ allow, children }) {
  const { userId, userRole, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#08090e' }}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  if (!userId) return <Redirect href="/(auth)/login" />;

  if (userRole !== allow) {
    if (userRole === 'driver') return <Redirect href="/(driver)" />;
    if (userRole === 'broker') return <Redirect href="/(broker)" />;
    if (userRole === 'dispatcher' || userRole === 'admin') return <Redirect href="/(app)/home" />;
    return <Redirect href="/(auth)/login" />;
  }

  return children;
}
