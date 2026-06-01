import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import Icon from './Icon';

/**
 * Brand-aligned offline banner. Slides down from the top whenever the
 * device loses connectivity. Lives in root layout so every screen gets it
 * "for free". Slides back out + flashes green for ~1.2s on reconnect so
 * the user knows they're live again.
 */
export default function OfflineBanner() {
  const { online } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const ty = useRef(new Animated.Value(-80)).current;
  const wasOffline = useRef(false);
  const [phase, setPhase] = React.useState('hidden'); // hidden | offline | reconnected

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setPhase('offline');
      Animated.spring(ty, { toValue: 0, damping: 18, stiffness: 240, useNativeDriver: true }).start();
    } else if (wasOffline.current) {
      setPhase('reconnected');
      // Keep visible for 1.2s, then hide.
      const t = setTimeout(() => {
        Animated.timing(ty, { toValue: -80, duration: 220, useNativeDriver: true })
          .start(() => setPhase('hidden'));
        wasOffline.current = false;
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [online]);

  if (phase === 'hidden') return null;
  const reconnected = phase === 'reconnected';

  return (
    <Animated.View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={reconnected ? 'Back online' : 'Offline. Some features unavailable.'}
      style={[styles.wrap, { paddingTop: insets.top, transform: [{ translateY: ty }] }]}
    >
      <LinearGradient
        colors={reconnected ? ['#10b981', '#059669'] : ['#ef4444', '#b91c1c']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.inner}
      >
        <Icon name={reconnected ? 'check' : 'powerOff'} size={14} color="#fff" />
        <Text style={styles.text}>
          {reconnected
            ? 'Back online — syncing'
            : 'Offline — some features unavailable'}
        </Text>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 90 },
  inner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  text: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
});
