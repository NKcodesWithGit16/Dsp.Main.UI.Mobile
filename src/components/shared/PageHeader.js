import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { spacing, typography, radius, gradients, glass, shadow } from '../../theme/colors';
import Icon from './Icon';

/**
 * Sticky liquid-glass page header — mirrors the web app's <Header> bar.
 *
 *   • BlurView backdrop + fill
 *   • Top-aligned inset highlight on the bottom border (teal-tinted)
 *   • Title + optional subtitle on the left
 *   • Theme toggle + brand-gradient avatar on the right
 *   • rightAction slot for custom controls between title and avatar
 */
export default function PageHeader({ title, subtitle, rightAction }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { userName, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const initials = userName
    ? userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const fill   = isDark ? glass.fillDarkStrong : glass.fillLightStrong;
  const border = isDark ? glass.borderDark : 'rgba(1,147,171,0.18)';
  const blurIntensity = Platform.OS === 'ios'
    ? (isDark ? glass.blurIosDark : glass.blurIosLight)
    : (isDark ? glass.blurAndDark : glass.blurAndLight);

  return (
    <View style={[s.wrap, { paddingTop: insets.top }]}>
      <BlurView
        intensity={blurIntensity}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      {/* Bottom hairline border — brand teal in light, white-fade in dark */}
      <View pointerEvents="none" style={[s.bottomBorder, { backgroundColor: border }]} />

      <View style={s.inner}>
        <View style={s.left}>
          <Text style={[s.title, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text style={[s.subtitle, { color: colors.textMuted }]} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>

        <View style={s.right}>
          {rightAction}
          <TouchableOpacity
            onPress={toggleTheme}
            style={[
              s.iconBtn,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(1,147,171,0.08)',
                borderColor: border,
              },
            ]}
            activeOpacity={0.7}
          >
            <Icon
              name={isDark ? 'sun' : 'moon'}
              size={15}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { logout(); router.replace('/(auth)/login'); }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[s.avatar, shadow.glow]}
            >
              <Text style={s.avatarText}>{initials}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  bottomBorder: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  left: { flex: 1, gap: 3 },
  title: {
    fontSize: typography.md,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: typography.xs,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
});
