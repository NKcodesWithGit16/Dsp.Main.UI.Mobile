import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ImageBackground, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { gradients, radius, spacing, typography, shadow } from '../../theme/colors';

/**
 * Greeting/hero banner — a navy → teal gradient overlaid on an Unsplash
 * truck photo, with two animated decorative orbs, a top "eyebrow" line,
 * a big display title, and an optional alert pill in the right corner.
 *
 * Used at the top of Home / Driver portal.
 */
export default function HeroBanner({
  eyebrow,
  title,
  date,
  photo,
  rightSlot,
  alert,
  height = 156,
  style,
}) {
  const { isDark } = useTheme();

  // Two-orb subtle decorative drift.
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 9000, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 9000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const orbA = {
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
    ],
  };
  const orbB = {
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
    ],
  };

  return (
    <View style={[styles.outer, shadow.cardStrong, { height }, style]}>
      <ImageBackground
        source={photo ? { uri: photo } : null}
        style={styles.img}
        imageStyle={styles.imgStyle}
      >
        {/* Brand gradient overlay — darker on left, brighter teal on right */}
        <LinearGradient
          colors={isDark
            ? ['rgba(4,40,90,0.92)', 'rgba(1,55,72,0.88)', 'rgba(1,147,171,0.72)']
            : ['rgba(4,40,90,0.86)', 'rgba(8,72,108,0.78)', 'rgba(1,147,171,0.62)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Decorative orbs */}
        <Animated.View style={[styles.orb, styles.orbA, orbA]} />
        <Animated.View style={[styles.orb, styles.orbB, orbB]} />

        {/* Top sheen */}
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={styles.sheen}
          pointerEvents="none"
        />

        <View style={styles.body}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            {date ? <Text style={styles.date}>{date}</Text> : null}
          </View>
          <View style={styles.right}>
            {alert ? (
              <View style={styles.alertPill}>
                <View style={styles.alertDot} />
                <Text style={styles.alertText}>{alert}</Text>
              </View>
            ) : null}
            {rightSlot}
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: radius['2xl'],
    overflow: 'hidden',
  },
  img: { flex: 1 },
  imgStyle: { borderRadius: radius['2xl'] },
  body: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    padding: spacing[5], gap: spacing[3],
  },
  right: { alignItems: 'flex-end', gap: spacing[2] },

  eyebrow: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10, fontWeight: '800', letterSpacing: 1.6,
    marginBottom: 4,
  },
  title: {
    color: '#fff',
    fontSize: typography['2xl'],
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  date: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: typography.xs,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  alertPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(239,68,68,0.26)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.42)',
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.pill,
  },
  alertDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fca5a5' },
  alertText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  orb: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  orbA: { right: -28, top: -28, width: 130, height: 130 },
  orbB: { right: 22, bottom: -34, width: 84, height: 84 },

  sheen: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 36,
  },
});
