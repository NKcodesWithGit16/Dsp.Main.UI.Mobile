import React, { useRef } from 'react';
import { Pressable, Animated, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { gradients, radius, shadow, typography } from '../../theme/colors';
import Icon from './Icon';

/**
 * Brand CTA button — Navy→Teal gradient pill with spring press + haptic.
 *
 *   variant: 'primary' (gradient) | 'secondary' (outline glass) | 'ghost'
 *   size   : 'sm' | 'md' | 'lg'
 *   icon   : optional icon name
 *   iconRight: when true, places icon after label
 *   loading: shows spinner
 */
export default function BrandButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight = false,
  loading = false,
  disabled = false,
  full = false,
  style,
  haptic = true,
  accessibilityLabel,
  accessibilityHint,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const sz = size === 'sm' ? { pv: 10, ph: 16, fs: 13, ic: 14, gap: 6 }
           : size === 'lg' ? { pv: 16, ph: 22, fs: 16, ic: 18, gap: 8 }
           : { pv: 13, ph: 20, fs: 14.5, ic: 16, gap: 7 };

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.97, damping: 18, stiffness: 280, mass: 0.6, useNativeDriver: true }).start();
    if (haptic && !disabled) Haptics.selectionAsync().catch(() => {});
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, damping: 18, stiffness: 260, mass: 0.6, useNativeDriver: true }).start();
  };

  const content = (
    <View style={[styles.row, { gap: sz.gap }]}>
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? '#fff' : '#0193ab'} />
      ) : (
        <>
          {icon && !iconRight ? (
            <Icon name={icon} size={sz.ic} color={variant === 'primary' ? '#fff' : '#0193ab'} />
          ) : null}
          {label ? (
            <Text style={[styles.label, {
              fontSize: sz.fs,
              color: variant === 'primary' ? '#fff'
                : variant === 'secondary' ? '#0193ab'
                : '#04285a',
            }]}>
              {label}
            </Text>
          ) : null}
          {icon && iconRight ? (
            <Icon name={icon} size={sz.ic} color={variant === 'primary' ? '#fff' : '#0193ab'} />
          ) : null}
        </>
      )}
    </View>
  );

  const wrapStyle = [
    styles.btn,
    { paddingVertical: sz.pv, paddingHorizontal: sz.ph },
    full ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' },
    disabled && { opacity: 0.55 },
    style,
  ];

  return (
    <Animated.View style={{ transform: [{ scale }], alignSelf: full ? 'stretch' : 'flex-start' }}>
      <Pressable
        onPress={disabled || loading ? null : onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
      >
        {variant === 'primary' ? (
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[wrapStyle, shadow.glow]}
          >
            {content}
          </LinearGradient>
        ) : variant === 'secondary' ? (
          <View style={[wrapStyle, styles.secondary]}>{content}</View>
        ) : (
          <View style={[wrapStyle]}>{content}</View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { fontWeight: '800', letterSpacing: 0.2 },
  secondary: {
    borderWidth: 1.5,
    borderColor: 'rgba(1,147,171,0.42)',
    backgroundColor: 'rgba(1,147,171,0.10)',
  },
});
