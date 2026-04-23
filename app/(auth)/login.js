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
import { radius, spacing, typography } from '../../src/theme/colors';

const schema = z.object({
  email: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginScreen() {
  const { colors } = useTheme();
  const { login } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await apiLogin(data.email, data.password);
      const ROLE_MAP = { 0: 'dispatcher', 1: 'driver', 2: 'broker' };
      const role = typeof res.role === 'number' ? (ROLE_MAP[res.role] ?? 'dispatcher') : (res.role || 'dispatcher');
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

  const s = makeStyles(colors);

  return (
    <LinearGradient colors={['#08090e', '#11141c', '#1a1f2e']} style={s.gradient}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={s.logoWrap}>
            <LinearGradient colors={['#6366f1', '#4f46e5']} style={s.logoIcon}>
              <Text style={s.logoIconText}>D</Text>
            </LinearGradient>
            <Text style={s.logoText}>
              dispatch<Text style={{ color: colors.accent }}>R</Text>
            </Text>
            <Text style={s.tagline}>Logistics management platform</Text>
          </View>

          {/* Card */}
          <View style={s.card}>
            <Text style={s.title}>Welcome back</Text>
            <Text style={s.subtitle}>Sign in to your account</Text>

            <View style={s.field}>
              <Text style={s.label}>Username or Email</Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value, onBlur } }) => (
                  <TextInput
                    style={[s.input, errors.email && s.inputError]}
                    placeholder="Username or email"
                    placeholderTextColor={colors.textDisabled}
                    autoCapitalize="none"
                    keyboardType="default"
                    onChangeText={onChange}
                    onBlur={onBlur}
                    value={value}
                  />
                )}
              />
              {errors.email && <Text style={s.errorText}>{errors.email.message}</Text>}
            </View>

            <View style={s.field}>
              <Text style={s.label}>Password</Text>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value, onBlur } }) => (
                  <TextInput
                    style={[s.input, errors.password && s.inputError]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textDisabled}
                    secureTextEntry
                    onChangeText={onChange}
                    onBlur={onBlur}
                    value={value}
                  />
                )}
              />
              {errors.password && <Text style={s.errorText}>{errors.password.message}</Text>}
            </View>

            <TouchableOpacity style={s.btn} onPress={handleSubmit(onSubmit)} disabled={loading} activeOpacity={0.85}>
              <LinearGradient colors={['#6366f1', '#4f46e5']} style={s.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign In</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={s.linkRow}>
              <Text style={s.linkText}>Don't have an account? <Text style={s.link}>Sign up</Text></Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const makeStyles = (c) => StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing[5] },
  logoWrap: { alignItems: 'center', marginBottom: spacing[8] },
  logoIcon: { width: 64, height: 64, borderRadius: radius.xl, justifyContent: 'center', alignItems: 'center', marginBottom: spacing[3] },
  logoIconText: { color: '#fff', fontSize: typography['2xl'], fontWeight: '800' },
  logoText: { color: c.textPrimary, fontSize: typography['2xl'], fontWeight: '800', letterSpacing: -0.5 },
  tagline: { color: c.textMuted, fontSize: typography.sm, marginTop: 4 },
  card: { backgroundColor: c.surface1, borderRadius: radius['2xl'], padding: spacing[6], borderWidth: 1, borderColor: c.border },
  title: { color: c.textPrimary, fontSize: typography.xl, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: c.textMuted, fontSize: typography.sm, marginBottom: spacing[5] },
  field: { marginBottom: spacing[4] },
  label: { color: c.textSecondary, fontSize: typography.sm, fontWeight: '600', marginBottom: spacing[1] },
  input: { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3], color: c.textPrimary, fontSize: typography.base },
  inputError: { borderColor: c.danger },
  errorText: { color: c.danger, fontSize: typography.xs, marginTop: 4 },
  btn: { borderRadius: radius.md, overflow: 'hidden', marginTop: spacing[2] },
  btnGrad: { paddingVertical: spacing[4], alignItems: 'center' },
  btnText: { color: '#fff', fontSize: typography.base, fontWeight: '700' },
  linkRow: { alignItems: 'center', marginTop: spacing[4] },
  linkText: { color: c.textMuted, fontSize: typography.sm },
  link: { color: c.accent, fontWeight: '600' },
});
