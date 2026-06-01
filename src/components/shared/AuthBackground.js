import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { gradients } from '../../theme/colors';

const { height: H } = Dimensions.get('window');

/**
 * AuthBackground — premium theme-aware backdrop for auth screens.
 *
 *   • Page wash gradient
 *   • Three brand-colour glow orbs that drift continuously
 *   • Subtle ribbon "spotlight" along the top to add focal weight
 */
export default function AuthBackground({ children }) {
  const { isDark } = useTheme();

  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;
  const a3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopAnim = (v, d, delay = 0) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: d / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: d / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
      if (delay > 0) {
        Animated.sequence([Animated.delay(delay), loop]).start();
      } else {
        loop.start();
      }
      return loop;
    };
    const l1 = loopAnim(a1, 18000);
    const l2 = loopAnim(a2, 24000);
    loopAnim(a3, 16000, 3000);
    return () => { l1.stop(); l2.stop(); };
  }, []);

  const t1 = {
    transform: [
      { translateX: a1.interpolate({ inputRange: [0, 1], outputRange: [0, 24] }) },
      { translateY: a1.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) },
      { scale:      a1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
    ],
  };
  const t2 = {
    transform: [
      { translateX: a2.interpolate({ inputRange: [0, 1], outputRange: [0, -28] }) },
      { translateY: a2.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) },
      { scale:      a2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
    ],
  };
  const t3 = {
    transform: [
      { translateX: a3.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) },
      { translateY: a3.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) },
    ],
  };

  const teal = isDark ? 'rgba(31,182,206,0.34)' : 'rgba(1,147,171,0.48)';
  const cyan = isDark ? 'rgba(6,182,212,0.22)'  : 'rgba(6,182,212,0.36)';
  const navy = isDark ? 'rgba(10,58,120,0.32)'  : 'rgba(4,40,90,0.34)';

  return (
    <LinearGradient
      colors={isDark ? gradients.pageHeroDark : gradients.pageHeroLight}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <View style={styles.bg} pointerEvents="none">
        <Animated.View style={[styles.orb, styles.orb1, t1]}>
          <LinearGradient
            colors={[teal, 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.5 }} end={{ x: 1, y: 1 }}
          />
        </Animated.View>
        <Animated.View style={[styles.orb, styles.orb2, t2]}>
          <LinearGradient
            colors={[cyan, 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.5 }} end={{ x: 0, y: 1 }}
          />
        </Animated.View>
        <Animated.View style={[styles.orb, styles.orb3, t3]}>
          <LinearGradient
            colors={[navy, 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.5 }} end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      </View>

      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 9999, overflow: 'hidden' },
  orb1: { top: -180, left: -120, width: 480, height: 480 },
  orb2: { bottom: -160, right: -120, width: 440, height: 440 },
  orb3: { top: H * 0.42, right: -60, width: 320, height: 320 },
});
