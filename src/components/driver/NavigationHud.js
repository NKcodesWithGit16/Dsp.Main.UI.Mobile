import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { formatDistance, formatDuration, maneuverGlyph } from '../../utils/navigation';

// Top maneuver banner: glyph + distance + instruction.
export function NavManeuverBanner({ step, distanceToManeuverMeters, isRerouting }) {
  const insets = useSafeAreaInsets();
  if (!step) return null;

  return (
    <View style={[bannerS.wrap, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
      <LinearGradient
        colors={isRerouting ? ['#f59e0b', '#ea580c'] : ['#4f46e5', '#7c3aed']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={bannerS.card}
      >
        <View style={bannerS.glyphBox}>
          <Text style={bannerS.glyph}>{maneuverGlyph(step.maneuver)}</Text>
        </View>
        <View style={bannerS.body}>
          <Text style={bannerS.distance} numberOfLines={1}>
            {isRerouting ? 'Rerouting…' : `In ${formatDistance(distanceToManeuverMeters)}`}
          </Text>
          <Text style={bannerS.instruction} numberOfLines={2}>
            {step.instruction || 'Continue on route'}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

// Bottom HUD: ETA + remaining distance + Stop button.
export function NavBottomHud({
  remainingMeters, remainingSeconds, speedMph, onStop, bottomOffset = 0,
}) {
  const { isDark } = useTheme();
  const arrival = remainingSeconds
    ? new Date(Date.now() + remainingSeconds * 1000)
        .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <View style={[hudS.wrap, { bottom: 18 + bottomOffset }]} pointerEvents="box-none">
      <BlurView
        intensity={Platform.OS === 'ios' ? 70 : 110}
        tint={isDark ? 'dark' : 'light'}
        style={hudS.blur}
      >
        <View style={[hudS.card, {
          backgroundColor: isDark ? 'rgba(12,18,35,0.72)' : 'rgba(255,255,255,0.78)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        }]}>
          <View style={hudS.statCol}>
            <Text style={[hudS.statValue, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>
              {formatDuration(remainingSeconds)}
            </Text>
            <Text style={hudS.statLabel}>ETA</Text>
            {arrival ? <Text style={hudS.statSub}>{arrival}</Text> : null}
          </View>

          <View style={hudS.divider} />

          <View style={hudS.statCol}>
            <Text style={[hudS.statValue, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>
              {formatDistance(remainingMeters)}
            </Text>
            <Text style={hudS.statLabel}>REMAINING</Text>
          </View>

          <View style={hudS.divider} />

          <View style={hudS.statCol}>
            <Text style={[hudS.statValue, { color: '#22c55e' }]}>
              {speedMph != null ? speedMph : '—'}
              <Text style={[hudS.statValue, { fontSize: 12, color: '#94a3b8' }]}> mph</Text>
            </Text>
            <Text style={hudS.statLabel}>SPEED</Text>
          </View>

          <TouchableOpacity onPress={onStop} activeOpacity={0.85} style={hudS.stopBtn}>
            <Text style={hudS.stopBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
}

const bannerS = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, zIndex: 25 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 14, paddingVertical: 14,
    borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32, shadowRadius: 24, elevation: 14,
  },
  glyphBox: {
    width: 54, height: 54, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  glyph: { color: '#fff', fontSize: 32, fontWeight: '900', lineHeight: 36 },
  body: { flex: 1 },
  distance: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  instruction: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: -0.3, marginTop: 2, lineHeight: 21 },
});

const hudS = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 22 },
  blur: { borderRadius: 18, overflow: 'hidden' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 4,
    borderRadius: 18, borderWidth: 1,
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 18, elevation: 10,
  },
  statCol: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  statLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.7, color: '#94a3b8' },
  statSub: { fontSize: 10.5, fontWeight: '600', color: '#94a3b8', marginTop: 1 },
  divider: { width: 1, height: 28, backgroundColor: 'rgba(148,163,184,0.3)', marginHorizontal: 4 },
  stopBtn: {
    width: 38, height: 38, borderRadius: 99, marginLeft: 6,
    backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 5,
  },
  stopBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
