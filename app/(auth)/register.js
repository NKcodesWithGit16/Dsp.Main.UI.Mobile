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
import { useTheme } from '../../src/context/ThemeContext';
import { registerAccount } from '../../src/api/auth';
import { radius, spacing, typography } from '../../src/theme/colors';

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

export default function RegisterScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', companyName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await registerAccount(data);
      Alert.alert('Account Created', 'You can now sign in.', [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]);
    } catch (e) {
      Alert.alert('Registration Failed', e.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const s = makeStyles(colors);

  const Field = ({ name, label, placeholder, keyboardType, secureTextEntry, autoCapitalize }) => (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, value, onBlur } }) => (
          <TextInput
            style={[s.input, errors[name] && s.inputError]}
            placeholder={placeholder}
            placeholderTextColor={colors.textDisabled}
            keyboardType={keyboardType || 'default'}
            secureTextEntry={secureTextEntry}
            autoCapitalize={autoCapitalize || 'words'}
            onChangeText={onChange}
            onBlur={onBlur}
            value={value}
          />
        )}
      />
      {errors[name] && <Text style={s.errorText}>{errors[name].message}</Text>}
    </View>
  );

  return (
    <LinearGradient colors={['#08090e', '#11141c', '#1a1f2e']} style={s.gradient}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <Text style={s.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={s.logoText}>dispatch<Text style={{ color: colors.accent }}>R</Text></Text>
          </View>

          <View style={s.card}>
            <Text style={s.title}>Create account</Text>
            <Text style={s.subtitle}>Start managing your fleet today</Text>

            <Field name="name" label="Full Name" placeholder="John Smith" />
            <Field name="companyName" label="Company Name" placeholder="Acme Trucking LLC" />
            <Field name="email" label="Email" placeholder="you@company.com" keyboardType="email-address" autoCapitalize="none" />
            <Field name="password" label="Password" placeholder="••••••••" secureTextEntry autoCapitalize="none" />
            <Field name="confirmPassword" label="Confirm Password" placeholder="••••••••" secureTextEntry autoCapitalize="none" />

            <TouchableOpacity style={s.btn} onPress={handleSubmit(onSubmit)} disabled={loading} activeOpacity={0.85}>
              <LinearGradient colors={['#6366f1', '#4f46e5']} style={s.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create Account</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={s.linkRow}>
              <Text style={s.linkText}>Already have an account? <Text style={s.link}>Sign in</Text></Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const makeStyles = (c) => StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, padding: spacing[5], paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[6] },
  backBtn: { padding: spacing[2] },
  backText: { color: c.accent, fontSize: typography.base, fontWeight: '600' },
  logoText: { color: c.textPrimary, fontSize: typography.lg, fontWeight: '800' },
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
