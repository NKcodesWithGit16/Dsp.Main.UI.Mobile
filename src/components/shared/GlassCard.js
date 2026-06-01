import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { glass, shadow, radius } from '../../theme/colors';

/**
 * GlassCard — premium frosted-glass surface, matched 1:1 with web .home-card.
 *
 *   variant: 'default' | 'strong' | 'floating'
 *   accent : adds a soft teal glow + brand-tinted border
 *
 * Composition (bottom → top):
 *   1. Card shadow (tinted teal)
 *   2. Clip viewport (rounded corners)
 *   3. BlurView (backdrop blur — iOS strong, Android tinted)
 *   4. Fill colour wash (rgba white/dark)
 *   5. Top highlight line (inset 0 1px 0 rgba(255,255,255,0.95))
 *   6. Border on top, content inside
 */
export default function GlassCard({
  children,
  variant = 'default',
  accent = false,
  style,
  contentStyle,
  cornerRadius = radius.xl,
  borderless = false,
  padded = true,
}) {
  const { isDark } = useTheme();

  const fill = isDark
    ? variant === 'floating' ? glass.fillDarkFloat
      : variant === 'strong' ? glass.fillDarkStrong
      : glass.fillDark
    : variant === 'floating' ? glass.fillLightFloat
      : variant === 'strong' ? glass.fillLightStrong
      : glass.fillLight;

  const border = isDark
    ? accent ? glass.borderDarkSoft : glass.borderDark
    : accent ? glass.borderLightSoft : glass.borderLight;

  const blurIntensity = Platform.OS === 'ios'
    ? (isDark ? glass.blurIosDark : glass.blurIosLight)
    : (isDark ? glass.blurAndDark : glass.blurAndLight);

  const shadowStyle = variant === 'floating' ? shadow.floating
    : accent ? shadow.cardStrong
    : shadow.card;

  return (
    <View style={[styles.outer, { borderRadius: cornerRadius }, shadowStyle, style]}>
      <View style={[styles.clip, { borderRadius: cornerRadius }]}>
        <BlurView
          intensity={blurIntensity}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: fill }]}
        />
        {/* Inset top highlight — mimics the `inset 0 1px 0 rgba(255,255,255,0.95)`
            shadow in the web theme so the card edge looks "etched". */}
        {!isDark && (
          <LinearGradient
            colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            pointerEvents="none"
            style={styles.topHighlight}
          />
        )}
        {isDark && (
          <LinearGradient
            colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            pointerEvents="none"
            style={styles.topHighlight}
          />
        )}
        <View
          style={[
            padded ? styles.content : styles.contentBare,
            { borderRadius: cornerRadius, borderColor: border, borderWidth: borderless ? 0 : 1 },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { overflow: 'visible' },
  clip:  { overflow: 'hidden' },
  content:     { padding: 16 },
  contentBare: { padding: 0 },
  topHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 24,
  },
});
