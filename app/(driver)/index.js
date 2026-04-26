import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  Dimensions, Platform, Linking, Alert, Animated, PanResponder, Easing,
  RefreshControl, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MapView, { Marker, MarkerAnimated, Polyline, PROVIDER_GOOGLE, AnimatedRegion } from 'react-native-maps';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import {
  fetchActiveLoad, fetchDriverMessages, updateDriverStatus,
} from '../../src/api/main';
import { spacing, glass, shadow, gradients } from '../../src/theme/colors';
import { darkMapStyle, lightMapStyle } from '../../src/theme/mapStyles';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_COLLAPSED = 148;
const SHEET_OPEN = Math.round(SCREEN_H * 0.62);

const STATUSES = [
  { key: 'moving',  label: 'Moving',  color: '#22c55e' },
  { key: 'idle',    label: 'Idle',    color: '#f59e0b' },
  { key: 'offline', label: 'Offline', color: '#9ca3af' },
];

function haversineMiles(a, b) {
  if (!a || !b) return null;
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function etaFromMilesAndSpeed(miles, speedMph) {
  if (!Number.isFinite(miles) || miles <= 0) return null;
  const avg = Math.max(30, speedMph || 55);
  const mins = Math.round((miles / avg) * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatArrivalTime(etaText) {
  if (!etaText || typeof etaText !== 'string') return null;
  const hm = etaText.match(/(\d+)\s*h/i);
  const mm = etaText.match(/(\d+)\s*m/i);
  const hours = hm ? parseInt(hm[1], 10) : 0;
  const mins  = mm ? parseInt(mm[1], 10) : 0;
  if (!hours && !mins) return null;
  const arrive = new Date(Date.now() + (hours * 60 + mins) * 60 * 1000);
  return arrive.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function normalizeLoad(raw) {
  if (!raw) return null;
  const pickupLat = raw.pickupLat ?? raw.originLat;
  const pickupLng = raw.pickupLng ?? raw.originLng;
  const dropoffLat = raw.dropoffLat ?? raw.destLat;
  const dropoffLng = raw.dropoffLng ?? raw.destLng;
  return {
    ...raw,
    origin: raw.origin || raw.pickupAddress || 'Pickup',
    destination: raw.destination || raw.dropoffAddress || 'Delivery',
    pickupLat, pickupLng, dropoffLat, dropoffLng,
    hasCoords: Number.isFinite(pickupLat) && Number.isFinite(dropoffLat),
  };
}

/* ═════ Pulse ring ═════ */
function PulseDot({ color, size = 10 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(scale, { toValue: 2.4, duration: 1800, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(opacity, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  useEffect(() => { scale.setValue(1); opacity.setValue(0.55); }, [color]);
  return (
    <View style={{ width: size, height: size }}>
      <View style={[pulseS.core, { backgroundColor: color, width: size, height: size }]} />
      <Animated.View style={[
        pulseS.ring,
        { backgroundColor: color, width: size, height: size, transform: [{ scale }], opacity },
      ]} />
    </View>
  );
}
const pulseS = StyleSheet.create({
  core: { borderRadius: 999, position: 'absolute' },
  ring: { borderRadius: 999, position: 'absolute' },
});

/* ═════ Map pills ═════ */
function MapPills({ speedMph, gpsOk, isDark }) {
  const bgColor = isDark ? 'rgba(12,18,35,0.78)' : 'rgba(255,255,255,0.88)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)';
  return (
    <View style={pillS.wrap} pointerEvents="none">
      <View style={[pillS.speed, { backgroundColor: bgColor, borderColor }]}>
        <Text style={[pillS.speedNum, speedMph != null && pillS.speedNumLive, isDark && { color: '#f1f5f9' }]}>
          {speedMph ?? 0}
        </Text>
        <Text style={pillS.speedUnit}>mph</Text>
      </View>
      <View style={[pillS.gps, { backgroundColor: bgColor, borderColor }]}>
        <View style={[pillS.gpsDot, { backgroundColor: gpsOk ? '#059669' : '#d97706' }]} />
        <Text style={[pillS.gpsText, { color: gpsOk ? '#059669' : '#d97706' }]}>
          {gpsOk ? 'GPS LIVE' : 'GPS WEAK'}
        </Text>
      </View>
    </View>
  );
}
const pillS = StyleSheet.create({
  wrap: { position: 'absolute', top: 12, left: 12, gap: 8, zIndex: 5 },
  speed: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, borderWidth: 1,
    alignSelf: 'flex-start',
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 22, elevation: 6,
  },
  speedNum: { fontSize: 22, fontWeight: '800', letterSpacing: -0.8, color: '#0f172a' },
  speedNumLive: { color: '#6366f1' },
  speedUnit: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, color: '#6b7280', textTransform: 'uppercase' },
  gps: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
    alignSelf: 'flex-start',
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 14, elevation: 3,
  },
  gpsDot: { width: 6, height: 6, borderRadius: 99 },
  gpsText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
});

/* ═════ Header ═════ */
function DriverHeader({ status, userName, onAvatarTap, colors, isDark }) {
  const insets = useSafeAreaInsets();
  const statusMeta = STATUSES.find(s => s.key === status) || STATUSES[0];
  const initials = userName
    ? userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'DR';

  return (
    <View style={[hdrS.wrap, {
      paddingTop: insets.top + 6,
      backgroundColor: isDark ? 'rgba(8,9,14,0.92)' : 'rgba(255,255,255,0.92)',
      borderBottomColor: colors.border,
    }]}>
      <View style={hdrS.inner}>
        <View style={hdrS.left}>
          <Text style={[hdrS.logo, { color: colors.textPrimary }]}>
            dispatch<Text style={{ color: colors.accent }}>R</Text>
          </Text>
          <View style={[hdrS.roleBadge, { backgroundColor: colors.accentMuted }]}>
            <Text style={[hdrS.roleText, { color: colors.accent }]}>DRIVER</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[hdrS.pill, {
            backgroundColor: statusMeta.color + '1f',
            borderColor: statusMeta.color + '55',
          }]}
          onPress={onAvatarTap}
          activeOpacity={0.8}
        >
          <PulseDot color={statusMeta.color} size={7} />
          <Text style={[hdrS.pillText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          <LinearGradient colors={['#6366f1', '#8b5cf6']} style={hdrS.avatar}>
            <Text style={hdrS.avatarText}>{initials}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const hdrS = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, borderBottomWidth: 1 },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 10 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  roleBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  roleText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10, paddingRight: 4, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.3, textTransform: 'capitalize' },
  avatar: { width: 28, height: 28, borderRadius: 999, justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});

/* ═════ Dropdown menu ═════ */
function HeaderMenu({ visible, onClose, isDark, colors, userName, userEmail, truckInfo, onToggleTheme, onSignOut }) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(-6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translate, { toValue: visible ? 0 : -6, duration: 160, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Pressable style={menuS.backdrop} onPress={onClose}>
      <Animated.View
        style={[
          menuS.wrap,
          {
            top: insets.top + 52,
            opacity,
            transform: [{ translateY: translate }],
          },
        ]}
      >
        <BlurView
          intensity={isDark ? 80 : 70}
          tint={isDark ? 'dark' : 'light'}
          style={menuS.blur}
        >
          <View style={[menuS.card, {
            backgroundColor: isDark ? 'rgba(18,22,38,0.72)' : 'rgba(255,255,255,0.78)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }]}>
            <View style={menuS.profile}>
              <LinearGradient colors={['#6366f1', '#8b5cf6']} style={menuS.profileAvatar}>
                <Text style={menuS.profileAvatarText}>
                  {(userName || 'DR').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </LinearGradient>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[menuS.profileName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {userName || 'Driver'}
                </Text>
                <Text style={[menuS.profileSub, { color: colors.textMuted }]} numberOfLines={1}>
                  {userEmail || 'Signed in'}
                </Text>
              </View>
            </View>

            <View style={[menuS.divider, { backgroundColor: colors.border }]} />

            <MenuRow
              icon={isDark ? '☾' : '☀︎'}
              label={isDark ? 'Dark theme' : 'Light theme'}
              meta={isDark ? 'On' : 'Off'}
              colors={colors}
              onPress={onToggleTheme}
            />
            <MenuRow
              icon="🌐"
              label="Language"
              meta="English"
              colors={colors}
              onPress={() => {
                Haptics.selectionAsync();
                Alert.alert('Language', 'Additional languages coming soon.');
              }}
            />
            <MenuRow
              icon="🚛"
              label="Truck info"
              meta={truckInfo || '—'}
              colors={colors}
              onPress={() => {
                Haptics.selectionAsync();
                Alert.alert('Truck info', truckInfo || 'No truck info on file. Contact your dispatcher.');
              }}
            />

            <View style={[menuS.divider, { backgroundColor: colors.border }]} />

            <MenuRow
              icon="⎋"
              label="Sign out"
              danger
              colors={colors}
              onPress={onSignOut}
            />
          </View>
        </BlurView>
      </Animated.View>
    </Pressable>
  );
}

function MenuRow({ icon, label, meta, onPress, colors, danger }) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={menuS.row}>
      <Text style={[menuS.rowIcon, danger && { color: '#ef4444' }]}>{icon}</Text>
      <Text style={[menuS.rowLabel, { color: danger ? '#ef4444' : colors.textPrimary }]}>{label}</Text>
      {meta ? <Text style={[menuS.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>{meta}</Text> : null}
    </TouchableOpacity>
  );
}

const menuS = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 30 },
  wrap: {
    position: 'absolute',
    right: 10,
    width: 268,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 14,
  },
  blur: { width: '100%' },
  card: { borderRadius: 16, borderWidth: 1, padding: 10, gap: 2 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 6 },
  profileAvatar: { width: 36, height: 36, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  profileName: { fontSize: 14, fontWeight: '700' },
  profileSub: { fontSize: 11.5, marginTop: 1 },
  divider: { height: 1, marginVertical: 4, opacity: 0.9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 10 },
  rowIcon: { width: 20, textAlign: 'center', fontSize: 15 },
  rowLabel: { flex: 1, fontSize: 13.5, fontWeight: '600' },
  rowMeta: { fontSize: 12, fontWeight: '500', maxWidth: 120, textAlign: 'right' },
});

/* ═════ Toast ═════ */
function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((text, kind = 'success') => {
    setToast({ text, kind, id: Date.now() });
  }, []);
  return { toast, show, clear: () => setToast(null) };
}

function Toast({ toast, onDone, isDark }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(-20)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(ty, { toValue: 0, damping: 18, stiffness: 240, mass: 0.9, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(ty, { toValue: -20, duration: 180, useNativeDriver: true }),
      ]).start(() => onDone && onDone());
    }, 2200);
    return () => clearTimeout(t);
  }, [toast?.id]);

  if (!toast) return null;
  const color = toast.kind === 'error' ? '#ef4444' : toast.kind === 'info' ? '#6366f1' : '#10b981';

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        toastS.wrap,
        {
          top: insets.top + 62,
          opacity,
          transform: [{ translateY: ty }],
        },
      ]}
    >
      <BlurView intensity={isDark ? 70 : 60} tint={isDark ? 'dark' : 'light'} style={toastS.blur}>
        <View style={[toastS.inner, {
          borderColor: color + '55',
          backgroundColor: isDark ? 'rgba(18,22,38,0.7)' : 'rgba(255,255,255,0.82)',
        }]}>
          <View style={[toastS.dot, { backgroundColor: color }]} />
          <Text style={[toastS.text, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{toast.text}</Text>
        </View>
      </BlurView>
    </Animated.View>
  );
}
const toastS = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 50 },
  blur: { borderRadius: 999, overflow: 'hidden' },
  inner: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999, borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 99 },
  text: { fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },
});

/* ═════ New-message banner ═════ */
function MessageBanner({ message, isDark, onTap, onDone }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(-26)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(ty, { toValue: 0, damping: 18, stiffness: 260, mass: 0.9, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(ty, { toValue: -26, duration: 180, useNativeDriver: true }),
      ]).start(() => onDone && onDone());
    }, 3400);
    return () => clearTimeout(t);
  }, [message?.id]);

  if (!message) return null;

  return (
    <Animated.View
      style={[
        bnrS.wrap,
        { top: insets.top + 62, opacity, transform: [{ translateY: ty }] },
      ]}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={onTap}>
        <BlurView intensity={isDark ? 70 : 55} tint={isDark ? 'dark' : 'light'} style={bnrS.blur}>
          <View style={[bnrS.inner, {
            backgroundColor: isDark ? 'rgba(18,22,38,0.78)' : 'rgba(255,255,255,0.86)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }]}>
            <LinearGradient colors={['#6366f1', '#8b5cf6']} style={bnrS.icon}>
              <Text style={bnrS.iconText}>💬</Text>
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[bnrS.title, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>Dispatcher</Text>
              <Text style={[bnrS.sub, { color: isDark ? '#b8c0d4' : '#3d4663' }]} numberOfLines={1}>
                {message.text}
              </Text>
            </View>
            <Text style={[bnrS.chev, { color: isDark ? '#7b869e' : '#5a6478' }]}>›</Text>
          </View>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}
const bnrS = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 40 },
  blur: { borderRadius: 16, overflow: 'hidden' },
  inner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, borderRadius: 16, borderWidth: 1,
  },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 16 },
  title: { fontSize: 13.5, fontWeight: '800', letterSpacing: -0.2 },
  sub: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  chev: { fontSize: 22, fontWeight: '300', opacity: 0.7 },
});

/* ═════ Arrived overlay ═════ */
function ArrivedBanner({ visible, onDismiss, destination, isDark, colors }) {
  const scale = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, damping: 18, stiffness: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scale, { toValue: 0.92, damping: 20, stiffness: 260, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[arrivedS.overlay, { opacity }]}>
      <Animated.View style={{ transform: [{ scale }], width: '100%' }}>
        <BlurView intensity={isDark ? 80 : 65} tint={isDark ? 'dark' : 'light'} style={arrivedS.blur}>
          <View style={[arrivedS.card, {
            backgroundColor: isDark ? 'rgba(10,15,28,0.88)' : 'rgba(255,255,255,0.92)',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
          }]}>
            <LinearGradient colors={['#10b981', '#059669']} style={arrivedS.iconWrap}>
              <Text style={arrivedS.iconText}>✓</Text>
            </LinearGradient>
            <Text style={[arrivedS.title, { color: colors.textPrimary }]}>You've arrived!</Text>
            <Text style={[arrivedS.sub, { color: colors.textMuted }]} numberOfLines={2}>
              {destination || 'Destination reached'}
            </Text>
            <TouchableOpacity activeOpacity={0.85} onPress={onDismiss} style={arrivedS.btnWrap}>
              <LinearGradient colors={['#10b981', '#059669']} style={arrivedS.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={arrivedS.btnText}>Confirm Arrival</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>
    </Animated.View>
  );
}
const arrivedS = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject, zIndex: 60,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 24,
  },
  blur: { borderRadius: 28, overflow: 'hidden', width: '100%' },
  card: {
    borderRadius: 28, borderWidth: 1,
    padding: 28, alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.28, shadowRadius: 48, elevation: 22,
  },
  iconWrap: {
    width: 76, height: 76, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
    shadowColor: '#10b981', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
  },
  iconText: { color: '#fff', fontSize: 34, fontWeight: '800' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  sub: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20, marginBottom: 6 },
  btnWrap: { borderRadius: 14, overflow: 'hidden', width: '100%', marginTop: 4 },
  btn: { paddingVertical: 15, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.1 },
});

/* ═════════════════════════════════════ */
export default function DriverPortal() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { userId, userName, userEmail, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeLoad, setActiveLoad] = useState(null);
  const [loadLoading, setLoadLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState('moving');
  const [unread, setUnread] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [speedMph, setSpeedMph] = useState(null);
  const [driverPos, setDriverPos] = useState(null); // { latitude, longitude }
  const [gpsOk, setGpsOk] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [banner, setBanner] = useState(null);
  const [arrivedVisible, setArrivedVisible] = useState(false);
  const arrivedDismissedRef = useRef(false);

  const { toast, show: showToast, clear: clearToast } = useToast();

  const prevMsgCountRef = useRef(0);
  const firstPollDoneRef = useRef(false);
  const mapRef = useRef(null);
  const hasFitRef = useRef(false);

  // Animated marker coordinate (tweens between position updates)
  const animatedCoord = useRef(
    new AnimatedRegion({
      latitude: 39.8283,
      longitude: -98.5795,
      latitudeDelta: 0,
      longitudeDelta: 0,
    }),
  ).current;

  const loadActive = useCallback(async () => {
    if (!userId) return;
    try {
      const d = await fetchActiveLoad(userId);
      setActiveLoad(normalizeLoad(d));
    } catch {}
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setLoadLoading(true);
    loadActive().finally(() => setLoadLoading(false));
  }, [userId, loadActive]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.selectionAsync();
    await loadActive();
    setRefreshing(false);
  }, [loadActive]);

  // Message polling + unread + new-message banner
  useEffect(() => {
    if (!userId) return;
    let stopped = false;
    const tick = async () => {
      try {
        const data = await fetchDriverMessages(userId);
        if (stopped || !Array.isArray(data)) return;
        const fromDispatcher = data.filter(m =>
          (m.senderRole || '').toLowerCase() !== 'driver' && m.senderId !== userId,
        );
        const latest = fromDispatcher[fromDispatcher.length - 1];
        if (firstPollDoneRef.current) {
          const diff = fromDispatcher.length - prevMsgCountRef.current;
          if (diff > 0) {
            setUnread(u => u + diff);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            if (latest) {
              setBanner({
                id: latest.id || latest.messageId || `${latest.sentAt}`,
                text: latest.message || latest.content || latest.text || 'New message',
              });
            }
          }
        }
        prevMsgCountRef.current = fromDispatcher.length;
        firstPollDoneRef.current = true;
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 9000);
    return () => { stopped = true; clearInterval(iv); };
  }, [userId]);

  // Location tracking
  useEffect(() => {
    let sub = null;
    let cancelled = false;
    (async () => {
      try {
        const { status: pStatus } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (pStatus !== 'granted') {
          setHasLocationPermission(false);
          setGpsOk(false);
          return;
        }
        setHasLocationPermission(true);
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }).catch(() => null);
        if (!cancelled && current?.coords) {
          const c = { latitude: current.coords.latitude, longitude: current.coords.longitude };
          setDriverPos(c);
          animatedCoord.setValue({ ...c, latitudeDelta: 0, longitudeDelta: 0 });
          if (Number.isFinite(current.coords.speed) && current.coords.speed >= 0) {
            setSpeedMph(Math.max(0, Math.round(current.coords.speed * 2.23694)));
          }
          setGpsOk(true);
        }
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (loc) => {
            if (cancelled || !loc?.coords) return;
            const next = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setDriverPos(next);
            animatedCoord.timing({
              ...next,
              duration: 900,
              useNativeDriver: false,
            }).start();
            if (Number.isFinite(loc.coords.speed) && loc.coords.speed >= 0) {
              setSpeedMph(Math.max(0, Math.round(loc.coords.speed * 2.23694)));
            }
            setGpsOk(true);
          },
        );
      } catch {
        setGpsOk(false);
      }
    })();
    return () => {
      cancelled = true;
      if (sub && typeof sub.remove === 'function') sub.remove();
    };
  }, []);

  // Fallback simulated speed when offline / no permission
  useEffect(() => {
    if (hasLocationPermission) return;
    if (status !== 'moving') { setSpeedMph(null); return; }
    const base = 55;
    const iv = setInterval(() => {
      setSpeedMph(base + Math.round((Math.random() - 0.5) * 14));
    }, 1600);
    return () => clearInterval(iv);
  }, [status, hasLocationPermission]);

  // Fallback driver position if no GPS: 25% along route
  const fallbackPos = useMemo(() => {
    if (!activeLoad?.hasCoords) return null;
    return {
      latitude: activeLoad.pickupLat + (activeLoad.dropoffLat - activeLoad.pickupLat) * 0.25,
      longitude: activeLoad.pickupLng + (activeLoad.dropoffLng - activeLoad.pickupLng) * 0.25,
    };
  }, [activeLoad]);

  const effectiveDriverPos = driverPos || fallbackPos;

  // Compute remaining miles / eta from real position
  const remainingMiles = useMemo(() => {
    if (!effectiveDriverPos || !activeLoad?.hasCoords) return null;
    const m = haversineMiles(effectiveDriverPos, {
      latitude: activeLoad.dropoffLat,
      longitude: activeLoad.dropoffLng,
    });
    return m != null ? Math.round(m) : null;
  }, [effectiveDriverPos, activeLoad]);

  const liveEta = useMemo(() => {
    if (remainingMiles == null) return null;
    return etaFromMilesAndSpeed(remainingMiles, speedMph);
  }, [remainingMiles, speedMph]);

  const totalMiles = useMemo(() => {
    if (!activeLoad?.hasCoords) return null;
    const m = haversineMiles(
      { latitude: activeLoad.pickupLat, longitude: activeLoad.pickupLng },
      { latitude: activeLoad.dropoffLat, longitude: activeLoad.dropoffLng },
    );
    return m != null ? Math.round(m) : null;
  }, [activeLoad]);

  const progressPercent = useMemo(() => {
    if (totalMiles == null || remainingMiles == null || totalMiles === 0) return 0;
    return Math.max(0, Math.min(100, ((totalMiles - remainingMiles) / totalMiles) * 100));
  }, [totalMiles, remainingMiles]);

  useEffect(() => {
    if (remainingMiles != null && remainingMiles < 0.5 && activeLoad && !arrivedDismissedRef.current) {
      setArrivedVisible(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [remainingMiles, activeLoad]);

  useEffect(() => {
    hasFitRef.current = false;
  }, [activeLoad?.id ?? activeLoad?.origin]);

  const changeStatus = async (next) => {
    if (next === status) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setStatus(next);
    try {
      await updateDriverStatus(userId, next);
      showToast(`Status set to ${next}`, 'success');
    } catch {
      showToast('Could not update status', 'error');
    }
  };

  const mapsUrl = useMemo(() => {
    if (!activeLoad) return null;
    if (activeLoad.hasCoords) {
      return `https://www.google.com/maps/dir/?api=1&destination=${activeLoad.dropoffLat},${activeLoad.dropoffLng}`;
    }
    const dest = encodeURIComponent(activeLoad.destination || '');
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  }, [activeLoad]);

  const openMaps = () => {
    Haptics.selectionAsync();
    if (mapsUrl) Linking.openURL(mapsUrl).catch(() => {});
  };

  const initialRegion = useMemo(() => {
    if (activeLoad?.hasCoords) {
      const midLat = (activeLoad.pickupLat + activeLoad.dropoffLat) / 2;
      const midLng = (activeLoad.pickupLng + activeLoad.dropoffLng) / 2;
      const latDelta = Math.abs(activeLoad.pickupLat - activeLoad.dropoffLat) * 1.8 || 0.6;
      const lngDelta = Math.abs(activeLoad.pickupLng - activeLoad.dropoffLng) * 1.8 || 0.6;
      return { latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta };
    }
    return { latitude: 39.8283, longitude: -98.5795, latitudeDelta: 25, longitudeDelta: 40 };
  }, [activeLoad]);

  // Fit to coordinates once map + (load or GPS) are ready
  useEffect(() => {
    if (!mapReady || hasFitRef.current || !mapRef.current) return;

    if (activeLoad?.hasCoords) {
      const coords = [
        { latitude: activeLoad.pickupLat, longitude: activeLoad.pickupLng },
        { latitude: activeLoad.dropoffLat, longitude: activeLoad.dropoffLng },
      ];
      if (driverPos) coords.push(driverPos);
      const t = setTimeout(() => {
        try {
          mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 120, right: 60, bottom: SHEET_OPEN + 40, left: 60 },
            animated: true,
          });
          hasFitRef.current = true;
        } catch {}
      }, 400);
      return () => clearTimeout(t);
    }

    // No active load: center on driver's GPS once we have a fix.
    if (driverPos) {
      const t = setTimeout(() => {
        try {
          mapRef.current?.animateToRegion(
            {
              latitude: driverPos.latitude,
              longitude: driverPos.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            },
            600,
          );
          hasFitRef.current = true;
        } catch {}
      }, 400);
      return () => clearTimeout(t);
    }
  }, [mapReady, activeLoad, driverPos]);

  const handleSignOut = () => {
    setMenuOpen(false);
    Alert.alert('Sign Out', 'Sign out of DispatchR?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await logout();
        router.replace('/(auth)/login');
      } },
    ]);
  };

  const handleToggleTheme = () => {
    Haptics.selectionAsync();
    toggleTheme();
  };

  const recenterMap = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (!mapRef.current || !effectiveDriverPos) return;
    mapRef.current.animateToRegion({
      latitude: effectiveDriverPos.latitude,
      longitude: effectiveDriverPos.longitude,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    }, 500);
  }, [effectiveDriverPos]);

  /* ───────── Bottom sheet ───────── */
  const sheetH = useRef(new Animated.Value(SHEET_OPEN)).current;
  const sheetHValue = useRef(SHEET_OPEN);
  const startHRef = useRef(SHEET_OPEN);
  const lastSnapRef = useRef(SHEET_OPEN);

  useEffect(() => {
    const id = sheetH.addListener(({ value }) => { sheetHValue.current = value; });
    return () => sheetH.removeListener(id);
  }, [sheetH]);

  const snapTo = useCallback((target) => {
    if (target !== lastSnapRef.current) {
      lastSnapRef.current = target;
      Haptics.selectionAsync().catch(() => {});
    }
    Animated.spring(sheetH, {
      toValue: target,
      damping: 22,
      stiffness: 260,
      mass: 0.8,
      useNativeDriver: false,
    }).start();
  }, [sheetH]);

  const toggleSheet = useCallback(() => {
    const mid = (SHEET_COLLAPSED + SHEET_OPEN) / 2;
    snapTo(sheetHValue.current > mid ? SHEET_COLLAPSED : SHEET_OPEN);
  }, [snapTo]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderGrant: () => { startHRef.current = sheetHValue.current; },
      onPanResponderMove: (_, g) => {
        const next = startHRef.current - g.dy;
        let value;
        if (next > SHEET_OPEN) {
          // rubber-band resistance above the open snap point
          value = SHEET_OPEN + (next - SHEET_OPEN) * 0.25;
        } else {
          value = Math.max(SHEET_COLLAPSED, next);
        }
        sheetH.setValue(value);
      },
      onPanResponderRelease: (_, g) => {
        const mid = (SHEET_COLLAPSED + SHEET_OPEN) / 2;
        const vy = g.vy * 1000;
        let target;
        if (vy < -600) target = SHEET_OPEN;
        else if (vy > 600) target = SHEET_COLLAPSED;
        else target = sheetHValue.current >= mid ? SHEET_OPEN : SHEET_COLLAPSED;
        snapTo(target);
      },
      onPanResponderTerminate: () => snapTo(SHEET_OPEN),
    }),
  ).current;

  const handlePillWidth = sheetH.interpolate({
    inputRange: [SHEET_COLLAPSED, SHEET_OPEN],
    outputRange: [40, 44],
    extrapolate: 'clamp',
  });

  const backdropOpacity = 0;

  const collapsedPreviewOpacity = sheetH.interpolate({
    inputRange: [SHEET_COLLAPSED, SHEET_COLLAPSED + 55],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const collapsedPreviewHeight = sheetH.interpolate({
    inputRange: [SHEET_COLLAPSED, SHEET_COLLAPSED + 55],
    outputRange: [104, 0],
    extrapolate: 'clamp',
  });

  const recenterBottom = sheetH.interpolate({
    inputRange: [SHEET_COLLAPSED, SHEET_OPEN],
    outputRange: [SHEET_COLLAPSED + 14, SHEET_OPEN + 14],
    extrapolate: 'clamp',
  });

  const arrivalEtaText = liveEta || activeLoad?.eta || '--';
  const arrivalTime = formatArrivalTime(arrivalEtaText);
  const distanceText = remainingMiles != null
    ? `${remainingMiles} mi`
    : (activeLoad?.miles ? `${activeLoad.miles} mi` : '--');

  const goDispatcherChat = () => {
    Haptics.selectionAsync();
    setUnread(0);
    setBanner(null);
    router.push('/(driver)/dispatcher-chat');
  };
  const goAiChat = () => {
    Haptics.selectionAsync();
    router.push('/(driver)/ai-chat');
  };

  // Split-polyline coordinates
  const polylineCoords = useMemo(() => {
    if (!activeLoad?.hasCoords) return null;
    const origin = { latitude: activeLoad.pickupLat, longitude: activeLoad.pickupLng };
    const dest = { latitude: activeLoad.dropoffLat, longitude: activeLoad.dropoffLng };
    const driver = effectiveDriverPos || origin;
    return {
      traveled: [origin, driver],
      remaining: [driver, dest],
    };
  }, [activeLoad, effectiveDriverPos]);

  const truckInfo = activeLoad?.equipment || activeLoad?.truckInfo || null;

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      {/* ── Map ── */}
      <View style={StyleSheet.absoluteFill}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={initialRegion}
          customMapStyle={isDark ? darkMapStyle : lightMapStyle}
          showsCompass={false}
          showsUserLocation
          showsMyLocationButton={false}
          followsUserLocation={false}
          onMapReady={() => setMapReady(true)}
        >
          {activeLoad?.hasCoords && (
            <>
              <Marker
                coordinate={{ latitude: activeLoad.pickupLat, longitude: activeLoad.pickupLng }}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.originPin}>
                  <View style={styles.originPinInner} />
                </View>
              </Marker>
              <Marker
                coordinate={{ latitude: activeLoad.dropoffLat, longitude: activeLoad.dropoffLng }}
                anchor={{ x: 0.5, y: 1 }}
              >
                <View style={styles.destPin}>
                  <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.destPinHead}>
                    <Text style={styles.destPinFlag}>⚑</Text>
                  </LinearGradient>
                  <View style={styles.destPinTail} />
                </View>
              </Marker>

              {polylineCoords && (
                <>
                  <Polyline
                    coordinates={polylineCoords.traveled}
                    strokeColor="#6366f1"
                    strokeWidth={5}
                  />
                  <Polyline
                    coordinates={polylineCoords.remaining}
                    strokeColor={isDark ? 'rgba(148,163,184,0.75)' : '#94a3b8'}
                    strokeWidth={4}
                    lineDashPattern={[10, 8]}
                  />
                </>
              )}

            </>
          )}

          {effectiveDriverPos && (
            <MarkerAnimated
              coordinate={animatedCoord}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={10}
            >
              <View style={styles.driverPinWrap}>
                <View style={styles.driverPinPulse} />
                <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.driverPin}>
                  <Text style={styles.driverPinIcon}>🚛</Text>
                </LinearGradient>
              </View>
            </MarkerAnimated>
          )}
        </MapView>
        {!mapReady && (
          <View style={[styles.mapLoading, { backgroundColor: colors.surface1 }]}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={{ color: colors.textMuted, marginTop: spacing[2] }}>Loading map…</Text>
          </View>
        )}
      </View>

      {/* ── Dim backdrop over map when sheet is near max ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#000', opacity: backdropOpacity, zIndex: 1 },
        ]}
      />

      {/* ── Header ── */}
      <DriverHeader
        status={status}
        userName={userName}
        onAvatarTap={() => { Haptics.selectionAsync(); setMenuOpen(v => !v); }}
        colors={colors}
        isDark={isDark}
      />

      {/* ── Pills ── */}
      <View style={[styles.pillsWrap, { top: insets.top + 58 }]} pointerEvents="box-none">
        <MapPills speedMph={speedMph} gpsOk={gpsOk} isDark={isDark} />
      </View>

      {/* ── Re-center button ── */}
      {effectiveDriverPos && mapReady && (
        <Animated.View style={[styles.recenterWrap, { bottom: recenterBottom }]} pointerEvents="box-none">
          <TouchableOpacity activeOpacity={0.82} onPress={recenterMap}>
            <BlurView intensity={isDark ? 72 : 58} tint={isDark ? 'dark' : 'light'} style={styles.recenterBlur}>
              <View style={[styles.recenterInner, {
                backgroundColor: isDark ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.7)',
                borderColor: isDark ? 'rgba(99,102,241,0.45)' : 'rgba(99,102,241,0.25)',
              }]}>
                <Text style={styles.recenterIcon}>⊕</Text>
              </View>
            </BlurView>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Toast + banner ── */}
      <Toast toast={toast} onDone={clearToast} isDark={isDark} />
      <MessageBanner
        message={banner}
        isDark={isDark}
        onTap={() => { setBanner(null); goDispatcherChat(); }}
        onDone={() => setBanner(null)}
      />

      {/* ── Bottom sheet ── */}
      <Animated.View style={[
        styles.sheet,
        { height: sheetH },
        {
          borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          backgroundColor: isDark ? 'rgba(12,18,35,0.55)' : 'rgba(255,255,255,0.55)',
        },
      ]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 60 : 90}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {/* subtle tint to emulate saturate(160%) */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(10,14,28,0.48)' : 'rgba(255,255,255,0.42)' },
          ]}
        />

        <View {...pan.panHandlers}>
          <TouchableOpacity activeOpacity={0.6} onPress={toggleSheet} style={styles.handleArea}>
            <Animated.View style={[
              styles.handlePill,
              { width: handlePillWidth, backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)' },
            ]} />
          </TouchableOpacity>
        </View>

        {/* ── Collapsed preview strip ── */}
        <Animated.View style={[styles.collapsedPreview, { height: collapsedPreviewHeight, opacity: collapsedPreviewOpacity }]}>
          <TouchableOpacity activeOpacity={0.7} onPress={toggleSheet} style={styles.collapsedRow}>
            <View style={styles.collapsedLeft}>
              {activeLoad ? (
                <>
                  <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.collapsedDot} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.collapsedDest, { color: colors.textPrimary }]} numberOfLines={1}>
                      {activeLoad.destination}
                    </Text>
                    <View style={styles.collapsedMeta}>
                      <Text style={[styles.collapsedMetaVal, { color: colors.accent }]}>{arrivalEtaText}</Text>
                      <Text style={[styles.collapsedMetaSep, { color: colors.textMuted }]}>·</Text>
                      <Text style={[styles.collapsedMetaVal, { color: colors.textMuted }]}>{distanceText}</Text>
                    </View>
                  </View>
                </>
              ) : (
                <Text style={[styles.collapsedDest, { color: colors.textMuted }]}>No active load</Text>
              )}
            </View>
            <Text style={[styles.collapsedChev, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>
          {activeLoad && (
            <View style={[styles.collapsedBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }]}>
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.collapsedBarFill, { width: `${progressPercent}%` }]}
              />
            </View>
          )}
        </Animated.View>

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
          bounces
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        >
          {/* Load card */}
          <View style={[styles.loadCard, shadow.card, {
            backgroundColor: isDark ? glass.fillDarkStrong : glass.fillLightStrong,
            borderColor: isDark ? glass.borderDarkSoft : glass.borderLightSoft,
          }]}>
            {loadLoading ? (
              <View style={{ padding: spacing[6], alignItems: 'center' }}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : activeLoad ? (
              <>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setDetailsExpanded(v => !v);
                  }}
                  style={styles.peek}
                >
                  <View style={styles.peekEyebrow}>
                    <PulseDot color="#6366f1" size={7} />
                    <Text style={styles.peekEyebrowText}>NEXT STOP</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={[styles.peekChev, { color: colors.textMuted }]}>
                      {detailsExpanded ? 'Hide details' : 'More details'}
                    </Text>
                  </View>
                  <Text style={[styles.peekDest, { color: colors.textPrimary }]} numberOfLines={2}>
                    {activeLoad.destination}
                  </Text>
                  <View style={styles.peekMeta}>
                    {arrivalTime && (
                      <Text style={[styles.peekMetaStrong, { color: colors.textPrimary }]}>
                        Arrive {arrivalTime}
                      </Text>
                    )}
                    {arrivalTime && <Text style={[styles.peekSep, { color: colors.textMuted }]}>•</Text>}
                    <Text style={[styles.peekMetaText, { color: colors.textMuted }]}>{distanceText}</Text>
                  </View>
                </TouchableOpacity>

                {detailsExpanded && (
                  <View style={[styles.detailsBox, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)',
                    borderColor: colors.border,
                  }]}>
                    <DetailRow label="Equipment" value={activeLoad.equipment || '—'} colors={colors} />
                    <DetailRow label="Weight" value={activeLoad.weight ? `${activeLoad.weight} lbs` : '—'} colors={colors} />
                    <DetailRow
                      label="Pickup window"
                      value={activeLoad.pickupWindow || activeLoad.pickupTime || '—'}
                      colors={colors}
                    />
                    <DetailRow
                      label="Shipper"
                      value={activeLoad.shipperName || activeLoad.shipper || '—'}
                      colors={colors}
                    />
                    {(activeLoad.shipperPhone || activeLoad.contactPhone) && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          Haptics.selectionAsync();
                          const p = activeLoad.shipperPhone || activeLoad.contactPhone;
                          Linking.openURL(`tel:${p}`).catch(() => {});
                        }}
                        style={[styles.callBtn, {
                          backgroundColor: 'rgba(99,102,241,0.12)',
                          borderColor: 'rgba(99,102,241,0.35)',
                        }]}
                      >
                        <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>
                          ☎ Call shipper
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.route}>
                  <View style={styles.routeRail}>
                    <View style={[styles.routeDotStart, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff', borderColor: '#9ca3af' }]} />
                    <View style={styles.routeLine}>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <View key={i} style={[styles.routeLineSeg, { backgroundColor: colors.border }]} />
                      ))}
                    </View>
                    <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.routeDotEnd}>
                      <Text style={styles.routeFlag}>⚑</Text>
                    </LinearGradient>
                  </View>
                  <View style={styles.routeStops}>
                    <View style={styles.routeStop}>
                      <Text style={[styles.routeKind, { color: colors.textMuted }]}>FROM</Text>
                      <Text style={[styles.routeName, { color: colors.textPrimary }]} numberOfLines={2}>{activeLoad.origin}</Text>
                    </View>
                    <View style={styles.routeStop}>
                      <Text style={[styles.routeKind, { color: colors.textMuted }]}>TO</Text>
                      <Text style={[styles.routeName, { color: colors.textPrimary }]} numberOfLines={2}>{activeLoad.destination}</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.stats, { backgroundColor: colors.border }]}>
                  <View style={[styles.stat, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.65)' }]}>
                    <Text style={[styles.statLbl, { color: colors.textMuted }]}>ETA</Text>
                    <Text style={[styles.statVal, { color: colors.textPrimary }]}>{arrivalEtaText}</Text>
                  </View>
                  <View style={[styles.stat, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.65)' }]}>
                    <Text style={[styles.statLbl, { color: colors.textMuted }]}>DISTANCE</Text>
                    <Text style={[styles.statVal, { color: colors.textPrimary }]}>{distanceText}</Text>
                  </View>
                  <View style={[styles.stat, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.65)' }]}>
                    <Text style={[styles.statLbl, { color: colors.textMuted }]}>SPEED</Text>
                    <Text style={[styles.statVal, { color: colors.textPrimary }]}>
                      {speedMph != null ? speedMph : '--'}
                      <Text style={[styles.statUnit, { color: colors.textMuted }]}> mph</Text>
                    </Text>
                  </View>
                </View>

                {totalMiles != null && (
                  <View style={styles.progressWrap}>
                    <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]}>
                      <LinearGradient
                        colors={['#6366f1', '#8b5cf6']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[styles.progressFill, { width: `${progressPercent}%` }]}
                      />
                    </View>
                    <View style={styles.progressLabels}>
                      <Text style={[styles.progressLabel, { color: colors.textMuted }]} numberOfLines={1}>
                        {activeLoad.origin?.split(',')[0]}
                      </Text>
                      <Text style={[styles.progressPct, { color: colors.accent }]}>
                        {Math.round(progressPercent)}%
                      </Text>
                      <Text style={[styles.progressLabel, { color: colors.textMuted, textAlign: 'right' }]} numberOfLines={1}>
                        {activeLoad.destination?.split(',')[0]}
                      </Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity activeOpacity={0.85} onPress={openMaps} style={styles.ctaWrap}>
                  <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Text style={styles.ctaIcon}>➤</Text>
                    <Text style={styles.ctaText}>Open in Maps</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.loadEmpty}>
                <View style={styles.loadEmptyBadge}>
                  <Text style={{ fontSize: 26 }}>🚛</Text>
                </View>
                <Text style={[styles.loadEmptyTitle, { color: colors.textPrimary }]}>No active load</Text>
                <Text style={[styles.loadEmptySub, { color: colors.textMuted }]}>
                  Your next assignment will appear here.
                </Text>
              </View>
            )}
          </View>

          {/* Status card */}
          <View style={[styles.statusCard, shadow.card, {
            backgroundColor: isDark ? glass.fillDarkStrong : glass.fillLightStrong,
            borderColor: isDark ? glass.borderDarkSoft : glass.borderLightSoft,
          }]}>
            <View style={styles.statusHead}>
              <View style={{ width: 16, height: 16 }}>
                <PulseDot color={STATUSES.find(s => s.key === status).color} size={12} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>
                  You're {STATUSES.find(s => s.key === status).label}
                </Text>
                <Text style={[styles.statusSub, { color: colors.textMuted }]}>
                  Dispatchers see this in real time
                </Text>
              </View>
            </View>
            <View style={styles.statusToggle}>
              {STATUSES.map(opt => {
                const active = status === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => changeStatus(opt.key)}
                    activeOpacity={0.85}
                    style={[styles.statusBtn, {
                      backgroundColor: active ? opt.color + '26' : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'),
                      borderColor: active ? opt.color : colors.border,
                    }]}
                  >
                    <Text style={[styles.statusBtnText, { color: active ? opt.color : colors.textMuted }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Launchers */}
          <View style={styles.launchers}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={goDispatcherChat}
              style={[styles.launcher, shadow.card, {
                backgroundColor: isDark ? glass.fillDarkStrong : glass.fillLightStrong,
                borderColor: isDark ? glass.borderDarkSoft : glass.borderLightSoft,
              }]}
            >
              <LinearGradient
                colors={gradients.heroDispatch}
                style={styles.launcherIconGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <Text style={{ fontSize: 18 }}>💬</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[styles.launcherLabel, { color: colors.textPrimary }]}>Dispatcher</Text>
                <Text style={[styles.launcherSub, { color: colors.textMuted }]} numberOfLines={1}>
                  {unread > 0 ? `${unread} new message${unread > 1 ? 's' : ''}` : 'Tap to open chat'}
                </Text>
              </View>
              {unread > 0 && (
                <View style={styles.launcherBadge}>
                  <Text style={styles.launcherBadgeText}>{unread}</Text>
                </View>
              )}
              <Text style={[styles.launcherChevron, { color: colors.textMuted }]}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={goAiChat}
              style={[styles.launcher, shadow.card, {
                backgroundColor: isDark ? glass.fillDarkStrong : glass.fillLightStrong,
                borderColor: isDark ? glass.borderDarkSoft : glass.borderLightSoft,
              }]}
            >
              <LinearGradient
                colors={gradients.heroAi}
                style={styles.launcherIconGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <Text style={{ fontSize: 16, color: '#fff' }}>✦</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[styles.launcherLabel, { color: colors.textPrimary }]}>AI Assistant</Text>
                <Text style={[styles.launcherSub, { color: colors.textMuted }]} numberOfLines={1}>
                  Routes, traffic & load help
                </Text>
              </View>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI</Text>
              </View>
              <Text style={[styles.launcherChevron, { color: colors.textMuted }]}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: spacing[6] }} />
        </ScrollView>
      </Animated.View>

      {/* ── Arrived overlay ── */}
      <ArrivedBanner
        visible={arrivedVisible}
        onDismiss={() => {
          setArrivedVisible(false);
          arrivedDismissedRef.current = true;
        }}
        destination={activeLoad?.destination}
        isDark={isDark}
        colors={colors}
      />

      {/* ── Dropdown menu ── */}
      <HeaderMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        isDark={isDark}
        colors={colors}
        userName={userName}
        userEmail={userEmail}
        truckInfo={truckInfo}
        onToggleTheme={handleToggleTheme}
        onSignOut={handleSignOut}
      />
    </View>
  );
}

function DetailRow({ label, value, colors }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.textPrimary }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pillsWrap: { position: 'absolute', left: 0, right: 0, zIndex: 15 },
  mapLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  originPin: {
    width: 16, height: 16, borderRadius: 99, borderWidth: 2.5,
    borderColor: '#9ca3af', backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  originPinInner: { width: 5, height: 5, borderRadius: 99, backgroundColor: '#9ca3af' },
  destPin: { alignItems: 'center' },
  destPinHead: {
    width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  destPinFlag: { color: '#fff', fontSize: 14, fontWeight: '800' },
  destPinTail: { width: 2, height: 8, backgroundColor: '#dc2626', marginTop: -1 },
  driverPinWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  driverPinPulse: {
    position: 'absolute', width: 52, height: 52, borderRadius: 99,
    backgroundColor: 'rgba(99,102,241,0.25)',
  },
  driverPin: {
    width: 40, height: 40, borderRadius: 99, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: '#fff',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  driverPinIcon: { fontSize: 20 },

  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.16, shadowRadius: 40, elevation: 20,
    overflow: 'hidden',
    zIndex: 2,
  },
  handleArea: { width: '100%', paddingTop: 11, paddingBottom: 7, alignItems: 'center' },
  handlePill: { height: 4, borderRadius: 99 },
  sheetScroll: { flex: 1 },
  sheetContent: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 18, gap: 12 },

  loadCard: { borderRadius: 18, padding: 16, borderWidth: 1, gap: 12 },
  peek: { gap: 6 },
  peekEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  peekEyebrowText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.9, color: '#6366f1' },
  peekChev: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  peekDest: { fontSize: 19, fontWeight: '800', letterSpacing: -0.5, lineHeight: 24 },
  peekMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 2 },
  peekMetaStrong: { fontSize: 13, fontWeight: '700' },
  peekMetaText: { fontSize: 13, fontWeight: '500' },
  peekSep: { opacity: 0.5 },

  detailsBox: { borderRadius: 12, borderWidth: 1, padding: 10, gap: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  detailLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  detailValue: { fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  callBtn: {
    marginTop: 4, borderRadius: 10, borderWidth: 1,
    paddingVertical: 9, alignItems: 'center',
  },

  divider: { height: 1, marginHorizontal: -2 },

  route: { flexDirection: 'row', gap: 10 },
  routeRail: { width: 18, alignItems: 'center', paddingVertical: 4 },
  routeDotStart: { width: 11, height: 11, borderRadius: 99, borderWidth: 2.5 },
  routeLine: { flex: 1, width: 2, marginVertical: 2, alignItems: 'center', justifyContent: 'space-between' },
  routeLineSeg: { width: 2, height: 3, borderRadius: 1 },
  routeDotEnd: {
    width: 18, height: 18, borderRadius: 99, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  routeFlag: { color: '#fff', fontSize: 9, fontWeight: '800' },
  routeStops: { flex: 1, justifyContent: 'space-between', gap: 12 },
  routeStop: { gap: 2, minWidth: 0 },
  routeKind: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.9 },
  routeName: { fontSize: 13.5, fontWeight: '600', lineHeight: 18 },

  stats: { flexDirection: 'row', borderRadius: 14, overflow: 'hidden', gap: 1 },
  stat: { flex: 1, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', gap: 3 },
  statLbl: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  statVal: { fontSize: 16, fontWeight: '800', letterSpacing: -0.4 },
  statUnit: { fontSize: 9.5, fontWeight: '700' },

  ctaWrap: { borderRadius: 12, overflow: 'hidden' },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13,
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
  },
  ctaIcon: { color: '#fff', fontSize: 13, fontWeight: '800' },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },

  loadEmpty: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  loadEmptyBadge: {
    width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(99,102,241,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  loadEmptyTitle: { fontSize: 15, fontWeight: '700' },
  loadEmptySub: { fontSize: 12.5, textAlign: 'center', lineHeight: 18, maxWidth: 240 },

  statusCard: { borderRadius: 18, padding: 14, borderWidth: 1, gap: 12 },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusTitle: { fontSize: 14, fontWeight: '700', letterSpacing: -0.1 },
  statusSub: { fontSize: 11.5, marginTop: 1 },
  statusToggle: { flexDirection: 'row', gap: 6 },
  statusBtn: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderRadius: 10, borderWidth: 1.5,
  },
  statusBtnText: { fontSize: 13, fontWeight: '700' },

  launchers: { gap: 10 },
  launcher: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, borderWidth: 1,
  },
  launcherIcon: {
    width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  launcherIconGrad: {
    width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  launcherLabel: { fontSize: 14.5, fontWeight: '800', letterSpacing: -0.2 },
  launcherSub: { fontSize: 11.5, fontWeight: '500', marginTop: 2 },
  aiBadge: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.35)',
  },
  aiBadgeText: { color: '#8b5cf6', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  launcherBadge: {
    minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ef4444', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 3,
  },
  launcherBadgeText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  launcherChevron: { fontSize: 22, opacity: 0.55, fontWeight: '300', marginLeft: 4 },

  recenterWrap: { position: 'absolute', right: 14, zIndex: 3 },
  recenterBlur: { borderRadius: 15, overflow: 'hidden' },
  recenterInner: {
    width: 46, height: 46, borderRadius: 15, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  recenterIcon: { fontSize: 22, color: '#6366f1' },

  collapsedPreview: { overflow: 'hidden' },
  collapsedRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, gap: 10,
  },
  collapsedLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  collapsedDot: { width: 8, height: 8, borderRadius: 99, flexShrink: 0 },
  collapsedDest: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  collapsedMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  collapsedMetaVal: { fontSize: 12, fontWeight: '600' },
  collapsedMetaSep: { fontSize: 11, opacity: 0.45 },
  collapsedChev: { fontSize: 22, fontWeight: '300', opacity: 0.55 },
  collapsedBar: { height: 3, marginHorizontal: 16, borderRadius: 99, overflow: 'hidden', marginBottom: 10 },
  collapsedBarFill: { height: '100%', borderRadius: 99 },

  progressWrap: { gap: 7 },
  progressTrack: { height: 7, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 10.5, fontWeight: '600', flex: 1 },
  progressPct: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
});
