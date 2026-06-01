import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal,
  ActivityIndicator, RefreshControl, Alert, KeyboardAvoidingView,
  Platform, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import {
  fetchBrokerLoads, postLoad, deleteLoad,
  fetchBrokerInquiries, fetchInquiryThread, sendBrokerMessage,
} from '../../src/api/main';
import {
  spacing, typography, radius, gradients, glass, shadow,
} from '../../src/theme/colors';
import GlassCard from '../../src/components/shared/GlassCard';
import GradientHeader from '../../src/components/shared/GradientHeader';
import Icon from '../../src/components/shared/Icon';
import LiveDot from '../../src/components/shared/LiveDot';
import BrandLogo from '../../src/components/shared/BrandLogo';
import BrandButton from '../../src/components/shared/BrandButton';
import AnimatedPressable from '../../src/components/shared/AnimatedPressable';

const EQUIPMENT_OPTIONS = ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'RGN', 'Tanker', 'Power Only'];

const STATUS_HEX = {
  available: '#10b981',
  assigned:  '#0193ab',
  delivered: '#06b6d4',
  cancelled: '#ef4444',
};

/* ── helpers ──────────────────────────────────────────────── */
const rpm = (rate, miles) => (!miles ? 0 : (rate / miles).toFixed(2));

function fmtTime(ts) {
  const d = new Date(ts);
  const diff = Date.now() - d;
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

/* ════════════════════════════════════════════════════════════
   KPI CARD
   ════════════════════════════════════════════════════════════ */
function KpiCard({ label, value, sub, color, icon }) {
  const { colors } = useTheme();
  return (
    <GlassCard accent style={{ flex: 1, margin: spacing[1] }} contentStyle={{ padding: spacing[4], gap: 4 }}>
      <View style={kpiS.row}>
        <LinearGradient
          colors={[color + 'cc', color + '88']}
          style={kpiS.iconWrap}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <Icon name={icon} size={18} color="#fff" />
        </LinearGradient>
        <View style={[kpiS.accentBar, { backgroundColor: color }]} />
      </View>
      <Text style={[kpiS.value, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[kpiS.label, { color: colors.textMuted }]}>{label}</Text>
      {sub ? <Text style={[kpiS.sub, { color }]}>{sub}</Text> : null}
    </GlassCard>
  );
}

const kpiS = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] },
  iconWrap: {
    width: 38, height: 38, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 4,
  },
  accentBar: { width: 22, height: 3, borderRadius: 2, opacity: 0.55 },
  value: { fontSize: typography.xl, fontWeight: '800', letterSpacing: -0.6 },
  label: { fontSize: typography.xs, fontWeight: '600', marginTop: 1 },
  sub: { fontSize: 11, marginTop: 3, fontWeight: '700' },
});

/* ════════════════════════════════════════════════════════════
   LOAD CARD
   ════════════════════════════════════════════════════════════ */
function LoadCard({ load, onDelete }) {
  const { colors, isDark } = useTheme();
  const rpmVal = rpm(load.rate, load.miles);
  const statusColor = STATUS_HEX[load.status] ?? colors.textMuted;

  const chips = [
    { val: '$' + (load.rate ?? 0).toLocaleString(), color: '#10b981' },
    { val: '$' + rpmVal + '/mi',                     color: '#f59e0b' },
    { val: (load.miles ?? 0) + ' mi',                color: '#06b6d4' },
    { val: load.equipment,                           color: '#5dd0e3' },
  ];

  return (
    <GlassCard
      accent
      cornerRadius={radius.lg}
      style={{ marginBottom: spacing[3] }}
      contentStyle={{ padding: spacing[4], gap: spacing[3] }}
    >
      {/* Header */}
      <View style={loadCardS.head}>
        <View style={{ flex: 1 }}>
          <View style={loadCardS.routeRow}>
            <View style={[loadCardS.routeDot, { backgroundColor: '#10b981' }]} />
            <Text style={[loadCardS.city, { color: colors.textPrimary }]} numberOfLines={1}>{load.origin}</Text>
          </View>
          <View style={[loadCardS.routeRail, { backgroundColor: colors.border }]} />
          <View style={loadCardS.routeRow}>
            <View style={[loadCardS.routeDot, { backgroundColor: '#ef4444' }]} />
            <Text style={[loadCardS.city, { color: colors.textPrimary }]} numberOfLines={1}>{load.destination}</Text>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', gap: spacing[1] }}>
          <View style={[loadCardS.statusPill, {
            backgroundColor: statusColor + (isDark ? '33' : '22'),
            borderColor: statusColor + '55',
          }]}>
            <View style={[loadCardS.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[loadCardS.statusText, { color: statusColor }]}>{load.status}</Text>
          </View>
          {load.inquiryCount > 0 && (
            <View style={[loadCardS.inquiryPill, { backgroundColor: 'rgba(1,147,171,0.18)', borderColor: 'rgba(1,147,171,0.4)' }]}>
              <Text style={[loadCardS.inquiryText, { color: colors.accent }]}>{load.inquiryCount} inquiries</Text>
            </View>
          )}
        </View>
      </View>

      {/* Chips */}
      <View style={loadCardS.chipRow}>
        {chips.map(({ val, color }) => (
          <View key={val} style={[loadCardS.chip, {
            backgroundColor: color + (isDark ? '22' : '15'),
            borderColor: color + '40',
          }]}>
            <Text style={[loadCardS.chipText, { color }]}>{val}</Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={loadCardS.foot}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <Icon name="clock" size={11} color={colors.textMuted} />
          <Text style={[loadCardS.dateText, { color: colors.textMuted }]} numberOfLines={1}>
            {load.pickupDate} → {load.deliveryDate}
          </Text>
        </View>
        {load.status === 'available' && (
          <AnimatedPressable
            onPress={() => onDelete(load.id)}
            hapticStyle="warning"
            pressedScale={0.94}
          >
            <View style={[loadCardS.delBtn, { backgroundColor: 'rgba(239,68,68,0.14)', borderColor: 'rgba(239,68,68,0.42)' }]}>
              <Text style={loadCardS.delText}>Remove</Text>
            </View>
          </AnimatedPressable>
        )}
      </View>
    </GlassCard>
  );
}

const loadCardS = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[3] },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  routeDot: { width: 9, height: 9, borderRadius: 99 },
  routeRail: { width: 1.5, height: 14, marginLeft: 4 },
  city: { fontSize: 14.5, fontWeight: '700', flex: 1, letterSpacing: -0.2 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 999, borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 99 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  inquiryPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  inquiryText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: { paddingHorizontal: spacing[3], paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1 },
  chipText: { fontSize: 11.5, fontWeight: '700' },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] },
  dateText: { fontSize: 11, fontWeight: '500', flex: 1 },
  delBtn: { paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1 },
  delText: { color: '#dc2626', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
});

/* ════════════════════════════════════════════════════════════
   DASHBOARD TAB
   ════════════════════════════════════════════════════════════ */
function DashboardTab({ loads, inquiries, refreshing, onRefresh }) {
  const { colors, isDark } = useTheme();
  const totalValue = loads.reduce((s, l) => s + (l.rate ?? 0), 0);
  const avgRpm = loads.length
    ? (loads.reduce((s, l) => s + parseFloat(rpm(l.rate, l.miles)), 0) / loads.length).toFixed(2)
    : '0.00';
  const statusCounts = loads.reduce((acc, l) => { acc[l.status] = (acc[l.status] ?? 0) + 1; return acc; }, {});
  const recentLoads = [...loads].sort((a, b) => (b.id > a.id ? 1 : -1)).slice(0, 5);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* KPIs */}
      <View style={{ flexDirection: 'row', marginBottom: spacing[2] }}>
        <KpiCard label="Total loads" value={loads.length} icon="box" color="#0193ab" />
        <KpiCard label="Total value" value={'$' + (totalValue / 1000).toFixed(1) + 'k'} sub="portfolio" icon="dollar" color="#10b981" />
      </View>
      <View style={{ flexDirection: 'row', marginBottom: spacing[4] }}>
        <KpiCard label="Avg RPM" value={'$' + avgRpm} sub="per mile" icon="trendUp" color="#f59e0b" />
        <KpiCard label="Inquiries" value={inquiries.length} sub="active" icon="chat" color="#06b6d4" />
      </View>

      {/* Status breakdown */}
      <GlassCard style={{ marginBottom: spacing[4] }} contentStyle={{ padding: spacing[4], gap: spacing[3] }}>
        <View style={dashS.sectionHead}>
          <Text style={[dashS.sectionTitle, { color: colors.textPrimary }]}>Load Status Breakdown</Text>
          <Text style={[dashS.sectionMeta, { color: colors.textMuted }]}>{loads.length} total</Text>
        </View>
        {Object.entries(STATUS_HEX).map(([status, color]) => {
          const count = statusCounts[status] ?? 0;
          const pct = loads.length ? count / loads.length : 0;
          return (
            <View key={status} style={{ gap: 5 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: color }} />
                  <Text style={[dashS.statusLabel, { color: colors.textSecondary }]}>{status}</Text>
                </View>
                <Text style={[dashS.statusCount, { color: colors.textPrimary }]}>{count}</Text>
              </View>
              <View style={[dashS.barTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(1,147,171,0.1)' }]}>
                <LinearGradient
                  colors={[color + 'ff', color + 'aa']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[dashS.barFill, { width: `${pct * 100}%` }]}
                />
              </View>
            </View>
          );
        })}
      </GlassCard>

      {/* Recent loads */}
      <View style={dashS.sectionHead}>
        <Text style={[dashS.sectionTitle, { color: colors.textPrimary }]}>Recent Loads</Text>
        <Text style={[dashS.sectionMeta, { color: colors.textMuted }]}>{Math.min(recentLoads.length, 5)} shown</Text>
      </View>
      {recentLoads.length === 0 && (
        <Text style={{ color: colors.textMuted, textAlign: 'center', paddingVertical: spacing[6] }}>
          No loads posted yet
        </Text>
      )}
      {recentLoads.map(l => (
        <GlassCard
          key={l.id}
          cornerRadius={radius.md}
          style={{ marginBottom: spacing[2] }}
          contentStyle={dashS.recentCard}
        >
          <View style={{ flex: 1 }}>
            <Text style={[dashS.recentRoute, { color: colors.textPrimary }]} numberOfLines={1}>
              {l.origin} → {l.destination}
            </Text>
            <Text style={[dashS.recentMeta, { color: colors.textMuted }]}>{l.equipment} · {l.miles} mi</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[dashS.recentRate, { color: '#10b981' }]}>${(l.rate ?? 0).toLocaleString()}</Text>
            <View style={[dashS.recentPill, {
              backgroundColor: (STATUS_HEX[l.status] ?? colors.textMuted) + (isDark ? '33' : '22'),
              borderColor: (STATUS_HEX[l.status] ?? colors.textMuted) + '55',
            }]}>
              <Text style={[dashS.recentPillText, { color: STATUS_HEX[l.status] ?? colors.textMuted }]}>{l.status}</Text>
            </View>
          </View>
        </GlassCard>
      ))}
    </ScrollView>
  );
}

const dashS = StyleSheet.create({
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  sectionTitle: { fontSize: typography.base, fontWeight: '800', letterSpacing: -0.3 },
  sectionMeta: { fontSize: 11.5, fontWeight: '600' },
  statusLabel: { fontSize: 12.5, fontWeight: '600', textTransform: 'capitalize' },
  statusCount: { fontSize: 12.5, fontWeight: '800' },
  barTrack: { height: 7, borderRadius: 99, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99 },
  recentCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing[3], gap: spacing[3],
  },
  recentRoute: { fontSize: 13, fontWeight: '700' },
  recentMeta: { fontSize: 11, marginTop: 2 },
  recentRate: { fontWeight: '800', fontSize: 14, letterSpacing: -0.3 },
  recentPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginTop: 4, borderWidth: 1 },
  recentPillText: { fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
});

/* ════════════════════════════════════════════════════════════
   POST LOAD TAB
   ════════════════════════════════════════════════════════════ */
function PostLoadTab({ brokerId, onLoadPosted }) {
  const { colors, isDark } = useTheme();
  const [form, setForm] = useState({ originCity: '', originState: '', destCity: '', destState: '', equipment: 'Dry Van', commodity: '', miles: '', rate: '', weightLb: '', pickupDate: '', deliveryDate: '', notes: '' });
  const [equipOpen, setEquipOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: null })); };

  const validate = () => {
    const e = {};
    if (!form.originCity.trim())   e.originCity   = 'Required';
    if (!form.originState.trim())  e.originState  = 'Required';
    if (!form.destCity.trim())     e.destCity     = 'Required';
    if (!form.destState.trim())    e.destState    = 'Required';
    if (!form.commodity.trim())    e.commodity    = 'Required';
    if (!form.miles || isNaN(Number(form.miles))) e.miles = 'Valid number required';
    if (!form.rate  || isNaN(Number(form.rate)))  e.rate  = 'Valid number required';
    if (!form.pickupDate.trim())   e.pickupDate   = 'Required';
    if (!form.deliveryDate.trim()) e.deliveryDate = 'Required';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setPosting(true);
    try {
      const payload = {
        origin: `${form.originCity}, ${form.originState}`,
        destination: `${form.destCity}, ${form.destState}`,
        equipment: form.equipment, commodity: form.commodity,
        miles: Number(form.miles), rate: Number(form.rate),
        ...(form.weightLb ? { weightLb: Number(form.weightLb) } : {}),
        pickupDate: form.pickupDate, deliveryDate: form.deliveryDate,
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        brokerId, status: 'available',
      };
      await postLoad(payload);
      Alert.alert('Success', 'Load posted successfully!');
      setForm({ originCity: '', originState: '', destCity: '', destState: '', equipment: 'Dry Van', commodity: '', miles: '', rate: '', weightLb: '', pickupDate: '', deliveryDate: '', notes: '' });
      onLoadPosted();
    } catch {
      Alert.alert('Error', 'Could not post load. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const rpmVal = form.rate && form.miles && !isNaN(Number(form.rate)) && !isNaN(Number(form.miles)) && Number(form.miles) > 0
    ? (Number(form.rate) / Number(form.miles)).toFixed(2)
    : null;

  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)';

  const renderField = (label, field, opts = {}) => (
    <View style={{ flex: opts.half ? 1 : undefined, marginBottom: spacing[3], ...(opts.half ? { marginHorizontal: spacing[1] } : {}) }}>
      <Text style={[postS.fieldLbl, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={form[field]}
        onChangeText={v => set(field, v)}
        placeholder={opts.placeholder ?? label}
        placeholderTextColor={colors.textDisabled}
        keyboardType={opts.keyboardType ?? 'default'}
        style={[postS.input, {
          backgroundColor: inputBg,
          borderColor: errors[field] ? '#ef4444' : colors.border,
          color: colors.textPrimary,
        }]}
      />
      {errors[field] ? <Text style={postS.fieldErr}>{errors[field]}</Text> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8] }}>
        <GlassCard accent contentStyle={{ padding: spacing[5], gap: spacing[2] }}>
          <View style={postS.titleRow}>
            <View style={postS.titleIcon}>
              <LinearGradient colors={gradients.brand} style={postS.titleIconGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Icon name="fileText" size={20} color="#fff" />
              </LinearGradient>
            </View>
            <View>
              <Text style={[postS.title, { color: colors.textPrimary }]}>Post a new load</Text>
              <Text style={[postS.titleSub, { color: colors.textMuted }]}>Fill out the details to publish to the loadboard</Text>
            </View>
          </View>

          {/* Origin */}
          <Text style={[postS.section, { color: colors.accent }]}>● Origin</Text>
          <View style={{ flexDirection: 'row', marginHorizontal: -spacing[1] }}>
            {renderField('City',  'originCity',  { half: true })}
            {renderField('State', 'originState', { half: true, placeholder: 'IL' })}
          </View>

          {/* Destination */}
          <Text style={[postS.section, { color: '#ef4444' }]}>● Destination</Text>
          <View style={{ flexDirection: 'row', marginHorizontal: -spacing[1] }}>
            {renderField('City',  'destCity',  { half: true })}
            {renderField('State', 'destState', { half: true, placeholder: 'TX' })}
          </View>

          {/* Equipment */}
          <Text style={[postS.fieldLbl, { color: colors.textSecondary }]}>Equipment Type</Text>
          <TouchableOpacity
            onPress={() => setEquipOpen(true)}
            style={[postS.input, postS.select, { backgroundColor: inputBg, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{form.equipment}</Text>
            <Icon name="chevronDown" size={14} color={colors.textMuted} />
          </TouchableOpacity>

          {renderField('Commodity', 'commodity', { placeholder: 'e.g. Electronics' })}

          <View style={{ flexDirection: 'row', marginHorizontal: -spacing[1] }}>
            {renderField('Miles',    'miles', { half: true, placeholder: '920',  keyboardType: 'numeric' })}
            {renderField('Rate ($)', 'rate',  { half: true, placeholder: '2760', keyboardType: 'numeric' })}
          </View>

          {rpmVal && (
            <View style={[postS.rpmBanner, { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.4)' }]}>
              <Icon name="chart" size={16} color="#d97706" />
              <Text style={postS.rpmVal}>${rpmVal}/mi</Text>
              <Text style={[postS.rpmLbl, { color: colors.textMuted }]}>rate per mile</Text>
            </View>
          )}

          {renderField('Weight (lbs, optional)', 'weightLb', { placeholder: '42000', keyboardType: 'numeric' })}

          <View style={{ flexDirection: 'row', marginHorizontal: -spacing[1] }}>
            {renderField('Pickup Date',   'pickupDate',   { half: true, placeholder: '2026-04-25' })}
            {renderField('Delivery Date', 'deliveryDate', { half: true, placeholder: '2026-04-27' })}
          </View>

          <Text style={[postS.fieldLbl, { color: colors.textSecondary }]}>Notes (optional)</Text>
          <TextInput
            value={form.notes}
            onChangeText={v => set('notes', v)}
            placeholder="Any special requirements..."
            placeholderTextColor={colors.textDisabled}
            multiline
            numberOfLines={3}
            style={[postS.input, postS.textarea, { backgroundColor: inputBg, borderColor: colors.border, color: colors.textPrimary }]}
          />

          <View style={{ marginTop: spacing[2] }}>
            <BrandButton
              label="Post load"
              icon="checkmark"
              size="lg"
              full
              loading={posting}
              onPress={handleSubmit}
            />
          </View>
        </GlassCard>
      </ScrollView>

      {/* Equipment picker modal */}
      <Modal visible={equipOpen} transparent animationType="fade" onRequestClose={() => setEquipOpen(false)}>
        <TouchableOpacity
          style={postS.modalBackdrop}
          activeOpacity={1}
          onPress={() => setEquipOpen(false)}
        >
          <View style={{ width: '100%', maxWidth: 380 }}>
            <GlassCard variant="floating" cornerRadius={radius.xl} contentStyle={{ padding: 0 }}>
              <Text style={[postS.modalTitle, { color: colors.textPrimary, borderBottomColor: colors.border }]}>
                Equipment Type
              </Text>
              {EQUIPMENT_OPTIONS.map(opt => {
                const active = form.equipment === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => { set('equipment', opt); setEquipOpen(false); }}
                    style={[postS.modalRow, { borderBottomColor: colors.border }]}
                  >
                    <Text style={{ color: active ? colors.accent : colors.textPrimary, fontSize: 15, fontWeight: active ? '800' : '500' }}>
                      {opt}
                    </Text>
                    {active && <View style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: colors.accent }} />}
                  </TouchableOpacity>
                );
              })}
            </GlassCard>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const postS = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  titleIcon: { borderRadius: radius.md, overflow: 'hidden' },
  titleIconGrad: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  titleSub: { fontSize: 11.5, marginTop: 2 },
  section: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing[2], marginBottom: spacing[2] },
  fieldLbl: { fontSize: 12, fontWeight: '600', marginBottom: 5 },
  input: {
    borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    fontSize: 14, fontWeight: '500', borderWidth: 1.5,
  },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] },
  textarea: { minHeight: 80, textAlignVertical: 'top', marginBottom: spacing[4] },
  fieldErr: { color: '#ef4444', fontSize: 11, marginTop: 3, fontWeight: '600' },
  rpmBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    borderRadius: radius.md, borderWidth: 1, marginBottom: spacing[3],
  },
  rpmIcon: { fontSize: 16 },
  rpmVal: { color: '#d97706', fontWeight: '800', fontSize: 15, letterSpacing: -0.3 },
  rpmLbl: { fontSize: 12 },
  submitWrap: {
    borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing[2],
    ...shadow.glow,
  },
  submit: {
    paddingVertical: spacing[4],
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  submitIcon: { color: '#fff', fontSize: 18, fontWeight: '800' },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: spacing[6],
  },
  modalTitle: { fontWeight: '800', fontSize: 16, padding: spacing[4], borderBottomWidth: 1, letterSpacing: -0.2 },
  modalRow: { padding: spacing[4], borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

/* ════════════════════════════════════════════════════════════
   MY LOADS TAB
   ════════════════════════════════════════════════════════════ */
function MyLoadsTab({ loads, refreshing, onRefresh, onDelete }) {
  const { colors, isDark } = useTheme();
  const [filter, setFilter] = useState('all');
  const filters = ['all', 'available', 'assigned', 'delivered'];
  const filtered = filter === 'all' ? loads : loads.filter(l => l.status === filter);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 56 }}
        contentContainerStyle={{ paddingHorizontal: spacing[4], paddingVertical: spacing[2], gap: spacing[2] }}
      >
        {filters.map(f => {
          const active = filter === f;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              activeOpacity={0.85}
              style={{ borderRadius: 999, overflow: 'hidden' }}
            >
              {active ? (
                <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={myLoadsS.filterActive}>
                  <Text style={myLoadsS.filterActiveText}>{f}</Text>
                </LinearGradient>
              ) : (
                <View style={[myLoadsS.filterIdle, {
                  backgroundColor: isDark ? glass.fillDark : glass.fillLight,
                  borderColor: colors.border,
                }]}>
                  <Text style={[myLoadsS.filterIdleText, { color: colors.textMuted }]}>{f}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {filtered.length === 0 && (
          <Text style={{ color: colors.textMuted, textAlign: 'center', paddingVertical: spacing[8] }}>
            No {filter} loads
          </Text>
        )}
        {filtered.map(l => <LoadCard key={l.id} load={l} onDelete={onDelete} />)}
      </ScrollView>
    </View>
  );
}

const myLoadsS = StyleSheet.create({
  filterActive: {
    paddingHorizontal: spacing[4], paddingVertical: 8,
    shadowColor: '#0193ab', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 4,
  },
  filterActiveText: { color: '#fff', fontWeight: '800', fontSize: 12.5, textTransform: 'capitalize', letterSpacing: 0.3 },
  filterIdle: { paddingHorizontal: spacing[4], paddingVertical: 8, borderWidth: 1.5, borderRadius: 999 },
  filterIdleText: { fontSize: 12.5, fontWeight: '700', textTransform: 'capitalize' },
});

/* ════════════════════════════════════════════════════════════
   INQUIRIES TAB
   ════════════════════════════════════════════════════════════ */
function InquiriesTab({ inquiries, brokerId }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(null);
  const [thread, setThread] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const scrollRef = useRef(null);
  const pollRef = useRef(null);

  const loadThread = useCallback(async (inq) => {
    if (!inq) return;
    setLoadingThread(true);
    try {
      const data = await fetchInquiryThread(inq.loadId, inq.dispatcherId);
      setThread(data);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  const selectInquiry = async (inq) => {
    setSelected(inq);
    await loadThread(inq);
  };

  useEffect(() => {
    if (!selected) return;
    pollRef.current = setInterval(() => loadThread(selected), 8000);
    return () => clearInterval(pollRef.current);
  }, [selected, loadThread]);

  useEffect(() => {
    if (thread.length && scrollRef.current) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [thread]);

  const handleSend = async () => {
    if (!text.trim() || !selected) return;
    setSending(true);
    const msg = { id: Date.now().toString(), text: text.trim(), senderRole: 'broker', timestamp: Date.now() };
    setThread(t => [...t, msg]);
    setText('');
    try {
      await sendBrokerMessage(selected.loadId, selected.dispatcherId, msg.text, brokerId);
    } catch { /* optimistic */ }
    setSending(false);
  };

  if (inquiries.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[6] }}>
        <LinearGradient
          colors={['rgba(1,147,171,0.28)', 'rgba(6,182,212,0.20)']}
          style={inqS.emptyAvatar}
        >
          <Icon name="chat" size={34} color="#0193ab" />
        </LinearGradient>
        <Text style={[inqS.emptyTitle, { color: colors.textPrimary }]}>No inquiries yet</Text>
        <Text style={[inqS.emptyHint, { color: colors.textMuted }]}>
          Dispatchers will reach out about your posted loads — replies appear here in real time.
        </Text>
      </View>
    );
  }

  if (selected) {
    return (
      <View style={{ flex: 1 }}>
        <GradientHeader
          gradient={gradients.heroDispatch}
          eyebrow={`Load #${selected.loadId}`}
          title={selected.dispatcherName}
          onBack={() => setSelected(null)}
          centerSlot={
            <View style={inqS.threadAvatar}>
              <Text style={inqS.threadAvatarText}>{selected.dispatcherName[0]}</Text>
            </View>
          }
          rightSlot={
            <View style={inqS.threadStatus}>
              <LiveDot color="#10b981" size={6} />
              <Text style={inqS.threadStatusText}>Live</Text>
            </View>
          }
        />

        {loadingThread ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: spacing[4], gap: spacing[2] }}
          >
            {thread.map(msg => {
              const isBroker = msg.senderRole === 'broker';
              return (
                <View key={msg.id} style={{ alignItems: isBroker ? 'flex-end' : 'flex-start' }}>
                  {isBroker ? (
                    <LinearGradient
                      colors={gradients.brand}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={[inqS.bubble, inqS.bubbleMe]}
                    >
                      <Text style={inqS.bubbleMeText}>{msg.text}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[inqS.bubble, inqS.bubbleThem, {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
                      borderColor: colors.border,
                    }]}>
                      <Text style={[inqS.bubbleThemText, { color: colors.textPrimary }]}>{msg.text}</Text>
                    </View>
                  )}
                  <Text style={[inqS.bubbleTime, { color: colors.textMuted }]}>{fmtTime(msg.timestamp)}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[inqS.inputBar, {
            backgroundColor: isDark ? 'rgba(12,18,35,0.95)' : colors.surface1,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom > 0 ? insets.bottom : spacing[3],
          }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message…"
              placeholderTextColor={colors.textDisabled}
              style={[inqS.input, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
                borderColor: colors.border,
                color: colors.textPrimary,
              }]}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <AnimatedPressable
              onPress={handleSend}
              disabled={sending || !text.trim()}
              hapticStyle="light"
              pressedScale={0.9}
              containerStyle={{ opacity: text.trim() && !sending ? 1 : 0.4 }}
            >
              <LinearGradient
                colors={gradients.brand}
                style={[inqS.send, shadow.glow]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                {sending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Icon name="send" size={17} color="#fff" />}
              </LinearGradient>
            </AnimatedPressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8] }}>
      {inquiries.map(inq => (
        <TouchableOpacity
          key={inq.id}
          onPress={() => selectInquiry(inq)}
          activeOpacity={0.85}
          style={{ marginBottom: spacing[3] }}
        >
          <GlassCard accent contentStyle={inqS.listRow}>
            <LinearGradient colors={gradients.brand} style={inqS.listAvatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={inqS.listAvatarText}>{inq.dispatcherName[0]}</Text>
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[inqS.listName, { color: colors.textPrimary }]}>{inq.dispatcherName}</Text>
              <Text style={[inqS.listLast, { color: colors.textMuted }]} numberOfLines={1}>{inq.lastMessage}</Text>
              <Text style={[inqS.listLoadId, { color: colors.accent }]}>Load #{inq.loadId}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: spacing[1] }}>
              <Text style={[inqS.listTime, { color: colors.textMuted }]}>{fmtTime(inq.timestamp)}</Text>
              {inq.unread > 0 && (
                <View style={inqS.unread}>
                  <Text style={inqS.unreadText}>{inq.unread}</Text>
                </View>
              )}
            </View>
          </GlassCard>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const inqS = StyleSheet.create({
  emptyAvatar: {
    width: 84, height: 84, borderRadius: 99,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[3],
    shadowColor: '#0193ab', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, marginBottom: 6 },
  emptyHint: { fontSize: 13, textAlign: 'center', maxWidth: 320, lineHeight: 19 },

  threadAvatar: {
    width: 40, height: 40, borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  threadAvatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  threadStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 999, backgroundColor: 'rgba(34,197,94,0.22)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)',
  },
  threadDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: '#22c55e' },
  threadStatusText: { color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },

  bubble: { maxWidth: '78%', borderRadius: 16, padding: spacing[3] },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleMeText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  bubbleThem: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleThemText: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 3, paddingHorizontal: 4 },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: spacing[3], borderTopWidth: 1 },
  input: {
    flex: 1, borderRadius: 24, paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: 13.5, borderWidth: 1.5, maxHeight: 120, minHeight: 42,
  },
  sendWrap: { borderRadius: 99, overflow: 'hidden' },
  send: {
    width: 44, height: 44, borderRadius: 99,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0193ab', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 5,
  },
  sendIcon: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: -2 },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4] },
  listAvatar: {
    width: 46, height: 46, borderRadius: 99,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0193ab', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
  },
  listAvatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  listName: { fontWeight: '800', fontSize: 14.5, letterSpacing: -0.2 },
  listLast: { fontSize: 12, marginTop: 2 },
  listLoadId: { fontSize: 11, marginTop: 3, fontWeight: '700' },
  listTime: { fontSize: 11, fontWeight: '500' },
  unread: {
    backgroundColor: '#0193ab',
    borderRadius: 999, minWidth: 22, height: 22,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
    shadowColor: '#0193ab', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 3,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});

/* ════════════════════════════════════════════════════════════
   MAIN PORTAL
   ════════════════════════════════════════════════════════════ */
const TABS = [
  { label: 'Dashboard', icon: 'chart' },
  { label: 'Post load', icon: 'fileText' },
  { label: 'My loads',  icon: 'box' },
  { label: 'Inquiries', icon: 'chat' },
];

export default function BrokerPortal() {
  const { colors, isDark } = useTheme();
  const { userId, userName, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(0);
  const [loads, setLoads] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [l, i] = await Promise.all([
        fetchBrokerLoads(userId).catch(() => []),
        fetchBrokerInquiries(userId).catch(() => []),
      ]);
      setLoads(l);
      setInquiries(i);
    } catch {
      setLoads([]);
      setInquiries([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleDelete = (loadId) => {
    Alert.alert('Remove Load', 'Remove this load from the board?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
          try { await deleteLoad(loadId); }
          catch (e) { if (__DEV__) console.warn('[Broker] deleteLoad failed', e); }
          setLoads(l => l.filter(x => x.id !== loadId));
      } },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
      } },
    ]);
  };

  if (loading) {
    return (
      <View style={[rootS.loading, { backgroundColor: colors.pageBg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ color: colors.textSecondary, marginTop: spacing[4] }}>Loading broker portal…</Text>
      </View>
    );
  }

  const unreadTotal = inquiries.reduce((s, i) => s + (i.unread ?? 0), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.pageBg }} edges={['left', 'right']}>
      {/* Hero header */}
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[rootS.hero, { paddingTop: insets.top + spacing[3] }]}
      >
        <View style={rootS.heroRow}>
          <View style={rootS.heroLeft}>
            <View style={rootS.brandBadge}>
              <Icon name="briefcase" size={20} color="#fff" />
            </View>
            <View style={{ minWidth: 0, flex: 1 }}>
              <Text style={rootS.heroEyebrow}>Broker Portal</Text>
              <Text style={rootS.heroName} numberOfLines={1}>{userName ?? 'Broker'}</Text>
            </View>
          </View>
          <AnimatedPressable onPress={handleLogout} hapticStyle="light" pressedScale={0.94}>
            <View style={rootS.signOut}>
              <Icon name="logout" size={13} color="#fff" />
              <Text style={rootS.signOutText}>Sign out</Text>
            </View>
          </AnimatedPressable>
        </View>
      </LinearGradient>

      {/* Tab bar */}
      <View style={[rootS.tabBar, {
        backgroundColor: isDark ? glass.fillDarkStrong : glass.fillLightStrong,
        borderBottomColor: colors.border,
      }]}>
        {TABS.map(({ label, icon }, i) => {
          const active = activeTab === i;
          const badge = label === 'Inquiries' && unreadTotal > 0 ? unreadTotal : null;
          return (
            <TouchableOpacity
              key={label}
              onPress={() => setActiveTab(i)}
              activeOpacity={0.8}
              style={rootS.tab}
            >
              <View style={[rootS.tabContent, active && rootS.tabContentActive]}>
                {active && (
                  <LinearGradient
                    colors={gradients.brand}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Icon
                  name={icon}
                  size={14}
                  color={active ? '#fff' : colors.textMuted}
                />
                <Text style={[rootS.tabLabel, {
                  color: active ? '#fff' : colors.textMuted,
                  fontWeight: active ? '800' : '600',
                }]}>{label}</Text>
                {badge ? (
                  <View style={rootS.tabBadge}>
                    <Text style={rootS.tabBadgeText}>{badge}</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {activeTab === 0 && <DashboardTab loads={loads} inquiries={inquiries} refreshing={refreshing} onRefresh={onRefresh} />}
        {activeTab === 1 && <PostLoadTab brokerId={userId} onLoadPosted={() => { loadData(); setActiveTab(2); }} />}
        {activeTab === 2 && <MyLoadsTab loads={loads} refreshing={refreshing} onRefresh={onRefresh} onDelete={handleDelete} />}
        {activeTab === 3 && <InquiriesTab inquiries={inquiries} brokerId={userId} />}
      </View>
    </SafeAreaView>
  );
}

const rootS = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    borderBottomLeftRadius: radius['2xl'],
    borderBottomRightRadius: radius['2xl'],
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1, minWidth: 0 },
  brandBadge: {
    width: 42, height: 42, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  brandBadgeText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  signOutBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: typography.xs, fontWeight: '700',
    letterSpacing: 0.7, textTransform: 'uppercase',
  },
  heroName: { color: '#fff', fontSize: typography.lg, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 },
  signOut: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  signOutText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing[2],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
    gap: 4,
    borderBottomWidth: 1,
  },
  tab: { flex: 1 },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, paddingHorizontal: 8,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  tabContentActive: {
    shadowColor: '#0193ab', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 4,
  },
  tabIcon: { fontSize: 13 },
  tabLabel: { fontSize: 12, letterSpacing: 0.2 },
  tabBadge: {
    minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 999,
    backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center',
  },
  tabBadgeText: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
});
