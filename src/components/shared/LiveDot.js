import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

/**
 * Pulse-dot indicator — a solid core with a soft halo that expands and
 * fades on loop. Used wherever the UI is "live" (live activity feed,
 * GPS tracking, hot loads, etc.).
 */
export default function LiveDot({ color = '#10b981', size = 8, ring = true }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.55)).current;
  const pulse   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ringLoop = Animated.loop(
      Animated.parallel([
        Animated.timing(scale,   { toValue: 2.6, duration: 1800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0,   duration: 1800, useNativeDriver: true }),
      ]),
    );
    const coreLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 850, useNativeDriver: true }),
      ]),
    );
    ringLoop.start();
    coreLoop.start();
    return () => { ringLoop.stop(); coreLoop.stop(); };
  }, []);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {ring && (
        <Animated.View
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              transform: [{ scale }],
              opacity,
            },
          ]}
        />
      )}
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: pulse,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute' },
});
