import React, { useRef } from 'react';
import { Pressable, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Spring-physics Pressable — gives every tappable surface a tactile feel.
 *
 *   • Scales to `pressedScale` (default 0.97) on touch-down with spring physics
 *   • Triggers Selection haptic when `haptic` is true
 *   • Forwards every other Pressable prop (incl. accessibility*)
 *
 * Accessibility defaults: role="button" and uses `accessibilityLabel` (or
 * children string) so screen readers always have something to announce.
 */
export default function AnimatedPressable({
  children,
  onPress,
  onLongPress,
  haptic = true,
  hapticStyle = 'selection', // 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'
  pressedScale = 0.97,
  disabled,
  style,
  hitSlop,
  containerStyle,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  ...rest
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const triggerHaptic = () => {
    if (!haptic || disabled) return;
    try {
      switch (hapticStyle) {
        case 'light':   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); break;
        case 'medium':  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
        case 'heavy':   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); break;
        case 'success': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
        case 'warning': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); break;
        case 'error':   Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); break;
        default:        Haptics.selectionAsync();
      }
    } catch {}
  };

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: pressedScale,
      damping: 18,
      stiffness: 300,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
    triggerHaptic();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      damping: 18,
      stiffness: 280,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  };

  // Auto-derive an accessibilityLabel if the child is a single string.
  const derivedLabel = accessibilityLabel
    ?? (typeof children === 'string' ? children : undefined);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, containerStyle]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={style}
        hitSlop={hitSlop}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={derivedLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !!disabled, ...(accessibilityState || {}) }}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
