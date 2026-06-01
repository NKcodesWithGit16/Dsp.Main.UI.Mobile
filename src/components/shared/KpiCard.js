import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { glass, shadow, radius, spacing, typography } from '../../theme/colors';
import Icon from './Icon';
import Sparkline from './Sparkline';
import CountUp from './CountUp';

/**
 * KPI metric card — full match for .home-kpi-card on web.
 *
 *   ┌─┬───────────────────────────────────────┐
 *   │ │  [icon]    1,250        ▲ 12% util   │
 *   │ │            Revenue today              │  ← `.home-kpi-label`
 *   │ │            $24.8k                     │  ← `.home-kpi-sub`
 *   └─┴───────────────────────────────────────┘
 *      ↑
 *   4-px gradient-tinted accent strip on the left.
 *
 *   Props
 *   • label / value / sub  – content
 *   • icon                 – Icon name (string) from our Icon set
 *   • color                – accent for the strip + icon tint
 *   • trend                – { up: true, pct: 12 } | { hot: true, pct: 3 } | { down: true, pct: 4 }
 *   • spark                – optional points[] for the inline sparkline
 *   • loading              – render skeleton bars instead of text
 */
export default function KpiCard({
  label, value, sub, icon = 'box',
  color = '#0193ab',
  trend, trendLabel,
  spark,
  loading = false,
  style,
  // Animated count-up support (preferred when value is purely numeric)
  numericValue,
  valuePrefix = '',
  valueSuffix = '',
  valueFormat,
}) {
  const { isDark } = useTheme();
  const fill   = isDark ? glass.fillDarkStrong : glass.fillLightStrong;
  const border = isDark ? glass.borderDark : glass.borderLightSoft;
  const blurIntensity = Platform.OS === 'ios'
    ? (isDark ? glass.blurIosDark : glass.blurIosLight)
    : (isDark ? glass.blurAndDark : glass.blurAndLight);

  return (
    <View style={[styles.outer, shadow.card, style]}>
      <View style={styles.clip}>
        <BlurView intensity={blurIntensity} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
        {!isDark && (
          <LinearGradient
            colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            pointerEvents="none"
            style={styles.topHighlight}
          />
        )}

        <View style={[styles.body, { borderColor: border }]}>
          {/* Edge accent */}
          <View style={[styles.accent, { backgroundColor: color }]} />

          <View style={styles.inner}>
            <View style={[styles.iconWrap, { backgroundColor: color + '1f' }]}>
              <Icon name={icon} size={20} color={color} />
            </View>

            <View style={styles.textCol}>
              {loading ? (
                <>
                  <View style={[styles.skelBar, { width: 64 }]} />
                  <View style={[styles.skelBar, { width: 90, marginTop: 6, height: 9 }]} />
                  <View style={[styles.skelBar, { width: 40, marginTop: 4, height: 8 }]} />
                </>
              ) : (
                <>
                  {typeof numericValue === 'number' ? (
                    <CountUp
                      value={numericValue}
                      prefix={valuePrefix}
                      suffix={valueSuffix}
                      format={valueFormat}
                      style={[styles.value, { color: isDark ? '#f1f5f9' : '#0f172a' }]}
                    />
                  ) : (
                    <Text style={[styles.value, { color: isDark ? '#f1f5f9' : '#0f172a' }]} numberOfLines={1}>
                      {value}
                    </Text>
                  )}
                  {label ? (
                    <Text style={[styles.label, { color: isDark ? '#5dd0e3' : '#04285a' }]} numberOfLines={1}>
                      {label}
                    </Text>
                  ) : null}
                  {sub ? (
                    <Text style={[styles.sub, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>
                      {sub}
                    </Text>
                  ) : null}
                </>
              )}
            </View>
          </View>

          {!loading && trend && (
            <View
              style={[
                styles.trend,
                trend.hot ? styles.trendHot : trend.up ? styles.trendUp : styles.trendDown,
              ]}
            >
              <Icon
                name={trend.hot ? 'flame' : trend.up ? 'trendUp' : 'trendDown'}
                size={11}
                color={trend.hot ? '#dc2626' : trend.up ? '#059669' : '#dc2626'}
              />
              <Text
                style={[
                  styles.trendText,
                  { color: trend.hot ? '#dc2626' : trend.up ? '#059669' : '#dc2626' },
                ]}
              >
                {trend.pct}{trend.hot ? '' : '%'}
              </Text>
              {trendLabel ? (
                <Text style={[styles.trendLbl, { color: isDark ? '#94a3b8' : '#64748b' }]}>{trendLabel}</Text>
              ) : null}
            </View>
          )}

          {!loading && spark && spark.length > 1 && (
            <View style={styles.spark} pointerEvents="none">
              <Sparkline points={spark} color={color} width={64} height={22} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { borderRadius: radius.lg, overflow: 'visible', flexGrow: 1 },
  clip:  { borderRadius: radius.lg, overflow: 'hidden' },
  topHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 18 },

  body: {
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 90,
    overflow: 'hidden',
    position: 'relative',
  },
  accent: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 4,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[3],
    paddingLeft: spacing[3] + 4,
  },
  iconWrap: {
    width: 38, height: 38,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  textCol: { flex: 1, gap: 0, paddingRight: 48 /* leave room for trend pill */ },
  value: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, lineHeight: 26 },
  label: { fontSize: 11.5, fontWeight: '700', marginTop: 1, letterSpacing: 0.1 },
  sub:   { fontSize: 11,   fontWeight: '500', marginTop: 1 },

  trend: {
    position: 'absolute', top: spacing[3], right: spacing[3],
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill,
  },
  trendHot:  { backgroundColor: 'rgba(239,68,68,0.12)' },
  trendUp:   { backgroundColor: 'rgba(16,185,129,0.12)' },
  trendDown: { backgroundColor: 'rgba(239,68,68,0.12)' },
  trendText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.2 },
  trendLbl:  { fontSize: 9, fontWeight: '600', marginLeft: 1 },

  spark: { position: 'absolute', right: spacing[3], bottom: spacing[2] },

  skelBar: {
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(100,116,139,0.20)',
  },
});
