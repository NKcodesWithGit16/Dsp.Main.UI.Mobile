import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import GlassCard from './GlassCard';
import AnimatedPressable from './AnimatedPressable';
import Icon from './Icon';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme/colors';

/**
 * Section card with a title row + optional link/eyebrow on the right.
 * Wraps GlassCard for a consistent look across the dispatcher screens.
 */
export default function SectionCard({
  title,
  eyebrow,
  linkLabel,
  onLinkPress,
  rightSlot,
  children,
  contentStyle,
  style,
  accent = false,
}) {
  const { colors } = useTheme();
  return (
    <GlassCard accent={accent} variant="strong" style={style} contentStyle={[styles.body, contentStyle]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          {eyebrow ? (
            <Text style={[styles.eyebrow, { color: colors.accent }]}>{eyebrow.toUpperCase()}</Text>
          ) : null}
          {title ? (
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>
        {rightSlot ?? (linkLabel ? (
          <AnimatedPressable onPress={onLinkPress} hapticStyle="selection">
            <View style={styles.link}>
              <Text style={[styles.linkText, { color: colors.accent }]}>{linkLabel}</Text>
              <Icon name="arrow" size={13} color={colors.accent} />
            </View>
          </AnimatedPressable>
        ) : null)}
      </View>
      {children}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing[4], gap: spacing[3] },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing[2],
  },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 2 },
  title: { fontSize: typography.base, fontWeight: '800', letterSpacing: -0.2 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { fontSize: 12.5, fontWeight: '700' },
});
