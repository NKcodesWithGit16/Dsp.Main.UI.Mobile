import React, { useEffect } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';

export default function LiveDot({ color = '#10b981', size = 7 }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 850 }),
        withTiming(1,    { duration: 850 })
      ),
      -1
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{
        width: size, height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }, style]}
    />
  );
}
