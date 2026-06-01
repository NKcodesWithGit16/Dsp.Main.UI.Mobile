import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Alert, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { useAuth }  from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { login as apiLogin } from '../../src/api/auth';
import { ensureDispatcher } from '../../src/api/main';
import {
  radius, spacing, typography, photos,
} from '../../src/theme/colors';
import {
  isBiometricSupported, isBiometricEnabled, enableBiometric,
  getStoredCreds, authenticateBiometric,
} from '../../src/utils/biometric';

import AuthBackground from '../../src/components/shared/AuthBackground';
import GlassCard      from '../../src/components/shared/GlassCard';
import AnimatedPressable from '../../src/components/shared/AnimatedPressable';
import Icon           from '../../src/components/shared/Icon';
import BrandLogo      from '../../src/components/shared/BrandLogo';
import BrandButton    from '../../src/components/shared/BrandButton';
import FloatingLabelInput from '../../src/components/shared/FloatingLabelInput';
import KenBurnsImage  from '../../src/components/shared/KenBurnsImage';
import log            from '../../src/utils/logger';

const schema = z.object({
  email:    z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

const ROLE_HINTS = [
  { key: 'dispatcher', label: 'Dispatcher', icon: 'briefcase' },
  { key: 'driver',     label: 'Driver',     icon: 'truck' },
  { key: 'broker',     label: 'Broker',     icon: 'chart' },
];

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { login }  = useAuth();
  const router     = useRouter();
  const [loading,  setLoading]  = useState(false);
  const [bioInfo,  setBioInfo]  = useState({ available: false });
  const [bioEnabled, setBioEnabled] = useState(false);
  const [showBioPrompt, setShowBioPrompt] = useState(false);

  // Wordmark mount animation: lift + fade
  const logoFade = useRef(new Animated.Value(0)).current;
  const logoLift = useRef(new Animated.Value(8)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoFade, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(logoLift, { toValue: 0, duration: 440, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(lift, { toValue: 0, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    (async () => {
      const support = await isBiometricSupported();
      const enabled = await isBiometricEnabled();
      setBioInfo(support);
      setBioEnabled(enabled);
    })();
  }, []);

  const { control, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const performLogin = async (email, password, { promptBio = false } = {}) => {
    setLoading(true);
    try {
      const res = await apiLogin(email, password);
      if (res && res.isAccepted === false) {
        throw new Error(res.message || 'Invalid credentials');
      }
      const ROLE_MAP = { 1: 'admin', 2: 'dispatcher', 3: 'driver', 4: 'broker' };
      const role = typeof res.role === 'number'
        ? (ROLE_MAP[res.role] ?? 'dispatcher')
        : (typeof res.role === 'string' ? res.role.toLowerCase() : 'dispatcher');
      const displayName = res.username || res.name || email.split('@')[0];
      await login(res.userId || res.id || '1', displayName, email, res.token || null, role);
      if (role === 'dispatcher' && (res.userId || res.id)) {
        try { await ensureDispatcher(res.userId || res.id, displayName, res.token); }
        catch (e) { log.warn('LoginScreen', 'ensureDispatcher failed (non-fatal)', e); }
      }
      if (promptBio && bioInfo.available && !bioEnabled) {
        // Defer prompt until next paint so the role redirect doesn't beat us.
        setShowBioPrompt({ email, password, role });
        return;
      }
      if (role === 'driver') router.replace('/(driver)');
      else if (role === 'broker') router.replace('/(broker)');
      else router.replace('/(app)/home');
    } catch (e) {
      Alert.alert('Login failed', e.message || 'Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    await performLogin(data.email, data.password, { promptBio: true });
  };

  const onBiometric = async () => {
    const creds = await getStoredCreds();
    if (!creds) {
      Alert.alert('Biometric login', 'No saved credentials. Sign in once with your password to enable.');
      return;
    }
    const result = await authenticateBiometric(`Sign in to HitchLink with ${bioInfo.label || 'biometrics'}`);
    if (!result?.success) return;
    await performLogin(creds.email, creds.password);
  };

  const onForgotPassword = () => {
    const email = watch('email');
    Alert.alert(
      'Reset password',
      email
        ? `We'll send a password reset link to ${email}.`
        : 'Enter your email above, then tap "Forgot password" again to send a reset link.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send link', onPress: () => {
          if (email) Alert.alert('Email sent', 'Check your inbox for the reset link.');
        }},
      ],
    );
  };

  const finishBioOnboarding = async (accepted) => {
    if (accepted && showBioPrompt) {
      await enableBiometric(showBioPrompt.email, showBioPrompt.password);
      setBioEnabled(true);
    }
    const role = showBioPrompt?.role;
    setShowBioPrompt(false);
    if (role === 'driver') router.replace('/(driver)');
    else if (role === 'broker') router.replace('/(broker)');
    else router.replace('/(app)/home');
  };

  return (
    <AuthBackground>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero brand panel with Ken Burns */}
          <View style={styles.heroWrap}>
            <KenBurnsImage source={{ uri: photos.heroAuth }} />
            <LinearGradient
              colors={['rgba(4,40,90,0.94)', 'rgba(1,55,72,0.82)', 'rgba(1,147,171,0.62)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroBody}>
              <Animated.View style={{ opacity: logoFade, transform: [{ translateY: logoLift }] }}>
                <BrandLogo size={28} />
              </Animated.View>
              <Text style={styles.heroTitle}>Logistics, simplified.</Text>
              <Text style={styles.heroSub}>
                Dispatch loads, track drivers, and get paid faster — all in one place.
              </Text>
            </View>
          </View>

          <Animated.View style={[styles.formArea, { opacity: fade, transform: [{ translateY: lift }] }]}>
            <View style={styles.head}>
              <View style={[styles.pill, { backgroundColor: isDark ? 'rgba(31,182,206,0.18)' : 'rgba(1,147,171,0.10)', borderColor: isDark ? 'rgba(31,182,206,0.32)' : 'rgba(1,147,171,0.28)' }]}>
                <View style={styles.pillDot} />
                <Text style={[styles.pillText, { color: colors.accent }]}>Welcome back</Text>
              </View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Sign in</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Continue to your dispatcher portal
              </Text>
            </View>

            <GlassCard accent variant="strong" cornerRadius={radius['2xl']} contentStyle={styles.card}>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value, onBlur } }) => (
                  <FloatingLabelInput
                    label="Email or username"
                    icon="mail"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="username"
                    keyboardType="email-address"
                    error={errors.email?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value, onBlur } }) => (
                  <FloatingLabelInput
                    label="Password"
                    icon="lock"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit(onSubmit)}
                    error={errors.password?.message}
                  />
                )}
              />

              <View style={styles.forgotRow}>
                <AnimatedPressable onPress={onForgotPassword} hapticStyle="light" pressedScale={0.95}>
                  <Text style={[styles.forgotText, { color: colors.accent }]}>Forgot password?</Text>
                </AnimatedPressable>
              </View>

              <BrandButton
                label={loading ? 'Signing in…' : 'Sign in'}
                icon="arrow"
                iconRight
                size="lg"
                full
                loading={loading}
                onPress={handleSubmit(onSubmit)}
              />

              {bioInfo.available && bioEnabled ? (
                <View style={{ marginTop: spacing[3] }}>
                  <AnimatedPressable onPress={onBiometric} hapticStyle="medium" pressedScale={0.97}>
                    <View style={[styles.bioBtn, { borderColor: colors.accent, backgroundColor: colors.accentMuted }]}>
                      <Icon name="lock" size={16} color={colors.accent} />
                      <Text style={[styles.bioBtnText, { color: colors.accent }]}>
                        Unlock with {bioInfo.label || 'biometrics'}
                      </Text>
                    </View>
                  </AnimatedPressable>
                </View>
              ) : null}

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
                      backgroundColor: isDark ? 'rgba(31,182,206,0.14)' : 'rgba(1,147,171,0.08)',
                      borderColor: isDark ? 'rgba(31,182,206,0.32)' : 'rgba(1,147,171,0.24)',
                    }]}
                  >
                    <Icon name={r.icon} size={14} color={colors.accent} />
                    <Text style={[styles.rolePillText, { color: colors.textSecondary }]}>{r.label}</Text>
                  </View>
                ))}
              </View>

              {/* Sign up link */}
              <AnimatedPressable
                onPress={() => router.push('/(auth)/register')}
                hapticStyle="light"
                pressedScale={0.97}
              >
                <View style={styles.linkRow}>
                  <Text style={[styles.linkText, { color: colors.textMuted }]}>
                    Don't have an account?{' '}
                    <Text style={[styles.link, { color: colors.accent }]}>Sign up</Text>
                  </Text>
                </View>
              </AnimatedPressable>
            </GlassCard>

            <Text style={[styles.footer, { color: colors.textDisabled }]}>
              © 2026 HitchLink · Logistics simplified
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {showBioPrompt ? (
        <View style={styles.bioOverlay}>
          <GlassCard variant="floating" accent contentStyle={styles.bioModal}>
            <LinearGradient
              colors={['#0193ab', '#04285a']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.bioIcon}
            >
              <Icon name="lock" size={28} color="#fff" />
            </LinearGradient>
            <Text style={[styles.bioTitle, { color: colors.textPrimary }]}>
              Enable {bioInfo.label || 'biometric'} login?
            </Text>
            <Text style={[styles.bioSub, { color: colors.textMuted }]}>
              Skip the password next time. We'll keep your credentials encrypted in the device keychain.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] }}>
              <AnimatedPressable onPress={() => finishBioOnboarding(false)} pressedScale={0.97}>
                <View style={[styles.bioCancel, { borderColor: colors.border }]}>
                  <Text style={[styles.bioCancelText, { color: colors.textMuted }]}>Not now</Text>
                </View>
              </AnimatedPressable>
              <View style={{ flex: 1 }}>
                <BrandButton label="Enable" full size="md" onPress={() => finishBioOnboarding(true)} />
              </View>
            </View>
          </GlassCard>
        </View>
      ) : null}
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: spacing[8] },

  heroWrap: {
    height: 230,
    overflow: 'hidden',
  },
  heroBody: {
    flex: 1, padding: spacing[5],
    justifyContent: 'flex-end',
    gap: spacing[3],
  },
  heroTitle: {
    color: '#fff', fontSize: typography['3xl'],
    fontWeight: '800', letterSpacing: -0.8,
    lineHeight: 38,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14, fontWeight: '500',
    lineHeight: 20, maxWidth: 320,
  },

  formArea: {
    marginTop: -spacing[4],
    padding: spacing[5],
    gap: spacing[3],
  },

  head: { marginBottom: spacing[3], gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start',
  },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  title: { fontSize: typography['2xl'], fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: typography.sm, marginTop: 2 },

  card: { padding: spacing[5], gap: 0 },

  forgotRow: { alignItems: 'flex-end', marginTop: -spacing[2], marginBottom: spacing[3] },
  forgotText: { fontSize: typography.xs, fontWeight: '800', letterSpacing: 0.2 },

  bioBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: radius.lg, borderWidth: 1.5,
  },
  bioBtnText: { fontSize: typography.sm, fontWeight: '800', letterSpacing: 0.2 },

  roleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[5], marginBottom: spacing[3] },
  roleDivider: { flex: 1, height: 1 },
  roleHint: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  rolePills: { flexDirection: 'row', gap: spacing[2], justifyContent: 'center', flexWrap: 'wrap' },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing[3], paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
  },
  rolePillText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.2 },

  linkRow: { alignItems: 'center', marginTop: spacing[5] },
  linkText: { fontSize: typography.sm, fontWeight: '500' },
  link: { fontWeight: '800' },

  footer: { textAlign: 'center', marginTop: spacing[6], fontSize: 11, fontWeight: '600' },

  bioOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing[5],
  },
  bioModal: { padding: spacing[5], gap: spacing[2], alignItems: 'center' },
  bioIcon: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[2],
  },
  bioTitle: { fontSize: typography.lg, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  bioSub: { fontSize: typography.sm, textAlign: 'center', lineHeight: 19, marginTop: 4 },
  bioCancel: {
    paddingHorizontal: spacing[5], paddingVertical: 13, borderRadius: radius.md, borderWidth: 1,
    alignItems: 'center',
  },
  bioCancelText: { fontSize: typography.sm, fontWeight: '700' },
});
