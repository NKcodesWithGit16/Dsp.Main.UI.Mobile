import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { fetchLoads, fetchDrivers, fetchActivity } from '../../src/api/main';
import PageHeader from '../../src/components/shared/PageHeader';
import PageBackground from '../../src/components/shared/PageBackground';
import LiveDot from '../../src/components/shared/LiveDot';
import { spacing, typography, radius, glass, shadow } from '../../src/theme/colors';

const RANGES = ['Today', 'Week', 'Month'];
const RANGE_MULT = { Today: 1, Week: 7, Month: 30 };

const STATUS_COLORS = { moving: '#10b981', idle: '#f59e0b', offline: '#6b7280', 0: '#10b981', 1: '#f59e0b', 2: '#6b7280' };
const STATUS_LABELS = { moving: 'Moving', idle: 'Idle', offline: 'Offline', 0: 'Moving', 1: 'Idle', 2: 'Offline' };

const ACTIVITY_ICON = {
  LoadBooked: 'layers',
  DriverDeparted: 'car',
  LoadDelivered: 'checkmark-circle',
  DriverIdle: 'time',
  DocumentUploaded: 'document-text',
  StatusChanged: 'refresh',
  load_created: 'layers',
  driver_status: 'car',
  load_delivered: 'checkmark-circle',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function normalizeStatus(d) {
  if (typeof d.status === 'number') return STATUS_LABELS[d.status]?.toLowerCase() || 'offline';
  return (d.status || 'offline').toLowerCase();
}

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const glassFill   = isDark ? glass.fillDarkStrong : glass.fillLightStrong;
  const glassBorder = isDark ? glass.borderDark : glass.borderLightSoft;
  const { userName, userId } = useAuth();
  const router = useRouter();
  const [range, setRange] = useState('Today');
  const [loads, setLoads] = useState([]);
  const [drivers, setDrivers] = useState([]);
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
      setLoads(l.status === 'fulfilled' ? l.value : []);
      setDrivers(d.status === 'fulfilled' ? d.value : []);
      setActivity(a.status === 'fulfilled' ? a.value : []);
    } catch {
      setLoads([]); setDrivers([]);
    } finally {
      setApiLoading(false); setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = useCallback(() => { setRefreshing(true); loadData(true); }, [loadData]);

  const mult = RANGE_MULT[range];
  const activeDrivers  = drivers.filter(d => normalizeStatus(d) === 'moving').length;
  const idleDrivers    = drivers.filter(d => normalizeStatus(d) === 'idle').length;
  const offlineDrivers = drivers.filter(d => normalizeStatus(d) === 'offline').length;
  const availLoads  = loads.filter(l => l.status === 'New' || l.status === 'Hot').length;
  const hotLoads    = loads.filter(l => l.status === 'Hot').length;
  const bookedLoads = loads.filter(l => l.status === 'Booked').length * mult;
  const revenue     = loads.filter(l => l.status === 'Booked').reduce((s, l) => s + (l.rate || 0), 0) * mult;
  const utilization = drivers.length ? Math.round((activeDrivers / drivers.length) * 100) : 0;
  const alertCount  = hotLoads + idleDrivers;

  const s = makeStyles(colors);

  if (apiLoading) {
    return (
      <PageBackground>
        <SafeAreaView style={s.safe} edges={['left', 'right']}>
          <PageHeader title="Dashboard" />
          <View style={s.loadingWrap}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={[s.loadingText, { color: colors.textMuted }]}>Loading dashboard…</Text>
          </View>
        </SafeAreaView>
      </PageBackground>
    );
  }

  return (
    <PageBackground>
      <SafeAreaView style={s.safe} edges={['left', 'right']}>
        <PageHeader title="Dashboard" />
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          {/* Greeting Banner */}
          <LinearGradient
            colors={['#1e1b4b', '#4338ca', '#6366f1']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.banner}
          >
            <View style={s.bannerDecorA} />
            <View style={s.bannerDecorB} />
            <View style={{ flex: 1 }}>
              <Text style={s.bannerGreet}>{getGreeting().toUpperCase()}</Text>
              <Text style={s.bannerName}>{userName || 'Dispatcher'}</Text>
              <Text style={s.bannerDate}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>
            {hotLoads > 0 && (
              <View style={s.bannerAlert}>
                <View style={s.bannerAlertDot} />
                <Text style={s.bannerAlertText}>{hotLoads} urgent</Text>
              </View>
            )}
          </LinearGradient>

          {/* Range Selector */}
          <View style={[s.rangeRow, { backgroundColor: glassFill, borderColor: glassBorder }]}>
            {RANGES.map(r => (
              <TouchableOpacity
                key={r}
                style={[s.rangeTab, range === r && { backgroundColor: colors.accentMuted }]}
                onPress={() => setRange(r)}
              >
                <Text style={[s.rangeTabText, { color: range === r ? colors.accent : colors.textMuted }]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* KPI Grid */}
          <View style={s.kpiGrid}>
            <KpiCard colors={colors} isDark={isDark} title="Active Drivers"
              value={`${activeDrivers}/${drivers.length}`} sub={`${idleDrivers} idle`}
              gradient={['#6366f1', '#4f46e5']} iconName="car" />
            <KpiCard colors={colors} isDark={isDark} title="Available Loads"
              value={availLoads} sub={`${hotLoads} urgent`}
              gradient={['#f59e0b', '#d97706']} iconName="layers" />
            <KpiCard colors={colors} isDark={isDark} title="Booked"
              value={bookedLoads} sub={range.toLowerCase()}
              gradient={['#10b981', '#059669']} iconName="checkmark-circle" />
            <KpiCard colors={colors} isDark={isDark} title="Revenue"
              value={`$${(revenue / 1000).toFixed(1)}k`} sub={range.toLowerCase()}
              gradient={['#8b5cf6', '#7c3aed']} iconName="cash" />
          </View>

          {/* Alerts */}
          {alertCount > 0 && (
            <View style={[s.alertsCard, { backgroundColor: glassFill, borderColor: glassBorder }]}>
              <View style={s.alertsHeader}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Needs Attention</Text>
                <View style={{ flex: 1 }} />
                <View style={[s.alertCountBadge, { backgroundColor: colors.danger }]}>
                  <Text style={s.alertCountText}>{alertCount}</Text>
                </View>
              </View>

              {hotLoads > 0 && (
                <TouchableOpacity
                  style={[s.alertRow, { borderLeftColor: colors.danger }]}
                  onPress={() => router.push('/(app)/loadboard')}
                >
                  <View style={[s.alertIconWrap, { backgroundColor: colors.danger + '1a' }]}>
                    <Ionicons name="flame" size={16} color={colors.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.alertTitle, { color: colors.textPrimary }]}>{hotLoads} hot loads</Text>
                    <Text style={[s.alertSub, { color: colors.textMuted }]}>Need immediate coverage</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
                </TouchableOpacity>
              )}

              {idleDrivers > 0 && (
                <TouchableOpacity
                  style={[s.alertRow, { borderLeftColor: colors.warning }]}
                  onPress={() => router.push('/(app)/drivers')}
                >
                  <View style={[s.alertIconWrap, { backgroundColor: colors.warning + '1a' }]}>
                    <Ionicons name="warning" size={16} color={colors.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.alertTitle, { color: colors.textPrimary }]}>{idleDrivers} drivers idle</Text>
                    <Text style={[s.alertSub, { color: colors.textMuted }]}>Ready for assignment</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Fleet Status */}
          <View style={[s.card, { backgroundColor: glassFill, borderColor: glassBorder }]}>
            <View style={s.cardHeader}>
              <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Fleet Status</Text>
              <View style={[s.utilBadge, { backgroundColor: colors.accentMuted }]}>
                <Text style={[s.utilText, { color: colors.accent }]}>{utilization}% active</Text>
              </View>
            </View>

            <View style={[s.fleetBar, { backgroundColor: colors.surface2 }]}>
              {activeDrivers > 0 && <View style={[s.fleetBarFill, { flex: activeDrivers, backgroundColor: '#10b981' }]} />}
              {idleDrivers > 0 && <View style={[s.fleetBarFill, { flex: idleDrivers, backgroundColor: '#f59e0b' }]} />}
              {offlineDrivers > 0 && <View style={[s.fleetBarFill, { flex: offlineDrivers, backgroundColor: '#6b7280' }]} />}
            </View>

            <View style={s.fleetLegend}>
              {[
                { label: 'Moving',  count: activeDrivers,  color: '#10b981' },
                { label: 'Idle',    count: idleDrivers,    color: '#f59e0b' },
                { label: 'Offline', count: offlineDrivers, color: '#6b7280' },
              ].map(item => (
                <View key={item.label} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: item.color }]} />
                  <Text style={[s.legendCount, { color: item.color }]}>{item.count}</Text>
                  <Text style={[s.legendLabel, { color: colors.textMuted }]}>{item.label}</Text>
                </View>
              ))}
            </View>

            {drivers.slice(0, 4).map((d) => {
              const st = normalizeStatus(d);
              const stColor = STATUS_COLORS[st] || '#6b7280';
              const name = d.name || (d.firstName ? `${d.firstName || ''} ${d.lastName || ''}`.trim() : 'Driver');
              const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'DR';
              const route = d.origin && d.dest
                ? `${d.origin} → ${d.dest}`
                : d.currentRoute || (st === 'offline' ? 'Offline' : 'En route');
              return (
                <View key={d.id} style={[s.driverRow, { borderTopColor: colors.borderSubtle }]}>
                  <View style={[s.driverAvatar, { backgroundColor: colors.accentMuted }]}>
                    <Text style={[s.driverInitials, { color: colors.accent }]}>{initials}</Text>
                    <View style={[s.driverDot, { backgroundColor: stColor, borderColor: colors.surface1 }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.driverName, { color: colors.textPrimary }]}>{name}</Text>
                    <Text style={[s.driverRoute, { color: colors.textMuted }]} numberOfLines={1}>{route}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: stColor + '1a' }]}>
                    <View style={[s.statusDot, { backgroundColor: stColor }]} />
                    <Text style={[s.statusBadgeText, { color: stColor }]}>{st}</Text>
                  </View>
                </View>
              );
            })}

            <TouchableOpacity style={s.seeAll} onPress={() => router.push('/(app)/drivers')}>
              <Text style={[s.seeAllText, { color: colors.accent }]}>View all drivers</Text>
              <Ionicons name="arrow-forward" size={13} color={colors.accent} />
            </TouchableOpacity>
          </View>

          {/* Activity Feed */}
          <View style={[s.card, { backgroundColor: glassFill, borderColor: glassBorder }]}>
            <View style={s.cardHeader}>
              <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Recent Activity</Text>
              <View style={s.liveRow}>
                <LiveDot />
                <Text style={s.liveText}>LIVE</Text>
              </View>
            </View>

            {activity.length > 0 ? activity.slice(0, 5).map((a, i) => (
              <View key={i} style={[s.activityRow, { borderTopColor: colors.borderSubtle }]}>
                <View style={[s.activityIconWrap, { backgroundColor: colors.surface2 }]}>
                  <Ionicons
                    name={ACTIVITY_ICON[a.type] || 'notifications-outline'}
                    size={15}
                    color={colors.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.activityText, { color: colors.textSecondary }]} numberOfLines={2}>
                    <Text style={{ fontWeight: '600', color: colors.textPrimary }}>
                      {a.actor || a.actorName || 'System'}
                    </Text>
                    {' — '}{a.target || a.description || a.message || a.type}
                  </Text>
                  <Text style={[s.activityTime, { color: colors.textDisabled }]}>
                    {a.time || a.createdAt || 'recently'}
                  </Text>
                </View>
              </View>
            )) : (
              <Text style={[s.emptyNote, { color: colors.textDisabled }]}>No recent activity</Text>
            )}
          </View>

          {/* Load Pipeline */}
          <View style={[s.card, { backgroundColor: glassFill, borderColor: glassBorder }]}>
            <View style={s.cardHeader}>
              <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Load Pipeline</Text>
              <TouchableOpacity style={s.seeAll} onPress={() => router.push('/(app)/loadboard')}>
                <Text style={[s.seeAllText, { color: colors.accent }]}>View all</Text>
                <Ionicons name="arrow-forward" size={13} color={colors.accent} />
              </TouchableOpacity>
            </View>

            {loads.slice(0, 5).map((l) => {
              const isHot = l.status === 'Hot';
              const isNew = l.status === 'New';
              const badgeBg    = isHot ? colors.danger + '1a' : isNew ? colors.accentMuted : colors.surface2;
              const badgeColor = isHot ? colors.danger : isNew ? colors.accent : colors.textMuted;
              return (
                <View key={l.id} style={[s.loadRow, { borderTopColor: colors.borderSubtle }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.loadId, { color: colors.textPrimary }]}>{l.id}</Text>
                    <Text style={[s.loadRoute, { color: colors.textMuted }]} numberOfLines={1}>
                      {l.origin} → {l.destination}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <Text style={[s.loadRate, { color: colors.textPrimary }]}>
                      ${(l.rate || 0).toLocaleString()}
                    </Text>
                    <View style={[s.loadBadge, { backgroundColor: badgeBg }]}>
                      <Text style={[s.loadBadgeText, { color: badgeColor }]}>{l.status}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Quick Actions */}
          <Text style={[s.sectionTitle, { color: colors.textPrimary, marginBottom: spacing[3] }]}>
            Quick Actions
          </Text>
          <View style={s.qaGrid}>
            {[
              { label: 'Track Drivers', iconName: 'car-outline',          gradient: ['#6366f1', '#4f46e5'], route: '/(app)/drivers' },
              { label: 'Loadboard',     iconName: 'layers-outline',        gradient: ['#8b5cf6', '#7c3aed'], route: '/(app)/loadboard' },
              { label: 'Documents',     iconName: 'folder-open-outline',   gradient: ['#06b6d4', '#0891b2'], route: '/(app)/documents' },
              { label: 'AI Assistant',  iconName: 'sparkles-outline',      gradient: ['#f59e0b', '#d97706'], route: '/(app)/aichat' },
            ].map((qa) => (
              <TouchableOpacity
                key={qa.label}
                style={s.qaCard}
                onPress={() => router.push(qa.route)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={qa.gradient}
                  style={s.qaGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Ionicons name={qa.iconName} size={26} color="#fff" />
                </LinearGradient>
                <Text style={[s.qaLabel, { color: colors.textSecondary }]}>{qa.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: spacing[8] }} />
        </ScrollView>
      </SafeAreaView>
    </PageBackground>
  );
}

function KpiCard({ colors, isDark, title, value, sub, gradient, iconName }) {
  const fill   = isDark ? glass.fillDarkStrong : glass.fillLightStrong;
  const border = isDark ? glass.borderDark : glass.borderLightSoft;
  return (
    <View style={[kpiS.card, shadow.card, { backgroundColor: fill, borderColor: border }]}>
      <LinearGradient
        colors={gradient}
        style={[kpiS.iconWrap, shadow.glow]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <Ionicons name={iconName} size={18} color="#fff" />
      </LinearGradient>
      <Text style={[kpiS.value, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[kpiS.title, { color: colors.textMuted }]}>{title}</Text>
      <Text style={[kpiS.sub, { color: colors.textDisabled }]}>{sub}</Text>
    </View>
  );
}

const kpiS = StyleSheet.create({
  card: { width: '47%', borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, flexGrow: 1 },
  iconWrap: {
    width: 38, height: 38,
    borderRadius: radius.lg,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing[2],
  },
  value: { fontSize: typography.xl, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: typography.xs, fontWeight: '600', marginTop: 2, letterSpacing: 0.2 },
  sub:   { fontSize: typography.xs, marginTop: 1 },
});

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { padding: spacing[4] },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing[3] },
  loadingText: { fontSize: typography.sm },

  banner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius['2xl'], padding: spacing[5],
    marginBottom: spacing[4], overflow: 'hidden',
    ...shadow.cardStrong,
  },
  bannerDecorA: {
    position: 'absolute', right: -24, top: -24,
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  bannerDecorB: {
    position: 'absolute', right: 30, bottom: -30,
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  bannerGreet: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    marginBottom: 4,
  },
  bannerName: {
    color: '#fff', fontSize: typography['2xl'],
    fontWeight: '800', letterSpacing: -0.5, lineHeight: 32,
  },
  bannerDate: { color: 'rgba(255,255,255,0.55)', fontSize: typography.xs, marginTop: 4, letterSpacing: 0.2 },
  bannerAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(239,68,68,0.22)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)',
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.pill,
  },
  bannerAlertDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fca5a5' },
  bannerAlertText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  rangeRow: {
    flexDirection: 'row', borderRadius: radius.lg, padding: 3,
    marginBottom: spacing[4], borderWidth: 1,
  },
  rangeTab: { flex: 1, alignItems: 'center', paddingVertical: spacing[2], borderRadius: radius.md },
  rangeTabText: { fontSize: typography.sm, fontWeight: '600' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginBottom: spacing[4] },

  alertsCard: { borderRadius: radius.xl, padding: spacing[4], marginBottom: spacing[4], borderWidth: 1 },
  alertsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  alertCountBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  alertCountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  alertRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[3], paddingLeft: spacing[3],
    borderLeftWidth: 2.5, marginTop: spacing[2],
    gap: spacing[3], borderRadius: 2,
  },
  alertIconWrap: {
    width: 34, height: 34, borderRadius: radius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  alertTitle: { fontSize: typography.sm, fontWeight: '600' },
  alertSub:   { fontSize: typography.xs, marginTop: 1 },

  card: { borderRadius: radius.xl, padding: spacing[4], marginBottom: spacing[4], borderWidth: 1, ...shadow.card },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  sectionTitle: { fontSize: typography.base, fontWeight: '700', letterSpacing: -0.1 },
  utilBadge: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.pill },
  utilText:  { fontSize: typography.xs, fontWeight: '700' },

  fleetBar: { height: 6, borderRadius: radius.pill, flexDirection: 'row', overflow: 'hidden', marginBottom: spacing[2] },
  fleetBarFill: { height: '100%' },
  fleetLegend: { flexDirection: 'row', gap: spacing[4], marginBottom: spacing[3] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 99 },
  legendCount: { fontSize: typography.sm, fontWeight: '700' },
  legendLabel: { fontSize: typography.xs },

  driverRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing[3], paddingVertical: spacing[3], borderTopWidth: StyleSheet.hairlineWidth,
  },
  driverAvatar: {
    width: 38, height: 38, borderRadius: radius.pill,
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  driverInitials: { fontSize: typography.xs, fontWeight: '700' },
  driverDot: {
    width: 9, height: 9, borderRadius: 99,
    position: 'absolute', bottom: 0, right: 0, borderWidth: 1.5,
  },
  driverName:  { fontSize: typography.sm, fontWeight: '600', letterSpacing: -0.1 },
  driverRoute: { fontSize: typography.xs, marginTop: 1 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.pill,
  },
  statusDot:      { width: 5, height: 5, borderRadius: 99 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: spacing[3], justifyContent: 'center' },
  seeAllText: { fontSize: typography.sm, fontWeight: '600' },

  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveText: { color: '#10b981', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },

  activityRow: {
    flexDirection: 'row', gap: spacing[3],
    paddingVertical: spacing[3], borderTopWidth: StyleSheet.hairlineWidth,
  },
  activityIconWrap: {
    width: 34, height: 34, borderRadius: radius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  activityText: { fontSize: typography.sm, lineHeight: 18 },
  activityTime: { fontSize: typography.xs, marginTop: 2 },
  emptyNote:    { fontSize: typography.sm, textAlign: 'center', paddingVertical: spacing[3] },

  loadRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing[3], borderTopWidth: StyleSheet.hairlineWidth,
  },
  loadId:    { fontSize: typography.sm, fontWeight: '700' },
  loadRoute: { fontSize: typography.xs, marginTop: 1 },
  loadRate:  { fontSize: typography.sm, fontWeight: '800' },
  loadBadge: { paddingHorizontal: spacing[2], paddingVertical: 1, borderRadius: radius.pill },
  loadBadgeText: { fontSize: 10, fontWeight: '700' },

  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  qaCard: { width: '47%', alignItems: 'center', flexGrow: 1 },
  qaGrad: {
    width: '100%', aspectRatio: 2, borderRadius: radius.xl,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing[2], ...shadow.glow,
  },
  qaLabel: { fontSize: typography.xs, fontWeight: '700', textAlign: 'center', letterSpacing: 0.2 },
});
