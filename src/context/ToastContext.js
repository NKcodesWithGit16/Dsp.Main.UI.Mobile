import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';

/**
 * Global toast. Replaces per-screen Toast components.
 * Usage in any screen:
 *   const { showToast } = useToast();
 *   showToast('Load booked', 'success');
 */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((text, kind = 'success', duration = 2200) => {
    setToast({ text, kind, id: Date.now(), duration });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, clearToast: () => setToast(null) }}>
      {children}
      <ToastView toast={toast} onDone={() => setToast(null)} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Don't crash a stand-alone screen render (e.g. tests) — just no-op.
    return { showToast: () => {}, clearToast: () => {} };
  }
  return ctx;
}

function ToastView({ toast, onDone }) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (!toast) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(ty, { toValue: 0, damping: 18, stiffness: 240, mass: 0.9, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(ty, { toValue: -20, duration: 180, useNativeDriver: true }),
      ]).start(() => onDone && onDone());
    }, toast.duration ?? 2200);
    return () => clearTimeout(t);
  }, [toast?.id]);

  if (!toast) return null;
  const color = toast.kind === 'error' ? '#ef4444'
              : toast.kind === 'info'  ? '#0193ab'
              : toast.kind === 'warn'  ? '#f59e0b'
              : '#10b981';

  return (
    <Animated.View
      pointerEvents="none"
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={toast.text}
      style={[
        styles.wrap,
        { top: insets.top + 12, opacity, transform: [{ translateY: ty }] },
      ]}
    >
      <BlurView
        intensity={isDark ? 70 : 60}
        tint={isDark ? 'dark' : 'light'}
        style={styles.blur}
      >
        <View style={[styles.inner, {
          borderColor: color + '55',
          backgroundColor: isDark ? 'rgba(18,22,38,0.78)' : 'rgba(255,255,255,0.88)',
        }]}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.text, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{toast.text}</Text>
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100 },
  blur: { borderRadius: 999, overflow: 'hidden' },
  inner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999, borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 99 },
  text: { fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },
});
