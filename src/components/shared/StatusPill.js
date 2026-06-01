import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { radius } from '../../theme/colors';
import Icon from './Icon';

/**
 * Header-style status pill — "All systems normal" / "3 need attention".
 * Two tones map to the .home-status-pill states on the web app.
 */
export default function StatusPill({ tone = 'clear', icon, label }) {
  const isClear = tone === 'clear';
  const fg = isClear ? '#059669' : '#b45309';
  const bg = isClear ? 'rgba(16,185,129,0.10)' : 'rgba(245,158,11,0.14)';
  const border = isClear ? 'rgba(16,185,129,0.28)' : 'rgba(245,158,11,0.34)';
  const iconName = icon || (isClear ? 'check' : 'bolt');

  return (
    <View style={[styles.wrap, { backgroundColor: bg, borderColor: border }]}>
      <Icon name={iconName} size={13} color={fg} />
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radius.pill, borderWidth: 1,
  },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
});
