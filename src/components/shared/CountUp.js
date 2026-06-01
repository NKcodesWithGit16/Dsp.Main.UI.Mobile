import React, { useEffect, useRef, useState } from 'react';
import { Text, Animated, Easing } from 'react-native';
import { useReduceMotion } from '../../hooks/useReduceMotion';

/**
 * Tabular-num count-up.
 *
 *   • Animates from `start` → `value` over `duration` ms with ease-out cubic
 *   • Supports prefix/suffix (e.g. "$", "k", "%")
 *   • Falls back to instantly showing the value when reduceMotion is true
 *   • Pass `format` for custom formatting (e.g. compact $/k)
 */
export default function CountUp({
  value = 0,
  start = 0,
  duration = 800,
  prefix = '',
  suffix = '',
  format,
  style,
  decimals = 0,
}) {
  const animatedValue = useRef(new Animated.Value(start)).current;
  const [display, setDisplay] = useState(start);
  const prevValue = useRef(start);
  const reduce = useReduceMotion();

  useEffect(() => {
    const from = prevValue.current;
    if (reduce) {
      animatedValue.setValue(value);
      setDisplay(value);
      prevValue.current = value;
      return;
    }
    animatedValue.setValue(from);
    Animated.timing(animatedValue, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    prevValue.current = value;
  }, [value, duration, reduce]);

  useEffect(() => {
    const id = animatedValue.addListener(({ value: v }) => {
      setDisplay(v);
    });
    return () => animatedValue.removeListener(id);
  }, []);

  const text = format
    ? format(display)
    : `${prefix}${display.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}${suffix}`;

  return (
    <Text style={[{ fontVariant: ['tabular-nums'] }, style]} numberOfLines={1}>
      {text}
    </Text>
  );
}
