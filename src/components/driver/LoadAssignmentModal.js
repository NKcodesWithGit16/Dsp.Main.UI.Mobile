import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Animated, Easing, ActivityIndicator, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';

const EQUIPMENT_LABELS = {
  DryVan: 'Dry Van', Reefer: 'Reefer', Flatbed: 'Flatbed',
  Stepdeck: 'Stepdeck', Lowboy: 'Lowboy', Hotshot: 'Hotshot',
};

function fmtMoney(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function LoadAssignmentModal({
  visible, load, onAccept, onDeny, accepting, denying,
}) {
  const { colors, isDark } = useTheme();
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(sparkle, { toValue: 1, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(sparkle, { toValue: 0, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ]),
      ).start();
    } else {
      scale.setValue(0.9);
      opacity.setValue(0);
    }
  }, [visible]);

  if (!visible || !load) return null;

  const equipment = EQUIPMENT_LABELS[load.equipment] || load.equipment || '—';
  const ratePerMile = load.rpm ? `$${Number(load.rpm).toFixed(2)}/mi` : null;
  const busy = accepting || denying;

  const sparkleOpacity = sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <Animated.View style={[s.backdrop, { opacity }]}>
        <BlurView intensity={Platform.OS === 'ios' ? 50 : 110} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(15,23,42,0.35)' }]} />

        <Animated.View style={[s.card, {
          transform: [{ scale }],
          backgroundColor: isDark ? 'rgba(18,22,38,0.96)' : '#ffffff',
          borderColor: isDark ? 'rgba(1,147,171,0.35)' : 'rgba(1,147,171,0.2)',
        }]}>
          <LinearGradient
            colors={['#04285a', '#0193ab', '#5dd0e3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.topAccent}
          />

          <View style={s.header}>
            <Animated.Text style={[s.sparkleLeft, { opacity: sparkleOpacity }]}>✦</Animated.Text>
            <Text style={[s.headerEyebrow, { color: colors.accent }]}>NEW LOAD ASSIGNED</Text>
            <Animated.Text style={[s.sparkleRight, { opacity: sparkleOpacity }]}>✦</Animated.Text>
          </View>

          <View style={s.routeBlock}>
            <View style={s.routeRow}>
              <View style={s.routeDot}>
                <LinearGradient colors={['#22c55e', '#16a34a']} style={s.routeDotInner} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.routeLabel, { color: colors.textMuted }]}>PICKUP</Text>
                <Text style={[s.routePlace, { color: colors.textPrimary }]} numberOfLines={1}>
                  {load.origin}{load.originState ? `, ${load.originState}` : ''}
                </Text>
              </View>
            </View>

            <View style={[s.routeConnector, { backgroundColor: colors.border }]} />

            <View style={s.routeRow}>
              <View style={s.routeDot}>
                <LinearGradient colors={['#ef4444', '#dc2626']} style={s.routeDotInner} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.routeLabel, { color: colors.textMuted }]}>DELIVERY</Text>
                <Text style={[s.routePlace, { color: colors.textPrimary }]} numberOfLines={1}>
                  {load.destination}{load.destState ? `, ${load.destState}` : ''}
                </Text>
              </View>
            </View>
          </View>

          <View style={[s.statsRow, { borderColor: colors.border }]}>
            <View style={s.statCell}>
              <Text style={[s.statValue, { color: colors.textPrimary }]}>{fmtMoney(load.rate)}</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Rate</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.statCell}>
              <Text style={[s.statValue, { color: colors.textPrimary }]}>
                {load.miles ? `${Math.round(load.miles)}` : '—'}
                <Text style={[s.statUnit, { color: colors.textMuted }]}> mi</Text>
              </Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Distance</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.statCell}>
              <Text style={[s.statValue, { color: colors.textPrimary }]}>{ratePerMile || '—'}</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Per mile</Text>
            </View>
          </View>

          <View style={s.metaRow}>
            <View style={[s.chip, { backgroundColor: isDark ? 'rgba(1,147,171,0.15)' : 'rgba(1,147,171,0.08)', borderColor: isDark ? 'rgba(1,147,171,0.3)' : 'rgba(1,147,171,0.2)' }]}>
              <Text style={[s.chipText, { color: colors.accent }]}>{equipment}</Text>
            </View>
            {load.commodity && (
              <View style={[s.chip, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderColor: colors.border }]}>
                <Text style={[s.chipText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {load.commodity}
                </Text>
              </View>
            )}
            {load.weight ? (
              <View style={[s.chip, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderColor: colors.border }]}>
                <Text style={[s.chipText, { color: colors.textSecondary }]}>
                  {Math.round(load.weight)} lb
                </Text>
              </View>
            ) : null}
          </View>

          {load.brokerName ? (
            <View style={s.brokerRow}>
              <Text style={[s.brokerLabel, { color: colors.textMuted }]}>Broker</Text>
              <Text style={[s.brokerName, { color: colors.textPrimary }]} numberOfLines={1}>
                {load.brokerName}
              </Text>
            </View>
          ) : null}

          <View style={s.btnRow}>
            <TouchableOpacity
              onPress={onDeny}
              disabled={busy}
              activeOpacity={0.85}
              style={[s.btnDeny, {
                borderColor: isDark ? 'rgba(239,68,68,0.45)' : 'rgba(239,68,68,0.3)',
                backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.06)',
                opacity: busy ? 0.5 : 1,
              }]}
            >
              {denying ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Text style={s.btnDenyText}>Deny</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onAccept}
              disabled={busy}
              activeOpacity={0.9}
              style={[s.btnAcceptWrap, { opacity: busy ? 0.7 : 1 }]}
            >
              <LinearGradient
                colors={['#04285a', '#0193ab']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.btnAccept}
              >
                {accepting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={s.btnAcceptIcon}>✓</Text>
                    <Text style={s.btnAcceptText}>Accept</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <Text style={[s.footer, { color: colors.textMuted }]}>
            Auto-accept can be enabled in Settings
          </Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 22 },
  card: {
    width: '100%', maxWidth: 420, borderRadius: 26, padding: 22,
    borderWidth: 1, overflow: 'hidden',
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.42, shadowRadius: 40, elevation: 22,
  },
  topAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginBottom: 18,
  },
  headerEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  sparkleLeft: { fontSize: 14, color: '#0193ab' },
  sparkleRight: { fontSize: 14, color: '#5dd0e3' },

  routeBlock: { marginBottom: 18 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  routeDot: {
    width: 18, height: 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
  },
  routeDotInner: { width: 14, height: 14, borderRadius: 999 },
  routeConnector: { width: 2, height: 16, marginLeft: 8, marginVertical: 2 },
  routeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 2 },
  routePlace: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },

  statsRow: {
    flexDirection: 'row', borderRadius: 16, borderWidth: 1,
    paddingVertical: 14, marginBottom: 14,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 19, fontWeight: '800', letterSpacing: -0.5 },
  statUnit: { fontSize: 12, fontWeight: '600' },
  statLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5, marginTop: 4, textTransform: 'uppercase' },
  statDivider: { width: 1 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, maxWidth: 180 },
  chipText: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.2 },

  brokerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  brokerLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  brokerName: { fontSize: 13, fontWeight: '600', flex: 1 },

  btnRow: { flexDirection: 'row', gap: 10 },
  btnDeny: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  btnDenyText: { color: '#ef4444', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  btnAcceptWrap: { flex: 1.4, borderRadius: 14, overflow: 'hidden' },
  btnAccept: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
  },
  btnAcceptIcon: { color: '#fff', fontSize: 16, fontWeight: '900' },
  btnAcceptText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },

  footer: { textAlign: 'center', marginTop: 14, fontSize: 11, fontWeight: '600' },
});
