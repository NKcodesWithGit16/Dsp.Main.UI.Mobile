import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { radius, spacing } from '../../theme/colors';
import Icon from './Icon';

/**
 * Hours-of-Service countdown pill. Decrements each second so the driver sees
 * a live ticker without waiting for a server push. Caller passes the initial
 * remaining minutes (e.g. 8h 12m → 492) and a key (`hoursKey`) that, when
 * changed, resets the timer (e.g. after the driver takes a 10h break).
 */
export default function HOSCountdown({
  initialMinutes = 660, // 11h driving cap as default
  hoursKey,
  warnThreshold = 60,   // amber when <1h left
  dangerThreshold = 15, // red when <15m left
  style,
}) {
  const { colors } = useTheme();
  const [seconds, setSeconds] = useState(initialMinutes * 60);

  useEffect(() => {
    setSeconds(initialMinutes * 60);
  }, [initialMinutes, hoursKey]);

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(s => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const totalMin = Math.max(0, Math.floor(seconds / 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;

  const tone = totalMin <= dangerThreshold ? 'danger' : totalMin <= warnThreshold ? 'warn' : 'ok';
  const palette = {
    ok:     { fg: '#059669', bg: 'rgba(16,185,129,0.14)', bdr: 'rgba(16,185,129,0.32)', icon: '#059669' },
    warn:   { fg: '#b45309', bg: 'rgba(245,158,11,0.16)', bdr: 'rgba(245,158,11,0.36)', icon: '#b45309' },
    danger: { fg: '#dc2626', bg: 'rgba(239,68,68,0.14)',  bdr: 'rgba(239,68,68,0.36)',  icon: '#dc2626' },
  }[tone];

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.bdr }, style]}>
      <Icon name="clock" size={12} color={palette.icon} />
      <Text style={[styles.label, { color: palette.fg }]}>
        HOS
      </Text>
      <Text style={[styles.value, { color: palette.fg }]}>
        {h}h {String(m).padStart(2, '0')}m
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  value: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.2 },
});
