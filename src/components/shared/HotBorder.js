import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius } from '../../theme/colors';

/**
 * Animated red→orange gradient border. Wraps any child and renders a
 * 1.5px shimmering border with a soft red tint behind it. Used on hot
 * load cards so urgency reads at a glance, not just from a small badge.
 */
export default function HotBorder({
  children,
  enabled = true,
  borderRadius: br = radius.lg,
  borderWidth = 1.5,
  style,
}) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return;
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [enabled]);

  if (!enabled) return children;

  const rotate = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[{ borderRadius: br }, style]}>
      {/* Outer animated gradient layer */}
      <View style={[
        StyleSheet.absoluteFill,
        { borderRadius: br, overflow: 'hidden' },
      ]}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [{ rotate }],
              width: '200%', height: '200%',
              left: '-50%', top: '-50%',
            },
          ]}
        >
          <LinearGradient
            colors={['#ef4444', '#f59e0b', '#ef4444', '#f59e0b', '#ef4444']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      {/* Inner cutout */}
      <View
        style={{
          margin: borderWidth,
          borderRadius: br - borderWidth,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}
