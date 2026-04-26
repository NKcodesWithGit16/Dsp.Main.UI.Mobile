import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from '../../src/context/ThemeContext';
import { registerAccount } from '../../src/api/auth';
import {
  radius, spacing, typography, gradients, shadow,
} from '../../src/theme/colors';
import AuthBackground from '../../src/components/shared/AuthBackground';
import GlassCard from '../../src/components/shared/GlassCard';

const schema = z.object({
  name: z.string().min(2, 'Min 2 characters'),
  companyName: z.string().min(2, 'Min 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Min 6 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const FIELDS = [
  { name: 'name',            label: 'Full Name',        placeholder: 'John Smith',          icon: '👤', autoCapitalize: 'words' },
  { name: 'companyName',     label: 'Company Name',     placeholder: 'Acme Trucking LLC',   icon: '🏢', autoCapitalize: 'words' },
  { name: 'email',           label: 'Email',            placeholder: 'you@company.com',     icon: '@',  keyboardType: 'email-address', autoCapitalize: 'none' },
  { name: 'password',        label: 'Password',         placeholder: '••••••••',            icon: '🔒', secureTextEntry: true, autoCapitalize: 'none' },
  { name: 'confirmPassword', label: 'Confirm Password', placeholder: '••••••••',            icon: '🔒', secureTextEntry: true, autoCapitalize: 'none' },
];

export default function RegisterScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', companyName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await registerAccount(data);
      Alert.alert('Account Created', 'You can now sign in.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (e) {
      Alert.alert('Registration Failed', e.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)';

  return (
    <AuthBackground>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4] }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backWrap}>
              <View style={[styles.backBtn, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)',
                borderColor: colors.border,
              }]}>
                <Text style={[styles.backIcon, { color: colors.accent }]}>‹</Text>
              </View>
              <Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text>
            </TouchableOpacity>
            <Text style={[styles.logoText, { color: colors.textPrimary }]}>
              dispatch<Text style={{ color: colors.accent }}>R</Text>
            </Text>
          </View>

          {/* Hero copy */}
          <View style={styles.heroCopy}>
            <Text style={[styles.heroEyebrow, { color: colors.accent }]}>GET STARTED</Text>
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Create your account</Text>
            <Text style={[styles.heroSub, { color: colors.textMuted }]}>
              Start managing your fleet, loads, and freight in minutes.
            </Text>
          </View>

          {/* Card */}
          <GlassCard accent variant="strong" cornerRadius={radius['2xl']} contentStyle={styles.card}>
            {FIELDS.map(f => (
              <View key={f.name} style={styles.field}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{f.label}</Text>
                <Controller
                  control={control}
                  name={f.name}
                  render={({ field: { onChange, value, onBlur } }) => (
                    <View style={[
                      styles.inputWrap,
                      { backgroundColor: inputBg, borderColor: errors[f.name] ? '#ef4444' : colors.border },
                    ]}>
                      <Text style={styles.inputIcon}>{f.icon}</Text>
                      <TextInput
                        style={[styles.input, { color: colors.textPrimary }]}
                        placeholder={f.placeholder}
                        placeholderTextColor={colors.textDisabled}
                        keyboardType={f.keyboardType || 'default'}
                        secureTextEntry={f.secureTextEntry}
                        autoCapitalize={f.autoCapitalize || 'words'}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        value={value}
                      />
                    </View>
                  )}
                />
                {errors[f.name] && <Text style={styles.errorText}>{errors[f.name].message}</Text>}
              </View>
            ))}

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
                      <Text style={styles.btnText}>Create Account</Text>
                      <Text style={styles.btnArrow}>→</Text>
                    </>}
              </LinearGradient>
            </TouchableOpacity>

            {/* Sign in link */}
            <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.linkRow}>
              <Text style={[styles.linkText, { color: colors.textMuted }]}>
                Already have an account? <Text style={[styles.link, { color: colors.accent }]}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </GlassCard>

          {/* Tiny legal */}
          <Text style={[styles.legal, { color: colors.textDisabled }]}>
            By creating an account you agree to the Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: spacing[5], paddingBottom: spacing[8] },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[5] },
  backWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: {
    width: 36, height: 36, borderRadius: 999, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 24, fontWeight: '300', marginTop: -3 },
  backText: { fontSize: typography.sm, fontWeight: '700' },
  logoText: { fontSize: typography.lg, fontWeight: '800', letterSpacing: -0.4 },

  heroCopy: { marginBottom: spacing[5] },
  heroEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  heroTitle: { fontSize: typography['2xl'], fontWeight: '800', letterSpacing: -0.6, marginBottom: 4 },
  heroSub: { fontSize: typography.sm, fontWeight: '500', lineHeight: 20, maxWidth: 320 },

  card: { padding: spacing[6], gap: 0 },

  field: { marginBottom: spacing[4] },
  label: { fontSize: typography.sm, fontWeight: '700', marginBottom: spacing[1] },
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

  linkRow: { alignItems: 'center', marginTop: spacing[5] },
  linkText: { fontSize: typography.sm, fontWeight: '500' },
  link: { fontWeight: '800' },

  legal: { textAlign: 'center', marginTop: spacing[5], fontSize: 11, fontWeight: '500', lineHeight: 16, paddingHorizontal: spacing[5] },
});
