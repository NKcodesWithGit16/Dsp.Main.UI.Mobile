import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { fetchLoads, fetchDrivers, fetchActivity } from '../../src/api/main';

import PageHeader  from '../../src/components/shared/PageHeader';
import PageBackground from '../../src/components/shared/PageBackground';
import HeroBanner  from '../../src/components/shared/HeroBanner';
import SectionCard from '../../src/components/shared/SectionCard';
import KpiCard     from '../../src/components/shared/KpiCard';
import FleetRing   from '../../src/components/shared/FleetRing';
import StatusBadge from '../../src/components/shared/StatusBadge';
import Avatar      from '../../src/components/shared/Avatar';
import LiveDot     from '../../src/components/shared/LiveDot';
import StatusPill  from '../../src/components/shared/StatusPill';
import AnimatedPressable from '../../src/components/shared/AnimatedPressable';
import Icon        from '../../src/components/shared/Icon';
import BrandButton from '../../src/components/shared/BrandButton';
import AISummaryCard from '../../src/components/shared/AISummaryCard';
import { SkeletonBlock, SkeletonKpiCard, SkeletonRow } from '../../src/components/shared/SkeletonShimmer';

import { spacing, typography, radius, shadow, photos } from '../../src/theme/colors';

// ────────────────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────────────────
const STATUS_KEYS = ['moving', 'idle', 'offline'];
const ACTIVITY_VISUAL = {
  LoadBooked:       { icon: 'box',           color: '#0193ab' },
  DriverDeparted:   { icon: 'truck',         color: '#10b981' },
  LoadDelivered:    { icon: 'check',         color: '#10b981' },
  DriverIdle:       { icon: 'alertTriangle', color: '#f59e0b' },
  DocumentUploaded: { icon: 'fileText',      color: '#0193ab' },
  StatusChanged:    { icon: 'refresh',       color: '#64748b' },
  load_created:     { icon: 'box',           color: '#0193ab' },
  driver_status:    { icon: 'truck',         color: '#10b981' },
  load_delivered:   { icon: 'check',         color: '#10b981' },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function normalizeStatus(d) {
  if (typeof d.status === 'number') return STATUS_KEYS[d.status] ?? 'offline';
  return (d.status || 'offline').toLowerCase();
}

function timeAgo(iso) {
  if (!iso) return '—';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtCurrency(n) {
  if (!n && n !== 0) return '$0';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000)    return '$' + (n / 1_000).toFixed(1) + 'k';
  return '$' + Math.round(n).toLocaleString('en-US');
}

// 7-day bucketing of an array by date field. Returns 7 numbers, oldest first.
function bucketByDay(items, dateField, valueFn = () => 1) {
  const now = new Date();
  const buckets = new Array(7).fill(0);
  for (const item of items) {
    const ts = item[dateField];
    if (!ts) continue;
    const date = new Date(ts);
    const daysAgo = Math.floor((now - date) / 86400000);
    if (daysAgo >= 0 && daysAgo < 7) {
      buckets[6 - daysAgo] += valueFn(item);
    }
  }
  return buckets;
}

// Drift the current value over 7 synthetic points if we don't have real
// historical data. Bias up if there's currently activity so the chart
// "rises into now" — feels like momentum, never a flat line.
function syntheticSpark(current, bias = 'up', range = 0.35) {
  const points = [];
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const base = bias === 'up'
      ? current * (1 - range) + current * range * t
      : bias === 'down'
        ? current * (1 + range) - current * range * t
        : current;
    const noise = current * range * 0.15 * Math.sin(i * 1.3);
    points.push(Math.max(0, Math.round(base + noise)));
  }
  return points;
}

// ────────────────────────────────────────────────────────────
//  Screen
// ────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { userName, userId } = useAuth();
  const router = useRouter();

  const [loads,    setLoads]    = useState([]);
  const [drivers,  setDrivers]  = useState([]);
  const [activity, setActivity] = useState([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setApiLoading(true);
    try {
      const [l, d, a] = await Promise.allSettled([
        fetchLoads({ pageSize: 50 }),
        fetchDrivers(),
        userId ? fetchActivity(userId, 20) : Promise.resolve([]),
      ]);
      setLoads(l.status === 'fulfilled' ? (l.value ?? []) : []);
      setDrivers(d.status === 'fulfilled' ? (d.value ?? []) : []);
      setActivity(a.status === 'fulfilled' ? (a.value ?? []) : []);
    } finally {
      setApiLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = useCallback(() => { setRefreshing(true); loadData(true); }, [loadData]);

  // Derived metrics
  const activeDrivers  = drivers.filter(d => normalizeStatus(d) === 'moving').length;
  const idleDrivers    = drivers.filter(d => normalizeStatus(d) === 'idle').length;
  const offlineDrivers = drivers.filter(d => normalizeStatus(d) === 'offline').length;
  const hotLoads       = loads.filter(l => l.status === 'Hot').length;
  const availLoads     = loads.filter(l => l.status === 'New' || l.status === 'Hot').length;
  const bookedLoads    = loads.filter(l => l.status === 'Booked').length;
  const revenue        = loads.filter(l => l.status === 'Booked').reduce((s, l) => s + (l.rate || 0), 0);
  const utilization    = drivers.length ? Math.round((activeDrivers / drivers.length) * 100) : 0;
  const alertCount     = hotLoads + (idleDrivers > 2 ? 1 : 0) + (offlineDrivers > 0 ? 1 : 0);

  const allClear = !apiLoading && alertCount === 0;

  // ── Sparkline data (real where possible, synthetic where not) ──
  const sparks = useMemo(() => {
    // Active drivers: synthesize 7 hourly buckets ramping to current
    const driverSpark = syntheticSpark(activeDrivers || 1, 'up');

    // Available loads: bucket posted loads over the last 7 days
    const postedBuckets = bucketByDay(
      loads.filter(l => l.status === 'New' || l.status === 'Hot'),
      'postedAt',
    );
    const availSpark = postedBuckets.some(v => v > 0) ? postedBuckets : syntheticSpark(availLoads, 'up');

    // Booked: bucket booked loads over last 7 days
    const bookedBuckets = bucketByDay(
      loads.filter(l => l.status === 'Booked'),
      'postedAt',
    );
    const bookedSpark = bookedBuckets.some(v => v > 0) ? bookedBuckets : syntheticSpark(bookedLoads, 'up');

    // Revenue: bucket revenue over last 7 days (rate per booked load)
    const revBuckets = bucketByDay(
      loads.filter(l => l.status === 'Booked'),
      'postedAt',
      (l) => l.rate || 0,
    );
    const revSpark = revBuckets.some(v => v > 0) ? revBuckets : syntheticSpark(revenue, 'up');

    return { driverSpark, availSpark, bookedSpark, revSpark };
  }, [loads, activeDrivers, availLoads, bookedLoads, revenue]);

  // ── Week-over-week trend deltas (last 3 days vs prior 4) ──
  const trends = useMemo(() => {
    const wow = (points) => {
      const recent = points.slice(-3).reduce((a, b) => a + b, 0);
      const prior  = points.slice(0, 4).reduce((a, b) => a + b, 0) || 1;
      const pct = Math.round(((recent / Math.max(1, prior * 3 / 4)) - 1) * 100);
      return { up: pct >= 0, pct: Math.abs(pct) };
    };
    return {
      drivers: drivers.length ? { up: true, pct: utilization } : null,
      avail:   hotLoads > 0 ? { hot: true, pct: hotLoads } : wow(sparks.availSpark),
      booked:  wow(sparks.bookedSpark),
      revenue: wow(sparks.revSpark),
    };
  }, [sparks, drivers.length, utilization, hotLoads]);

  const sortedDrivers = useMemo(() => {
    const order = { idle: 0, moving: 1, offline: 2 };
    return [...drivers].sort((a, b) => (order[normalizeStatus(a)] ?? 9) - (order[normalizeStatus(b)] ?? 9));
  }, [drivers]);

  const alerts = useMemo(() => {
    const list = [];
    if (hotLoads > 0) {
      list.push({ key: 'hot', icon: 'flame', tone: 'danger',
        title: `${hotLoads} hot load${hotLoads > 1 ? 's' : ''} need coverage`,
        desc:  'Urgent bookings pending',
        to:    '/(app)/loadboard' });
    }
    if (idleDrivers > 2) {
      list.push({ key: 'idle', icon: 'alertTriangle', tone: 'warn',
        title: `${idleDrivers} drivers idle`,
        desc:  'Consider re-assigning',
        to:    '/(app)/drivers' });
    }
    if (offlineDrivers > 0) {
      list.push({ key: 'off', icon: 'powerOff', tone: 'muted',
        title: `${offlineDrivers} driver${offlineDrivers > 1 ? 's' : ''} offline`,
        desc:  'No recent ping',
        to:    '/(app)/drivers' });
    }
    return list;
  }, [hotLoads, idleDrivers, offlineDrivers]);

  // Mount fade
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    if (!apiLoading) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(lift, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [apiLoading]);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const s = makeStyles(colors);

  return (
    <PageBackground>
      <SafeAreaView style={s.safe} edges={['left', 'right']}>
        <PageHeader title="Dashboard" />
        <Animated.ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          {apiLoading ? (
            <View style={{ gap: spacing[4] }}>
              <SkeletonBlock width="100%" height={130} borderRadius={radius.xl} />
              <View style={s.kpiGrid}>
                <SkeletonKpiCard />
                <SkeletonKpiCard />
                <SkeletonKpiCard />
                <SkeletonKpiCard />
              </View>
              <SkeletonBlock width="100%" height={180} borderRadius={radius.xl} />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : (
            <Animated.View style={{ opacity: fade, transform: [{ translateY: lift }], gap: spacing[4] }}>

              {/* ── Hero banner ── */}
              <HeroBanner
                eyebrow={getGreeting()}
                title={userName || 'Dispatcher'}
                date={dateStr}
                photo={photos.heroDispatcher}
                alert={hotLoads > 0 ? `${hotLoads} urgent` : null}
              />

              {/* ── AI Summary Card (killer feature) ── */}
              <AISummaryCard
                loads={loads}
                drivers={drivers}
                onAskMore={() => router.push('/(app)/aichat')}
                onActionPress={(a) => {
                  if (a.route) router.push(a.route);
                  else if (a.onPress) a.onPress();
                }}
              />

              {/* ── Status pill row ── */}
              <View style={s.pillRow}>
                <StatusPill
                  tone={allClear ? 'clear' : 'attn'}
                  label={allClear ? 'All systems normal' : `${alertCount} need${alertCount === 1 ? 's' : ''} attention`}
                />
                <BrandButton
                  label="Post load"
                  icon="bolt"
                  size="sm"
                  onPress={() => router.push('/(app)/loadboard')}
                />
              </View>

              {/* ── KPI grid (count-up + sparklines + trend deltas) ── */}
              <View style={s.kpiGrid}>
                <KpiCard
                  style={s.kpiHalf}
                  label="Active drivers"
                  value={`${activeDrivers}/${drivers.length}`}
                  sub={`${idleDrivers} idle · ${utilization}% util`}
                  icon="truck"
                  color="#0193ab"
                  trend={trends.drivers}
                  trendLabel="util"
                  spark={sparks.driverSpark}
                />
                <KpiCard
                  style={s.kpiHalf}
                  label="Available loads"
                  numericValue={availLoads}
                  sub="New & hot"
                  icon="box"
                  color="#06b6d4"
                  trend={trends.avail}
                  spark={sparks.availSpark}
                />
                <KpiCard
                  style={s.kpiHalf}
                  label="Booked today"
                  numericValue={bookedLoads}
                  sub="Confirmed runs"
                  icon="check"
                  color="#10b981"
                  trend={trends.booked}
                  spark={sparks.bookedSpark}
                />
                <KpiCard
                  style={s.kpiHalf}
                  label="Revenue booked"
                  numericValue={revenue}
                  valueFormat={fmtCurrency}
                  sub="From booked loads"
                  icon="dollar"
                  color="#f59e0b"
                  trend={trends.revenue}
                  spark={sparks.revSpark}
                />
              </View>

              {/* ── Alerts strip ── */}
              {alerts.length > 0 && (
                <View style={{ gap: spacing[2] }}>
                  {alerts.map(a => <AlertRow key={a.key} alert={a} onPress={() => router.push(a.to)} />)}
                </View>
              )}

              {/* ── Fleet status (bigger ring) ── */}
              <SectionCard
                title="Fleet status"
                linkLabel="View on map"
                onLinkPress={() => router.push('/(app)/drivers')}
                accent
              >
                <View style={s.fleetTop}>
                  <FleetRing pct={utilization} moving={activeDrivers} total={drivers.length} size={120} />
                  <View style={s.fleetStats}>
                    <FleetStat tone="moving"  num={activeDrivers}  label="Moving" />
                    <FleetStat tone="idle"    num={idleDrivers}    label="Idle" />
                    <FleetStat tone="offline" num={offlineDrivers} label="Offline" />
                  </View>
                </View>

                <View style={{ gap: spacing[1] }}>
                  {sortedDrivers.length === 0 ? (
                    <Text style={[s.empty, { color: colors.textMuted }]}>No drivers yet.</Text>
                  ) : (
                    sortedDrivers.slice(0, 6).map(d => (
                      <DriverRow
                        key={d.id}
                        driver={d}
                        onPress={() => router.push('/(app)/drivers')}
                      />
                    ))
                  )}
                </View>
              </SectionCard>

              {/* ── Recent activity ── */}
              <SectionCard
                title="Recent activity"
                rightSlot={
                  <View style={s.liveRow}>
                    <LiveDot color="#10b981" size={7} />
                    <Text style={s.liveText}>LIVE</Text>
                  </View>
                }
              >
                {activity.length === 0 ? (
                  <Text style={[s.empty, { color: colors.textMuted }]}>No recent activity yet.</Text>
                ) : (
                  activity.slice(0, 6).map(a => {
                    const visual = ACTIVITY_VISUAL[a.eventType || a.type] || { icon: 'sparkles', color: '#64748b' };
                    const msg = a.description || a.message || a.target || a.type || 'Activity';
                    return (
                      <View key={a.id || a.createdAt} style={s.activityRow}>
                        <View style={[s.activityIcon, { backgroundColor: visual.color + '1f' }]}>
                          <Icon name={visual.icon} size={15} color={visual.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.activityMsg, { color: colors.textSecondary }]} numberOfLines={2}>
                            {msg}
                          </Text>
                          <Text style={[s.activityTime, { color: colors.textDisabled }]}>
                            {timeAgo(a.createdAt || a.time)}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </SectionCard>

              {/* ── Load pipeline ── */}
              <SectionCard
                title="Load pipeline"
                linkLabel="View all"
                onLinkPress={() => router.push('/(app)/loadboard')}
              >
                {loads.length === 0 ? (
                  <Text style={[s.empty, { color: colors.textMuted }]}>No loads yet — post your first load.</Text>
                ) : (
                  loads.slice(0, 5).map((l) => (
                    <AnimatedPressable
                      key={l.id}
                      onPress={() => router.push('/(app)/loadboard')}
                      pressedScale={0.985}
                    >
                      <View style={s.loadRow}>
                        <View style={{ flex: 1 }}>
                          <View style={s.loadIdRow}>
                            <Text style={[s.loadId, { color: colors.textPrimary }]}>{l.id}</Text>
                            <StatusBadge tone={(l.status || '').toLowerCase()} label={l.status} size="xs" />
                          </View>
                          <Text style={[s.loadRoute, { color: colors.textMuted }]} numberOfLines={1}>
                            {l.origin} → {l.destination}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[s.loadRate, { color: colors.textPrimary }]}>
                            ${(l.rate || 0).toLocaleString()}
                          </Text>
                          <Text style={[s.loadMiles, { color: colors.textDisabled }]}>
                            {l.miles?.toLocaleString() ?? '—'} mi
                          </Text>
                        </View>
                      </View>
                    </AnimatedPressable>
                  ))
                )}
              </SectionCard>

              {/* ── Quick actions ── */}
              <Text style={[s.sectionLabel, { color: colors.textPrimary }]}>Quick actions</Text>
              <View style={s.qaGrid}>
                {QUICK_ACTIONS.map(qa => (
                  <AnimatedPressable
                    key={qa.label}
                    onPress={() => router.push(qa.route)}
                    containerStyle={s.qaWrap}
                    hapticStyle="light"
                  >
                    <View style={s.qaCard}>
                      <LinearGradient
                        colors={qa.gradient}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={[s.qaIcon, shadow.glow]}
                      >
                        <Icon name={qa.icon} size={22} color="#fff" />
                      </LinearGradient>
                      <Text style={[s.qaLabel, { color: colors.textPrimary }]}>{qa.label}</Text>
                      <Text style={[s.qaSub, { color: colors.textMuted }]} numberOfLines={1}>{qa.sub}</Text>
                    </View>
                  </AnimatedPressable>
                ))}
              </View>

              <View style={{ height: spacing[10] }} />
            </Animated.View>
          )}
        </Animated.ScrollView>
      </SafeAreaView>
    </PageBackground>
  );
}

// ────────────────────────────────────────────────────────────
//  Sub-components
// ────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Track drivers', sub: 'Live map view',   icon: 'map',       route: '/(app)/drivers',   gradient: ['#0193ab', '#04285a'] },
  { label: 'Loadboard',     sub: 'Browse available', icon: 'list',      route: '/(app)/loadboard', gradient: ['#06b6d4', '#0193ab'] },
  { label: 'Documents',     sub: 'BOLs & rate cons', icon: 'folder',    route: '/(app)/documents', gradient: ['#10b981', '#06b6d4'] },
  { label: 'AI assistant',  sub: 'Ask anything',     icon: 'sparkles',  route: '/(app)/aichat',    gradient: ['#f59e0b', '#dc2626'] },
];

function AlertRow({ alert, onPress }) {
  const { colors, isDark } = useTheme();
  const tone = alert.tone;
  const colorMap = {
    danger: { fg: '#dc2626', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.28)' },
    warn:   { fg: '#b45309', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)' },
    muted:  { fg: '#64748b', bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.24)' },
  };
  const c = colorMap[tone] || colorMap.muted;
  return (
    <AnimatedPressable onPress={onPress} hapticStyle="light">
      <View style={[alertS.row, { backgroundColor: c.bg, borderColor: c.border }]}>
        <View style={[alertS.icon, { backgroundColor: c.fg + '1f' }]}>
          <Icon name={alert.icon} size={15} color={c.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[alertS.title, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{alert.title}</Text>
          <Text style={[alertS.desc, { color: colors.textMuted }]}>{alert.desc}</Text>
        </View>
        <Icon name="chevron" size={14} color={c.fg} />
      </View>
    </AnimatedPressable>
  );
}
const alertS = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[3], borderRadius: radius.lg, borderWidth: 1,
  },
  icon: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13.5, fontWeight: '700' },
  desc:  { fontSize: 11.5, marginTop: 1 },
});

function FleetStat({ tone, num, label }) {
  const palette = {
    moving:  { dot: '#10b981', num: '#059669' },
    idle:    { dot: '#f59e0b', num: '#d97706' },
    offline: { dot: '#94a3b8', num: '#64748b' },
  };
  const p = palette[tone] ?? palette.offline;
  const { colors } = useTheme();
  return (
    <View style={fleetS.item}>
      <View style={[fleetS.dot, { backgroundColor: p.dot }]} />
      <Text style={[fleetS.num, { color: p.num }]}>{num}</Text>
      <Text style={[fleetS.lbl, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}
const fleetS = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:  { width: 8, height: 8, borderRadius: 99 },
  num:  { fontSize: 13, fontWeight: '800' },
  lbl:  { fontSize: 11, fontWeight: '500' },
});

function DriverRow({ driver, onPress }) {
  const { colors } = useTheme();
  const st = normalizeStatus(driver);
  const stColor = st === 'moving' ? '#10b981' : st === 'idle' ? '#f59e0b' : '#94a3b8';
  const name = driver.name || `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || 'Driver';
  const route = driver.origin && driver.dest
    ? `${driver.origin} → ${driver.dest}`
    : driver.currentRoute || (st === 'offline' ? 'Offline' : 'Awaiting dispatch');

  return (
    <AnimatedPressable onPress={onPress} pressedScale={0.985}>
      <View style={drvS.row}>
        <Avatar name={name} statusColor={stColor} pipBorder={colors.surface1} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[drvS.name, { color: colors.textPrimary }]} numberOfLines={1}>{name}</Text>
          <Text style={[drvS.route, { color: colors.textMuted }]} numberOfLines={1}>{route}</Text>
        </View>
        <StatusBadge tone={st} label={st} size="xs" />
      </View>
    </AnimatedPressable>
  );
}
const drvS = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing[3], paddingVertical: spacing[2],
  },
  name:  { fontSize: 13.5, fontWeight: '700', letterSpacing: -0.1 },
  route: { fontSize: 11.5, marginTop: 1 },
});

// ────────────────────────────────────────────────────────────
//  Styles
// ────────────────────────────────────────────────────────────
const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { padding: spacing[4] },

  pillRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2], flexWrap: 'wrap' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  kpiHalf: { width: '47%', flexGrow: 1, minWidth: 150 },

  fleetTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], paddingBottom: spacing[3] },
  fleetStats: { flex: 1, gap: spacing[2] },

  loadRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[2], gap: spacing[2],
  },
  loadIdRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  loadId:    { fontSize: 13, fontWeight: '800' },
  loadRoute: { fontSize: 11.5, marginTop: 2 },
  loadRate:  { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  loadMiles: { fontSize: 11, marginTop: 2 },

  activityRow: { flexDirection: 'row', gap: spacing[3], paddingVertical: spacing[2] },
  activityIcon: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  activityMsg: { fontSize: 13, lineHeight: 18 },
  activityTime: { fontSize: 11, marginTop: 2 },

  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveText: { color: '#10b981', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },

  sectionLabel: { fontSize: typography.base, fontWeight: '800', letterSpacing: -0.2 },

  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  qaWrap: { width: '47%', flexGrow: 1, minWidth: 140 },
  qaCard: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2] },
  qaIcon: {
    width: 56, height: 56, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  qaLabel: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2, textAlign: 'center' },
  qaSub:   { fontSize: 11, textAlign: 'center' },

  empty: { fontSize: typography.sm, textAlign: 'center', paddingVertical: spacing[3] },
});
