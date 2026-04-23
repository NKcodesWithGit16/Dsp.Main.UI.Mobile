import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { radius, typography, spacing } from '../../theme/colors';

export default function Badge({ label, color, bg, size = 'sm' }) {
  const { colors } = useTheme();
  const textColor = color || colors.textPrimary;
  const bgColor = bg || colors.surface2;

  return (
    <View style={[s.badge, { backgroundColor: bgColor }, size === 'xs' && s.xs]}>
      <Text style={[s.text, { color: textColor }, size === 'xs' && s.xsText]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.pill, alignSelf: 'flex-start' },
  text: { fontSize: typography.xs, fontWeight: '600' },
  xs: { paddingHorizontal: 5, paddingVertical: 1 },
  xsText: { fontSize: 10 },
});
