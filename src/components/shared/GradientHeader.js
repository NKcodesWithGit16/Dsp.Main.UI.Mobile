import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gradients, typography, spacing, radius } from '../../theme/colors';

/**
 * GradientHeader — premium gradient banner used at the top of full-screen
 * routes (chats, modals, detail screens).
 *
 *  - Safe-area aware
 *  - Optional back button (left), avatar (center), CTA / right-action slot
 *  - Eyebrow + title + subtitle stack
 */
export default function GradientHeader({
  title,
  subtitle,
  eyebrow,
  gradient = gradients.heroPrimary,
  onBack,
  leftSlot,
  rightSlot,
  centerSlot,
  curve = true,
  paddingBottomExtra = 0,
  style,
}) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.wrap,
        curve && styles.wrapCurve,
        { paddingTop: insets.top + spacing[2], paddingBottom: spacing[4] + paddingBottomExtra },
        style,
      ]}
    >
      <View style={styles.row}>
        {leftSlot ?? (onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
        ))}

        {centerSlot}

        <View style={styles.titleStack}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>

        {rightSlot ? <View style={styles.rightWrap}>{rightSlot}</View> : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing[4],
  },
  wrapCurve: {
    borderBottomLeftRadius: radius['2xl'],
    borderBottomRightRadius: radius['2xl'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -3 },
  titleStack: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: typography.xs,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    color: '#fff',
    fontSize: typography.md,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: typography.xs,
    fontWeight: '500',
    marginTop: 2,
  },
  rightWrap: { marginLeft: 'auto' },
});
