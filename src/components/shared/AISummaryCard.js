import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { radius, spacing, typography, gradients, shadow } from '../../theme/colors';
import Icon from './Icon';
import AnimatedPressable from './AnimatedPressable';

/**
 * "AI summary" card on the dispatcher Home — turns the dashboard from "look
 * at numbers" into "make a decision now". Synthesizes the day's signal from
 * the same `loads` + `drivers` arrays the rest of the page uses.
 *
 *   • Pulsing AI orb on the left
 *   • Short headline + a sentence of context
 *   • Up to 3 inline action chips (e.g. "Cover hot loads", "Reassign idle")
 */
function statusOf(d) {
  if (typeof d.status === 'number') return ['moving', 'idle', 'offline'][d.status] ?? 'offline';
  return (d.status || 'offline').toLowerCase();
}

function PulseOrb({ size = 44 }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const ring = {
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }],
    opacity:   pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
  };
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: '#0193ab' },
          ring,
        ]}
      />
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }, shadow.glow]}
      >
        <Icon name="sparkles" size={Math.round(size * 0.5)} color="#fff" />
      </LinearGradient>
    </View>
  );
}

export default function AISummaryCard({
  loads = [],
  drivers = [],
  onAskMore,
  onActionPress,
  style,
}) {
  const { colors, isDark } = useTheme();

  const { headline, body, actions, tone } = useMemo(() => {
    const hot     = loads.filter(l => l.status === 'Hot');
    const newLds  = loads.filter(l => l.status === 'New');
    const moving  = drivers.filter(d => statusOf(d) === 'moving');
    const idle    = drivers.filter(d => statusOf(d) === 'idle');
    const offline = drivers.filter(d => statusOf(d) === 'offline');
    const booked  = loads.filter(l => l.status === 'Booked').length;

    const acts = [];
    let head = 'All clear — no urgent attention needed';
    let bod = `${booked} booked load${booked === 1 ? '' : 's'} today. ${moving.length} drivers moving, ${idle.length} idle.`;
    let to = 'calm';

    if (hot.length > 0) {
      head = `${hot.length} hot load${hot.length > 1 ? 's' : ''} need coverage`;
      const best = idle[0];
      bod = best
        ? `${best.name || 'Top idle driver'} is the closest available — ${idle.length} idle driver${idle.length === 1 ? '' : 's'} total.`
        : `${moving.length} moving · ${idle.length} idle. Consider reassigning to clear the urgent queue.`;
      acts.push({ key: 'hot',    label: 'Cover hot loads', icon: 'flame',    tone: 'danger', route: '/(app)/loadboard' });
      if (idle.length > 0) acts.push({ key: 'idle', label: 'See idle drivers', icon: 'truck', tone: 'warn', route: '/(app)/drivers' });
      to = 'urgent';
    } else if (idle.length > 2) {
      head = `${idle.length} drivers idle — reassign?`;
      bod = `${newLds.length} new load${newLds.length === 1 ? '' : 's'} on the board. Pair the closest match.`;
      acts.push({ key: 'idle', label: 'Reassign idle', icon: 'truck', tone: 'warn', route: '/(app)/drivers' });
      acts.push({ key: 'board', label: 'Browse loads', icon: 'box',   tone: 'brand', route: '/(app)/loadboard' });
      to = 'attn';
    } else if (newLds.length > 0) {
      head = `${newLds.length} new load${newLds.length === 1 ? '' : 's'} just posted`;
      bod = `Fleet is humming — ${moving.length} moving, ${booked} booked today.`;
      acts.push({ key: 'board', label: 'Review new loads', icon: 'box', tone: 'brand', route: '/(app)/loadboard' });
      to = 'calm';
    }

    if (offline.length > 0 && acts.length < 3) {
      acts.push({ key: 'off', label: `Ping ${offline.length} offline`, icon: 'powerOff', tone: 'muted', route: '/(app)/drivers' });
    }

    if (acts.length < 3) {
      acts.push({ key: 'ai', label: 'Ask AI more', icon: 'sparkles', tone: 'brand', onPress: onAskMore });
    }

    return { headline: head, body: bod, actions: acts.slice(0, 3), tone: to };
  }, [loads, drivers, onAskMore]);

  const toneAccent = tone === 'urgent'
    ? '#ef4444'
    : tone === 'attn'
      ? '#f59e0b'
      : '#0193ab';

  return (
    <View style={[styles.outer, shadow.card, style]}>
      <LinearGradient
        colors={isDark
          ? ['rgba(31,182,206,0.18)', 'rgba(4,40,90,0.32)']
          : ['rgba(1,147,171,0.10)', 'rgba(4,40,90,0.06)']
        }
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.card, { borderColor: isDark ? 'rgba(31,182,206,0.32)' : 'rgba(1,147,171,0.28)' }]}
      >
        <View style={[styles.accent, { backgroundColor: toneAccent }]} />
        <View style={styles.head}>
          <PulseOrb />
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>HITCHLINK AI</Text>
            <Text style={[styles.headline, { color: colors.textPrimary }]} numberOfLines={2}>
              {headline}
            </Text>
          </View>
        </View>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text>

        <View style={styles.actions}>
          {actions.map(a => {
            const c = a.tone === 'danger' ? '#dc2626'
                    : a.tone === 'warn'   ? '#b45309'
                    : a.tone === 'muted'  ? colors.textMuted
                    : colors.accent;
            return (
              <AnimatedPressable
                key={a.key}
                onPress={() => onActionPress && onActionPress(a)}
                hapticStyle="selection"
                pressedScale={0.95}
              >
                <View style={[styles.actionPill, { borderColor: c + '55', backgroundColor: c + '14' }]}>
                  <Icon name={a.icon} size={12} color={c} />
                  <Text style={[styles.actionText, { color: c }]} numberOfLines={1}>{a.label}</Text>
                </View>
              </AnimatedPressable>
            );
          })}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { borderRadius: radius.xl, overflow: 'visible' },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[3],
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  headline: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, marginTop: 3, lineHeight: 20 },
  body: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  actionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
  },
  actionText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.2 },
});
