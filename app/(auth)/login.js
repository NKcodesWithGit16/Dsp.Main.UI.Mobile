import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { login as apiLogin } from '../../src/api/auth';
import { ensureDispatcher } from '../../src/api/main';
import {
  radius, spacing, typography, gradients, glass, shadow,
} from '../../src/theme/colors';
import AuthBackground from '../../src/components/shared/AuthBackground';
import GlassCard from '../../src/components/shared/GlassCard';

const schema = z.object({
  email: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

const ROLE_HINTS = [
  { key: 'dispatcher', label: 'Dispatcher', icon: '📋' },
  { key: 'driver',     label: 'Driver',     icon: '🚛' },
  { key: 'broker',     label: 'Broker',     icon: '💼' },
];

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { login } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await apiLogin(data.email, data.password);
      if (res && res.isAccepted === false) {
        throw new Error(res.message || 'Invalid credentials');
      }
      const ROLE_MAP = { 1: 'admin', 2: 'dispatcher', 3: 'driver', 4: 'broker' };
      const role = typeof res.role === 'number'
        ? (ROLE_MAP[res.role] ?? 'dispatcher')
        : (typeof res.role === 'string' ? res.role.toLowerCase() : 'dispatcher');
      const displayName = res.username || res.name || data.email.split('@')[0];
      await login(res.userId || res.id || '1', displayName, data.email, res.token || null, role);
      if (role === 'dispatcher' && (res.userId || res.id)) {
        try { await ensureDispatcher(res.userId || res.id, displayName, res.token); } catch {}
      }
      if (role === 'driver') router.replace('/(driver)');
      else if (role === 'broker') router.replace('/(broker)');
      else router.replace('/(app)/home');
    } catch (e) {
      Alert.alert('Login Failed', e.message || 'Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)';

  return (
    <AuthBackground>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Logo */}
          <View style={styles.logoWrap}>
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[styles.logoIcon, shadow.glow]}
            >
              <Text style={styles.logoIconText}>D</Text>
            </LinearGradient>
            <Text style={[styles.logoText, { color: colors.textPrimary }]}>
              dispatch<Text style={{ color: colors.accent }}>R</Text>
            </Text>
            <Text style={[styles.tagline, { color: colors.textMuted }]}>
              Logistics management platform
            </Text>
          </View>

          {/* Card */}
          <GlassCard accent variant="strong" cornerRadius={radius['2xl']} contentStyle={styles.card}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Sign in to continue to your portal
            </Text>

            {/* Username field */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Username or Email</Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value, onBlur } }) => (
                  <View style={[
                    styles.inputWrap,
                    { backgroundColor: inputBg, borderColor: errors.email ? '#ef4444' : colors.border },
                  ]}>
                    <Text style={styles.inputIcon}>@</Text>
                    <TextInput
                      style={[styles.input, { color: colors.textPrimary }]}
                      placeholder="you@company.com"
                      placeholderTextColor={colors.textDisabled}
                      autoCapitalize="none"
                      keyboardType="default"
                      onChangeText={onChange}
                      onBlur={onBlur}
                      value={value}
                    />
                  </View>
                )}
              />
              {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}
            </View>

            {/* Password field */}
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
                <TouchableOpacity onPress={() => setShowPwd(v => !v)} hitSlop={8}>
                  <Text style={[styles.toggle, { color: colors.accent }]}>{showPwd ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value, onBlur } }) => (
                  <View style={[
                    styles.inputWrap,
                    { backgroundColor: inputBg, borderColor: errors.password ? '#ef4444' : colors.border },
                  ]}>
                    <Text style={styles.inputIcon}>🔒</Text>
                    <TextInput
                      style={[styles.input, { color: colors.textPrimary }]}
                      placeholder="••••••••"
                      placeholderTextColor={colors.textDisabled}
                      secureTextEntry={!showPwd}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      value={value}
                    />
                  </View>
                )}
              />
              {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}
            </View>

            {/* Submit */}
            <TouchableOpacity onPress={handleSubmit(onSubmit)} disabled={loading} activeOpacity={0.85}>
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[styles.btn, shadow.glow, loading && { opacity: 0.85 }]}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Text style={styles.btnText}>Sign In</Text>
                      <Text style={styles.btnArrow}>→</Text>
                    </>}
              </LinearGradient>
            </TouchableOpacity>

            {/* Role hint pills */}
            <View style={styles.roleRow}>
              <View style={[styles.roleDivider, { backgroundColor: colors.border }]} />
              <Text style={[styles.roleHint, { color: colors.textMuted }]}>Sign in as</Text>
              <View style={[styles.roleDivider, { backgroundColor: colors.border }]} />
            </View>
            <View style={styles.rolePills}>
              {ROLE_HINTS.map(r => (
                <View
                  key={r.key}
                  style={[styles.rolePill, {
                    backgroundColor: isDark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.08)',
                    borderColor: isDark ? 'rgba(99,102,241,0.32)' : 'rgba(99,102,241,0.22)',
                  }]}
                >
                  <Text style={styles.rolePillIcon}>{r.icon}</Text>
                  <Text style={[styles.rolePillText, { color: colors.textSecondary }]}>{r.label}</Text>
                </View>
              ))}
            </View>

            {/* Sign up link */}
            <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.linkRow}>
              <Text style={[styles.linkText, { color: colors.textMuted }]}>
                Don't have an account? <Text style={[styles.link, { color: colors.accent }]}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          </GlassCard>

          <Text style={[styles.footer, { color: colors.textDisabled }]}>
            © 2026 DispatchR · Logistics simplified
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing[5], paddingTop: spacing[8] },

  logoWrap: { alignItems: 'center', marginBottom: spacing[6] },
  logoIcon: {
    width: 68, height: 68, borderRadius: radius.xl,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing[3],
  },
  logoIconText: { color: '#fff', fontSize: typography['2xl'], fontWeight: '900', letterSpacing: -1 },
  logoText: { fontSize: typography['2xl'], fontWeight: '800', letterSpacing: -0.6 },
  tagline: { fontSize: typography.sm, marginTop: 4, fontWeight: '500' },

  card: { padding: spacing[6], gap: 0 },
  title: { fontSize: typography.xl, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: typography.sm, marginTop: 4, marginBottom: spacing[5] },

  field: { marginBottom: spacing[4] },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[1] },
  label: { fontSize: typography.sm, fontWeight: '700' },
  toggle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: radius.md,
    paddingHorizontal: spacing[3],
  },
  inputIcon: { fontSize: 14, opacity: 0.55 },
  input: {
    flex: 1, paddingVertical: spacing[3],
    fontSize: typography.base, fontWeight: '500',
  },
  errorText: { color: '#ef4444', fontSize: typography.xs, marginTop: 4, fontWeight: '600' },

  btn: {
    paddingVertical: spacing[4], borderRadius: radius.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: spacing[2],
  },
  btnText: { color: '#fff', fontSize: typography.base, fontWeight: '800', letterSpacing: 0.3 },
  btnArrow: { color: '#fff', fontSize: 18, fontWeight: '300' },

  roleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[5], marginBottom: spacing[3] },
  roleDivider: { flex: 1, height: 1 },
  roleHint: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  rolePills: { flexDirection: 'row', gap: spacing[2], justifyContent: 'center' },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing[3], paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
  },
  rolePillIcon: { fontSize: 13 },
  rolePillText: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.2 },

  linkRow: { alignItems: 'center', marginTop: spacing[5] },
  linkText: { fontSize: typography.sm, fontWeight: '500' },
  link: { fontWeight: '800' },

  footer: { textAlign: 'center', marginTop: spacing[6], fontSize: 11, fontWeight: '500' },
});
