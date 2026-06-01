import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { typography, radius } from '../../theme/colors';

/**
 * Pill-shaped status badge — same vocabulary as the web app
 * (.load-status-badge, .home-status-badge).
 *
 *   tone: 'new' | 'hot' | 'booked' | 'call' | 'moving' | 'idle' | 'offline' | 'success' | 'warn' | 'info'
 *
 *   • Hot loads get a pulsing dot
 *   • Booked / moving show a solid colored dot
 *   • Idle/offline use the muted dot
 */
const PALETTE = {
  new:     { fg: '#0193ab', bg: 'rgba(1,147,171,0.10)', dot: '#0193ab' },
  hot:     { fg: '#dc2626', bg: 'rgba(239,68,68,0.10)', dot: '#ef4444' },
  booked:  { fg: '#059669', bg: 'rgba(16,185,129,0.10)', dot: '#10b981' },
  call:    { fg: '#d97706', bg: 'rgba(245,158,11,0.10)', dot: '#f59e0b' },
  moving:  { fg: '#059669', bg: 'rgba(16,185,129,0.12)', dot: '#10b981' },
  idle:    { fg: '#d97706', bg: 'rgba(245,158,11,0.14)', dot: '#f59e0b' },
  offline: { fg: '#64748b', bg: 'rgba(100,116,139,0.14)', dot: '#94a3b8' },
  success: { fg: '#059669', bg: 'rgba(16,185,129,0.10)', dot: '#10b981' },
  warn:    { fg: '#b45309', bg: 'rgba(245,158,11,0.14)', dot: '#f59e0b' },
  info:    { fg: '#0e7490', bg: 'rgba(6,182,212,0.12)', dot: '#06b6d4' },
  muted:   { fg: '#64748b', bg: 'rgba(100,116,139,0.12)', dot: '#94a3b8' },
};

function normalize(tone) {
  if (!tone) return 'muted';
  const t = String(tone).toLowerCase();
  return PALETTE[t] ? t : 'muted';
}

function HotPulseDot({ color = '#ef4444', size = 6 }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  const scale   = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
        Animated.timing(scale,   { toValue: 2.6, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: color,
          opacity, transform: [{ scale }],
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

export default function StatusBadge({ tone, label, size = 'sm', dot = true, style }) {
  const t = normalize(tone);
  const p = PALETTE[t];
  const isHot = t === 'hot';

  const text = label ?? (typeof tone === 'string' ? tone : t);

  const sizing = size === 'xs'
    ? { px: 6,  py: 1, fs: 9.5, dotSize: 5,  gap: 4 }
    : size === 'md'
    ? { px: 10, py: 4, fs: 12,  dotSize: 6,  gap: 6 }
    : { px: 8,  py: 3, fs: 10.5, dotSize: 5,  gap: 5 };

  return (
    <View style={[
      styles.wrap,
      { backgroundColor: p.bg, paddingHorizontal: sizing.px, paddingVertical: sizing.py, gap: sizing.gap },
      style,
    ]}>
      {dot && (isHot
        ? <HotPulseDot color={p.dot} size={sizing.dotSize} />
        : <View style={{ width: sizing.dotSize, height: sizing.dotSize, borderRadius: sizing.dotSize / 2, backgroundColor: p.dot }} />
      )}
      <Text style={[styles.label, { color: p.fg, fontSize: sizing.fs }]}>
        {String(text).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
