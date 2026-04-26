import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { spacing, typography, radius, gradients, glass, shadow } from '../../theme/colors';

export default function ScreenHeader({ title, subtitle, rightAction }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { userName, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const initials = userName
    ? userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const fill = isDark ? glass.fillDarkStrong : glass.fillLightStrong;
  const border = isDark ? glass.borderDark : 'rgba(99,102,241,0.18)';
  const blurIntensity = Platform.OS === 'ios'
    ? (isDark ? glass.blurIosDark : glass.blurIosLight)
    : (isDark ? glass.blurAndDark : glass.blurAndLight);

  return (
    <View style={[s.wrap, { paddingTop: insets.top, borderBottomColor: border }]}>
      <BlurView
        intensity={blurIntensity}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />

      <View style={s.inner}>
        <View style={s.left}>
          <View style={s.logoRow}>
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.logoBadge}
            >
              <Text style={s.logoBadgeText}>D</Text>
            </LinearGradient>
            <Text style={[s.logo, { color: colors.textPrimary }]}>
              dispatch<Text style={{ color: colors.accent }}>R</Text>
            </Text>
          </View>
          {title ? (
            <View style={s.titleRow}>
              <Text style={[s.title, { color: colors.textSecondary }]}>{title}</Text>
              {subtitle ? <View style={[s.subtitleDot, { backgroundColor: colors.accent }]} /> : null}
              {subtitle ? <Text style={[s.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
            </View>
          ) : null}
        </View>

        <View style={s.right}>
          {rightAction}
          <TouchableOpacity
            onPress={toggleTheme}
            style={[s.iconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.08)', borderColor: border }]}
            activeOpacity={0.7}
          >
            <Text style={s.iconBtnText}>{isDark ? '☀︎' : '☾'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { logout(); router.replace('/(auth)/login'); }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
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
  wrap: { borderBottomWidth: 1, overflow: 'hidden' },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  left: { flex: 1, gap: 4 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBadge: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  logoBadgeText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: -0.5 },
  logo: { fontSize: typography.lg, fontWeight: '800', letterSpacing: -0.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  title: { fontSize: typography.xs, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  subtitleDot: { width: 4, height: 4, borderRadius: 99 },
  subtitle: { fontSize: typography.xs, fontWeight: '600' },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  iconBtn: {
    width: 34, height: 34, borderRadius: 999,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
  },
  iconBtnText: { fontSize: 14 },
  avatar: { width: 34, height: 34, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
});
