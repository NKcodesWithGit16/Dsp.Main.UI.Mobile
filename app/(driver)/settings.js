import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, ActivityIndicator,
  Animated, PanResponder, RefreshControl, Alert, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { fetchDriver, updateDriverSettings } from '../../src/api/main';
import log from '../../src/utils/logger';
import {
  isBiometricSupported, isBiometricEnabled, disableBiometric,
} from '../../src/utils/biometric';

import GradientHeader from '../../src/components/shared/GradientHeader';
import Icon from '../../src/components/shared/Icon';
import AnimatedPressable from '../../src/components/shared/AnimatedPressable';
import { gradients, glass, shadow, radius, spacing, typography } from '../../src/theme/colors';

function SectionLabel({ label, colors }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{label}</Text>
  );
}

function Card({ children, isDark }) {
  return (
    <View style={[styles.card, shadow.card, {
      backgroundColor: isDark ? glass.fillDarkStrong : glass.fillLightStrong,
      borderColor: isDark ? glass.borderDarkSoft : glass.borderLightSoft,
    }]}>
      {children}
    </View>
  );
}

function Row({ icon, iconColor, iconBg, gradient, title, sub, value, onPress, danger, switchValue, onSwitchChange, divider, colors }) {
  const Wrap = onPress ? AnimatedPressable : View;
  return (
    <>
      <Wrap onPress={onPress} pressedScale={0.99} hapticStyle="selection">
        <View style={styles.row}>
          {gradient ? (
            <LinearGradient colors={gradient} style={styles.rowIcon}>
              <Icon name={icon} size={18} color="#fff" />
            </LinearGradient>
          ) : (
            <View style={[styles.rowIcon, { backgroundColor: iconBg || (danger ? 'rgba(239,68,68,0.12)' : 'rgba(1,147,171,0.12)') }]}>
              <Icon name={icon} size={18} color={iconColor || (danger ? '#ef4444' : '#0193ab')} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: danger ? '#ef4444' : colors.textPrimary }]}>{title}</Text>
            {sub ? <Text style={[styles.rowSub, { color: colors.textMuted }]}>{sub}</Text> : null}
          </View>
          {switchValue != null ? (
            <Switch
              value={switchValue}
              onValueChange={onSwitchChange}
              trackColor={{ false: 'rgba(148,163,184,0.4)', true: '#0193ab' }}
              thumbColor="#ffffff"
            />
          ) : value != null ? (
            <Text style={[styles.rowValue, { color: colors.textMuted }]} numberOfLines={1}>{value}</Text>
          ) : onPress ? (
            <Icon name="chevron" size={16} color={colors.textMuted} />
          ) : null}
        </View>
      </Wrap>
      {divider ? <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} /> : null}
    </>
  );
}

export default function DriverSettings() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { userId, userName, userEmail, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driver, setDriver] = useState(null);
  const [autoAccept, setAutoAccept] = useState(false);
  const [bioSupport, setBioSupport] = useState({ available: false });
  const [bioEnabled, setBioEnabled] = useState(false);

  // Notification prefs (local-only for now; would sync to server in real impl)
  const [notif, setNotif] = useState({
    newLoad: true,
    hotLoad: true,
    dispatcherMsg: true,
    weather: false,
  });
  const [hosWarn, setHosWarn] = useState(60);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const d = await fetchDriver(userId);
      if (d) {
        setDriver(d);
        setAutoAccept(!!d.autoAcceptLoads);
      }
    } catch (e) { log.warn('DriverSettings', 'fetchDriver failed', e); }
    const support = await isBiometricSupported();
    const enabled = await isBiometricEnabled();
    setBioSupport(support);
    setBioEnabled(enabled);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggleAutoAccept = useCallback(async (next) => {
    Haptics.selectionAsync().catch(() => {});
    setAutoAccept(next);
    try {
      await updateDriverSettings(userId, { autoAcceptLoads: next });
    } catch {
      setAutoAccept(!next);
    }
  }, [userId]);

  const handleSignOut = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert('Sign out', 'Sign out of HitchLink?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => {
        await logout();
        router.replace('/(auth)/login');
      } },
    ]);
  };

  const toggleBio = async () => {
    if (bioEnabled) {
      await disableBiometric();
      setBioEnabled(false);
    } else {
      Alert.alert('Enable biometric login', 'You\'ll need to sign in with your password once to store credentials securely.');
    }
  };

  const truckLabel = driver
    ? (driver.truck || driver.truckNumber || driver.vehicleId || 'No truck on file')
    : '—';
  const equipLabel = driver?.equipment || 'Unknown';
  const plateLabel = driver?.plate || driver?.licensePlate || '—';
  const phoneLabel = driver?.phone || driver?.phoneNumber || '—';
  const licenseLabel = driver?.licenseNumber || driver?.cdl || '—';

  // Swipe-down-to-dismiss
  const dragY = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) dragY.setValue(Math.min(g.dy, 220)); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.8) {
          Animated.timing(dragY, { toValue: 600, duration: 200, useNativeDriver: true })
            .start(() => router.back());
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  const initials = (userName || 'DR').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Animated.View
      style={[stylesC.container, { backgroundColor: colors.pageBg, transform: [{ translateY: dragY }] }]}
    >
      <View {...pan.panHandlers}>
        <GradientHeader
          gradient={gradients.brand}
          eyebrow="Preferences"
          title="Settings"
          onBack={() => { Haptics.selectionAsync().catch(() => {}); router.back(); }}
        />
      </View>

      {loading ? (
        <View style={stylesC.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[stylesC.scroll, { paddingBottom: insets.bottom + spacing[8] }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
        >
          {/* Profile card */}
          <Card isDark={isDark}>
            <View style={stylesC.profileRow}>
              <LinearGradient colors={['#0193ab', '#04285a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={stylesC.avatar}>
                <Text style={stylesC.avatarText}>{initials}</Text>
              </LinearGradient>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[stylesC.profileName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {userName || 'Driver'}
                </Text>
                <Text style={[stylesC.profileSub, { color: colors.textMuted }]} numberOfLines={1}>
                  {userEmail || 'Signed in'}
                </Text>
                <View style={[stylesC.roleBadge, { backgroundColor: colors.accentMuted }]}>
                  <Icon name="truck" size={11} color={colors.accent} />
                  <Text style={[stylesC.roleText, { color: colors.accent }]}>DRIVER · {equipLabel}</Text>
                </View>
              </View>
              <AnimatedPressable
                onPress={() => Alert.alert('Edit profile', 'Coming soon — edit your details from the web portal for now.')}
                hapticStyle="light"
                pressedScale={0.92}
              >
                <View style={[stylesC.editBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }]}>
                  <Icon name="pencil" size={15} color={colors.textMuted} />
                </View>
              </AnimatedPressable>
            </View>
          </Card>

          <SectionLabel label="PROFILE" colors={colors} />
          <Card isDark={isDark}>
            <Row icon="mail"  title="Email"   value={userEmail || '—'} colors={colors} divider />
            <Row icon="phone" title="Phone"   value={phoneLabel} colors={colors} divider />
            <Row icon="fileText" title="CDL #" value={licenseLabel} colors={colors} />
          </Card>

          <SectionLabel label="TRUCK" colors={colors} />
          <Card isDark={isDark}>
            <Row icon="truck" gradient={['#0193ab', '#06b6d4']} title="Truck"     value={truckLabel} colors={colors} divider />
            <Row icon="box"   title="Equipment" value={equipLabel} colors={colors} divider />
            <Row icon="pin"   title="Plate"     value={plateLabel} colors={colors} />
          </Card>

          <SectionLabel label="LOADS" colors={colors} />
          <Card isDark={isDark}>
            <Row
              icon="checkmark"
              gradient={['#10b981', '#059669']}
              title="Auto-accept loads"
              sub="Skip the accept/deny prompt"
              switchValue={autoAccept}
              onSwitchChange={toggleAutoAccept}
              colors={colors}
            />
          </Card>

          <SectionLabel label="NOTIFICATIONS" colors={colors} />
          <Card isDark={isDark}>
            <Row icon="box"       title="New load assigned"     switchValue={notif.newLoad}      onSwitchChange={v => setNotif(p => ({ ...p, newLoad: v }))}      colors={colors} divider />
            <Row icon="flame"     iconColor="#ef4444" iconBg="rgba(239,68,68,0.12)" title="Hot load alerts" switchValue={notif.hotLoad} onSwitchChange={v => setNotif(p => ({ ...p, hotLoad: v }))} colors={colors} divider />
            <Row icon="chat"      title="Dispatcher messages"  switchValue={notif.dispatcherMsg} onSwitchChange={v => setNotif(p => ({ ...p, dispatcherMsg: v }))} colors={colors} divider />
            <Row icon="alertTriangle" iconColor="#b45309" iconBg="rgba(245,158,11,0.14)" title="Weather alerts" switchValue={notif.weather} onSwitchChange={v => setNotif(p => ({ ...p, weather: v }))} colors={colors} />
          </Card>

          <SectionLabel label="HOURS OF SERVICE" colors={colors} />
          <Card isDark={isDark}>
            <Row
              icon="clock"
              iconColor="#b45309"
              iconBg="rgba(245,158,11,0.14)"
              title="Warn me before HOS limit"
              sub={`${hosWarn} minutes before max`}
              onPress={() => {
                Alert.alert('HOS warning threshold', '', [
                  { text: '30 minutes', onPress: () => setHosWarn(30) },
                  { text: '60 minutes', onPress: () => setHosWarn(60) },
                  { text: '90 minutes', onPress: () => setHosWarn(90) },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
              colors={colors}
            />
          </Card>

          <SectionLabel label="SECURITY" colors={colors} />
          <Card isDark={isDark}>
            <Row
              icon="lock"
              title={bioSupport.available ? `Sign in with ${bioSupport.label || 'biometrics'}` : 'Biometric login'}
              sub={bioSupport.available
                ? (bioEnabled ? 'Enabled' : 'Tap to disable / sign in with password once to enable')
                : 'Not available on this device'}
              switchValue={bioSupport.available ? bioEnabled : null}
              onSwitchChange={toggleBio}
              colors={colors}
            />
          </Card>

          <SectionLabel label="APPEARANCE" colors={colors} />
          <Card isDark={isDark}>
            <Row
              icon={isDark ? 'moon' : 'sun'}
              title="Theme"
              sub={`Currently ${isDark ? 'Dark' : 'Light'} — tap to switch`}
              onPress={toggleTheme}
              colors={colors}
            />
          </Card>

          <SectionLabel label="SUPPORT" colors={colors} />
          <Card isDark={isDark}>
            <Row
              icon="phone"
              gradient={['#10b981', '#059669']}
              title="Contact dispatch"
              sub="Direct line to your dispatcher"
              onPress={() => {
                if (driver?.dispatcherPhone) Linking.openURL(`tel:${driver.dispatcherPhone}`);
                else Alert.alert('No phone', 'No dispatcher number on file.');
              }}
              colors={colors}
              divider
            />
            <Row
              icon="info"
              title="Help center"
              sub="FAQs, troubleshooting, contact"
              onPress={() => Linking.openURL('https://hitchlink.app/help').catch(() => {})}
              colors={colors}
            />
          </Card>

          <SectionLabel label="ACCOUNT" colors={colors} />
          <Card isDark={isDark}>
            <Row
              icon="logout"
              danger
              title="Sign out"
              onPress={handleSignOut}
              colors={colors}
            />
          </Card>

          <Text style={[stylesC.versionText, { color: colors.textDisabled }]}>
            HitchLink Driver · v1.0.0
          </Text>
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginLeft: 4, marginBottom: 8, marginTop: 18 },
  card: { borderRadius: radius.lg, borderWidth: 1, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[3], paddingVertical: spacing[3] },
  rowIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14.5, fontWeight: '700', letterSpacing: -0.1 },
  rowSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  rowValue: { fontSize: 12.5, fontWeight: '600', maxWidth: 140, textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
});

const stylesC = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing[4], gap: 0 },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3] },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0193ab', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: -0.6 },
  profileName: { fontSize: typography.lg, fontWeight: '800', letterSpacing: -0.3 },
  profileSub: { fontSize: typography.sm, marginTop: 2 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999, alignSelf: 'flex-start',
    marginTop: 6,
  },
  roleText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  editBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  versionText: { textAlign: 'center', marginTop: spacing[6], fontSize: 11, fontWeight: '600' },
});
