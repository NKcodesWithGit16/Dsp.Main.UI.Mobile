import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { typography } from '../../theme/colors';

/**
 * Circular fleet-utilisation gauge — 1:1 with the .home-fleet-ring on web.
 *
 *   • SVG ring with green→cyan gradient stroke
 *   • Center text: percentage on top, "moving/total active" beneath
 */
export default function FleetRing({ pct = 0, moving = 0, total = 0, size = 96 }) {
  const { colors, isDark } = useTheme();
  // Stroke and inner font scale with size so a bigger ring stays readable.
  const stroke = size >= 110 ? 8 : 6;
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const off = c - (clamped / 100) * c;
  const pctFontSize = size >= 110 ? 26 : typography.lg;

  const trackColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%"  stopColor="#10b981" />
            <Stop offset="100%" stopColor="#06b6d4" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          fill="none"
          rotation="-90"
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.pct, { color: colors.textPrimary, fontSize: pctFontSize }]}>{Math.round(clamped)}%</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>{moving}/{total} active</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  pct: { fontWeight: '800', letterSpacing: -0.5 },
  sub: { fontSize: 10, fontWeight: '500', marginTop: 1 },
});
