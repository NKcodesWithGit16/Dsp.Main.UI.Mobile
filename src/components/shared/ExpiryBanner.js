import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { radius, spacing, typography } from '../../theme/colors';
import Icon from './Icon';
import AnimatedPressable from './AnimatedPressable';

/**
 * Top-of-screen alert banner for upcoming/expired items. Used by Documents
 * to highlight expiring insurance, contracts, etc. before users hunt through
 * the grid for an amber "left" pill.
 */
export default function ExpiryBanner({
  count = 0,
  noun = 'document',
  windowDays = 14,
  expired = 0,
  onPress,
  style,
}) {
  const { colors } = useTheme();
  if (count === 0 && expired === 0) return null;

  const severe = expired > 0;
  const color = severe ? '#dc2626' : '#b45309';
  const bg    = severe ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.12)';
  const bdr   = severe ? 'rgba(239,68,68,0.28)' : 'rgba(245,158,11,0.30)';

  const title = expired > 0
    ? `${expired} ${noun}${expired > 1 ? 's' : ''} expired`
    : `${count} ${noun}${count > 1 ? 's' : ''} expire within ${windowDays} days`;

  const desc = expired > 0 && count > 0
    ? `${count} more expiring within ${windowDays} days`
    : 'Tap to review and renew';

  return (
    <AnimatedPressable onPress={onPress} hapticStyle="light" pressedScale={0.98}>
      <View style={[styles.banner, { backgroundColor: bg, borderColor: bdr }, style]}>
        <View style={[styles.icon, { backgroundColor: color + '22' }]}>
          <Icon name="alertTriangle" size={16} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.desc, { color: colors.textMuted }]} numberOfLines={1}>{desc}</Text>
        </View>
        <Icon name="chevron" size={14} color={color} />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[3], borderRadius: radius.lg, borderWidth: 1,
    marginHorizontal: spacing[4], marginVertical: spacing[2],
  },
  icon: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13.5, fontWeight: '700' },
  desc:  { fontSize: 11.5, marginTop: 1 },
});
