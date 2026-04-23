import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal,
  ActivityIndicator, RefreshControl, Alert, KeyboardAvoidingView,
  Platform, FlatList, SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/context/AuthContext';
import {
  fetchBrokerLoads, postLoad, deleteLoad,
  fetchBrokerInquiries, fetchInquiryThread, sendBrokerMessage,
} from '../../src/api/main';

// ─── design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#08090e',
  surface: '#0f1117',
  card: '#14161f',
  border: '#1e2130',
  indigo: '#6366f1',
  indigoDark: '#4f46e5',
  indigoLight: '#818cf8',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  sky: '#38bdf8',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#475569',
};

const sp = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 };
const radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 };

const EQUIPMENT_OPTIONS = ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'RGN', 'Tanker', 'Power Only'];
const STATUS_COLORS = { available: C.emerald, assigned: C.indigo, delivered: C.sky, cancelled: C.rose };

// ─── helpers ──────────────────────────────────────────────────────────────────
function rpm(rate, miles) {
  if (!miles || miles === 0) return 0;
  return (rate / miles).toFixed(2);
}

function fmtTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

// ─── sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.card, borderRadius: radius.lg, padding: sp[4], borderWidth: 1, borderColor: C.border, margin: sp[1] }}>
      <View style={{ width: 36, height: 36, borderRadius: radius.md, overflow: 'hidden', marginBottom: sp[2] }}>
        <LinearGradient colors={[color + '33', color + '22']} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
        </LinearGradient>
      </View>
      <Text style={{ color: C.textPrimary, fontSize: 22, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color: C.textSecondary, fontSize: 11, marginTop: 2 }}>{label}</Text>
      {sub ? <Text style={{ color: color, fontSize: 11, marginTop: 2, fontWeight: '600' }}>{sub}</Text> : null}
    </View>
  );
}

function LoadCard({ load, onDelete }) {
  const rpmVal = rpm(load.rate, load.miles);
  const statusColor = STATUS_COLORS[load.status] ?? C.textMuted;
  return (
    <View style={{ backgroundColor: C.card, borderRadius: radius.lg, padding: sp[4], marginBottom: sp[3], borderWidth: 1, borderColor: C.border }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: sp[2] }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.textPrimary, fontWeight: '700', fontSize: 15 }}>{load.origin}</Text>
          <Text style={{ color: C.textMuted, fontSize: 11, marginVertical: 2 }}>→</Text>
          <Text style={{ color: C.textPrimary, fontWeight: '700', fontSize: 15 }}>{load.destination}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: sp[1] }}>
          <View style={{ backgroundColor: statusColor + '22', paddingHorizontal: sp[2], paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, borderColor: statusColor + '44' }}>
            <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>{load.status}</Text>
          </View>
          {load.inquiryCount > 0 && (
            <View style={{ backgroundColor: C.indigo + '33', paddingHorizontal: sp[2], paddingVertical: 3, borderRadius: radius.full }}>
              <Text style={{ color: C.indigoLight, fontSize: 10, fontWeight: '700' }}>{load.inquiryCount} inquiries</Text>
            </View>
          )}
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp[2], marginBottom: sp[3] }}>
        {[
          ['$' + (load.rate ?? 0).toLocaleString(), C.emerald],
          ['$' + rpmVal + '/mi', C.amber],
          [(load.miles ?? 0) + ' mi', C.sky],
          [load.equipment, C.indigoLight],
        ].map(([val, clr]) => (
          <View key={val} style={{ backgroundColor: clr + '15', paddingHorizontal: sp[2], paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1, borderColor: clr + '30' }}>
            <Text style={{ color: clr, fontSize: 11, fontWeight: '600' }}>{val}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: C.textMuted, fontSize: 11 }}>Pickup: {load.pickupDate}  ·  Del: {load.deliveryDate}</Text>
        {load.status === 'available' && (
          <TouchableOpacity onPress={() => onDelete(load.id)} style={{ backgroundColor: C.rose + '22', paddingHorizontal: sp[3], paddingVertical: sp[1], borderRadius: radius.sm, borderWidth: 1, borderColor: C.rose + '44' }}>
            <Text style={{ color: C.rose, fontSize: 11, fontWeight: '700' }}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── DASHBOARD TAB ────────────────────────────────────────────────────────────
function DashboardTab({ loads, inquiries, refreshing, onRefresh }) {
  const totalValue = loads.reduce((s, l) => s + (l.rate ?? 0), 0);
  const avgRpm = loads.length ? (loads.reduce((s, l) => s + parseFloat(rpm(l.rate, l.miles)), 0) / loads.length).toFixed(2) : '0.00';
  const statusCounts = loads.reduce((acc, l) => { acc[l.status] = (acc[l.status] ?? 0) + 1; return acc; }, {});
  const recentLoads = [...loads].sort((a, b) => (b.id > a.id ? 1 : -1)).slice(0, 5);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: sp[4] }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.indigo} />}>
      {/* KPIs */}
      <View style={{ flexDirection: 'row', marginBottom: sp[3] }}>
        <KpiCard label="Total Loads" value={loads.length} color={C.indigo} />
        <KpiCard label="Total Value" value={'$' + (totalValue / 1000).toFixed(1) + 'k'} sub="portfolio" color={C.emerald} />
      </View>
      <View style={{ flexDirection: 'row', marginBottom: sp[4] }}>
        <KpiCard label="Avg RPM" value={'$' + avgRpm} sub="per mile" color={C.amber} />
        <KpiCard label="Inquiries" value={inquiries.length} sub="active threads" color={C.sky} />
      </View>

      {/* Status breakdown */}
      <View style={{ backgroundColor: C.card, borderRadius: radius.lg, padding: sp[4], marginBottom: sp[4], borderWidth: 1, borderColor: C.border }}>
        <Text style={{ color: C.textPrimary, fontWeight: '700', fontSize: 15, marginBottom: sp[3] }}>Load Status Breakdown</Text>
        {Object.entries(STATUS_COLORS).map(([status, color]) => {
          const count = statusCounts[status] ?? 0;
          const pct = loads.length ? count / loads.length : 0;
          return (
            <View key={status} style={{ marginBottom: sp[2] }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: C.textSecondary, fontSize: 12, textTransform: 'capitalize' }}>{status}</Text>
                <Text style={{ color: C.textSecondary, fontSize: 12 }}>{count}</Text>
              </View>
              <View style={{ height: 6, backgroundColor: C.border, borderRadius: 3 }}>
                <View style={{ height: 6, width: `${pct * 100}%`, backgroundColor: color, borderRadius: 3 }} />
              </View>
            </View>
          );
        })}
      </View>

      {/* Recent loads */}
      <Text style={{ color: C.textPrimary, fontWeight: '700', fontSize: 15, marginBottom: sp[3] }}>Recent Loads</Text>
      {recentLoads.length === 0 && <Text style={{ color: C.textMuted, textAlign: 'center', paddingVertical: sp[6] }}>No loads posted yet</Text>}
      {recentLoads.map(l => (
        <View key={l.id} style={{ backgroundColor: C.card, borderRadius: radius.md, padding: sp[3], marginBottom: sp[2], borderWidth: 1, borderColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: C.textPrimary, fontSize: 13, fontWeight: '600' }}>{l.origin} → {l.destination}</Text>
            <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>{l.equipment}  ·  {l.miles} mi</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: C.emerald, fontWeight: '700', fontSize: 14 }}>${(l.rate ?? 0).toLocaleString()}</Text>
            <View style={{ backgroundColor: (STATUS_COLORS[l.status] ?? C.textMuted) + '22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, marginTop: 3 }}>
              <Text style={{ color: STATUS_COLORS[l.status] ?? C.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>{l.status}</Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── POST LOAD TAB ────────────────────────────────────────────────────────────
function PostLoadTab({ brokerId, onLoadPosted }) {
  const [form, setForm] = useState({ originCity: '', originState: '', destCity: '', destState: '', equipment: 'Dry Van', commodity: '', miles: '', rate: '', weightLb: '', pickupDate: '', deliveryDate: '', notes: '' });
  const [equipOpen, setEquipOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: null })); };

  const validate = () => {
    const e = {};
    if (!form.originCity.trim()) e.originCity = 'Required';
    if (!form.originState.trim()) e.originState = 'Required';
    if (!form.destCity.trim()) e.destCity = 'Required';
    if (!form.destState.trim()) e.destState = 'Required';
    if (!form.commodity.trim()) e.commodity = 'Required';
    if (!form.miles || isNaN(Number(form.miles))) e.miles = 'Valid number required';
    if (!form.rate || isNaN(Number(form.rate))) e.rate = 'Valid number required';
    if (!form.pickupDate.trim()) e.pickupDate = 'Required';
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
        equipment: form.equipment,
        commodity: form.commodity,
        miles: Number(form.miles),
        rate: Number(form.rate),
        ...(form.weightLb ? { weightLb: Number(form.weightLb) } : {}),
        pickupDate: form.pickupDate,
        deliveryDate: form.deliveryDate,
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        brokerId,
        status: 'available',
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
    ? (Number(form.rate) / Number(form.miles)).toFixed(2) : null;

  const Field = ({ label, field, placeholder, keyboardType, half }) => (
    <View style={{ flex: half ? 1 : undefined, marginBottom: sp[3], ...(half ? { marginHorizontal: sp[1] } : {}) }}>
      <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: sp[1] }}>{label}</Text>
      <TextInput
        value={form[field]}
        onChangeText={v => set(field, v)}
        placeholder={placeholder ?? label}
        placeholderTextColor={C.textMuted}
        keyboardType={keyboardType ?? 'default'}
        style={{ backgroundColor: C.surface, borderRadius: radius.md, padding: sp[3], color: C.textPrimary, fontSize: 14, borderWidth: 1, borderColor: errors[field] ? C.rose : C.border }}
      />
      {errors[field] ? <Text style={{ color: C.rose, fontSize: 11, marginTop: 2 }}>{errors[field]}</Text> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: sp[4] }}>
        <View style={{ backgroundColor: C.card, borderRadius: radius.lg, padding: sp[4], marginBottom: sp[4], borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.textPrimary, fontWeight: '700', fontSize: 16, marginBottom: sp[4] }}>Post a New Load</Text>

          {/* Origin */}
          <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: sp[2] }}>Origin</Text>
          <View style={{ flexDirection: 'row', marginHorizontal: -sp[1] }}>
            <Field label="City" field="originCity" half />
            <Field label="State" field="originState" placeholder="IL" half />
          </View>

          {/* Destination */}
          <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: sp[2] }}>Destination</Text>
          <View style={{ flexDirection: 'row', marginHorizontal: -sp[1] }}>
            <Field label="City" field="destCity" half />
            <Field label="State" field="destState" placeholder="TX" half />
          </View>

          {/* Equipment */}
          <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: sp[1] }}>Equipment Type</Text>
          <TouchableOpacity onPress={() => setEquipOpen(true)} style={{ backgroundColor: C.surface, borderRadius: radius.md, padding: sp[3], borderWidth: 1, borderColor: C.border, marginBottom: sp[3] }}>
            <Text style={{ color: C.textPrimary, fontSize: 14 }}>{form.equipment}</Text>
          </TouchableOpacity>

          <Field label="Commodity" field="commodity" placeholder="e.g. Electronics" />

          <View style={{ flexDirection: 'row', marginHorizontal: -sp[1] }}>
            <Field label="Miles" field="miles" placeholder="920" keyboardType="numeric" half />
            <Field label="Rate ($)" field="rate" placeholder="2760" keyboardType="numeric" half />
          </View>

          {rpmVal && (
            <View style={{ backgroundColor: C.amber + '15', borderRadius: radius.md, padding: sp[3], marginBottom: sp[3], borderWidth: 1, borderColor: C.amber + '30', flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: C.amber, fontWeight: '700', fontSize: 14 }}>${rpmVal}/mi RPM</Text>
              <Text style={{ color: C.textMuted, fontSize: 12, marginLeft: sp[2] }}>rate per mile</Text>
            </View>
          )}

          <Field label="Weight (lbs, optional)" field="weightLb" placeholder="42000" keyboardType="numeric" />

          <View style={{ flexDirection: 'row', marginHorizontal: -sp[1] }}>
            <Field label="Pickup Date" field="pickupDate" placeholder="2026-04-25" half />
            <Field label="Delivery Date" field="deliveryDate" placeholder="2026-04-27" half />
          </View>

          <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: sp[1] }}>Notes (optional)</Text>
          <TextInput
            value={form.notes}
            onChangeText={v => set('notes', v)}
            placeholder="Any special requirements..."
            placeholderTextColor={C.textMuted}
            multiline
            numberOfLines={3}
            style={{ backgroundColor: C.surface, borderRadius: radius.md, padding: sp[3], color: C.textPrimary, fontSize: 14, borderWidth: 1, borderColor: C.border, textAlignVertical: 'top', minHeight: 80, marginBottom: sp[4] }}
          />

          <TouchableOpacity onPress={handleSubmit} disabled={posting} style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
            <LinearGradient colors={['#6366f1', '#4f46e5']} style={{ paddingVertical: sp[4], alignItems: 'center' }}>
              {posting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Post Load</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Equipment picker modal */}
      <Modal visible={equipOpen} transparent animationType="fade" onRequestClose={() => setEquipOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', padding: sp[6] }} activeOpacity={1} onPress={() => setEquipOpen(false)}>
          <View style={{ backgroundColor: C.card, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.textPrimary, fontWeight: '700', fontSize: 16, padding: sp[4], borderBottomWidth: 1, borderBottomColor: C.border }}>Equipment Type</Text>
            {EQUIPMENT_OPTIONS.map(opt => (
              <TouchableOpacity key={opt} onPress={() => { set('equipment', opt); setEquipOpen(false); }} style={{ padding: sp[4], borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: form.equipment === opt ? C.indigo : C.textPrimary, fontSize: 15, fontWeight: form.equipment === opt ? '700' : '400' }}>{opt}</Text>
                {form.equipment === opt && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.indigo }} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── MY LOADS TAB ─────────────────────────────────────────────────────────────
function MyLoadsTab({ loads, refreshing, onRefresh, onDelete }) {
  const [filter, setFilter] = useState('all');
  const filters = ['all', 'available', 'assigned', 'delivered'];
  const filtered = filter === 'all' ? loads : loads.filter(l => l.status === filter);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50 }} contentContainerStyle={{ paddingHorizontal: sp[4], paddingVertical: sp[2], gap: sp[2] }}>
        {filters.map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={{ borderRadius: radius.full, overflow: 'hidden' }}>
            {filter === f
              ? <LinearGradient colors={['#6366f1', '#4f46e5']} style={{ paddingHorizontal: sp[4], paddingVertical: sp[1] + 2 }}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, textTransform: 'capitalize' }}>{f}</Text></LinearGradient>
              : <View style={{ paddingHorizontal: sp[4], paddingVertical: sp[1] + 2, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }}><Text style={{ color: C.textSecondary, fontSize: 13, textTransform: 'capitalize' }}>{f}</Text></View>
            }
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: sp[4] }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.indigo} />}>
        {filtered.length === 0 && <Text style={{ color: C.textMuted, textAlign: 'center', paddingVertical: sp[8] }}>No {filter} loads</Text>}
        {filtered.map(l => <LoadCard key={l.id} load={l} onDelete={onDelete} />)}
      </ScrollView>
    </View>
  );
}

// ─── INQUIRIES TAB ────────────────────────────────────────────────────────────
function InquiriesTab({ inquiries, brokerId }) {
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
    if (thread.length && scrollRef.current) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [thread]);

  const handleSend = async () => {
    if (!text.trim() || !selected) return;
    setSending(true);
    const msg = { id: Date.now().toString(), text: text.trim(), senderRole: 'broker', timestamp: Date.now() };
    setThread(t => [...t, msg]);
    setText('');
    try {
      await sendBrokerMessage(selected.loadId, selected.dispatcherId, msg.text, brokerId);
    } catch { /* optimistic update stays */ }
    setSending(false);
  };

  if (inquiries.length === 0) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: C.textMuted, fontSize: 15 }}>No inquiries yet</Text></View>;
  }

  if (selected) {
    return (
      <View style={{ flex: 1 }}>
        {/* Chat header */}
        <LinearGradient colors={['#4f46e5', '#6366f1']} style={{ paddingTop: sp[2], paddingBottom: sp[3], paddingHorizontal: sp[4], flexDirection: 'row', alignItems: 'center', gap: sp[3] }}>
          <TouchableOpacity onPress={() => setSelected(null)} style={{ backgroundColor: '#ffffff22', borderRadius: radius.full, width: 32, height: 32, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>‹</Text>
          </TouchableOpacity>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffffff22', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{selected.dispatcherName[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{selected.dispatcherName}</Text>
            <Text style={{ color: '#ffffff99', fontSize: 11 }}>Load #{selected.loadId}</Text>
          </View>
        </LinearGradient>

        {/* Messages */}
        {loadingThread
          ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={C.indigo} /></View>
          : (
            <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: sp[4], gap: sp[2] }}>
              {thread.map(msg => {
                const isBroker = msg.senderRole === 'broker';
                return (
                  <View key={msg.id} style={{ alignItems: isBroker ? 'flex-end' : 'flex-start' }}>
                    {isBroker
                      ? <LinearGradient colors={['#6366f1', '#4f46e5']} style={{ maxWidth: '78%', borderRadius: radius.lg, borderBottomRightRadius: 4, padding: sp[3] }}><Text style={{ color: '#fff', fontSize: 14 }}>{msg.text}</Text></LinearGradient>
                      : <View style={{ maxWidth: '78%', borderRadius: radius.lg, borderBottomLeftRadius: 4, padding: sp[3], backgroundColor: C.card, borderWidth: 1, borderColor: C.border }}><Text style={{ color: C.textPrimary, fontSize: 14 }}>{msg.text}</Text></View>
                    }
                    <Text style={{ color: C.textMuted, fontSize: 10, marginTop: 3, marginHorizontal: sp[1] }}>{fmtTime(msg.timestamp)}</Text>
                  </View>
                );
              })}
            </ScrollView>
          )
        }

        {/* Input */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flexDirection: 'row', padding: sp[3], gap: sp[2], backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message..."
              placeholderTextColor={C.textMuted}
              style={{ flex: 1, backgroundColor: C.card, borderRadius: radius.full, paddingHorizontal: sp[4], paddingVertical: sp[2], color: C.textPrimary, fontSize: 14, borderWidth: 1, borderColor: C.border }}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity onPress={handleSend} disabled={sending || !text.trim()} style={{ borderRadius: radius.full, overflow: 'hidden' }}>
              <LinearGradient colors={['#6366f1', '#4f46e5']} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginTop: -2 }}>↑</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: sp[4] }}>
      {inquiries.map(inq => (
        <TouchableOpacity key={inq.id} onPress={() => selectInquiry(inq)} style={{ backgroundColor: C.card, borderRadius: radius.lg, padding: sp[4], marginBottom: sp[3], borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: sp[3] }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
            <LinearGradient colors={['#6366f1', '#4f46e5']} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>{inq.dispatcherName[0]}</Text>
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.textPrimary, fontWeight: '700', fontSize: 14 }}>{inq.dispatcherName}</Text>
            <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{inq.lastMessage}</Text>
            <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>Load #{inq.loadId}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: sp[1] }}>
            <Text style={{ color: C.textMuted, fontSize: 11 }}>{fmtTime(inq.timestamp)}</Text>
            {inq.unread > 0 && (
              <View style={{ backgroundColor: C.indigo, borderRadius: radius.full, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{inq.unread}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── MAIN BROKER PORTAL ───────────────────────────────────────────────────────
const TABS = ['Dashboard', 'Post Load', 'My Loads', 'Inquiries'];

export default function BrokerPortal() {
  const { userId, userName, logout } = useAuth();
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
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try { await deleteLoad(loadId); } catch { /* optimistic */ }
          setLoads(l => l.filter(x => x.id !== loadId));
        }
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={C.indigo} />
        <Text style={{ color: C.textSecondary, marginTop: sp[4] }}>Loading broker portal...</Text>
      </View>
    );
  }

  const unreadTotal = inquiries.reduce((s, i) => s + (i.unread ?? 0), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <LinearGradient colors={['#0f1117', '#14161f']} style={{ paddingHorizontal: sp[4], paddingTop: sp[4], paddingBottom: sp[3], borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp[3] }}>
            <View style={{ borderRadius: radius.md, overflow: 'hidden' }}>
              <LinearGradient colors={['#6366f1', '#4f46e5']} style={{ paddingHorizontal: sp[2], paddingVertical: 4 }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 1 }}>DSP</Text>
              </LinearGradient>
            </View>
            <View>
              <Text style={{ color: C.textPrimary, fontWeight: '700', fontSize: 16 }}>Broker Portal</Text>
              <Text style={{ color: C.textMuted, fontSize: 11 }}>{userName ?? 'Broker'}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={{ backgroundColor: C.rose + '22', paddingHorizontal: sp[3], paddingVertical: sp[1] + 2, borderRadius: radius.full, borderWidth: 1, borderColor: C.rose + '44' }}>
            <Text style={{ color: C.rose, fontSize: 12, fontWeight: '700' }}>Logout</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Tab bar */}
      <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border }}>
        {TABS.map((tab, i) => {
          const isActive = activeTab === i;
          const badge = tab === 'Inquiries' && unreadTotal > 0 ? unreadTotal : null;
          return (
            <TouchableOpacity key={tab} onPress={() => setActiveTab(i)} style={{ flex: 1, alignItems: 'center', paddingVertical: sp[3], borderBottomWidth: 2, borderBottomColor: isActive ? C.indigo : 'transparent' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: isActive ? C.indigoLight : C.textMuted, fontSize: 12, fontWeight: isActive ? '700' : '400' }}>{tab}</Text>
                {badge ? (
                  <View style={{ backgroundColor: C.rose, borderRadius: radius.full, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{badge}</Text>
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
