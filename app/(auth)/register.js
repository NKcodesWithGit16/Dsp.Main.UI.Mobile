import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Animated, Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { useTheme } from '../../src/context/ThemeContext';
import { registerAccount } from '../../src/api/auth';
import {
  radius, spacing, typography,
} from '../../src/theme/colors';

import AuthBackground from '../../src/components/shared/AuthBackground';
import GlassCard      from '../../src/components/shared/GlassCard';
import AnimatedPressable from '../../src/components/shared/AnimatedPressable';
import Icon           from '../../src/components/shared/Icon';
import BrandLogo      from '../../src/components/shared/BrandLogo';
import BrandButton    from '../../src/components/shared/BrandButton';
import FloatingLabelInput from '../../src/components/shared/FloatingLabelInput';

const schema = z.object({
  name:            z.string().min(2, 'Min 2 characters'),
  companyName:     z.string().min(2, 'Min 2 characters'),
  email:           z.string().email('Invalid email'),
  password:        z.string().min(6, 'Min 6 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const FIELDS = [
  { name: 'name',            label: 'Full name',         icon: 'user',       autoCapitalize: 'words' },
  { name: 'companyName',     label: 'Company name',      icon: 'briefcase',  autoCapitalize: 'words' },
  { name: 'email',           label: 'Email',             icon: 'mail',       keyboardType: 'email-address', autoCapitalize: 'none', autoComplete: 'email', textContentType: 'username' },
  { name: 'password',        label: 'Password',          icon: 'lock',       secureTextEntry: true, autoCapitalize: 'none', autoComplete: 'password-new', textContentType: 'newPassword' },
  { name: 'confirmPassword', label: 'Confirm password',  icon: 'lock',       secureTextEntry: true, autoCapitalize: 'none', autoComplete: 'password-new', textContentType: 'newPassword' },
];

export default function RegisterScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', companyName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await registerAccount(data);
      Alert.alert('Account created', 'You can now sign in.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (e) {
      Alert.alert('Registration failed', e.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthBackground>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[3] }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <AnimatedPressable
              onPress={() => router.back()}
              hapticStyle="light"
              pressedScale={0.93}
            >
              <View style={styles.backWrap}>
                <View style={[styles.backBtn, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.78)',
                  borderColor: colors.border,
                }]}>
                  <Icon name="arrowLeft" size={15} color={colors.accent} />
                </View>
                <Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text>
              </View>
            </AnimatedPressable>
            <BrandLogo size={22} layout="horizontal" />
          </View>

          <Animated.View style={{ opacity: fade, transform: [{ translateY: lift }], gap: spacing[3] }}>
            {/* Hero copy */}
            <View style={styles.heroCopy}>
              <View style={[styles.pill, { backgroundColor: isDark ? 'rgba(31,182,206,0.18)' : 'rgba(1,147,171,0.10)', borderColor: isDark ? 'rgba(31,182,206,0.32)' : 'rgba(1,147,171,0.28)' }]}>
                <View style={styles.pillDot} />
                <Text style={[styles.pillText, { color: colors.accent }]}>Get started</Text>
              </View>
              <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Create your account</Text>
              <Text style={[styles.heroSub, { color: colors.textMuted }]}>
                Start managing your fleet, loads, and freight in minutes.
              </Text>
            </View>

            {/* Card */}
            <GlassCard accent variant="strong" cornerRadius={radius['2xl']} contentStyle={styles.card}>
              {FIELDS.map(f => (
                <Controller
                  key={f.name}
                  control={control}
                  name={f.name}
                  render={({ field: { onChange, value, onBlur } }) => (
                    <FloatingLabelInput
                      label={f.label}
                      icon={f.icon}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType={f.keyboardType}
                      secureTextEntry={f.secureTextEntry}
                      autoCapitalize={f.autoCapitalize || 'words'}
                      autoComplete={f.autoComplete}
                      textContentType={f.textContentType}
                      error={errors[f.name]?.message}
                    />
                  )}
                />
              ))}

              <BrandButton
                label={loading ? 'Creating…' : 'Create account'}
                icon="arrow"
                iconRight
                size="lg"
                full
                loading={loading}
                onPress={handleSubmit(onSubmit)}
              />

              <AnimatedPressable
                onPress={() => router.push('/(auth)/login')}
                hapticStyle="light"
                pressedScale={0.97}
              >
                <View style={styles.linkRow}>
                  <Text style={[styles.linkText, { color: colors.textMuted }]}>
                    Already have an account?{' '}
                    <Text style={[styles.link, { color: colors.accent }]}>Sign in</Text>
                  </Text>
                </View>
              </AnimatedPressable>
            </GlassCard>

            <Text style={[styles.legal, { color: colors.textDisabled }]}>
              By creating an account you agree to the Terms of Service and Privacy Policy.
            </Text>
          </Animated.View>
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
  backText: { fontSize: typography.sm, fontWeight: '700' },

  heroCopy: { marginBottom: spacing[3], gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start',
  },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },

  heroTitle: { fontSize: typography['2xl'], fontWeight: '800', letterSpacing: -0.6, marginTop: 4 },
  heroSub: { fontSize: typography.sm, fontWeight: '500', lineHeight: 20, maxWidth: 320 },

  card: { padding: spacing[5], gap: 0 },

  linkRow: { alignItems: 'center', marginTop: spacing[5] },
  linkText: { fontSize: typography.sm, fontWeight: '500' },
  link: { fontWeight: '800' },

  legal: { textAlign: 'center', marginTop: spacing[3], fontSize: 11, fontWeight: '600', lineHeight: 16, paddingHorizontal: spacing[3] },
});
