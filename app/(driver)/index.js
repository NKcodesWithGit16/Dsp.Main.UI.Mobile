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
  fetchActiveLoad, fetchDriverMessages,
} from '../../src/api/main';
import { useAutoStatus } from '../../src/hooks/useAutoStatus';
import { fetchRoute } from '../../src/utils/directions';
import LoadAssignmentModal from '../../src/components/driver/LoadAssignmentModal';
import { NavManeuverBanner, NavBottomHud } from '../../src/components/driver/NavigationHud';
import {
  advanceStepIndex, bearingDeg, distanceToRouteMeters,
  haversineMeters, nearestPointOnRoute,
} from '../../src/utils/navigation';
import { acceptLoad as apiAcceptLoad, declineLoad as apiDeclineLoad } from '../../src/api/main';
import { spacing, glass, shadow, gradients } from '../../src/theme/colors';
import { darkMapStyle, lightMapStyle } from '../../src/theme/mapStyles';
import DeliveryProofModal from '../../src/components/shared/DeliveryProofModal';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_COLLAPSED = 148;
const SHEET_OPEN = Math.round(SCREEN_H * 0.62);

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
function DriverHeader({ userName, onAvatarTap, colors, isDark }) {
  const insets = useSafeAreaInsets();
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

        <TouchableOpacity onPress={onAvatarTap} activeOpacity={0.85}>
          <LinearGradient colors={['#6366f1', '#8b5cf6']} style={hdrS.avatarSolo}>
            <Text style={hdrS.avatarSoloText}>{initials}</Text>
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
  avatarSolo: {
    width: 36, height: 36, borderRadius: 999,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  avatarSoloText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});

/* ═════ Dropdown menu ═════ */
function HeaderMenu({ visible, onClose, isDark, colors, userName, userEmail, truckInfo, onToggleTheme, onSignOut, onOpenSettings }) {
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
            <MenuRow
              icon="⚙︎"
              label="Settings"
              colors={colors}
              onPress={onOpenSettings}
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
  const [proofModalVisible, setProofModalVisible] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [denying, setDenying] = useState(false);
  const arrivedDismissedRef = useRef(false);

  // Mobile shows the assign-load modal whenever there's an assigned load
  // that the driver hasn't acknowledged yet. Server marks `acceptedAt` at
  // assign-time if the driver opted into auto-accept.
  const needsAcceptance = !!(activeLoad && activeLoad.status === 'Assigned' && !activeLoad.acceptedAt);

  const { toast, show: showToast, clear: clearToast } = useToast();

  usePushNotifications(userId, (title, body) => showToast(`${title}: ${body}`, 'info'));

  // Heartbeats keep the dispatcher view fresh (server derives moving/idle/offline).
  // The driver UI itself never surfaces the bucket — speed + GPS pills are enough.
  useAutoStatus(userId, driverPos, speedMph);

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

  const handleAccept = useCallback(async () => {
    if (!activeLoad?.id || !userId) return;
    setAccepting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await apiAcceptLoad(activeLoad.id, userId);
      await loadActive();
      showToast('Load accepted', 'success');
    } catch {
      showToast('Could not accept load', 'error');
    } finally {
      setAccepting(false);
    }
  }, [activeLoad?.id, userId, loadActive]);

  const handleDecline = useCallback(async () => {
    if (!activeLoad?.id || !userId) return;
    setDenying(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    try {
      await apiDeclineLoad(activeLoad.id, userId);
      setActiveLoad(null);
      showToast('Load declined — dispatcher notified', 'info');
    } catch {
      showToast('Could not decline load', 'error');
    } finally {
      setDenying(false);
    }
  }, [activeLoad?.id, userId]);

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

  // Fallback simulated speed when there's no GPS permission so the
  // speed pill doesn't sit at "0 mph" forever during demos.
  useEffect(() => {
    if (hasLocationPermission) return;
    const base = 55;
    const iv = setInterval(() => {
      setSpeedMph(base + Math.round((Math.random() - 0.5) * 14));
    }, 1600);
    return () => clearInterval(iv);
  }, [hasLocationPermission]);

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
    Alert.alert('Sign Out', 'Sign out of HitchLink?', [
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

  // Auto-follow toggle for nav mode. Flips off when the user pans/zooms the
  // map by hand; the recenter button flips it back on and snaps the camera.
  // Defined here so the gesture handler/recenter UI can read it; the actual
  // recenterMap function lives below where the nav state is in scope.
  const [followMode, setFollowMode] = useState(true);
  const followModeRef = useRef(true);
  followModeRef.current = followMode;

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

  // Road-following polyline from Google Directions (pickup → dropoff).
  // Refetches only when the load changes — driver movement doesn't change the road.
  const [routeCoords, setRouteCoords] = useState(null);
  useEffect(() => {
    if (!activeLoad?.hasCoords) { setRouteCoords(null); return; }
    let cancelled = false;
    fetchRoute({
      origin: { latitude: activeLoad.pickupLat, longitude: activeLoad.pickupLng },
      destination: { latitude: activeLoad.dropoffLat, longitude: activeLoad.dropoffLng },
    }).then(r => {
      if (!cancelled) setRouteCoords(r?.coords?.length ? r.coords : null);
    });
    return () => { cancelled = true; };
  }, [activeLoad?.id, activeLoad?.pickupLat, activeLoad?.pickupLng, activeLoad?.dropoffLat, activeLoad?.dropoffLng]);

  // Road-following dashed deadhead line from the driver's actual location
  // to pickup. Refetches when the driver moves ≥1km from where we last
  // fetched so the line stays accurate the whole drive. Skipped in nav mode
  // (the active nav route covers it) and after pickup arrival.
  const [driverToPickupCoords, setDriverToPickupCoords] = useState(null);
  const lastDeadheadFetchRef = useRef(null);     // { loadId, position }
  const deadheadInFlightRef = useRef(false);
  useEffect(() => {
    if (!activeLoad?.hasCoords || !driverPos || activeLoad.pickupArrivedAt || navMode) {
      setDriverToPickupCoords(null);
      lastDeadheadFetchRef.current = null;
      return;
    }
    const last = lastDeadheadFetchRef.current;
    const needsFetch =
      !last ||
      last.loadId !== activeLoad.id ||
      haversineMeters(last.position, driverPos) > 1000;
    if (!needsFetch || deadheadInFlightRef.current) return;

    deadheadInFlightRef.current = true;
    const fetchOrigin = driverPos;
    let cancelled = false;
    fetchRoute({
      origin: fetchOrigin,
      destination: { latitude: activeLoad.pickupLat, longitude: activeLoad.pickupLng },
    }).then(r => {
      if (cancelled) return;
      if (r?.coords?.length) {
        setDriverToPickupCoords(r.coords);
        lastDeadheadFetchRef.current = { loadId: activeLoad.id, position: fetchOrigin };
      }
    }).finally(() => {
      deadheadInFlightRef.current = false;
    });
    return () => { cancelled = true; };
  }, [activeLoad?.id, activeLoad?.pickupLat, activeLoad?.pickupLng, activeLoad?.pickupArrivedAt, driverPos, navMode]);

  /* ── Navigation ("Start" / turn-by-turn) ─────────────────────────────── */
  const [navMode, setNavMode] = useState(false);
  const [navRoute, setNavRoute] = useState(null);          // { coords, steps, distanceMeters, durationSeconds }
  const [navStepIdx, setNavStepIdx] = useState(0);
  const [navStepRemainingMeters, setNavStepRemainingMeters] = useState(0);
  const [navTotalRemainingMeters, setNavTotalRemainingMeters] = useState(0);
  const [navTotalRemainingSeconds, setNavTotalRemainingSeconds] = useState(0);
  const [navIsRerouting, setNavIsRerouting] = useState(false);
  const [navHeading, setNavHeading] = useState(0);
  const prevDriverPosRef = useRef(null);
  const lastBearingRef = useRef(0);
  const offRouteSinceRef = useRef(null);
  const rerouteInFlightRef = useRef(false);

  const recenterMap = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (!mapRef.current || !effectiveDriverPos) return;
    setFollowMode(true);
    if (navMode) {
      mapRef.current.animateCamera(
        {
          center: effectiveDriverPos,
          pitch: 55,
          heading: lastBearingRef.current,
          zoom: 17.5,
        },
        { duration: 500 },
      );
    } else {
      mapRef.current.animateToRegion({
        latitude: effectiveDriverPos.latitude,
        longitude: effectiveDriverPos.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }, 500);
    }
  }, [effectiveDriverPos, navMode]);

  const navTarget = useMemo(() => {
    if (!activeLoad?.hasCoords) return null;
    // After the load is "Loaded", head straight to dropoff; otherwise go to pickup first.
    const beforePickup = !activeLoad.loadedAt && !activeLoad.pickupArrivedAt;
    return beforePickup
      ? { latitude: activeLoad.pickupLat, longitude: activeLoad.pickupLng, kind: 'pickup' }
      : { latitude: activeLoad.dropoffLat, longitude: activeLoad.dropoffLng, kind: 'dropoff' };
  }, [activeLoad]);

  const startNavigation = useCallback(async () => {
    if (!effectiveDriverPos || !navTarget) {
      showToast('Waiting for GPS — try again in a moment', 'info');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setNavIsRerouting(true);
    const route = await fetchRoute({
      origin: effectiveDriverPos,
      destination: { latitude: navTarget.latitude, longitude: navTarget.longitude },
    });
    setNavIsRerouting(false);
    if (!route?.steps?.length) {
      showToast('Could not load directions', 'error');
      return;
    }
    setNavRoute(route);
    setNavStepIdx(0);
    setNavTotalRemainingMeters(route.distanceMeters);
    setNavTotalRemainingSeconds(route.durationSeconds);
    setNavMode(true);
    setFollowMode(true);
    // Seed the heading from the first segment so the camera doesn't snap
    // north on the first frame before any GPS-delta is available.
    if (route.coords?.length > 1) {
      const seedHeading = bearingDeg(route.coords[0], route.coords[1]);
      lastBearingRef.current = seedHeading;
      setNavHeading(seedHeading);
    }
    // Collapse the bottom sheet so the map can take over.
    snapTo(SHEET_COLLAPSED);
    // Immediate camera move so Start feels instant: snaps to driver, tilts,
    // and rotates to face the route direction — Google-Maps style.
    if (mapRef.current) {
      mapRef.current.animateCamera(
        {
          center: effectiveDriverPos,
          pitch: 55,
          heading: lastBearingRef.current,
          zoom: 17.5,
        },
        { duration: 600 },
      );
    }
  }, [effectiveDriverPos, navTarget, showToast]);

  const stopNavigation = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setNavMode(false);
    setNavRoute(null);
    setNavStepIdx(0);
    setFollowMode(true);
    snapTo(SHEET_OPEN);
    // Reset camera to overhead.
    if (mapRef.current) {
      mapRef.current.animateCamera(
        { pitch: 0, heading: 0, zoom: 12 },
        { duration: 500 },
      );
    }
  }, []);

  // On every GPS update while in nav mode:
  //  - Advance to the current maneuver step
  //  - Compute distance-to-maneuver + remaining trip distance/time
  //  - Tilt + heading-follow the camera
  //  - Detect off-route → silently refetch
  useEffect(() => {
    if (!navMode || !navRoute || !effectiveDriverPos) return;

    const prev = prevDriverPosRef.current;
    prevDriverPosRef.current = effectiveDriverPos;

    // Snap to the nearest point on the route polyline when we're within the
    // road corridor. Hides GPS jitter and keeps the camera glued to the road.
    const snap = nearestPointOnRoute(effectiveDriverPos, navRoute.coords);
    const onRoute = snap && snap.distance <= 40;
    const center = onRoute ? snap.point : effectiveDriverPos;

    // Heading: use the route's tangent when we're on it (matches the road),
    // otherwise fall back to GPS delta. Stationary → keep the last heading.
    let heading = lastBearingRef.current;
    if (onRoute) {
      heading = snap.bearing;
      lastBearingRef.current = heading;
    } else if (prev && haversineMeters(prev, effectiveDriverPos) > 3) {
      heading = bearingDeg(prev, effectiveDriverPos);
      lastBearingRef.current = heading;
    }
    // Only re-render the marker when heading actually shifted enough to see.
    if (Math.abs(heading - navHeading) > 2) setNavHeading(heading);

    const newIdx = advanceStepIndex(navRoute.steps, navStepIdx, effectiveDriverPos);
    if (newIdx !== navStepIdx) setNavStepIdx(newIdx);

    const currentStep = navRoute.steps[newIdx];
    if (currentStep) {
      const dToManeuver = haversineMeters(effectiveDriverPos, currentStep.endLocation);
      setNavStepRemainingMeters(dToManeuver);
      // Sum distances of steps after the current one + dToManeuver for the rest.
      let remainingMeters = dToManeuver;
      let remainingSeconds = currentStep.durationSeconds * (currentStep.distanceMeters
        ? Math.min(1, dToManeuver / currentStep.distanceMeters) : 1);
      for (let i = newIdx + 1; i < navRoute.steps.length; i++) {
        remainingMeters += navRoute.steps[i].distanceMeters;
        remainingSeconds += navRoute.steps[i].durationSeconds;
      }
      setNavTotalRemainingMeters(remainingMeters);
      setNavTotalRemainingSeconds(remainingSeconds);
    }

    // Off-route check: 40m corridor (matches the snap threshold). Sustained
    // 5s of being off → refetch a fresh route.
    if (!onRoute && (snap?.distance ?? Infinity) > 40) {
      if (!offRouteSinceRef.current) offRouteSinceRef.current = Date.now();
      if (Date.now() - offRouteSinceRef.current > 5_000 && !rerouteInFlightRef.current) {
        rerouteInFlightRef.current = true;
        setNavIsRerouting(true);
        fetchRoute({
          origin: effectiveDriverPos,
          destination: { latitude: navTarget.latitude, longitude: navTarget.longitude },
        }).then(route => {
          if (route?.steps?.length) {
            setNavRoute(route);
            setNavStepIdx(0);
            setNavTotalRemainingMeters(route.distanceMeters);
            setNavTotalRemainingSeconds(route.durationSeconds);
          }
        }).finally(() => {
          setNavIsRerouting(false);
          rerouteInFlightRef.current = false;
          offRouteSinceRef.current = null;
        });
      }
    } else {
      offRouteSinceRef.current = null;
    }

    // Camera follow: tilted, heading-aligned, snapped to road when on-route.
    // Skipped while the user has panned the map manually — they get a
    // recenter button to return to follow mode.
    if (mapRef.current && followModeRef.current) {
      mapRef.current.animateCamera(
        {
          center,
          pitch: 55,
          heading,
          zoom: 17.5,
        },
        { duration: 800 },
      );
    }
  }, [navMode, navRoute, effectiveDriverPos, navStepIdx, navTarget, navHeading]);

  // If the user gets a new active load while navigating an old one, drop out.
  useEffect(() => {
    if (navMode && !activeLoad) stopNavigation();
  }, [navMode, activeLoad, stopNavigation]);

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
          showsUserLocation={!navMode}
          showsMyLocationButton={false}
          followsUserLocation={false}
          onMapReady={() => setMapReady(true)}
          onPanDrag={() => {
            // User dragged the map → stop auto-following until they tap Recenter.
            if (followModeRef.current) setFollowMode(false);
          }}
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

              {navMode && navRoute?.coords ? (
                navTarget?.kind === 'pickup' ? (
                  // Deadhead in nav mode: dashed green, full fidelity.
                  <Polyline
                    coordinates={navRoute.coords}
                    strokeColor="#22c55e"
                    strokeWidth={6}
                    lineDashPattern={[14, 10]}
                  />
                ) : (
                  // Loaded leg in nav mode: solid blue.
                  <Polyline
                    coordinates={navRoute.coords}
                    strokeColor="#2563eb"
                    strokeWidth={7}
                  />
                )
              ) : (
                <>
                  {/* Pickup → dropoff: the actual load route, solid blue. */}
                  {routeCoords && (
                    <Polyline
                      coordinates={routeCoords}
                      strokeColor="#2563eb"
                      strokeWidth={5}
                    />
                  )}
                  {/* Driver → pickup deadhead, dashed green, road-routed. */}
                  {driverToPickupCoords && (
                    <Polyline
                      coordinates={driverToPickupCoords}
                      strokeColor="#22c55e"
                      strokeWidth={4}
                      lineDashPattern={[12, 10]}
                    />
                  )}
                </>
              )}

            </>
          )}

          {effectiveDriverPos && (
            <MarkerAnimated
              coordinate={animatedCoord}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={10}
              flat={navMode}
              rotation={navMode ? navHeading : 0}
            >
              {navMode ? (
                // Google-Maps-style navigation puck: blue chevron on a halo.
                <View style={styles.navPuckWrap}>
                  <View style={styles.navPuckHalo} />
                  <View style={styles.navPuckCircle}>
                    <View style={styles.navPuckArrow} />
                  </View>
                </View>
              ) : (
                <View style={styles.driverPinWrap}>
                  <View style={styles.driverPinPulse} />
                  <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.driverPin}>
                    <Text style={styles.driverPinIcon}>🚛</Text>
                  </LinearGradient>
                </View>
              )}
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

      {/* ── Header (hidden in nav mode for full-bleed driving UI) ── */}
      {!navMode && (
        <DriverHeader
          userName={userName}
          onAvatarTap={() => { Haptics.selectionAsync(); setMenuOpen(v => !v); }}
          colors={colors}
          isDark={isDark}
        />
      )}

      {/* ── Pills (suppressed in nav mode — bottom HUD owns speed) ── */}
      {!navMode && (
        <View style={[styles.pillsWrap, { top: insets.top + 58 }]} pointerEvents="box-none">
          <MapPills speedMph={speedMph} gpsOk={gpsOk} isDark={isDark} />
        </View>
      )}

      {/* ── Navigation HUD ── */}
      {navMode && navRoute && (
        <>
          <NavManeuverBanner
            step={navRoute.steps[navStepIdx]}
            distanceToManeuverMeters={navStepRemainingMeters}
            isRerouting={navIsRerouting}
          />
          <NavBottomHud
            remainingMeters={navTotalRemainingMeters}
            remainingSeconds={navTotalRemainingSeconds}
            speedMph={speedMph}
            onStop={stopNavigation}
            bottomOffset={SHEET_COLLAPSED + insets.bottom}
          />
        </>
      )}

      {/* ── Re-center button ── */}
      {/* Overview mode: small circle button anchored above the sheet handle.   */}
      {!navMode && effectiveDriverPos && mapReady && (
        <Animated.View style={[styles.recenterWrap, { bottom: Animated.add(recenterBottom, new Animated.Value(insets.bottom)) }]} pointerEvents="box-none">
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
      {/* Nav mode: prominent pill that appears only when auto-follow is off.  */}
      {navMode && !followMode && effectiveDriverPos && mapReady && (
        <View style={[styles.navRecenterWrap, { bottom: SHEET_COLLAPSED + insets.bottom + 78 }]} pointerEvents="box-none">
          <TouchableOpacity activeOpacity={0.85} onPress={recenterMap}>
            <LinearGradient
              colors={['#2563eb', '#1d4ed8']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.navRecenterPill}
            >
              <Text style={styles.navRecenterIcon}>⊙</Text>
              <Text style={styles.navRecenterText}>Recenter</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
        { height: Animated.add(sheetH, new Animated.Value(insets.bottom)), paddingBottom: insets.bottom },
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
          {loadLoading ? (
            <View style={[styles.loadCard, shadow.card, {
              backgroundColor: isDark ? glass.fillDarkStrong : glass.fillLightStrong,
              borderColor: isDark ? glass.borderDarkSoft : glass.borderLightSoft,
              padding: 28, alignItems: 'center',
            }]}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : activeLoad ? (
            <View style={[styles.loadCardWrap, shadow.card, {
              borderColor: isDark ? glass.borderDarkSoft : glass.borderLightSoft,
            }]}>
              {/* ── Hero: rate + status + equipment ── */}
              <LinearGradient
                colors={isDark ? ['#1e1b4b', '#312e81', '#4c1d95'] : ['#6366f1', '#8b5cf6', '#a855f7']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.loadHero}
              >
                <View style={styles.loadHeroTop}>
                  <View style={styles.loadHeroPill}>
                    <View style={styles.loadHeroDot} />
                    <Text style={styles.loadHeroPillText}>
                      {(activeLoad.status || 'Active').toString().replace(/([A-Z])/g, ' $1').trim().toUpperCase()}
                    </Text>
                  </View>
                  {activeLoad.equipment ? (
                    <View style={styles.loadHeroBadge}>
                      <Text style={styles.loadHeroBadgeText}>{activeLoad.equipment}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.loadHeroBody}>
                  <Text style={styles.loadHeroRate}>
                    {activeLoad.rate != null
                      ? `$${Number(activeLoad.rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                      : 'Active load'}
                  </Text>
                  <View style={styles.loadHeroMetaRow}>
                    {activeLoad.rpm ? (
                      <Text style={styles.loadHeroMeta}>${Number(activeLoad.rpm).toFixed(2)}/mi</Text>
                    ) : null}
                    {activeLoad.rpm && activeLoad.miles ? (
                      <Text style={styles.loadHeroDotSep}>·</Text>
                    ) : null}
                    {activeLoad.miles ? (
                      <Text style={styles.loadHeroMeta}>
                        {Math.round(activeLoad.miles).toLocaleString()} mi total
                      </Text>
                    ) : null}
                  </View>
                </View>
              </LinearGradient>

              {/* ── Body ── */}
              <View style={[styles.loadBody, {
                backgroundColor: isDark ? glass.fillDarkStrong : glass.fillLightStrong,
              }]}>
                {/* Route timeline */}
                <View style={styles.timeline}>
                  <View style={styles.timelineRail}>
                    <LinearGradient colors={['#22c55e', '#16a34a']} style={styles.timelinePinPickup}>
                      <View style={styles.timelinePinInner} />
                    </LinearGradient>
                    <View style={styles.timelineLine}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <View key={i} style={[styles.timelineSeg, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }]} />
                      ))}
                    </View>
                    <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.timelinePinDest}>
                      <Text style={styles.timelinePinFlag}>⚑</Text>
                    </LinearGradient>
                  </View>
                  <View style={styles.timelineStops}>
                    <View style={styles.timelineStop}>
                      <Text style={[styles.timelineLabel, { color: '#22c55e' }]}>PICKUP</Text>
                      <Text style={[styles.timelinePlace, { color: colors.textPrimary }]} numberOfLines={2}>
                        {activeLoad.origin}{activeLoad.originState ? `, ${activeLoad.originState}` : ''}
                      </Text>
                    </View>
                    <View style={styles.timelineStop}>
                      <Text style={[styles.timelineLabel, { color: '#ef4444' }]}>DROP-OFF</Text>
                      <Text style={[styles.timelinePlace, { color: colors.textPrimary }]} numberOfLines={2}>
                        {activeLoad.destination}{activeLoad.destState ? `, ${activeLoad.destState}` : ''}
                      </Text>
                      {arrivalTime ? (
                        <Text style={[styles.timelineArrival, { color: colors.textMuted }]}>
                          Arriving ~{arrivalTime}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Stat strip */}
                <View style={[styles.statStrip, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.05)',
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.12)',
                }]}>
                  <View style={styles.statCell}>
                    <Text style={[styles.statCellIcon, { color: '#6366f1' }]}>◷</Text>
                    <Text style={[styles.statCellValue, { color: colors.textPrimary }]}>{arrivalEtaText || '—'}</Text>
                    <Text style={[styles.statCellLabel, { color: colors.textMuted }]}>ETA</Text>
                  </View>
                  <View style={[styles.statCellDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
                  <View style={styles.statCell}>
                    <Text style={[styles.statCellIcon, { color: '#8b5cf6' }]}>⟶</Text>
                    <Text style={[styles.statCellValue, { color: colors.textPrimary }]}>{distanceText || '—'}</Text>
                    <Text style={[styles.statCellLabel, { color: colors.textMuted }]}>REMAINING</Text>
                  </View>
                  <View style={[styles.statCellDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
                  <View style={styles.statCell}>
                    <Text style={[styles.statCellIcon, { color: '#22c55e' }]}>⚡</Text>
                    <Text style={[styles.statCellValue, { color: colors.textPrimary }]}>
                      {speedMph != null ? speedMph : '—'}
                      <Text style={[styles.statCellUnit, { color: colors.textMuted }]}> mph</Text>
                    </Text>
                    <Text style={[styles.statCellLabel, { color: colors.textMuted }]}>SPEED</Text>
                  </View>
                </View>

                {totalMiles != null && (
                  <View style={styles.progressBlock}>
                    <View style={styles.progressRow}>
                      <Text style={[styles.progressEndpoint, { color: colors.textPrimary }]} numberOfLines={1}>
                        {activeLoad.origin?.split(',')[0]}
                      </Text>
                      <Text style={[styles.progressPctBig, { color: colors.accent }]}>
                        {Math.round(progressPercent)}%
                      </Text>
                      <Text style={[styles.progressEndpoint, { color: colors.textPrimary, textAlign: 'right' }]} numberOfLines={1}>
                        {activeLoad.destination?.split(',')[0]}
                      </Text>
                    </View>
                    <View style={[styles.progressTrack2, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                      <LinearGradient
                        colors={['#22c55e', '#6366f1', '#ec4899']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[styles.progressFill2, { width: `${progressPercent}%` }]}
                      />
                      <View style={[styles.progressMarker, { left: `${progressPercent}%` }]}>
                        <View style={styles.progressMarkerDot} />
                      </View>
                    </View>
                  </View>
                )}

                {/* Start navigation */}
                {!navMode && activeLoad?.hasCoords && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={startNavigation}
                    disabled={navIsRerouting}
                  >
                    <LinearGradient
                      colors={['#22c55e', '#16a34a']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.navStartBtn}
                    >
                      <Text style={styles.navStartGlyph}>▶</Text>
                      <Text style={styles.navStartText}>
                        {navIsRerouting
                          ? 'Loading route…'
                          : `Start — drive to ${navTarget?.kind === 'dropoff' ? 'drop-off' : 'pickup'}`}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {/* Toggleable details */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => { Haptics.selectionAsync(); setDetailsExpanded(v => !v); }}
                  style={styles.detailsToggle}
                >
                  <Text style={[styles.detailsToggleText, { color: colors.textMuted }]}>
                    {detailsExpanded ? 'Hide details' : 'Show load details'}
                  </Text>
                  <Text style={[styles.detailsToggleChev, { color: colors.textMuted }]}>
                    {detailsExpanded ? '▴' : '▾'}
                  </Text>
                </TouchableOpacity>

                {detailsExpanded && (
                  <View style={[styles.detailsBox, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)',
                    borderColor: colors.border,
                  }]}>
                    <DetailRow label="Commodity" value={activeLoad.commodity || '—'} colors={colors} />
                    <DetailRow
                      label="Weight"
                      value={activeLoad.weight ? `${Number(activeLoad.weight).toLocaleString()} lbs` : '—'}
                      colors={colors}
                    />
                    <DetailRow label="Broker" value={activeLoad.brokerName || '—'} colors={colors} />
                    {activeLoad.notes ? (
                      <DetailRow label="Notes" value={activeLoad.notes} colors={colors} />
                    ) : null}
                    {(activeLoad.brokerPhone || activeLoad.shipperPhone || activeLoad.contactPhone) && (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          Haptics.selectionAsync();
                          const p = activeLoad.brokerPhone || activeLoad.shipperPhone || activeLoad.contactPhone;
                          Linking.openURL(`tel:${p}`).catch(() => {});
                        }}
                        style={[styles.callBtn, {
                          backgroundColor: 'rgba(99,102,241,0.12)',
                          borderColor: 'rgba(99,102,241,0.35)',
                        }]}
                      >
                        <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>
                          ☎ Call broker
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={[styles.loadCard, shadow.card, {
              backgroundColor: isDark ? glass.fillDarkStrong : glass.fillLightStrong,
              borderColor: isDark ? glass.borderDarkSoft : glass.borderLightSoft,
            }]}>
              <View style={styles.loadEmpty}>
                <View style={styles.loadEmptyBadge}>
                  <Text style={{ fontSize: 26 }}>🚛</Text>
                </View>
                <Text style={[styles.loadEmptyTitle, { color: colors.textPrimary }]}>No active load</Text>
                <Text style={[styles.loadEmptySub, { color: colors.textMuted }]}>
                  Your next assignment will appear here.
                </Text>
              </View>
            </View>
          )}

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
          setProofModalVisible(true);
        }}
        destination={activeLoad?.destination}
        isDark={isDark}
        colors={colors}
      />

      {/* ── Load assignment (accept / deny) modal ── */}
      <LoadAssignmentModal
        visible={needsAcceptance}
        load={activeLoad}
        accepting={accepting}
        denying={denying}
        onAccept={handleAccept}
        onDeny={handleDecline}
      />

      {/* ── Delivery proof modal ── */}
      <DeliveryProofModal
        visible={proofModalVisible}
        load={activeLoad}
        userId={userId}
        colors={colors}
        isDark={isDark}
        onDismiss={() => {
          setProofModalVisible(false);
          arrivedDismissedRef.current = true;
        }}
        onSuccess={() => {
          setProofModalVisible(false);
          arrivedDismissedRef.current = true;
          setActiveLoad(null);
          showToast('Delivery confirmed!', 'success');
        }}
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
        onOpenSettings={() => {
          setMenuOpen(false);
          Haptics.selectionAsync().catch(() => {});
          router.push('/(driver)/settings');
        }}
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

  // Nav-mode puck (Google Maps style: blue chevron in a halo).
  navPuckWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  navPuckHalo: {
    position: 'absolute', width: 60, height: 60, borderRadius: 99,
    backgroundColor: 'rgba(37,99,235,0.18)',
  },
  navPuckCircle: {
    width: 40, height: 40, borderRadius: 99,
    backgroundColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#2563eb', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.55, shadowRadius: 8, elevation: 6,
  },
  navPuckArrow: {
    width: 0, height: 0,
    borderLeftWidth: 8, borderRightWidth: 8, borderBottomWidth: 14,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: '#fff',
    marginBottom: 2,
  },

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

  loadCardWrap: {
    borderRadius: 22, borderWidth: 1, overflow: 'hidden',
  },
  loadHero: {
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18, gap: 10,
  },
  loadHeroTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  loadHeroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  loadHeroDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: '#fff' },
  loadHeroPillText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.9 },
  loadHeroBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  loadHeroBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  loadHeroBody: { gap: 4 },
  loadHeroRate: {
    color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: -1.6,
    textShadowColor: 'rgba(0,0,0,0.18)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  loadHeroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadHeroMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },
  loadHeroDotSep: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '700' },

  loadBody: { padding: 14, gap: 14 },

  timeline: { flexDirection: 'row', gap: 12, paddingHorizontal: 2 },
  timelineRail: { width: 20, alignItems: 'center', paddingVertical: 2 },
  timelinePinPickup: {
    width: 18, height: 18, borderRadius: 99, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#22c55e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 3,
  },
  timelinePinInner: { width: 7, height: 7, borderRadius: 99, backgroundColor: '#fff' },
  timelineLine: {
    flex: 1, width: 2, marginVertical: 4, alignItems: 'center', justifyContent: 'space-between',
  },
  timelineSeg: { width: 2, height: 4, borderRadius: 1 },
  timelinePinDest: {
    width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ef4444', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  timelinePinFlag: { color: '#fff', fontSize: 10, fontWeight: '800' },
  timelineStops: { flex: 1, justifyContent: 'space-between', gap: 14, paddingVertical: 1 },
  timelineStop: { gap: 3, minWidth: 0 },
  timelineLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.9 },
  timelinePlace: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3, lineHeight: 19 },
  timelineArrival: { fontSize: 11.5, fontWeight: '600', marginTop: 1 },

  statStrip: {
    flexDirection: 'row', borderRadius: 14, borderWidth: 1,
    paddingVertical: 10,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statCellIcon: { fontSize: 13, fontWeight: '900' },
  statCellValue: { fontSize: 15.5, fontWeight: '800', letterSpacing: -0.4 },
  statCellUnit: { fontSize: 10, fontWeight: '700' },
  statCellLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8, marginTop: 1 },
  statCellDivider: { width: 1, marginVertical: 6 },

  progressBlock: { gap: 7 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressEndpoint: { flex: 1, fontSize: 12, fontWeight: '700', letterSpacing: -0.1 },
  progressPctBig: { fontSize: 14, fontWeight: '900', letterSpacing: -0.3, marginHorizontal: 10 },
  progressTrack2: { height: 8, borderRadius: 999, overflow: 'visible', position: 'relative' },
  progressFill2: { height: 8, borderRadius: 999 },
  progressMarker: { position: 'absolute', top: -3, width: 0, alignItems: 'center' },
  progressMarkerDot: {
    width: 14, height: 14, borderRadius: 99, backgroundColor: '#fff',
    borderWidth: 3, borderColor: '#6366f1',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 4,
  },

  navStartBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 15, borderRadius: 14,
    shadowColor: '#16a34a', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.36, shadowRadius: 18, elevation: 8,
  },
  navStartGlyph: { color: '#fff', fontSize: 14, fontWeight: '900' },
  navStartText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },

  detailsToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 6,
  },
  detailsToggleText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  detailsToggleChev: { fontSize: 11, fontWeight: '700' },

  detailsBox: { borderRadius: 12, borderWidth: 1, padding: 10, gap: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  detailLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  detailValue: { fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  callBtn: {
    marginTop: 4, borderRadius: 10, borderWidth: 1,
    paddingVertical: 9, alignItems: 'center',
  },

  loadEmpty: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  loadEmptyBadge: {
    width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(99,102,241,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  loadEmptyTitle: { fontSize: 15, fontWeight: '700' },
  loadEmptySub: { fontSize: 12.5, textAlign: 'center', lineHeight: 18, maxWidth: 240 },

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
  navRecenterWrap: { position: 'absolute', alignSelf: 'center', zIndex: 24 },
  navRecenterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
    shadowColor: '#2563eb', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 16, elevation: 10,
  },
  navRecenterIcon: { color: '#fff', fontSize: 16, fontWeight: '900' },
  navRecenterText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },

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
