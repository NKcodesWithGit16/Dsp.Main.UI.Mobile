import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  Modal, ScrollView, RefreshControl, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../src/context/ThemeContext';
import { fetchLoads, fetchDrivers } from '../../src/api/main';
import { loadMatchScore, bestDriverForLoad } from '../../src/utils/loadMatch';

import PageHeader     from '../../src/components/shared/PageHeader';
import PageBackground from '../../src/components/shared/PageBackground';
import GlassCard      from '../../src/components/shared/GlassCard';
import StatusBadge    from '../../src/components/shared/StatusBadge';
import Avatar         from '../../src/components/shared/Avatar';
import AnimatedPressable from '../../src/components/shared/AnimatedPressable';
import Icon           from '../../src/components/shared/Icon';
import BrandButton    from '../../src/components/shared/BrandButton';
import HotBorder      from '../../src/components/shared/HotBorder';
import CachedImage    from '../../src/components/shared/CachedImage';
import { SkeletonBlock } from '../../src/components/shared/SkeletonShimmer';

import { spacing, typography, radius, glass, shadow, gradients, photos } from '../../src/theme/colors';

const EQUIPMENT_TYPES = ['All', '53FT Dry Van', 'Reefer', 'Flatbed', 'Power Only'];
const SORTS = [
  { key: 'newest',  label: 'Newest',   icon: 'clock'      },
  { key: 'rate',    label: 'Rate',     icon: 'dollar'     },
  { key: 'rpm',     label: 'RPM',      icon: 'chart'      },
  { key: 'miles',   label: 'Distance', icon: 'navigation' },
  { key: 'match',   label: 'Best match', icon: 'sparkles' },
];
const PAGE_SIZE = 20;
const LIFECYCLE_STEPS = ['Posted', 'Booked', 'Dispatched', 'In Transit', 'Delivered', 'POD'];

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function rateColor(rate, marketRate, colors) {
  if (!marketRate) return colors.textPrimary;
  if (rate > marketRate * 1.05) return colors.successText;
  if (rate < marketRate * 0.95) return colors.dangerText;
  return colors.textPrimary;
}

function getMatchTone(score) {
  if (score >= 80) return { color: '#059669', bg: 'rgba(16,185,129,0.16)', border: 'rgba(16,185,129,0.36)', label: 'Best' };
  if (score >= 60) return { color: '#0891b2', bg: 'rgba(6,182,212,0.16)', border: 'rgba(6,182,212,0.36)', label: 'Good' };
  if (score >= 40) return { color: '#b45309', bg: 'rgba(245,158,11,0.16)', border: 'rgba(245,158,11,0.36)', label: 'Fair' };
  return { color: '#94a3b8', bg: 'rgba(148,163,184,0.16)', border: 'rgba(148,163,184,0.32)', label: 'Low' };
}

export default function LoadboardScreen() {
  const { colors, isDark } = useTheme();
  const glassFill   = isDark ? glass.fillDarkStrong : glass.fillLightStrong;
  const glassBorder = isDark ? glass.borderDark : glass.borderLightSoft;

  const [allLoads, setAllLoads] = useState([]);
  const [drivers,  setDrivers]  = useState([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,    setSearch]    = useState('');
  const [equipFilter, setEquipFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [showSort,    setShowSort]    = useState(false);
  const [sortKey,     setSortKey]     = useState('newest');
  const [favorites, setFavorites] = useState(new Set());
  const [selectedLoad, setSelectedLoad] = useState(null);
  const [bookingLoad, setBookingLoad] = useState(null);
  const [page, setPage] = useState(1);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setApiLoading(true);
    try {
      const [loads, drvs] = await Promise.all([fetchLoads({ pageSize: 120 }), fetchDrivers()]);
      setAllLoads(loads ?? []);
      setDrivers(drvs ?? []);
    } catch {
      setAllLoads([]); setDrivers([]);
    } finally {
      setApiLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = useCallback(() => { setRefreshing(true); loadData(true); }, [loadData]);

  // Precompute best driver + match score for each load
  const loadsWithMatch = useMemo(() => {
    return allLoads.map(l => {
      const match = bestDriverForLoad(drivers, l);
      return { ...l, _bestMatch: match };
    });
  }, [allLoads, drivers]);

  const filtered = useMemo(() => {
    let loads = loadsWithMatch;
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
    // Sort
    const sorted = [...loads];
    switch (sortKey) {
      case 'rate':   sorted.sort((a, b) => (b.rate || 0) - (a.rate || 0)); break;
      case 'rpm':    sorted.sort((a, b) => (b.rpm || 0) - (a.rpm || 0)); break;
      case 'miles':  sorted.sort((a, b) => (a.miles || 0) - (b.miles || 0)); break;
      case 'match':  sorted.sort((a, b) => (b._bestMatch?.score || 0) - (a._bestMatch?.score || 0)); break;
      default:       sorted.sort((a, b) => new Date(b.postedAt || 0) - new Date(a.postedAt || 0));
    }
    // Hot loads first regardless of sort
    return sorted.sort((a, b) => {
      const aHot = a.status === 'Hot' ? 1 : 0;
      const bHot = b.status === 'Hot' ? 1 : 0;
      return bHot - aHot;
    });
  }, [loadsWithMatch, search, equipFilter, sortKey]);

  const paged = filtered.slice(0, page * PAGE_SIZE);

  const toggleFav = useCallback((id) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const stats = useMemo(() => ({
    active:  filtered.filter(l => l.status !== 'Booked').length,
    urgent:  filtered.filter(l => l.status === 'Hot').length,
    avgRate: filtered.length ? Math.round(filtered.reduce((s, l) => s + (l.rate || 0), 0) / filtered.length) : 0,
    avgRpm:  filtered.length ? (filtered.reduce((s, l) => s + (l.rpm || 0), 0) / filtered.length).toFixed(2) : '0.00',
  }), [filtered]);

  const s = makeStyles(colors);

  const renderLoad = useCallback(({ item: l }) => {
    const isHot = l.status === 'Hot';
    const match = l._bestMatch;
    const matchTone = match ? getMatchTone(match.score) : null;

    const cardInner = (
      <GlassCard
        accent={isHot}
        variant="strong"
        cornerRadius={isHot ? radius.lg - 1.5 : radius.lg}
        contentStyle={s.loadCard}
      >
        <View style={s.loadHead}>
          <AnimatedPressable
            onPress={() => toggleFav(l.id)}
            hapticStyle="light"
            pressedScale={0.85}
            containerStyle={{ marginRight: spacing[1] }}
          >
            <View style={s.starWrap}>
              <Icon
                name={favorites.has(l.id) ? 'star' : 'starOutline'}
                size={18}
                color={favorites.has(l.id) ? '#f59e0b' : colors.textDisabled}
              />
            </View>
          </AnimatedPressable>
          <Text style={[s.loadId, { color: colors.textPrimary }]}>{l.id}</Text>
          {isHot && <StatusBadge tone="hot" label="HOT" size="xs" />}
          {l.status === 'New' && <StatusBadge tone="new" label="NEW" size="xs" />}
          {l.status === 'Booked' && <StatusBadge tone="booked" label="BOOKED" size="xs" />}
          <View style={{ flex: 1 }} />
          <View style={s.agePill}>
            <Icon name="clock" size={10} color={colors.textDisabled} />
            <Text style={[s.loadAge, { color: colors.textDisabled }]}>{relativeTime(l.postedAt)}</Text>
          </View>
        </View>

        <View style={s.routeRow}>
          <View style={s.routePin}>
            <View style={[s.routeDot, { backgroundColor: '#10b981' }]} />
            <View style={[s.routeLine, { backgroundColor: colors.borderSubtle }]} />
            <View style={[s.routeDot, { backgroundColor: '#ef4444' }]} />
          </View>
          <View style={{ flex: 1, gap: spacing[1] }}>
            <Text style={[s.routeCity, { color: colors.textPrimary }]} numberOfLines={1}>{l.origin}</Text>
            <Text style={[s.routeCity, { color: colors.textPrimary }]} numberOfLines={1}>{l.destination}</Text>
          </View>
        </View>

        {/* Match score badge */}
        {match && l.status !== 'Booked' ? (
          <View style={[s.matchPill, { backgroundColor: matchTone.bg, borderColor: matchTone.border }]}>
            <Icon name="sparkles" size={11} color={matchTone.color} />
            <Text style={[s.matchText, { color: matchTone.color }]} numberOfLines={1}>
              {matchTone.label} for {match.driver.name} · {match.score}%
            </Text>
          </View>
        ) : null}

        <View style={s.metaRow}>
          <View style={s.metaPill}>
            <Icon name="truck" size={11} color={colors.textMuted} />
            <Text style={[s.metaText, { color: colors.textMuted }]}>{l.equipment}</Text>
          </View>
          <View style={s.metaPill}>
            <Icon name="navigation" size={11} color={colors.textMuted} />
            <Text style={[s.metaText, { color: colors.textMuted }]}>{l.miles ?? '—'} mi</Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.rate, { color: rateColor(l.rate, l.marketRate, colors) }]}>
              ${(l.rate || 0).toLocaleString()}
            </Text>
            <Text style={[s.rpm, { color: colors.textMuted }]}>${l.rpm}/mi</Text>
          </View>
        </View>
      </GlassCard>
    );

    return (
      <AnimatedPressable
        onPress={() => setSelectedLoad(l)}
        pressedScale={0.985}
        hapticStyle="selection"
      >
        <View style={s.loadCardWrap}>
          {isHot ? (
            <HotBorder borderRadius={radius.lg}>
              {cardInner}
            </HotBorder>
          ) : (
            cardInner
          )}
        </View>
      </AnimatedPressable>
    );
  }, [favorites, colors]);

  return (
    <PageBackground>
      <SafeAreaView style={s.safe} edges={['left', 'right']}>
        <PageHeader title="Loadboard" subtitle={apiLoading ? '…' : `${filtered.length} loads`} />

        {/* Stats strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.statsScroll}
          contentContainerStyle={s.statsContent}
        >
          {[
            { label: 'Active',   value: stats.active, color: '#0193ab', icon: 'box' },
            { label: 'Avg rate', value: '$' + stats.avgRate.toLocaleString(), color: '#10b981', icon: 'dollar' },
            { label: 'Avg RPM',  value: '$' + stats.avgRpm, color: '#06b6d4', icon: 'chart' },
            { label: 'Urgent',   value: stats.urgent, color: '#ef4444', icon: 'flame' },
          ].map(chip => (
            <View key={chip.label} style={[s.statChip, { borderColor: chip.color + '33', backgroundColor: chip.color + '0d' }]}>
              <View style={[s.statIcon, { backgroundColor: chip.color + '22' }]}>
                <Icon name={chip.icon} size={13} color={chip.color} />
              </View>
              <Text style={[s.statValue, { color: chip.color }]}>{chip.value}</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>{chip.label.toUpperCase()}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Search + filter + sort */}
        <View style={s.controlRow}>
          <View style={[s.searchWrap, { backgroundColor: glassFill, borderColor: glassBorder }]}>
            <Icon name="search" size={15} color={colors.textDisabled} />
            <TextInput
              style={[s.searchInput, { color: colors.textPrimary }]}
              placeholder="Search by city, broker, ID…"
              placeholderTextColor={colors.textDisabled}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <AnimatedPressable onPress={() => setSearch('')} hapticStyle="light" pressedScale={0.85}>
                <Icon name="close" size={14} color={colors.textMuted} />
              </AnimatedPressable>
            )}
          </View>
          <AnimatedPressable
            onPress={() => { setShowSort(v => !v); setShowFilters(false); }}
            hapticStyle="selection"
            pressedScale={0.94}
          >
            <View style={[
              s.filterBtn,
              {
                backgroundColor: showSort ? colors.accentMuted : glassFill,
                borderColor: showSort ? colors.accent : glassBorder,
              },
            ]}>
              <Icon name="filter" size={17} color={showSort ? colors.accent : colors.textMuted} />
            </View>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => { setShowFilters(v => !v); setShowSort(false); }}
            hapticStyle="selection"
            pressedScale={0.94}
          >
            <View style={[
              s.filterBtn,
              {
                backgroundColor: showFilters ? colors.accentMuted : glassFill,
                borderColor: showFilters ? colors.accent : glassBorder,
              },
            ]}>
              <Icon name="options" size={17} color={showFilters ? colors.accent : colors.textMuted} />
            </View>
          </AnimatedPressable>
        </View>

        {showSort && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.equipScroll}
            contentContainerStyle={s.equipContent}
          >
            {SORTS.map(opt => {
              const active = sortKey === opt.key;
              return (
                <AnimatedPressable
                  key={opt.key}
                  onPress={() => { setSortKey(opt.key); setShowSort(false); }}
                  hapticStyle="selection"
                  pressedScale={0.95}
                >
                  <View style={[s.equipChip, {
                    backgroundColor: active ? colors.accentMuted : glassFill,
                    borderColor: active ? colors.accent : glassBorder,
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                  }]}>
                    <Icon name={opt.icon} size={12} color={active ? colors.accent : colors.textMuted} />
                    <Text style={[s.equipChipText, { color: active ? colors.accent : colors.textMuted }]}>
                      {opt.label}
                    </Text>
                  </View>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        )}

        {showFilters && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.equipScroll}
            contentContainerStyle={s.equipContent}
          >
            {EQUIPMENT_TYPES.map(e => (
              <AnimatedPressable
                key={e}
                onPress={() => setEquipFilter(e)}
                hapticStyle="selection"
                pressedScale={0.95}
              >
                <View style={[s.equipChip, {
                  backgroundColor: equipFilter === e ? colors.accentMuted : glassFill,
                  borderColor: equipFilter === e ? colors.accent : glassBorder,
                }]}>
                  <Text style={[s.equipChipText, { color: equipFilter === e ? colors.accent : colors.textMuted }]}>
                    {e}
                  </Text>
                </View>
              </AnimatedPressable>
            ))}
          </ScrollView>
        )}

        {apiLoading ? (
          <View style={{ padding: spacing[4], gap: spacing[3] }}>
            {[0, 1, 2, 3, 4].map(i => (
              <SkeletonBlock key={i} width="100%" height={140} borderRadius={radius.lg} />
            ))}
          </View>
        ) : (
          <FlatList
            data={paged}
            keyExtractor={i => String(i.id)}
            renderItem={renderLoad}
            onEndReached={() => setPage(p => p + 1)}
            onEndReachedThreshold={0.3}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
            contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: spacing[8], gap: spacing[3], paddingTop: spacing[2] }}
            ListFooterComponent={
              paged.length < filtered.length
                ? <SkeletonBlock width="100%" height={80} borderRadius={radius.lg} style={{ margin: spacing[2] }} />
                : <View style={{ height: spacing[6] }} />
            }
            ListEmptyComponent={<EmptyLoads colors={colors} />}
            removeClippedSubviews
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={9}
            updateCellsBatchingPeriod={50}
          />
        )}

        {selectedLoad && (
          <LoadDetailModal
            load={selectedLoad}
            onClose={() => setSelectedLoad(null)}
            onBook={() => { setBookingLoad(selectedLoad); setSelectedLoad(null); }}
            colors={colors}
            isDark={isDark}
            favorites={favorites}
            toggleFav={toggleFav}
            drivers={drivers}
          />
        )}

        {bookingLoad && (
          <BookingSheet
            load={bookingLoad}
            drivers={drivers}
            onClose={() => setBookingLoad(null)}
            onBooked={() => {
              setAllLoads(prev => prev.map(l =>
                l.id === bookingLoad.id ? { ...l, status: 'Booked' } : l,
              ));
              setBookingLoad(null);
            }}
            colors={colors}
            isDark={isDark}
          />
        )}
      </SafeAreaView>
    </PageBackground>
  );
}

// ────────────────────────────────────────────────────────────
//  Empty state
// ────────────────────────────────────────────────────────────
function EmptyLoads({ colors }) {
  return (
    <View style={{ paddingTop: spacing[8], alignItems: 'center' }}>
      <View style={{
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: 'rgba(1,147,171,0.12)',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="box" size={42} color="#0193ab" />
      </View>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: spacing[3] }}>
        No loads found
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: spacing[6] }}>
        Adjust your filters or pull to refresh
      </Text>
    </View>
  );
}

// ────────────────────────────────────────────────────────────
//  Booking sheet (replaces the dead "Book this load" button)
// ────────────────────────────────────────────────────────────
function BookingSheet({ load, drivers, onClose, onBooked, colors, isDark }) {
  const [step, setStep] = useState(1); // 1: pick driver, 2: confirm, 3: success
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const eligible = useMemo(() => {
    return drivers
      .filter(d => {
        const st = typeof d.status === 'number'
          ? ['moving', 'idle', 'offline'][d.status]
          : (d.status || '').toLowerCase();
        return st !== 'offline';
      })
      .map(d => ({ ...d, _match: loadMatchScore(d, load) }))
      .sort((a, b) => b._match - a._match);
  }, [drivers, load]);

  const confirm = async () => {
    setSubmitting(true);
    // Simulate dispatch — real impl would POST to /loads/{id}/book
    await new Promise(r => setTimeout(r, 700));
    setSubmitting(false);
    setStep(3);
    setTimeout(() => onBooked(), 1100);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={bookS.header}
        >
          <SafeAreaView edges={['top']} style={{ width: '100%' }}>
            <View style={bookS.headerInner}>
              <AnimatedPressable onPress={onClose} hapticStyle="light" pressedScale={0.9}>
                <View style={bookS.iconBtn}>
                  <Icon name="close" size={18} color="#fff" />
                </View>
              </AnimatedPressable>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={bookS.headerEyebrow}>BOOK LOAD</Text>
                <Text style={bookS.headerId}>{load.id}</Text>
              </View>
              <View style={{ width: 36 }} />
            </View>
            <View style={bookS.steps}>
              {[1, 2, 3].map(i => (
                <View key={i} style={[bookS.stepDot, { backgroundColor: i <= step ? '#fff' : 'rgba(255,255,255,0.35)' }]} />
              ))}
            </View>
          </SafeAreaView>
        </LinearGradient>

        {step === 1 && (
          <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[3] }}>
            <Text style={[bookS.section, { color: colors.textPrimary }]}>Assign driver</Text>
            <Text style={[bookS.helper, { color: colors.textMuted }]}>
              Ranked by equipment match, availability, and proximity.
            </Text>
            {eligible.length === 0 ? (
              <Text style={{ color: colors.textMuted, padding: spacing[4], textAlign: 'center' }}>
                No available drivers. Free one up or invite a new one.
              </Text>
            ) : eligible.map(d => {
              const tone = getMatchTone(d._match);
              const isSel = selectedDriver?.id === d.id;
              return (
                <AnimatedPressable
                  key={d.id}
                  onPress={() => setSelectedDriver(d)}
                  hapticStyle="selection"
                  pressedScale={0.985}
                >
                  <View style={[
                    bookS.driverRow,
                    {
                      backgroundColor: isSel ? colors.accentMuted : colors.surface2,
                      borderColor: isSel ? colors.accent : colors.borderSubtle,
                    },
                  ]}>
                    <Avatar name={d.name} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={[bookS.driverName, { color: colors.textPrimary }]}>{d.name}</Text>
                      <Text style={[bookS.driverMeta, { color: colors.textMuted }]} numberOfLines={1}>
                        {d.equipment || 'Unknown equipment'} · {d.truck || '—'}
                      </Text>
                    </View>
                    <View style={[bookS.matchPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                      <Text style={[bookS.matchPillText, { color: tone.color }]}>{d._match}%</Text>
                    </View>
                  </View>
                </AnimatedPressable>
              );
            })}
            <View style={{ marginTop: spacing[4] }}>
              <BrandButton
                label="Continue"
                icon="arrow"
                iconRight
                size="lg"
                full
                disabled={!selectedDriver}
                onPress={() => setStep(2)}
              />
            </View>
          </ScrollView>
        )}

        {step === 2 && (
          <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[3] }}>
            <Text style={[bookS.section, { color: colors.textPrimary }]}>Confirm booking</Text>
            <GlassCard variant="strong" accent>
              <View style={bookS.confirmRow}>
                <Text style={[bookS.confirmLabel, { color: colors.textMuted }]}>Driver</Text>
                <Text style={[bookS.confirmValue, { color: colors.textPrimary }]}>{selectedDriver?.name}</Text>
              </View>
              <View style={bookS.confirmRow}>
                <Text style={[bookS.confirmLabel, { color: colors.textMuted }]}>Route</Text>
                <Text style={[bookS.confirmValue, { color: colors.textPrimary }]} numberOfLines={1}>
                  {load.origin} → {load.destination}
                </Text>
              </View>
              <View style={bookS.confirmRow}>
                <Text style={[bookS.confirmLabel, { color: colors.textMuted }]}>Rate</Text>
                <Text style={[bookS.confirmValue, { color: '#059669' }]}>${(load.rate || 0).toLocaleString()}</Text>
              </View>
              <View style={bookS.confirmRow}>
                <Text style={[bookS.confirmLabel, { color: colors.textMuted }]}>Equipment</Text>
                <Text style={[bookS.confirmValue, { color: colors.textPrimary }]}>{load.equipment}</Text>
              </View>
              <View style={bookS.confirmRow}>
                <Text style={[bookS.confirmLabel, { color: colors.textMuted }]}>Pickup</Text>
                <Text style={[bookS.confirmValue, { color: colors.textPrimary }]}>
                  {load.pickupDate} · {load.pickupWindow}
                </Text>
              </View>
            </GlassCard>

            <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] }}>
              <AnimatedPressable onPress={() => setStep(1)} hapticStyle="light" pressedScale={0.97}>
                <View style={[bookS.backBtn, { borderColor: colors.border }]}>
                  <Text style={[bookS.backBtnText, { color: colors.textMuted }]}>Back</Text>
                </View>
              </AnimatedPressable>
              <View style={{ flex: 1 }}>
                <BrandButton
                  label={submitting ? 'Sending rate con…' : 'Send rate con & book'}
                  icon="checkmark"
                  size="lg"
                  full
                  loading={submitting}
                  onPress={confirm}
                />
              </View>
            </View>
          </ScrollView>
        )}

        {step === 3 && (
          <View style={bookS.success}>
            <LinearGradient
              colors={['#10b981', '#059669']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[bookS.successIcon, shadow.glow]}
            >
              <Icon name="checkmark" size={42} color="#fff" />
            </LinearGradient>
            <Text style={[bookS.successTitle, { color: colors.textPrimary }]}>Load booked</Text>
            <Text style={[bookS.successSub, { color: colors.textMuted }]}>
              {selectedDriver?.name} dispatched · rate confirmation sent
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const bookS = StyleSheet.create({
  header: { paddingBottom: spacing[3] },
  headerInner: { flexDirection: 'row', alignItems: 'center', padding: spacing[3], gap: spacing[2] },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerEyebrow: { color: 'rgba(255,255,255,0.62)', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  headerId:      { color: '#fff', fontSize: typography.lg, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 },
  steps: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 6 },
  stepDot: { width: 24, height: 4, borderRadius: 2 },

  section: { fontSize: typography.lg, fontWeight: '800', letterSpacing: -0.3 },
  helper:  { fontSize: typography.sm, marginTop: -spacing[1] },

  driverRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[3], borderRadius: radius.lg, borderWidth: 1.5,
  },
  driverName: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  driverMeta: { fontSize: 11.5, marginTop: 2 },
  matchPill: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1,
  },
  matchPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },

  confirmRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: spacing[2], gap: spacing[3],
  },
  confirmLabel: { fontSize: typography.sm, fontWeight: '600' },
  confirmValue: { fontSize: typography.sm, fontWeight: '800', maxWidth: '60%', textAlign: 'right' },

  backBtn: {
    paddingHorizontal: spacing[5], paddingVertical: 14,
    borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center',
  },
  backBtnText: { fontSize: typography.sm, fontWeight: '700' },

  success: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[5], gap: spacing[3] },
  successIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: typography['2xl'], fontWeight: '800', letterSpacing: -0.5, marginTop: spacing[2] },
  successSub: { fontSize: typography.sm, textAlign: 'center' },
});

// ────────────────────────────────────────────────────────────
//  Load detail modal
// ────────────────────────────────────────────────────────────
function LoadDetailModal({ load: l, onClose, onBook, colors, isDark, favorites, toggleFav, drivers }) {
  const s = makeStyles(colors);
  const currentStep = l.status === 'Booked' ? 1 : (l.status === 'Hot' || l.status === 'New') ? 0 : 2;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.modalContainer, { backgroundColor: colors.pageBg }]}>
        {/* Hero header with brand gradient + photo */}
        <View style={{ height: 200 }}>
          <CachedImage source={{ uri: photos.heroDispatcher }} style={StyleSheet.absoluteFill} priority="high" />
          <LinearGradient
            colors={['rgba(4,40,90,0.92)', 'rgba(1,55,72,0.78)', 'rgba(1,147,171,0.62)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView edges={['top']} style={{ flex: 1, padding: spacing[5] }}>
            <View style={s.modalHeaderRow}>
              <View>
                <Text style={s.modalEyebrow}>LOAD</Text>
                <Text style={s.modalLoadId}>{l.id}</Text>
                <View style={{ marginTop: 6 }}>
                  <StatusBadge tone={(l.status || '').toLowerCase()} label={l.status} size="md" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                <AnimatedPressable onPress={() => toggleFav(l.id)} hapticStyle="light" pressedScale={0.9}>
                  <View style={s.iconBtnDark}>
                    <Icon name={favorites.has(l.id) ? 'star' : 'starOutline'} size={18} color={favorites.has(l.id) ? '#fbbf24' : '#fff'} />
                  </View>
                </AnimatedPressable>
                <AnimatedPressable onPress={onClose} hapticStyle="light" pressedScale={0.9}>
                  <View style={s.iconBtnDark}>
                    <Icon name="close" size={18} color="#fff" />
                  </View>
                </AnimatedPressable>
              </View>
            </View>
          </SafeAreaView>
        </View>

        <ScrollView contentContainerStyle={s.modalContent}>
          {/* Route card */}
          <GlassCard variant="strong" accent>
            <View style={s.routePoint}>
              <View style={[s.routeDotLg, { backgroundColor: '#10b981' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.routeCityLg, { color: colors.textPrimary }]}>{l.origin}</Text>
                <Text style={[s.routeDetail, { color: colors.textMuted }]}>{l.pickupDate} · {l.pickupWindow}</Text>
              </View>
            </View>
            <View style={s.routeConnector}>
              <View style={[s.routeConnLine, { backgroundColor: colors.border }]} />
              <View style={[s.routeMilesBadge, { backgroundColor: colors.accentMuted, borderColor: 'rgba(1,147,171,0.34)' }]}>
                <Icon name="navigation" size={11} color={colors.accent} />
                <Text style={[s.routeMilesText, { color: colors.accent }]}>{l.miles} mi</Text>
              </View>
              <View style={[s.routeConnLine, { backgroundColor: colors.border }]} />
            </View>
            <View style={s.routePoint}>
              <View style={[s.routeDotLg, { backgroundColor: '#ef4444' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.routeCityLg, { color: colors.textPrimary }]}>{l.destination}</Text>
                <Text style={[s.routeDetail, { color: colors.textMuted }]}>{l.deliveryDate} · {l.deliveryWindow}</Text>
              </View>
            </View>
          </GlassCard>

          {/* Stats grid */}
          <View style={s.statsGrid}>
            {[
              { label: 'Rate',      value: `$${(l.rate || 0).toLocaleString()}`,                  color: rateColor(l.rate, l.marketRate, colors), icon: 'dollar' },
              { label: 'RPM',       value: `$${l.rpm || 0}/mi`,                                   color: colors.textPrimary, icon: 'chart' },
              { label: 'Weight',    value: l.weightLb ? `${l.weightLb.toLocaleString()} lbs` : 'N/A', color: colors.textPrimary, icon: 'box' },
              { label: 'DH miles',  value: `${l.dhMiles || 0} mi`,                                color: colors.textPrimary, icon: 'navigation' },
              { label: 'Equipment', value: l.equipment || 'N/A',                                  color: colors.textPrimary, icon: 'truck' },
              { label: 'Calls',     value: l.calls || 0,                                          color: (l.calls || 0) > 5 ? '#dc2626' : colors.textPrimary, icon: 'phone' },
            ].map(stat => (
              <GlassCard key={stat.label} variant="default" contentStyle={s.statCell} cornerRadius={radius.md}>
                <Icon name={stat.icon} size={14} color={colors.textMuted} />
                <Text style={[s.statValue2, { color: stat.color }]}>{stat.value}</Text>
                <Text style={[s.statLabel2, { color: colors.textMuted }]}>{stat.label}</Text>
              </GlassCard>
            ))}
          </View>

          {l.notes ? (
            <View style={[s.notesCard, { backgroundColor: colors.warningBg, borderColor: 'rgba(245,158,11,0.32)' }]}>
              <Icon name="info" size={16} color={colors.warningText} />
              <Text style={[s.notesText, { color: colors.textPrimary }]}>{l.notes}</Text>
            </View>
          ) : null}

          {/* Lifecycle */}
          <GlassCard variant="strong">
            <Text style={[s.sectionLabel, { color: colors.textPrimary }]}>Load lifecycle</Text>
            <View style={s.stepsRow}>
              {LIFECYCLE_STEPS.map((step, i) => (
                <View key={step} style={s.stepWrap}>
                  <View style={[s.stepDot, {
                    backgroundColor: i < currentStep ? '#10b981'
                      : i === currentStep ? colors.accent
                      : colors.surface2,
                    borderColor: i < currentStep ? '#10b981'
                      : i === currentStep ? colors.accent
                      : colors.border,
                  }]}>
                    {i < currentStep && <Icon name="checkmark" size={10} color="#fff" />}
                    {i === currentStep && <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: '#fff' }} />}
                  </View>
                  <Text
                    style={[s.stepLabel, { color: i <= currentStep ? colors.textSecondary : colors.textDisabled }]}
                    numberOfLines={1}
                  >
                    {step}
                  </Text>
                  {i < LIFECYCLE_STEPS.length - 1 && (
                    <View style={[s.stepLine, { backgroundColor: i < currentStep ? '#10b981' : colors.border }]} />
                  )}
                </View>
              ))}
            </View>
          </GlassCard>

          {/* Broker */}
          <GlassCard variant="strong">
            <Text style={[s.sectionLabel, { color: colors.textPrimary }]}>Broker</Text>
            <Text style={[s.brokerName, { color: colors.textPrimary }]}>{l.broker}</Text>
            <Text style={[s.brokerRef, { color: colors.textMuted }]}>Ref: {l.brokerRef}</Text>
            <View style={s.brokerActions}>
              <AnimatedPressable hapticStyle="light">
                <View style={[s.brokerBtn, { backgroundColor: colors.successBg }]}>
                  <Icon name="phone" size={14} color={colors.successText} />
                  <Text style={[s.brokerBtnText, { color: colors.successText }]}>Call</Text>
                </View>
              </AnimatedPressable>
              <AnimatedPressable hapticStyle="light">
                <View style={[s.brokerBtn, { backgroundColor: colors.accentMuted }]}>
                  <Icon name="mail" size={14} color={colors.accent} />
                  <Text style={[s.brokerBtnText, { color: colors.accent }]}>Email</Text>
                </View>
              </AnimatedPressable>
            </View>
          </GlassCard>

          {/* Driver recs */}
          {drivers.filter(d => d.status !== 'offline').length > 0 && (
            <GlassCard variant="strong">
              <Text style={[s.sectionLabel, { color: colors.textPrimary }]}>Recommended drivers</Text>
              {drivers
                .filter(d => d.status !== 'offline')
                .map(d => ({ ...d, _m: loadMatchScore(d, l) }))
                .sort((a, b) => b._m - a._m)
                .slice(0, 3)
                .map((d, i) => {
                  const tone = getMatchTone(d._m);
                  return (
                    <View key={d.id} style={[s.driverRecRow, { borderTopColor: colors.borderSubtle, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth }]}>
                      <Text style={[s.driverRecRank, { color: colors.textDisabled }]}>#{i + 1}</Text>
                      <Avatar name={d.name} size={32} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.driverRecName, { color: colors.textPrimary }]}>{d.name}</Text>
                        <Text style={[s.driverRecTruck, { color: colors.textMuted }]}>{d.truck}</Text>
                      </View>
                      <View style={[bookS.matchPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                        <Text style={[bookS.matchPillText, { color: tone.color }]}>{d._m}%</Text>
                      </View>
                    </View>
                  );
                })}
            </GlassCard>
          )}

          {/* Actions */}
          <View style={s.actionRow}>
            <BrandButton
              label={l.status === 'Booked' ? 'Already booked' : 'Book this load'}
              full
              size="lg"
              icon="checkmark"
              disabled={l.status === 'Booked'}
              onPress={onBook}
            />
            <BrandButton label="Save load" variant="secondary" full onPress={() => Alert.alert('Saved', 'Load added to favorites.')} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────
//  Styles
// ────────────────────────────────────────────────────────────
const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  statsScroll: { flexGrow: 0 },
  statsContent: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[2] },
  statChip: {
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: radius.lg, borderWidth: 1.5,
    minWidth: 96, alignItems: 'center',
    ...shadow.card,
  },
  statIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontSize: typography.base, fontWeight: '800', letterSpacing: -0.3 },
  statLabel: { fontSize: 9, marginTop: 2, letterSpacing: 0.6, fontWeight: '700' },

  controlRow: { flexDirection: 'row', paddingHorizontal: spacing[4], paddingBottom: spacing[3], gap: spacing[2] },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.md, paddingHorizontal: spacing[3], borderWidth: 1, gap: spacing[2],
  },
  searchInput: { flex: 1, fontSize: typography.sm, paddingVertical: spacing[3], fontWeight: '500' },
  filterBtn: { width: 44, height: 44, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },

  equipScroll: { flexGrow: 0 },
  equipContent: { paddingHorizontal: spacing[4], paddingBottom: spacing[3], gap: spacing[2] },
  equipChip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.pill, borderWidth: 1 },
  equipChipText: { fontSize: typography.xs, fontWeight: '700', letterSpacing: 0.2 },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing[3] },
  loadingText: { fontSize: typography.sm },

  // Load card
  loadCardWrap: {},
  loadCard: { padding: spacing[3], gap: spacing[3] },
  loadHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  starWrap: { padding: 2 },
  loadId:   { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  agePill: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  loadAge:  { fontSize: 11, fontWeight: '500' },

  routeRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing[3] },
  routePin: { width: 16, alignItems: 'center', paddingTop: 4, paddingBottom: 4 },
  routeDot: { width: 9, height: 9, borderRadius: 99 },
  routeLine: { flex: 1, width: 1.5, marginVertical: 4 },
  routeCity: { fontSize: 13.5, fontWeight: '700', letterSpacing: -0.1 },

  matchPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start',
  },
  matchText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.1 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11.5, fontWeight: '600' },
  rate:    { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  rpm:     { fontSize: 11, fontWeight: '500' },

  // Modal
  modalContainer: { flex: 1 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalEyebrow:   { color: 'rgba(255,255,255,0.62)', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  modalLoadId:    { color: '#fff', fontSize: typography['2xl'], fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  iconBtnDark: {
    width: 36, height: 36, borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  modalContent: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[10] },

  routePoint: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  routeDotLg: { width: 12, height: 12, borderRadius: 99, marginTop: 5 },
  routeCityLg: { fontSize: typography.base, fontWeight: '800', letterSpacing: -0.3 },
  routeDetail: { fontSize: typography.xs, marginTop: 2 },
  routeConnector: { flexDirection: 'row', alignItems: 'center', paddingLeft: 4, marginVertical: spacing[2] },
  routeConnLine: { flex: 1, height: 1 },
  routeMilesBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing[3], paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, marginHorizontal: spacing[2] },
  routeMilesText: { fontSize: 11, fontWeight: '700' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  statCell: { width: '31%', flexGrow: 1, padding: spacing[3], alignItems: 'center', gap: 4 },
  statValue2: { fontSize: 13.5, fontWeight: '800', marginTop: 2 },
  statLabel2: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },

  notesCard: { flexDirection: 'row', gap: spacing[2], borderRadius: radius.lg, padding: spacing[3], borderWidth: 1, alignItems: 'flex-start' },
  notesText: { flex: 1, fontSize: typography.sm, fontWeight: '500' },

  sectionLabel: { fontSize: typography.sm, fontWeight: '800', marginBottom: spacing[3], letterSpacing: 0.2 },

  stepsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stepWrap: { alignItems: 'center', flex: 1, position: 'relative' },
  stepDot: { width: 24, height: 24, borderRadius: 99, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  stepLabel: { fontSize: 9, marginTop: 4, textAlign: 'center', fontWeight: '600' },
  stepLine: { position: 'absolute', top: 11, left: '60%', right: '-60%', height: 2 },

  brokerName: { fontSize: typography.base, fontWeight: '800', marginTop: spacing[1] },
  brokerRef:  { fontSize: typography.xs, marginTop: 2, marginBottom: spacing[3] },
  brokerActions: { flexDirection: 'row', gap: spacing[2] },
  brokerBtn: { flex: 1, borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  brokerBtnText: { fontSize: typography.sm, fontWeight: '700' },

  driverRecRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] },
  driverRecRank: { fontSize: typography.xs, fontWeight: '800', width: 20 },
  driverRecName:  { fontSize: typography.sm, fontWeight: '700' },
  driverRecTruck: { fontSize: typography.xs },

  actionRow: { gap: spacing[3], paddingBottom: spacing[6] },
});
