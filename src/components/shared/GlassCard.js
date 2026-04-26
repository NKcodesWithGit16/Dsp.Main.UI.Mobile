import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../context/ThemeContext';
import { glass, shadow, radius } from '../../theme/colors';

/**
 * GlassCard — premium frosted-glass card surface.
 *
 * variant: 'default' | 'strong' | 'floating'
 *   default  — subtle glass for inline content
 *   strong   — denser fill for primary cards
 *   floating — heavier shadow + opaque fill, for modals / sheets
 *
 * accent: when true, adds a soft indigo glow.
 */
export default function GlassCard({
  children,
  variant = 'default',
  accent = false,
  style,
  contentStyle,
  cornerRadius = radius.xl,
  borderless = false,
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
        <View
          style={[
            styles.content,
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
  clip: { overflow: 'hidden' },
  content: { padding: 16 },
});
