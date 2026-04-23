import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { spacing, typography, radius } from '../../theme/colors';

export default function ScreenHeader({ title, subtitle, rightAction }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { userName, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const initials = userName
    ? userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <View style={[s.wrap, { paddingTop: insets.top, backgroundColor: colors.surface1, borderBottomColor: colors.border }]}>
      <View style={s.inner}>
        <View style={s.left}>
          <Text style={[s.logo, { color: colors.textPrimary }]}>
            dispatch<Text style={{ color: colors.accent }}>R</Text>
          </Text>
          {title ? (
            <View style={s.titleRow}>
              <Text style={[s.title, { color: colors.textMuted }]}>{title}</Text>
              {subtitle ? <Text style={[s.sep, { color: colors.textDisabled }]}>·</Text> : null}
              {subtitle ? <Text style={[s.subtitle, { color: colors.textDisabled }]}>{subtitle}</Text> : null}
            </View>
          ) : null}
        </View>

        <View style={s.right}>
          {rightAction}
          <TouchableOpacity onPress={toggleTheme} style={[s.iconBtn, { backgroundColor: colors.surface2 }]}>
            <Text style={s.iconBtnText}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { logout(); router.replace('/(auth)/login'); }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#6366f1', '#4f46e5']} style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderBottomWidth: 1 },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  left: { flex: 1 },
  logo: { fontSize: typography.lg, fontWeight: '800', letterSpacing: -0.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  title: { fontSize: typography.xs, fontWeight: '600' },
  sep: { fontSize: typography.xs },
  subtitle: { fontSize: typography.xs },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  iconBtn: { width: 34, height: 34, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center' },
  iconBtnText: { fontSize: 15 },
  avatar: { width: 34, height: 34, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: typography.xs, fontWeight: '700' },
});
