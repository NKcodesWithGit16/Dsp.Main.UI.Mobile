import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { useReduceMotion } from '../../hooks/useReduceMotion';

/**
 * Subtle Ken-Burns effect for hero photos. Loops scale 1.0 → 1.08 + slight
 * pan over ~22s for a "this app is alive" feel without being distracting.
 * Honors OS reduce-motion preference.
 */
export default function KenBurnsImage({ source, style, duration = 22000, maxScale = 1.08 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const tx    = useRef(new Animated.Value(0)).current;
  const ty    = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();

  useEffect(() => {
    if (reduce) {
      scale.setValue(1); tx.setValue(0); ty.setValue(0);
      return;
    }
    let cancelled = false;
    const animate = () => {
      if (cancelled) return;
      scale.setValue(1);
      tx.setValue(0);
      ty.setValue(0);
      Animated.parallel([
        Animated.timing(scale, {
          toValue: maxScale, duration,
          easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(tx, {
          toValue: -8, duration,
          easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(ty, {
          toValue: 6, duration,
          easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && !cancelled) animate();
      });
    };
    animate();
    return () => { cancelled = true; };
  }, [duration, maxScale, reduce]);

  return (
    <Animated.Image
      source={source}
      accessibilityIgnoresInvertColors
      style={[
        StyleSheet.absoluteFill,
        style,
        { transform: [{ scale }, { translateX: tx }, { translateY: ty }] },
      ]}
      resizeMode="cover"
    />
  );
}
