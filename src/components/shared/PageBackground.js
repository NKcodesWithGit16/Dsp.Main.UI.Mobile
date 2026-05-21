import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { gradients } from '../../theme/colors';

const { width: W, height: H } = Dimensions.get('window');
const GRID_SIZE = 52;
const GRID_COLS = Math.ceil(W / GRID_SIZE) + 1;
const GRID_ROWS = 10;

function GridOverlay({ isDark }) {
  const lines = [];
  for (let i = 0; i <= GRID_COLS; i++) {
    lines.push(
      <View
        key={`v${i}`}
        style={{
          position: 'absolute',
          left: i * GRID_SIZE,
          top: 0, bottom: 0,
          width: StyleSheet.hairlineWidth,
          backgroundColor: 'rgba(99,102,241,0.14)',
        }}
      />
    );
  }
  for (let i = 0; i < GRID_ROWS; i++) {
    lines.push(
      <View
        key={`h${i}`}
        style={{
          position: 'absolute',
          top: i * GRID_SIZE,
          left: 0, right: 0,
          height: StyleSheet.hairlineWidth,
          backgroundColor: 'rgba(99,102,241,0.14)',
        }}
      />
    );
  }
  return (
    <View
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: H * 0.55,
        opacity: isDark ? 0.45 : 0.85,
      }}
    >
      {lines}
    </View>
  );
}

export default function PageBackground({ children }) {
  const { isDark } = useTheme();

  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const make = (anim, duration, initialDelay = 0) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: duration / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: duration / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      if (initialDelay > 0) {
        Animated.sequence([Animated.delay(initialDelay), loop]).start();
      } else {
        loop.start();
      }
      return loop;
    };

    const a1 = make(anim1, 20000);
    const a2 = make(anim2, 26000);
    make(anim3, 18000, 4000);

    return () => {
      a1.stop();
      a2.stop();
      anim1.setValue(0);
      anim2.setValue(0);
      anim3.setValue(0);
    };
  }, []);

  const orb1Transform = {
    transform: [
      { translateX: anim1.interpolate({ inputRange: [0, 1], outputRange: [0, 30] }) },
      { translateY: anim1.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) },
    ],
  };
  const orb2Transform = {
    transform: [
      { translateX: anim2.interpolate({ inputRange: [0, 1], outputRange: [0, -30] }) },
      { translateY: anim2.interpolate({ inputRange: [0, 1], outputRange: [0, -20] }) },
    ],
  };
  const orb3Transform = {
    transform: [
      { translateX: anim3.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) },
      { translateY: anim3.interpolate({ inputRange: [0, 1], outputRange: [0, 15] }) },
    ],
  };

  const indigo = isDark ? 'rgba(99,102,241,0.35)'  : 'rgba(99,102,241,0.52)';
  const cyan   = isDark ? 'rgba(6,182,212,0.28)'   : 'rgba(6,182,212,0.42)';
  const violet = isDark ? 'rgba(139,92,246,0.20)'  : 'rgba(139,92,246,0.32)';

  return (
    <LinearGradient
      colors={isDark ? gradients.pageHeroDark : gradients.pageHeroLight}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <View style={styles.bg} pointerEvents="none">
        <GridOverlay isDark={isDark} />

        {/* Orb 1 — indigo, top-left */}
        <Animated.View style={[styles.orb, styles.orb1, orb1Transform]}>
          <LinearGradient
            colors={[indigo, 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Orb 2 — cyan, bottom-right (reverses direction) */}
        <Animated.View style={[styles.orb, styles.orb2, orb2Transform]}>
          <LinearGradient
            colors={[cyan, 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 0, y: 1 }}
          />
        </Animated.View>

        {/* Orb 3 — violet, center */}
        <Animated.View style={[styles.orb, styles.orb3, orb3Transform]}>
          <LinearGradient
            colors={[violet, 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 0.5, y: 1 }}
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
  orb1: { top: -180, left: -140, width: 520, height: 520 },
  orb2: { bottom: -140, right: -140, width: 490, height: 490 },
  orb3: { top: H * 0.38, left: W * 0.32, width: 360, height: 360 },
});
