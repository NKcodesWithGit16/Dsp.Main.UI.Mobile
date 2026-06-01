import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { radius } from '../../theme/colors';
import { useReduceMotion } from '../../hooks/useReduceMotion';

/**
 * Sweeping-gradient skeleton placeholder. Replace ActivityIndicators with this
 * for a snappier perceived load — the moving shimmer signals progress without
 * the platform spinner's lifeless spinning.
 */
export function SkeletonBlock({
  width = '100%',
  height = 16,
  borderRadius: br = radius.sm,
  style,
}) {
  const { isDark } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();

  useEffect(() => {
    if (reduce) return; // static placeholder when reduce-motion is on
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 400],
  });

  const base = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)';
  const sheen = isDark
    ? ['rgba(255,255,255,0)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']
    : ['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)'];

  return (
    <View
      style={[
        { width, height, borderRadius: br, backgroundColor: base, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX }] },
        ]}
      >
        <LinearGradient
          colors={sheen}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export function SkeletonKpiCard() {
  return (
    <View style={skelStyles.kpi}>
      <SkeletonBlock width={38} height={38} borderRadius={10} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBlock width="60%" height={20} />
        <SkeletonBlock width="80%" height={11} />
        <SkeletonBlock width="40%" height={11} />
      </View>
    </View>
  );
}

export function SkeletonRow({ withAvatar = true }) {
  return (
    <View style={skelStyles.row}>
      {withAvatar && <SkeletonBlock width={36} height={36} borderRadius={18} />}
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBlock width="55%" height={13} />
        <SkeletonBlock width="80%" height={11} />
      </View>
    </View>
  );
}

const skelStyles = StyleSheet.create({
  kpi: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    minHeight: 90,
    width: '47%',
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
});

export default SkeletonBlock;
