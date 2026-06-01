import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography, radius, gradients, shadow } from '../../theme/colors';
import Icon from './Icon';
import BrandButton from './BrandButton';

/**
 * One empty state to rule them all. Brand-gradient icon bubble + title +
 * sub + optional CTA button. Used across Loadboard, Drivers, Documents,
 * AI chat, etc. so empty screens stop feeling identical-but-different.
 */
export default function EmptyState({
  icon = 'box',
  iconColor = '#0193ab',
  iconGradient,
  title,
  sub,
  ctaLabel,
  ctaIcon,
  onCtaPress,
  style,
}) {
  const { colors } = useTheme();
  const grad = iconGradient || ['rgba(1,147,171,0.22)', 'rgba(6,182,212,0.14)'];

  return (
    <View style={[styles.wrap, style]} accessible accessibilityLabel={title}>
      <LinearGradient
        colors={grad}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.iconBubble, iconGradient ? shadow.glow : null]}
      >
        <Icon name={icon} size={40} color={iconGradient ? '#fff' : iconColor} />
      </LinearGradient>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {sub ? <Text style={[styles.sub, { color: colors.textMuted }]}>{sub}</Text> : null}
      {ctaLabel && onCtaPress ? (
        <View style={{ marginTop: spacing[4] }}>
          <BrandButton label={ctaLabel} icon={ctaIcon} size="md" onPress={onCtaPress} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[2],
    minHeight: 280,
  },
  iconBubble: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[3],
  },
  title: { fontSize: typography.lg, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  sub:   { fontSize: typography.sm, textAlign: 'center', lineHeight: 19, maxWidth: 320, marginTop: 4 },
});
