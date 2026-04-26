import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { gradients } from '../../theme/colors';

/**
 * AuthBackground — premium theme-aware backdrop for auth screens.
 *
 * Renders:
 *   - Full-bleed gradient page wash (light or dark)
 *   - Three soft "glow orbs" (radial-ish gradient circles), positioned
 *     in opposing corners + a faint center glow.
 *   - Children render above (z-index implicit via render order).
 */
export default function AuthBackground({ children }) {
  const { isDark } = useTheme();

  const orbColor1 = isDark ? 'rgba(99,102,241,0.32)'  : 'rgba(99,102,241,0.45)';
  const orbColor2 = isDark ? 'rgba(6,182,212,0.20)'   : 'rgba(6,182,212,0.32)';
  const orbColor3 = isDark ? 'rgba(139,92,246,0.18)'  : 'rgba(139,92,246,0.28)';

  return (
    <LinearGradient
      colors={isDark ? gradients.pageHeroDark : gradients.pageHeroLight}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      {/* Glow orbs — soft radial-feel circles via layered gradients */}
      <View style={styles.bg} pointerEvents="none">
        <LinearGradient
          colors={[orbColor1, 'transparent']}
          style={[styles.orb, styles.orb1]}
          start={{ x: 0.5, y: 0.5 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={[orbColor2, 'transparent']}
          style={[styles.orb, styles.orb2]}
          start={{ x: 0.5, y: 0.5 }} end={{ x: 0, y: 1 }}
        />
        <LinearGradient
          colors={[orbColor3, 'transparent']}
          style={[styles.orb, styles.orb3]}
          start={{ x: 0.5, y: 0.5 }} end={{ x: 1, y: 0 }}
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
  orb1: { top: -180, left: -120, width: 460, height: 460 },
  orb2: { bottom: -160, right: -120, width: 420, height: 420 },
  orb3: { top: '40%', right: '-10%', width: 320, height: 320 },
});
