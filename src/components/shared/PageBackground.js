import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { gradients } from '../../theme/colors';

/**
 * PageBackground — subtle theme-aware backdrop for tabs screens.
 *
 * Lighter than AuthBackground: page gradient + two soft glow orbs.
 * Wrap your screen contents inside this; render whatever you want above.
 *
 * Use `corner="top"` (default) to place orbs at the top of the screen,
 * or `corner="full"` to spread them across.
 */
export default function PageBackground({ children, corner = 'top' }) {
  const { isDark } = useTheme();

  const orb1 = isDark ? 'rgba(99,102,241,0.25)'  : 'rgba(99,102,241,0.32)';
  const orb2 = isDark ? 'rgba(6,182,212,0.18)'   : 'rgba(6,182,212,0.24)';

  return (
    <LinearGradient
      colors={isDark ? gradients.pageHeroDark : gradients.pageHeroLight}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <View style={styles.bg} pointerEvents="none">
        <LinearGradient
          colors={[orb1, 'transparent']}
          style={[styles.orb, corner === 'top' ? styles.orb1Top : styles.orb1Full]}
          start={{ x: 0.5, y: 0.5 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={[orb2, 'transparent']}
          style={[styles.orb, corner === 'top' ? styles.orb2Top : styles.orb2Full]}
          start={{ x: 0.5, y: 0.5 }} end={{ x: 0, y: 1 }}
        />
      </View>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 9999 },
  orb1Top:  { top: -160, right: -120, width: 380, height: 380 },
  orb2Top:  { top: -100, left: -140, width: 320, height: 320 },
  orb1Full: { top: -180, left: -120, width: 460, height: 460 },
  orb2Full: { bottom: -160, right: -140, width: 420, height: 420 },
});
