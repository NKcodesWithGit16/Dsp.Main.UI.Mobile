import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  Modal, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import { fetchLoads, fetchDrivers } from '../../src/api/main';
import ScreenHeader from '../../src/components/shared/ScreenHeader';
import PageBackground from '../../src/components/shared/PageBackground';
import { spacing, typography, radius, glass, shadow } from '../../src/theme/colors';

const EQUIPMENT_TYPES = ['All', '53FT Dry Van', 'Reefer', 'Flatbed', 'Power Only'];
const PAGE_SIZE = 20;

function statusColor(status, colors) {
  if (status === 'Hot')    return colors.danger;
  if (status === 'New')    return colors.accent;
  if (status === 'Booked') return colors.success;
  return colors.textMuted;
}

function rateColor(rate, marketRate, colors) {
  if (!marketRate) return colors.textPrimary;
  if (rate > marketRate * 1.05) return colors.success;
  if (rate < marketRate * 0.95) return colors.danger;
  return colors.textPrimary;
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

const LIFECYCLE_STEPS = ['Posted', 'Booked', 'Dispatched', 'In Transit', 'Delivered', 'POD'];

export default function LoadboardScreen() {
  const { colors, isDark } = useTheme();
  const glassFill   = isDark ? glass.fillDarkStrong : glass.fillLightStrong;
  const glassBorder = isDark ? glass.borderDark : glass.borderLightSoft;
  const [allLoads, setAllLoads] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [equipFilter, setEquipFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [favorites, setFavorites] = useState(new Set());
  const [selectedLoad, setSelectedLoad] = useState(null);
  const [page, setPage] = useState(1);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setApiLoading(true);
    try {
      const [loads, drvs] = await Promise.all([fetchLoads({ pageSize: 120 }), fetchDrivers()]);
      setAllLoads(loads);
      setDrivers(drvs);
    } catch {
      setAllLoads([]);
      setDrivers([]);
    } finally {
      setApiLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = useCallback(() => { setRefreshing(true); loadData(true); }, [loadData]);

  const filtered = useMemo(() => {
    let loads = allLoads;
    if (equipFilter !== 'All') loads = loads.filter(l => l.equipment === equipFilter);
    if (search) {
      const q = search.toLowerCase();
      loads = loads.filter(l =>
        (l.origin || '').toLowerCase().includes(q) ||
        (l.destination || '').toLowerCase().includes(q) ||
        (l.broker || '').toLowerCase().includes(q) ||
        (l.id || '').toLowerCase().includes(q)
      );
    }
    return loads;
  }, [allLoads, search, equipFilter]);

  const paged = filtered.slice(0, page * PAGE_SIZE);

  const toggleFav = useCallback((id) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const s = makeStyles(colors);

  const renderLoad = useCallback(({ item: l }) => {
    const sc = statusColor(l.status, colors);
    const isFav = favorites.has(l.id);
    return (
      <TouchableOpacity style={[s.loadRow, { borderBottomColor: colors.borderSubtle }]} onPress={() => setSelectedLoad(l)} activeOpacity={0.8}>
        <TouchableOpacity onPress={() => toggleFav(l.id)} style={s.star} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontSize: 15, color: isFav ? colors.warning : colors.textDisabled }}>{isFav ? '★' : '☆'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={s.loadTopRow}>
            <Text style={[s.loadId, { color: colors.textPrimary }]}>{l.id}</Text>
            {l.status === 'Hot' && (
              <View style={[s.hotBadge, { backgroundColor: colors.danger + '22' }]}>
                <Text style={[s.hotBadgeText, { color: colors.danger }]}>🔥 HOT</Text>
              </View>
            )}
            {l.status === 'New' && (
              <View style={[s.hotBadge, { backgroundColor: colors.accentMuted }]}>
                <Text style={[s.hotBadgeText, { color: colors.accent }]}>NEW</Text>
              </View>
            )}
          </View>
          <Text style={[s.loadRoute, { color: colors.textSecondary }]} numberOfLines={1}>
            {l.origin} → {l.destination}
          </Text>
          <Text style={[s.loadEquip, { color: colors.textDisabled }]}>{l.equipment} · {l.miles} mi</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[s.loadRate, { color: rateColor(l.rate, l.marketRate, colors) }]}>${(l.rate || 0).toLocaleString()}</Text>
          <Text style={[s.loadRpm, { color: colors.textMuted }]}>${l.rpm}/mi</Text>
          <Text style={[s.loadAge, { color: colors.textDisabled }]}>{relativeTime(l.postedAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [favorites, colors]);

  return (
    <PageBackground>
    <SafeAreaView style={[s.safe, { backgroundColor: 'transparent' }]} edges={['left', 'right']}>
      <ScreenHeader title="Loadboard" subtitle={apiLoading ? '…' : `${filtered.length} loads`} />

      {/* Stats Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.statsScroll} contentContainerStyle={s.statsContent}>
        {[
          { label: 'Active', value: filtered.filter(l => l.status !== 'Booked').length, color: colors.accent },
          { label: 'Avg Rate', value: `$${Math.round(filtered.reduce((s, l) => s + (l.rate || 0), 0) / Math.max(filtered.length, 1)).toLocaleString()}`, color: colors.success },
          { label: 'Avg RPM', value: `$${(filtered.reduce((s, l) => s + (l.rpm || 0), 0) / Math.max(filtered.length, 1)).toFixed(2)}`, color: colors.info },
          { label: '🔥 Hot', value: filtered.filter(l => l.status === 'Hot').length, color: colors.danger },
        ].map(chip => (
          <View key={chip.label} style={[s.statChip, { borderColor: chip.color + '33', backgroundColor: chip.color + '11' }]}>
            <Text style={[s.statValue, { color: chip.color }]}>{chip.value}</Text>
            <Text style={[s.statLabel, { color: colors.textMuted }]}>{chip.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Search */}
      <View style={s.controlRow}>
        <View style={[s.searchWrap, { backgroundColor: glassFill, borderColor: glassBorder }]}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={[s.searchInput, { color: colors.textPrimary }]}
            placeholder="Search loads…"
            placeholderTextColor={colors.textDisabled}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: colors.textMuted }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[s.filterBtn, { backgroundColor: showFilters ? colors.accentMuted : glassFill, borderColor: showFilters ? colors.accent : glassBorder }]}
          onPress={() => setShowFilters(v => !v)}
        >
          <Text style={{ color: showFilters ? colors.accent : colors.textMuted }}>⚙</Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.equipScroll} contentContainerStyle={s.equipContent}>
          {EQUIPMENT_TYPES.map(e => (
            <TouchableOpacity
              key={e}
              style={[s.equipChip, { backgroundColor: equipFilter === e ? colors.accentMuted : glassFill, borderColor: equipFilter === e ? colors.accent : glassBorder }]}
              onPress={() => setEquipFilter(e)}
            >
              <Text style={[s.equipChipText, { color: equipFilter === e ? colors.accent : colors.textMuted }]}>{e}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {apiLoading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[s.loadingText, { color: colors.textMuted }]}>Loading loads…</Text>
        </View>
      ) : (
        <FlatList
          data={paged}
          keyExtractor={i => String(i.id)}
          renderItem={renderLoad}
          onEndReached={() => setPage(p => p + 1)}
          onEndReachedThreshold={0.3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ListFooterComponent={
            paged.length < filtered.length
              ? <ActivityIndicator color={colors.accent} style={{ margin: spacing[4] }} />
              : <View style={{ height: spacing[8] }} />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 40, marginBottom: spacing[3] }}>📋</Text>
              <Text style={[s.emptyText, { color: colors.textMuted }]}>No loads found</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: spacing[6] }}
        />
      )}

      {selectedLoad && (
        <LoadDetailModal
          load={selectedLoad}
          onClose={() => setSelectedLoad(null)}
          colors={colors}
          isDark={isDark}
          favorites={favorites}
          toggleFav={toggleFav}
          drivers={drivers}
        />
      )}
    </SafeAreaView>
    </PageBackground>
  );
}

function LoadDetailModal({ load: l, onClose, colors, favorites, toggleFav, drivers }) {
  const s = makeStyles(colors);
  const currentStep = l.status === 'Booked' ? 1 : (l.status === 'Hot' || l.status === 'New') ? 0 : 2;
  const sc = statusColor(l.status, colors);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.modalContainer, { backgroundColor: colors.pageBg }]}>
        {/* Header */}
        <LinearGradient colors={['#4f46e5', '#6366f1']} style={s.modalHeaderGrad}>
          <View style={s.modalHeaderRow}>
            <View>
              <Text style={s.modalLoadId}>{l.id}</Text>
              <View style={[s.statusPill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={s.statusPillText}>{l.status}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing[3], alignItems: 'center' }}>
              <TouchableOpacity onPress={() => toggleFav(l.id)}>
                <Text style={{ fontSize: 24, color: favorites.has(l.id) ? '#fbbf24' : 'rgba(255,255,255,0.5)' }}>
                  {favorites.has(l.id) ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                <Text style={s.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={s.modalContent}>
          {/* Route */}
          <View style={[s.routeCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
            <View style={s.routePoint}>
              <View style={[s.routeDot, { backgroundColor: colors.success }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.routeCity, { color: colors.textPrimary }]}>{l.origin}</Text>
                <Text style={[s.routeDetail, { color: colors.textMuted }]}>{l.pickupDate} · {l.pickupWindow}</Text>
              </View>
            </View>
            <View style={s.routeConnector}>
              <View style={[s.routeLine, { backgroundColor: colors.border }]} />
              <View style={[s.routeMilesBadge, { backgroundColor: colors.accentMuted, borderColor: colors.accent + '44' }]}>
                <Text style={[s.routeMilesText, { color: colors.accent }]}>{l.miles} mi</Text>
              </View>
              <View style={[s.routeLine, { backgroundColor: colors.border }]} />
            </View>
            <View style={s.routePoint}>
              <View style={[s.routeDot, { backgroundColor: colors.danger }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.routeCity, { color: colors.textPrimary }]}>{l.destination}</Text>
                <Text style={[s.routeDetail, { color: colors.textMuted }]}>{l.deliveryDate} · {l.deliveryWindow}</Text>
              </View>
            </View>
          </View>

          {/* Stats Grid */}
          <View style={s.statsGrid}>
            {[
              { label: 'Rate',      value: `$${(l.rate || 0).toLocaleString()}`,     color: rateColor(l.rate, l.marketRate, colors) },
              { label: 'RPM',       value: `$${l.rpm || 0}/mi`,                      color: colors.textPrimary },
              { label: 'Weight',    value: l.weightLb ? `${l.weightLb.toLocaleString()} lbs` : 'N/A', color: colors.textPrimary },
              { label: 'DH Miles',  value: `${l.dhMiles || 0} mi`,                   color: colors.textPrimary },
              { label: 'Equipment', value: l.equipment || 'N/A',                     color: colors.textPrimary },
              { label: 'Calls',     value: l.calls || 0,                             color: (l.calls || 0) > 5 ? colors.danger : colors.textPrimary },
            ].map(stat => (
              <View key={stat.label} style={[s.statCell, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
                <Text style={[s.statValue2, { color: stat.color }]}>{stat.value}</Text>
                <Text style={[s.statLabel2, { color: colors.textMuted }]}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {l.notes && (
            <View style={[s.notesCard, { backgroundColor: colors.warningBg, borderColor: colors.warning + '44' }]}>
              <Text>📝</Text>
              <Text style={[s.notesText, { color: colors.textPrimary }]}>{l.notes}</Text>
            </View>
          )}

          {/* Lifecycle */}
          <View style={[s.sectionCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
            <Text style={[s.sectionLabel, { color: colors.textPrimary }]}>Load Lifecycle</Text>
            <View style={s.stepsRow}>
              {LIFECYCLE_STEPS.map((step, i) => (
                <View key={step} style={s.stepWrap}>
                  <View style={[s.stepDot, {
                    backgroundColor: i < currentStep ? colors.success : i === currentStep ? colors.accent : colors.surface2,
                    borderColor: i < currentStep ? colors.success : i === currentStep ? colors.accent : colors.border,
                  }]}>
                    {i < currentStep && <Text style={s.stepCheck}>✓</Text>}
                    {i === currentStep && <View style={[s.stepPulse, { backgroundColor: '#fff' }]} />}
                  </View>
                  <Text style={[s.stepLabel, { color: i <= currentStep ? colors.textSecondary : colors.textDisabled }]} numberOfLines={1}>{step}</Text>
                  {i < LIFECYCLE_STEPS.length - 1 && (
                    <View style={[s.stepLine, { backgroundColor: i < currentStep ? colors.success : colors.border }]} />
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Broker */}
          <View style={[s.sectionCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
            <Text style={[s.sectionLabel, { color: colors.textPrimary }]}>Broker</Text>
            <Text style={[s.brokerName, { color: colors.textPrimary }]}>{l.broker}</Text>
            <Text style={[s.brokerRef, { color: colors.textMuted }]}>Ref: {l.brokerRef}</Text>
            <View style={s.brokerActions}>
              <TouchableOpacity style={[s.brokerBtn, { backgroundColor: colors.successBg }]}>
                <Text style={[s.brokerBtnText, { color: colors.success }]}>📞 Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.brokerBtn, { backgroundColor: colors.accentMuted }]}>
                <Text style={[s.brokerBtnText, { color: colors.accent }]}>✉ Email</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Driver Recs */}
          <View style={[s.sectionCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
            <Text style={[s.sectionLabel, { color: colors.textPrimary }]}>Recommended Drivers</Text>
            {drivers.filter(d => d.status !== 'offline').slice(0, 3).map((d, i) => (
              <View key={d.id} style={[s.driverRecRow, { borderTopColor: colors.border }]}>
                <Text style={[s.driverRecRank, { color: colors.textDisabled }]}>#{i + 1}</Text>
                <View style={[s.driverRecAvatar, { backgroundColor: colors.accentMuted }]}>
                  <Text style={[{ color: colors.accent, fontSize: typography.xs, fontWeight: '700' }]}>{d.initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.driverRecName, { color: colors.textPrimary }]}>{d.name}</Text>
                  <Text style={[s.driverRecTruck, { color: colors.textMuted }]}>{d.truck}</Text>
                </View>
                {i === 0 && (
                  <View style={[s.bestBadge, { backgroundColor: colors.successBg }]}>
                    <Text style={[s.bestBadgeText, { color: colors.success }]}>Best</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Actions */}
          <View style={s.actionRow}>
            <TouchableOpacity style={s.bookBtnWrap}>
              <LinearGradient colors={['#6366f1', '#4f46e5']} style={s.bookBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={s.bookBtnText}>Book This Load</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { borderColor: colors.border, backgroundColor: colors.surface1 }]}>
              <Text style={[s.saveBtnText, { color: colors.textSecondary }]}>Save Load</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1 },
  statsScroll: { flexGrow: 0 },
  statsContent: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[2] },
  statChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg, borderWidth: 1.5, alignItems: 'center', minWidth: 84, ...shadow.card },
  statValue: { fontSize: typography.base, fontWeight: '800' },
  statLabel: { fontSize: 10, marginTop: 1 },
  controlRow: { flexDirection: 'row', paddingHorizontal: spacing[4], paddingBottom: spacing[3], gap: spacing[2] },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingHorizontal: spacing[3], borderWidth: 1, gap: spacing[2] },
  searchIcon: { fontSize: 13 },
  searchInput: { flex: 1, fontSize: typography.sm, paddingVertical: spacing[3] },
  filterBtn: { width: 44, height: 44, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  equipScroll: { flexGrow: 0 },
  equipContent: { paddingHorizontal: spacing[4], paddingBottom: spacing[3], gap: spacing[2] },
  equipChip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.pill, borderWidth: 1 },
  equipChipText: { fontSize: typography.xs, fontWeight: '600' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing[3] },
  loadingText: { fontSize: typography.sm },
  loadRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 1, gap: spacing[2] },
  star: { padding: 4 },
  loadTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginBottom: 3, flexWrap: 'wrap' },
  loadId: { fontSize: typography.sm, fontWeight: '700' },
  hotBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.xs },
  hotBadgeText: { fontSize: 9, fontWeight: '800' },
  loadRoute: { fontSize: typography.xs, marginBottom: 2 },
  loadEquip: { fontSize: typography.xs },
  loadRate: { fontSize: typography.base, fontWeight: '800' },
  loadRpm: { fontSize: typography.xs },
  loadAge: { fontSize: typography.xs },
  empty: { padding: spacing[10], alignItems: 'center' },
  emptyText: { fontSize: typography.base },
  // Modal
  modalContainer: { flex: 1 },
  modalHeaderGrad: { padding: spacing[5], paddingTop: spacing[8] },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalLoadId: { color: '#fff', fontSize: typography.xl, fontWeight: '800' },
  statusPill: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.pill, alignSelf: 'flex-start', marginTop: 5 },
  statusPillText: { color: '#fff', fontSize: typography.xs, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { color: '#fff', fontSize: typography.base, fontWeight: '700' },
  modalContent: { padding: spacing[4], gap: spacing[4] },
  routeCard: { borderRadius: radius.xl, padding: spacing[4], borderWidth: 1 },
  routePoint: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  routeDot: { width: 10, height: 10, borderRadius: 99, marginTop: 5 },
  routeCity: { fontSize: typography.base, fontWeight: '700' },
  routeDetail: { fontSize: typography.xs, marginTop: 2 },
  routeConnector: { flexDirection: 'row', alignItems: 'center', paddingLeft: 4, marginVertical: 4 },
  routeLine: { flex: 1, height: 1.5 },
  routeMilesBadge: { paddingHorizontal: spacing[3], paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, marginHorizontal: spacing[2] },
  routeMilesText: { fontSize: typography.xs, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  statCell: { width: '31%', flexGrow: 1, borderRadius: radius.lg, padding: spacing[3], borderWidth: 1, alignItems: 'center' },
  statValue2: { fontSize: typography.sm, fontWeight: '700' },
  statLabel2: { fontSize: 10, marginTop: 2 },
  notesCard: { flexDirection: 'row', gap: spacing[2], borderRadius: radius.lg, padding: spacing[3], borderWidth: 1 },
  notesText: { flex: 1, fontSize: typography.sm },
  sectionCard: { borderRadius: radius.xl, padding: spacing[4], borderWidth: 1 },
  sectionLabel: { fontSize: typography.sm, fontWeight: '700', marginBottom: spacing[3] },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stepWrap: { alignItems: 'center', flex: 1, position: 'relative' },
  stepDot: { width: 24, height: 24, borderRadius: 99, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  stepCheck: { color: '#fff', fontSize: 12, fontWeight: '800' },
  stepPulse: { width: 8, height: 8, borderRadius: 99 },
  stepLabel: { fontSize: 9, marginTop: 4, textAlign: 'center' },
  stepLine: { position: 'absolute', top: 11, left: '60%', right: '-60%', height: 2 },
  brokerName: { fontSize: typography.base, fontWeight: '700', marginTop: spacing[1] },
  brokerRef: { fontSize: typography.xs, marginTop: 2, marginBottom: spacing[3] },
  brokerActions: { flexDirection: 'row', gap: spacing[2] },
  brokerBtn: { flex: 1, borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  brokerBtnText: { fontSize: typography.sm, fontWeight: '600' },
  driverRecRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2], borderTopWidth: 1 },
  driverRecRank: { fontSize: typography.xs, fontWeight: '700', width: 20 },
  driverRecAvatar: { width: 34, height: 34, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center' },
  driverRecName: { fontSize: typography.sm, fontWeight: '600' },
  driverRecTruck: { fontSize: typography.xs },
  bestBadge: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.pill },
  bestBadgeText: { fontSize: 10, fontWeight: '700' },
  actionRow: { gap: spacing[3], paddingBottom: spacing[6] },
  bookBtnWrap: { borderRadius: radius.lg, overflow: 'hidden', ...shadow.glow },
  bookBtn: { paddingVertical: spacing[4], alignItems: 'center' },
  bookBtnText: { color: '#fff', fontSize: typography.base, fontWeight: '700' },
  saveBtn: { borderRadius: radius.lg, paddingVertical: spacing[4], alignItems: 'center', borderWidth: 1 },
  saveBtnText: { fontSize: typography.base, fontWeight: '600' },
});
