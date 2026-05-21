import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput,
  Modal, ScrollView, KeyboardAvoidingView, Platform, Dimensions,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { fetchDrivers, fetchDriverChat, sendChatMessage, inviteDriver } from '../../src/api/main';
import PageHeader from '../../src/components/shared/PageHeader';
import PageBackground from '../../src/components/shared/PageBackground';
import { spacing, typography, radius, glass, shadow } from '../../src/theme/colors';

const { height: SCREEN_H } = Dimensions.get('window');
const STATUS_TABS = ['All', 'Moving', 'Idle', 'Offline'];
const STATUS_COLORS = { moving: '#10b981', idle: '#f59e0b', offline: '#6b7280', 0: '#10b981', 1: '#f59e0b', 2: '#6b7280' };

function normalizeDriver(d) {
  const statusMap = { 0: 'moving', 1: 'idle', 2: 'offline' };
  const st = typeof d.status === 'number'
    ? (statusMap[d.status] || 'offline')
    : (d.status || 'offline').toLowerCase();
  const name = d.name || (d.firstName || d.lastName
    ? `${d.firstName || ''} ${d.lastName || ''}`.trim()
    : 'Driver');
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'DR';
  return {
    ...d, status: st, name, initials,
    lat: d.lat ?? d.latitude ?? 39.5,
    lng: d.lng ?? d.longitude ?? -98.35,
    origin: d.origin || d.currentCity || 'Origin',
    dest: d.dest || d.destination || d.destinationCity || 'Destination',
    truck: d.truck || d.truckNumber || d.vehicleId || 'Truck',
    eta: d.eta || '—',
    dist: d.dist || d.distance || '—',
  };
}

function MapPlaceholder({ drivers, selectedDriver, onSelect, colors }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface2 }}>
      {/* Grid background */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.12 }}>
        {[...Array(8)].map((_, i) => (
          <View key={`h${i}`} style={{ position: 'absolute', top: `${i * 14}%`, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
        ))}
        {[...Array(6)].map((_, i) => (
          <View key={`v${i}`} style={{ position: 'absolute', left: `${i * 20}%`, top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
        ))}
      </View>

      {drivers.map((d, i) => {
        const stColor = STATUS_COLORS[d.status] || '#6b7280';
        const isSelected = selectedDriver?.id === d.id;
        return (
          <TouchableOpacity
            key={d.id}
            style={{
              position: 'absolute',
              left: `${12 + (i % 4) * 22}%`,
              top: `${15 + Math.floor(i / 4) * 28}%`,
              alignItems: 'center',
            }}
            onPress={() => onSelect(d)}
          >
            {isSelected && (
              <View style={{
                position: 'absolute', width: 52, height: 52, borderRadius: 99,
                backgroundColor: colors.accent + '1a', top: -7,
              }} />
            )}
            <View style={{
              width: isSelected ? 44 : 36,
              height: isSelected ? 44 : 36,
              borderRadius: 99,
              backgroundColor: colors.elevated,
              borderWidth: isSelected ? 2.5 : 1.5,
              borderColor: isSelected ? colors.accent : colors.border,
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textPrimary }}>{d.initials}</Text>
              <View style={{
                position: 'absolute', top: 2, right: 2,
                width: 8, height: 8, borderRadius: 99,
                backgroundColor: stColor, borderWidth: 1.5, borderColor: colors.elevated,
              }} />
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 9, marginTop: 2, fontWeight: '600' }}>
              {d.name.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        );
      })}

      <View style={{
        position: 'absolute', bottom: 14, right: 14,
        backgroundColor: colors.surface1 + 'ee',
        paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 10, borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6,
      }}>
        <Ionicons name="map-outline" size={12} color={colors.textMuted} />
        <Text style={{ color: colors.textMuted, fontSize: 10 }}>Live map in production build</Text>
      </View>
    </View>
  );
}

export default function DriversScreen() {
  const { colors, isDark } = useTheme();
  const glassFill   = isDark ? glass.fillDarkStrong : glass.fillLightStrong;
  const glassBorder = isDark ? glass.borderDark : glass.borderLightSoft;
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const [drivers, setDrivers] = useState([]);
  const [apiLoading, setApiLoading]   = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [statusTab, setStatusTab]     = useState('All');
  const [search, setSearch]           = useState('');
  const [showSearch, setShowSearch]   = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [messages, setMessages]       = useState([]);
  const [chatInput, setChatInput]     = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [sheetExpanded, setSheetExpanded]     = useState(false);

  const loadDrivers = useCallback(async (silent = false) => {
    if (!silent) setApiLoading(true);
    try {
      const data = await fetchDrivers();
      setDrivers(data.map(normalizeDriver));
    } catch {
      setDrivers([]);
    } finally {
      setApiLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDrivers(); }, [loadDrivers]);
  const onRefresh = useCallback(() => { setRefreshing(true); loadDrivers(true); }, [loadDrivers]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDrivers(prev => prev.map(d => {
        if (d.status !== 'moving') return d;
        return { ...d, lat: d.lat + (Math.random() - 0.5) * 0.01, lng: d.lng + (Math.random() - 0.5) * 0.01 };
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const filteredDrivers = drivers.filter(d => {
    const matchTab    = statusTab === 'All' || d.status === statusTab.toLowerCase();
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const selectDriver = useCallback(async (driver) => {
    setSelectedDriver(driver);
    setChatVisible(false);
    try {
      const chatData = await fetchDriverChat(driver.id);
      if (chatData?.length > 0) {
        setMessages(chatData.map(m => ({
          id: String(m.id || m.messageId || Date.now()),
          sender: m.senderRole === 'driver' || m.senderId === driver.id ? 'driver' : 'dispatcher',
          text: m.message || m.content || m.text || '',
          time: m.sentAt ? new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
        })));
      } else {
        setMessages([
          { id: '1', sender: 'dispatcher', text: `Hey ${driver.name.split(' ')[0]}, how's the route looking?`, time: '10:30 AM' },
          { id: '2', sender: 'driver',     text: 'All good, smooth sailing so far.',                          time: '10:32 AM' },
          { id: '3', sender: 'dispatcher', text: 'Great. ETA still on track?',                                time: '10:35 AM' },
          { id: '4', sender: 'driver',     text: `Yes, should arrive around ${driver.eta} from now.`,         time: '10:36 AM' },
        ]);
      }
    } catch {
      setMessages([
        { id: '1', sender: 'dispatcher', text: `Hey ${driver.name.split(' ')[0]}, how's the route looking?`, time: '10:30 AM' },
        { id: '2', sender: 'driver',     text: 'All good, smooth sailing so far.',                          time: '10:32 AM' },
        { id: '3', sender: 'dispatcher', text: 'Great. ETA still on track?',                                time: '10:35 AM' },
        { id: '4', sender: 'driver',     text: `Yes, should arrive around ${driver.eta} from now.`,         time: '10:36 AM' },
      ]);
    }
  }, []);

  const sendMessage = async () => {
    if (!chatInput.trim() || !selectedDriver) return;
    const text = chatInput.trim();
    setChatInput('');
    const newMsg = {
      id: Date.now().toString(), sender: 'dispatcher', text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, newMsg]);
    try { await sendChatMessage(selectedDriver.id, text, userId); } catch {}
  };

  const tabCounts = STATUS_TABS.map(t => ({
    tab: t,
    count: t === 'All' ? drivers.length : drivers.filter(d => d.status === t.toLowerCase()).length,
  }));

  const s = makeStyles(colors, insets, isDark);

  return (
    <PageBackground>
      <SafeAreaView style={s.safe} edges={['left', 'right']}>
        <PageHeader title="Drivers" subtitle={apiLoading ? '…' : `${drivers.length} total`} />

        {/* Map */}
        <View style={s.mapWrap}>
          {MapView ? (
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              provider={PROVIDER_GOOGLE}
              initialRegion={{ latitude: 37.09, longitude: -95.71, latitudeDelta: 30, longitudeDelta: 30 }}
            >
              {drivers.map(driver => (
                <Marker
                  key={driver.id}
                  coordinate={{ latitude: driver.lat, longitude: driver.lng }}
                  onPress={() => selectDriver(driver)}
                >
                  <View style={[s.markerWrap, selectedDriver?.id === driver.id && s.markerSelected]}>
                    <View style={[s.markerDot, { backgroundColor: STATUS_COLORS[driver.status] || '#6b7280' }]} />
                    <Text style={s.markerText}>{driver.initials}</Text>
                  </View>
                </Marker>
              ))}
            </MapView>
          ) : (
            <MapPlaceholder
              drivers={filteredDrivers.slice(0, 8)}
              selectedDriver={selectedDriver}
              onSelect={selectDriver}
              colors={colors}
            />
          )}

          {/* Floating driver card */}
          {selectedDriver && (
            <View style={s.floatingCard}>
              <LinearGradient colors={['#6366f1', '#4f46e5']} style={s.floatingAvatar}>
                <Text style={s.floatingAvatarText}>{selectedDriver.initials}</Text>
                <View style={[s.floatingDot, { backgroundColor: STATUS_COLORS[selectedDriver.status] || '#6b7280' }]} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[s.floatingName, { color: colors.textPrimary }]}>{selectedDriver.name}</Text>
                <Text style={[s.floatingTruck, { color: colors.textMuted }]}>{selectedDriver.truck}</Text>
                <View style={s.floatingStats}>
                  {selectedDriver.eta !== '—' && (
                    <View style={s.floatingStatRow}>
                      <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                      <Text style={[s.floatingStat, { color: colors.textSecondary }]}>{selectedDriver.eta}</Text>
                    </View>
                  )}
                  {selectedDriver.dist !== '—' && (
                    <View style={s.floatingStatRow}>
                      <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                      <Text style={[s.floatingStat, { color: colors.textSecondary }]}>{selectedDriver.dist}</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity style={s.chatBtnWrap} onPress={() => setChatVisible(true)}>
                <LinearGradient colors={['#6366f1', '#4f46e5']} style={s.chatBtn}>
                  <Ionicons name="chatbubble-outline" size={14} color="#fff" />
                  <Text style={s.chatBtnText}>Chat</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelectedDriver(null)}
                style={s.floatingClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Bottom Sheet */}
        <View style={[s.sheet, sheetExpanded && s.sheetExpanded, {
          backgroundColor: glassFill,
          borderTopColor: glassBorder,
        }]}>
          <TouchableOpacity style={s.sheetHandle} onPress={() => setSheetExpanded(v => !v)}>
            <View style={[s.handleBar, { backgroundColor: colors.border }]} />
          </TouchableOpacity>

          <View style={s.sheetHeader}>
            <Text style={[s.sheetTitle, { color: colors.textPrimary }]}>
              Drivers{' '}
              <Text style={{ color: colors.accent }}>({drivers.length})</Text>
            </Text>
            <View style={s.sheetActions}>
              <TouchableOpacity
                style={[s.iconBtn, { backgroundColor: colors.surface2 }]}
                onPress={() => setShowSearch(v => !v)}
              >
                <Ionicons name="search-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAddModalVisible(true)}>
                <LinearGradient colors={['#6366f1', '#4f46e5']} style={s.addBtn}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={s.addBtnText}>Add</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {showSearch && (
            <View style={[s.searchWrap, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={14} color={colors.textDisabled} />
              <TextInput
                style={[s.searchInput, { color: colors.textPrimary }]}
                placeholder="Search drivers…"
                placeholderTextColor={colors.textDisabled}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
            </View>
          )}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.tabsScroll}
            contentContainerStyle={s.tabsContent}
          >
            {tabCounts.map(({ tab, count }) => (
              <TouchableOpacity
                key={tab}
                style={[s.tab, statusTab === tab && { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}
                onPress={() => setStatusTab(tab)}
              >
                <Text style={[s.tabText, { color: statusTab === tab ? colors.accent : colors.textMuted }]}>
                  {tab} <Text style={{ fontWeight: '800' }}>({count})</Text>
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {apiLoading ? (
            <View style={{ padding: spacing[4], alignItems: 'center' }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <FlatList
              data={filteredDrivers}
              keyExtractor={d => String(d.id)}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
              renderItem={({ item: d }) => {
                const stColor = STATUS_COLORS[d.status] || '#6b7280';
                const isSelected = selectedDriver?.id === d.id;
                return (
                  <TouchableOpacity
                    style={[
                      s.driverRow,
                      isSelected && { backgroundColor: colors.accentMuted },
                      { borderBottomColor: colors.borderSubtle },
                    ]}
                    onPress={() => selectDriver(d)}
                    activeOpacity={0.8}
                  >
                    <View style={[s.avatar, { backgroundColor: isSelected ? colors.accentMuted : colors.surface2 }]}>
                      <Text style={[s.avatarText, { color: isSelected ? colors.accent : colors.textSecondary }]}>
                        {d.initials}
                      </Text>
                      <View style={[s.statusDot, { backgroundColor: stColor, borderColor: colors.surface1 }]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.driverName, { color: colors.textPrimary }]}>{d.name}</Text>
                      <Text style={[s.driverTruck, { color: colors.textMuted }]}>{d.truck}</Text>
                      {d.status !== 'offline' && (
                        <Text style={[s.driverRoute, { color: colors.textDisabled }]} numberOfLines={1}>
                          {d.origin} → {d.dest}
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={[s.statusBadge, { backgroundColor: stColor + '1a' }]}>
                        <View style={[s.statusBadgeDot, { backgroundColor: stColor }]} />
                        <Text style={[s.statusBadgeText, { color: stColor }]}>{d.status}</Text>
                      </View>
                      {d.status !== 'offline' && d.eta !== '—' && (
                        <Text style={[s.driverEta, { color: colors.textDisabled }]}>{d.eta}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: sheetExpanded ? undefined : 200 }}
            />
          )}
        </View>

        {/* Chat Modal */}
        <Modal
          visible={chatVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setChatVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
            <LinearGradient colors={['#1e1b4b', '#4338ca', '#6366f1']} style={s.chatHeader}>
              <TouchableOpacity onPress={() => setChatVisible(false)}>
                <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={s.chatName}>{selectedDriver?.name}</Text>
                <Text style={s.chatTruck}>{selectedDriver?.truck}</Text>
              </View>
              <View style={{ width: 36 }} />
            </LinearGradient>

            <FlatList
              data={messages}
              keyExtractor={m => m.id}
              style={{ flex: 1, padding: spacing[4] }}
              renderItem={({ item: m }) => (
                <View style={[s.msgWrap, m.sender === 'dispatcher' ? s.msgRight : s.msgLeft]}>
                  <View style={[
                    s.msgBubble,
                    m.sender === 'dispatcher'
                      ? { backgroundColor: colors.accentDark }
                      : { backgroundColor: colors.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
                  ]}>
                    <Text style={[s.msgText, { color: m.sender === 'dispatcher' ? '#fff' : colors.textPrimary }]}>
                      {m.text}
                    </Text>
                    <Text style={[s.msgTime, { color: m.sender === 'dispatcher' ? 'rgba(255,255,255,0.5)' : colors.textDisabled }]}>
                      {m.time}
                    </Text>
                  </View>
                </View>
              )}
            />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={[s.chatInputRow, { backgroundColor: colors.surface1, borderTopColor: colors.border }]}>
                <TextInput
                  style={[s.chatTextInput, { backgroundColor: colors.surface2, borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="Type a message…"
                  placeholderTextColor={colors.textDisabled}
                  value={chatInput}
                  onChangeText={setChatInput}
                  multiline
                />
                <TouchableOpacity
                  style={[s.sendBtnWrap, { opacity: chatInput.trim() ? 1 : 0.4 }]}
                  onPress={sendMessage}
                >
                  <LinearGradient colors={['#6366f1', '#4f46e5']} style={s.sendBtn}>
                    <Ionicons name="arrow-up" size={18} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* Add Driver Modal */}
        <AddDriverModal
          visible={addModalVisible}
          onClose={() => setAddModalVisible(false)}
          colors={colors}
          dispatcherId={userId}
        />
      </SafeAreaView>
    </PageBackground>
  );
}

function AddDriverModal({ visible, onClose, colors, dispatcherId }) {
  const [name, setName]       = useState('');
  const [contact, setContact] = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!name || !contact) return;
    setLoading(true);
    try { await inviteDriver(name, contact, dispatcherId); } catch {}
    setLoading(false);
    setSent(true);
  };

  const handleClose = () => { setSent(false); setName(''); setContact(''); onClose(); };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <View style={addS.overlay}>
        <View style={[addS.modal, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
          {sent ? (
            <View style={{ alignItems: 'center', padding: spacing[4] }}>
              <View style={[addS.successIcon, { backgroundColor: colors.successBg }]}>
                <Ionicons name="checkmark" size={32} color={colors.success} />
              </View>
              <Text style={[addS.title, { color: colors.textPrimary, marginTop: spacing[4] }]}>Invite Sent</Text>
              <Text style={[addS.sub, { color: colors.textMuted }]}>Driver will receive an invite to join dispatchR.</Text>
              <TouchableOpacity onPress={handleClose} style={addS.btnWrap}>
                <LinearGradient colors={['#6366f1', '#4f46e5']} style={addS.btn}>
                  <Text style={addS.btnText}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[addS.title, { color: colors.textPrimary }]}>Add Driver</Text>
              <Text style={[addS.sub, { color: colors.textMuted }]}>Send an invite to a new driver</Text>
              <View style={{ marginTop: spacing[4], gap: spacing[3] }}>
                <View style={[addS.inputWrap, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <Ionicons name="person-outline" size={16} color={colors.textDisabled} />
                  <TextInput
                    style={[addS.input, { color: colors.textPrimary }]}
                    placeholder="Driver Name"
                    placeholderTextColor={colors.textDisabled}
                    value={name}
                    onChangeText={setName}
                  />
                </View>
                <View style={[addS.inputWrap, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <Ionicons name="mail-outline" size={16} color={colors.textDisabled} />
                  <TextInput
                    style={[addS.input, { color: colors.textPrimary }]}
                    placeholder="Email or Phone"
                    placeholderTextColor={colors.textDisabled}
                    value={contact}
                    onChangeText={setContact}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[5] }}>
                <TouchableOpacity style={[addS.cancelBtn, { borderColor: colors.border }]} onPress={handleClose}>
                  <Text style={[addS.cancelText, { color: colors.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1 }} onPress={handleSend} disabled={loading}>
                  <LinearGradient colors={['#6366f1', '#4f46e5']} style={[addS.btn, { opacity: loading ? 0.6 : 1 }]}>
                    {loading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={addS.btnText}>Send Invite</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const addS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: spacing[5] },
  modal: { borderRadius: radius['2xl'], padding: spacing[5], borderWidth: 1 },
  successIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: typography.lg, fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: typography.sm, marginTop: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    borderRadius: radius.md, paddingHorizontal: spacing[3], borderWidth: 1,
  },
  input: { flex: 1, fontSize: typography.base, paddingVertical: spacing[3] },
  btnWrap: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing[5] },
  btn: { paddingVertical: spacing[4], alignItems: 'center', borderRadius: radius.lg },
  btnText: { color: '#fff', fontSize: typography.base, fontWeight: '700', letterSpacing: 0.2 },
  cancelBtn: { flex: 1, borderRadius: radius.lg, paddingVertical: spacing[4], alignItems: 'center', borderWidth: 1 },
  cancelText: { fontSize: typography.base, fontWeight: '600' },
});

const makeStyles = (c, insets, isDark) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  mapWrap: { flex: 1 },

  markerWrap: { alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 99, backgroundColor: c.elevated, borderWidth: 2, borderColor: c.border },
  markerSelected: { borderColor: c.accent, width: 44, height: 44 },
  markerDot: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 99, borderWidth: 1.5, borderColor: c.elevated },
  markerText: { color: c.textPrimary, fontSize: 11, fontWeight: '700' },

  floatingCard: {
    position: 'absolute', bottom: 12, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.xl, padding: spacing[3], borderWidth: 1, gap: spacing[3],
    backgroundColor: isDark ? glass.fillDarkFloat : glass.fillLightFloat,
    borderColor: isDark ? glass.borderDark : glass.borderLightSoft,
    ...shadow.floating,
  },
  floatingAvatar: { width: 44, height: 44, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  floatingAvatarText: { color: '#fff', fontSize: typography.sm, fontWeight: '700' },
  floatingDot: { width: 10, height: 10, borderRadius: 99, position: 'absolute', bottom: 0, right: 0, borderWidth: 1.5, borderColor: c.elevated },
  floatingName: { fontSize: typography.base, fontWeight: '700', letterSpacing: -0.1 },
  floatingTruck: { fontSize: typography.xs, marginTop: 1 },
  floatingStats: { flexDirection: 'row', gap: spacing[3], marginTop: 3 },
  floatingStatRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  floatingStat: { fontSize: typography.xs },
  chatBtnWrap: { borderRadius: radius.md, overflow: 'hidden', ...shadow.glow },
  chatBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], flexDirection: 'row', alignItems: 'center', gap: 5 },
  chatBtnText: { color: '#fff', fontSize: typography.sm, fontWeight: '700' },
  floatingClose: { padding: spacing[1] },

  sheet: {
    height: 280,
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    borderTopWidth: 1, overflow: 'hidden',
  },
  sheetExpanded: { height: SCREEN_H * 0.55 },
  sheetHandle: { alignItems: 'center', paddingVertical: spacing[2] },
  handleBar: { width: 36, height: 4, borderRadius: radius.pill },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[4], paddingBottom: spacing[2] },
  sheetTitle: { fontSize: typography.base, fontWeight: '700', letterSpacing: -0.1 },
  sheetActions: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  iconBtn: { width: 34, height: 34, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  addBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 4, ...shadow.glow },
  addBtnText: { color: '#fff', fontSize: typography.sm, fontWeight: '700' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginHorizontal: spacing[4], marginBottom: spacing[2],
    borderRadius: radius.md, paddingHorizontal: spacing[3], borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: typography.sm, paddingVertical: spacing[2] },

  tabsScroll: { flexGrow: 0 },
  tabsContent: { paddingHorizontal: spacing[4], paddingBottom: spacing[2], gap: spacing[2] },
  tab: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    borderRadius: radius.pill, borderWidth: 1,
    borderColor: c.border, backgroundColor: c.surface2,
  },
  tabText: { fontSize: typography.xs, fontWeight: '600' },

  driverRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing[3],
  },
  avatar: { width: 40, height: 40, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  avatarText: { fontSize: typography.sm, fontWeight: '700' },
  statusDot: { width: 10, height: 10, borderRadius: 99, position: 'absolute', bottom: 0, right: 0, borderWidth: 1.5 },
  driverName:  { fontSize: typography.sm, fontWeight: '600', letterSpacing: -0.1 },
  driverTruck: { fontSize: typography.xs, marginTop: 1 },
  driverRoute: { fontSize: 10, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.pill },
  statusBadgeDot: { width: 5, height: 5, borderRadius: 99 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  driverEta: { fontSize: 10 },

  chatHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing[4], paddingTop: 56, gap: spacing[2] },
  chatName:  { color: '#fff', fontSize: typography.base, fontWeight: '700' },
  chatTruck: { color: 'rgba(255,255,255,0.65)', fontSize: typography.xs },

  msgWrap: { marginBottom: spacing[3] },
  msgRight: { alignItems: 'flex-end' },
  msgLeft:  { alignItems: 'flex-start' },
  msgBubble: { maxWidth: '80%', borderRadius: radius.xl, padding: spacing[3] },
  msgText: { fontSize: typography.sm, lineHeight: 19 },
  msgTime: { fontSize: 10, marginTop: 4, textAlign: 'right' },

  chatInputRow: {
    flexDirection: 'row', padding: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth, gap: spacing[2],
  },
  chatTextInput: {
    flex: 1, borderRadius: radius.lg,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderWidth: 1, fontSize: typography.sm, maxHeight: 100,
  },
  sendBtnWrap: { borderRadius: radius.pill, overflow: 'hidden' },
  sendBtn: { width: 40, height: 40, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center' },
});
