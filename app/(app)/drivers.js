import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  Modal, ScrollView, KeyboardAvoidingView, Platform, Dimensions,
  RefreshControl, Linking, Animated, Easing, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { fetchDrivers, fetchDriverChat, sendChatMessage, inviteDriver } from '../../src/api/main';

import PageHeader     from '../../src/components/shared/PageHeader';
import PageBackground from '../../src/components/shared/PageBackground';
import GlassCard      from '../../src/components/shared/GlassCard';
import StatusBadge    from '../../src/components/shared/StatusBadge';
import Avatar         from '../../src/components/shared/Avatar';
import LiveDot        from '../../src/components/shared/LiveDot';
import AnimatedPressable from '../../src/components/shared/AnimatedPressable';
import Icon           from '../../src/components/shared/Icon';
import BrandButton    from '../../src/components/shared/BrandButton';

import { spacing, typography, radius, glass, shadow, gradients } from '../../src/theme/colors';
import { darkMapStyle, lightMapStyle } from '../../src/theme/mapStyles';
import { SkeletonRow } from '../../src/components/shared/SkeletonShimmer';
import log from '../../src/utils/logger';

const { height: SCREEN_H } = Dimensions.get('window');
const STATUS_TABS = ['All', 'Moving', 'Idle', 'Offline'];
const STATUS_COLORS = { moving: '#10b981', idle: '#f59e0b', offline: '#94a3b8' };

// City centroids for the lanes used in mockDrivers, so the route polyline
// has a meaningful endpoint when drivers don't ship dest coords.
const CITY_COORDS = {
  'Los Angeles, CA':  { lat: 34.0522, lng: -118.2437 },
  'Chicago, IL':      { lat: 41.8781, lng: -87.6298 },
  'Dallas, TX':       { lat: 32.7767, lng: -96.7970 },
  'Atlanta, GA':      { lat: 33.7490, lng: -84.3880 },
  'Houston, TX':      { lat: 29.7604, lng: -95.3698 },
  'Phoenix, AZ':      { lat: 33.4484, lng: -112.0740 },
  'Seattle, WA':      { lat: 47.6062, lng: -122.3321 },
  'Miami, FL':        { lat: 25.7617, lng: -80.1918 },
  'Denver, CO':       { lat: 39.7392, lng: -104.9903 },
  'Nashville, TN':    { lat: 36.1627, lng: -86.7816 },
  'Indianapolis, IN': { lat: 39.7684, lng: -86.1581 },
  'Charlotte, NC':    { lat: 35.2271, lng: -80.8431 },
  'Memphis, TN':      { lat: 35.1495, lng: -90.0490 },
  'Kansas City, MO':  { lat: 39.0997, lng: -94.5786 },
  'Columbus, OH':     { lat: 39.9612, lng: -82.9988 },
  'San Diego, CA':    { lat: 32.7157, lng: -117.1611 },
  'Orlando, FL':      { lat: 28.5383, lng: -81.3792 },
  'New York, NY':     { lat: 40.7128, lng: -74.0060 },
  'Las Vegas, NV':    { lat: 36.1699, lng: -115.1398 },
  'Salt Lake City, UT': { lat: 40.7608, lng: -111.8910 },
};

function cityLatLng(name) {
  return CITY_COORDS[name] || null;
}

function normalizeDriver(d) {
  const statusMap = { 0: 'moving', 1: 'idle', 2: 'offline' };
  const st = typeof d.status === 'number'
    ? (statusMap[d.status] || 'offline')
    : (d.status || 'offline').toLowerCase();
  const name = d.name || (d.firstName || d.lastName
    ? `${d.firstName || ''} ${d.lastName || ''}`.trim()
    : 'Driver');
  const dest = d.dest || d.destination || d.destinationCity || 'Destination';
  const destCoords = d.destLat != null && d.destLng != null
    ? { lat: d.destLat, lng: d.destLng }
    : cityLatLng(dest);
  return {
    ...d, status: st, name,
    lat: d.lat ?? d.latitude ?? 39.5,
    lng: d.lng ?? d.longitude ?? -98.35,
    origin: d.origin || d.currentCity || 'Origin',
    dest,
    destLat: destCoords?.lat ?? null,
    destLng: destCoords?.lng ?? null,
    truck: d.truck || d.truckNumber || d.vehicleId || 'Truck',
    eta: d.eta || '—',
    dist: d.dist || d.distance || '—',
    phone: d.phone || d.phoneNumber || null,
  };
}

/* ── Idle pulse halo for markers that need attention ── */
function IdleHalo() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(scale, { toValue: 2, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: '#f59e0b',
        transform: [{ scale }],
        opacity,
        left: -9, top: -9,
      }}
    />
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
  const [apiLoading, setApiLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusTab, setStatusTab]   = useState('All');
  const [search,    setSearch]      = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [messages, setMessages]   = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const loadDrivers = useCallback(async (silent = false) => {
    if (!silent) setApiLoading(true);
    try {
      const data = await fetchDrivers();
      setDrivers((data ?? []).map(normalizeDriver));
    } catch {
      setDrivers([]);
    } finally {
      setApiLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDrivers(); }, [loadDrivers]);
  const onRefresh = useCallback(() => { setRefreshing(true); loadDrivers(true); }, [loadDrivers]);

  // Tiny "live drift" simulation so the map feels alive.
  useEffect(() => {
    const interval = setInterval(() => {
      setDrivers(prev => prev.map(d => {
        if (d.status !== 'moving') return d;
        return { ...d, lat: d.lat + (Math.random() - 0.5) * 0.008, lng: d.lng + (Math.random() - 0.5) * 0.008 };
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
        setMessages(defaultMessages(driver));
      }
    } catch {
      setMessages(defaultMessages(driver));
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
    try { await sendChatMessage(selectedDriver.id, text, userId); }
    catch (e) { log.error('DriversScreen', 'sendChatMessage failed', e); }
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
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            customMapStyle={isDark ? darkMapStyle : lightMapStyle}
            initialRegion={{ latitude: 37.09, longitude: -95.71, latitudeDelta: 30, longitudeDelta: 30 }}
          >
            {/* Dashed teal line: driver → destination on selected */}
            {selectedDriver && selectedDriver.destLat != null && selectedDriver.destLng != null && (
              <Polyline
                coordinates={[
                  { latitude: selectedDriver.lat, longitude: selectedDriver.lng },
                  { latitude: selectedDriver.destLat, longitude: selectedDriver.destLng },
                ]}
                strokeColor={isDark ? '#5dd0e3' : '#0193ab'}
                strokeWidth={4}
                lineDashPattern={[12, 8]}
                geodesic
              />
            )}

            {drivers.map(driver => {
              const isSel = selectedDriver?.id === driver.id;
              const stColor = STATUS_COLORS[driver.status] || '#94a3b8';
              return (
                <Marker
                  key={driver.id}
                  coordinate={{ latitude: driver.lat, longitude: driver.lng }}
                  onPress={() => selectDriver(driver)}
                  tracksViewChanges={false}
                >
                  <View style={s.markerOuter}>
                    {/* Idle pulse halo */}
                    {driver.status === 'idle' && <IdleHalo />}
                    <View style={[s.markerWrap, isSel && s.markerSelected]}>
                      <LinearGradient
                        colors={gradients.brand}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <Icon name="truck" size={14} color="#fff" />
                      <View style={[s.markerDot, { backgroundColor: stColor, borderColor: '#fff' }]} />
                    </View>
                    {isSel && (
                      <View style={[
                        s.markerLabel,
                        { backgroundColor: isDark ? 'rgba(8,12,22,0.92)' : 'rgba(255,255,255,0.96)' },
                      ]}>
                        <Text style={[s.markerLabelText, { color: colors.textPrimary }]} numberOfLines={1}>
                          {driver.name}
                        </Text>
                      </View>
                    )}
                  </View>
                </Marker>
              );
            })}

            {/* Destination marker for selected driver */}
            {selectedDriver && selectedDriver.destLat != null && selectedDriver.destLng != null && (
              <Marker
                coordinate={{ latitude: selectedDriver.destLat, longitude: selectedDriver.destLng }}
                tracksViewChanges={false}
              >
                <View style={s.destMarker}>
                  <Icon name="pin" size={18} color="#ef4444" />
                </View>
              </Marker>
            )}
          </MapView>

          {/* Live indicator */}
          <View style={s.liveBadge}>
            <LiveDot color="#10b981" size={7} />
            <Text style={s.liveBadgeText}>LIVE</Text>
          </View>

          {/* Floating driver card */}
          {selectedDriver && (
            <View style={s.floatingCardWrap}>
              <GlassCard variant="floating" accent contentStyle={s.floatingCard}>
                <Avatar
                  name={selectedDriver.name}
                  size={44}
                  statusColor={STATUS_COLORS[selectedDriver.status]}
                  pipBorder={isDark ? colors.surface1 : '#fff'}
                  shadowed
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.floatingName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {selectedDriver.name}
                  </Text>
                  <Text style={[s.floatingTruck, { color: colors.textMuted }]} numberOfLines={1}>
                    {selectedDriver.truck}
                  </Text>
                  <View style={s.floatingStats}>
                    {selectedDriver.eta !== '—' && (
                      <View style={s.floatingStatRow}>
                        <Icon name="clock" size={11} color={colors.textMuted} />
                        <Text style={[s.floatingStat, { color: colors.textSecondary }]}>{selectedDriver.eta}</Text>
                      </View>
                    )}
                    {selectedDriver.dist !== '—' && (
                      <View style={s.floatingStatRow}>
                        <Icon name="pin" size={11} color={colors.textMuted} />
                        <Text style={[s.floatingStat, { color: colors.textSecondary }]}>{selectedDriver.dist}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                  <AnimatedPressable
                    onPress={() => {
                      const phone = selectedDriver.phone;
                      if (phone) {
                        Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, '')}`);
                      } else {
                        Alert.alert('No phone', 'No phone on file for this driver.');
                      }
                    }}
                    hapticStyle="medium"
                    pressedScale={0.9}
                  >
                    <View style={[s.floatingActionBtn, { backgroundColor: colors.successBg, borderColor: 'rgba(16,185,129,0.32)' }]}>
                      <Icon name="phone" size={16} color={colors.successText} />
                    </View>
                  </AnimatedPressable>
                  <BrandButton label="Chat" icon="chat" size="sm" onPress={() => setChatVisible(true)} />
                </View>
                <AnimatedPressable
                  onPress={() => setSelectedDriver(null)}
                  hapticStyle="light"
                  pressedScale={0.85}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="close" size={16} color={colors.textMuted} />
                </AnimatedPressable>
              </GlassCard>
            </View>
          )}
        </View>

        {/* Bottom sheet */}
        <View style={[s.sheet, sheetExpanded && s.sheetExpanded, {
          backgroundColor: glassFill,
          borderTopColor: glassBorder,
        }]}>
          <AnimatedPressable
            onPress={() => setSheetExpanded(v => !v)}
            hapticStyle="light"
            pressedScale={0.97}
          >
            <View style={s.sheetHandle}>
              <View style={[s.handleBar, { backgroundColor: colors.border }]} />
            </View>
          </AnimatedPressable>

          <View style={s.sheetHeader}>
            <Text style={[s.sheetTitle, { color: colors.textPrimary }]}>
              Drivers{' '}
              <Text style={{ color: colors.accent }}>({drivers.length})</Text>
            </Text>
            <View style={s.sheetActions}>
              <AnimatedPressable
                onPress={() => setShowSearch(v => !v)}
                hapticStyle="selection"
                pressedScale={0.92}
              >
                <View style={[s.iconBtn, { backgroundColor: colors.surface2 }]}>
                  <Icon name="search" size={15} color={colors.textMuted} />
                </View>
              </AnimatedPressable>
              <BrandButton label="Add" icon="plus" size="sm" onPress={() => setAddModalVisible(true)} />
            </View>
          </View>

          {showSearch && (
            <View style={[s.searchWrap, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <Icon name="search" size={14} color={colors.textDisabled} />
              <TextInput
                style={[s.searchInput, { color: colors.textPrimary }]}
                placeholder="Search drivers…"
                placeholderTextColor={colors.textDisabled}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
              {search.length > 0 && (
                <AnimatedPressable onPress={() => setSearch('')} pressedScale={0.85}>
                  <Icon name="close" size={14} color={colors.textMuted} />
                </AnimatedPressable>
              )}
            </View>
          )}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.tabsScroll}
            contentContainerStyle={s.tabsContent}
          >
            {tabCounts.map(({ tab, count }) => (
              <AnimatedPressable
                key={tab}
                onPress={() => setStatusTab(tab)}
                hapticStyle="selection"
                pressedScale={0.94}
              >
                <View style={[
                  s.tab,
                  statusTab === tab && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                ]}>
                  <Text style={[s.tabText, { color: statusTab === tab ? colors.accent : colors.textMuted }]}>
                    {tab} <Text style={{ fontWeight: '800' }}>({count})</Text>
                  </Text>
                </View>
              </AnimatedPressable>
            ))}
          </ScrollView>

          {apiLoading ? (
            <View style={{ padding: spacing[4], gap: spacing[2] }}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : (
            <FlatList
              data={filteredDrivers}
              keyExtractor={d => String(d.id)}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
              renderItem={({ item: d }) => (
                <DriverListRow
                  driver={d}
                  selected={selectedDriver?.id === d.id}
                  onPress={() => selectDriver(d)}
                  colors={colors}
                  isDark={isDark}
                />
              )}
              style={{ maxHeight: sheetExpanded ? undefined : 280 }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: 'rgba(15,23,42,0.06)' }} />}
              contentContainerStyle={{ paddingBottom: spacing[4] }}
              removeClippedSubviews
              initialNumToRender={10}
              maxToRenderPerBatch={12}
              windowSize={7}
              ListEmptyComponent={
                <View style={{ padding: spacing[6], alignItems: 'center' }}>
                  <Icon name="truck" size={32} color={colors.textDisabled} />
                  <Text style={{ color: colors.textMuted, marginTop: spacing[2], fontSize: 13 }}>
                    No drivers match
                  </Text>
                </View>
              }
            />
          )}
        </View>

        {/* Chat modal */}
        <Modal
          visible={chatVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setChatVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.chatHeader}
            >
              <SafeAreaView edges={['top']} style={{ width: '100%' }}>
                <View style={s.chatHeaderInner}>
                  <AnimatedPressable
                    onPress={() => setChatVisible(false)}
                    hapticStyle="light"
                    pressedScale={0.9}
                  >
                    <View style={s.chatBackBtn}>
                      <Icon name="arrowLeft" size={18} color="#fff" />
                    </View>
                  </AnimatedPressable>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={s.chatName} numberOfLines={1}>{selectedDriver?.name}</Text>
                    <Text style={s.chatTruck} numberOfLines={1}>{selectedDriver?.truck}</Text>
                  </View>
                  {selectedDriver?.status === 'moving' ? (
                    <View style={s.chatLive}>
                      <LiveDot color="#10b981" size={7} />
                      <Text style={s.chatLiveText}>LIVE</Text>
                    </View>
                  ) : (
                    <View style={{ width: 60 }} />
                  )}
                </View>
              </SafeAreaView>
            </LinearGradient>

            <FlatList
              data={messages}
              keyExtractor={m => m.id}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing[4], gap: spacing[2] }}
              renderItem={({ item: m }) => (
                <View style={[s.msgWrap, m.sender === 'dispatcher' ? s.msgRight : s.msgLeft]}>
                  {m.sender === 'dispatcher' ? (
                    <LinearGradient
                      colors={gradients.brand}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={[s.msgBubble, { borderTopRightRadius: 6 }]}
                    >
                      <Text style={[s.msgText, { color: '#fff' }]}>{m.text}</Text>
                      <Text style={[s.msgTime, { color: 'rgba(255,255,255,0.6)' }]}>{m.time}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[
                      s.msgBubble,
                      { backgroundColor: colors.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderTopLeftRadius: 6 },
                    ]}>
                      <Text style={[s.msgText, { color: colors.textPrimary }]}>{m.text}</Text>
                      <Text style={[s.msgTime, { color: colors.textDisabled }]}>{m.time}</Text>
                    </View>
                  )}
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
                <AnimatedPressable
                  onPress={sendMessage}
                  disabled={!chatInput.trim()}
                  hapticStyle="light"
                  pressedScale={0.9}
                >
                  <LinearGradient
                    colors={gradients.brand}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[s.sendBtn, shadow.glow, !chatInput.trim() && { opacity: 0.55 }]}
                  >
                    <Icon name="send" size={16} color="#fff" />
                  </LinearGradient>
                </AnimatedPressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <AddDriverModal
          visible={addModalVisible}
          onClose={() => setAddModalVisible(false)}
          colors={colors}
          isDark={isDark}
          dispatcherId={userId}
        />
      </SafeAreaView>
    </PageBackground>
  );
}

function defaultMessages(driver) {
  return [
    { id: '1', sender: 'dispatcher', text: `Hey ${driver.name.split(' ')[0]}, how's the route looking?`, time: '10:30 AM' },
    { id: '2', sender: 'driver',     text: 'All good, smooth sailing so far.',                          time: '10:32 AM' },
    { id: '3', sender: 'dispatcher', text: 'Great. ETA still on track?',                                time: '10:35 AM' },
    { id: '4', sender: 'driver',     text: `Yes, should arrive around ${driver.eta} from now.`,         time: '10:36 AM' },
  ];
}

function DriverListRow({ driver, selected, onPress, colors, isDark }) {
  const stColor = STATUS_COLORS[driver.status] || '#94a3b8';
  return (
    <AnimatedPressable onPress={onPress} pressedScale={0.985}>
      <View style={[
        rowS.row,
        selected && { backgroundColor: colors.accentMuted },
      ]}>
        <Avatar
          name={driver.name}
          size={42}
          statusColor={stColor}
          pipBorder={isDark ? colors.surface1 : '#fff'}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[rowS.name, { color: colors.textPrimary }]} numberOfLines={1}>{driver.name}</Text>
          <Text style={[rowS.truck, { color: colors.textMuted }]} numberOfLines={1}>{driver.truck}</Text>
          {driver.status !== 'offline' && (
            <Text style={[rowS.route, { color: colors.textDisabled }]} numberOfLines={1}>
              {driver.origin} → {driver.dest}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <StatusBadge tone={driver.status} label={driver.status} size="xs" />
          {driver.status !== 'offline' && driver.eta !== '—' && (
            <Text style={[rowS.eta, { color: colors.textDisabled }]}>{driver.eta}</Text>
          )}
        </View>
      </View>
    </AnimatedPressable>
  );
}
const rowS = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3],
  },
  name:  { fontSize: 13.5, fontWeight: '700', letterSpacing: -0.1 },
  truck: { fontSize: 11.5, marginTop: 1 },
  route: { fontSize: 10.5, marginTop: 2 },
  eta:   { fontSize: 10.5, fontWeight: '500' },
});

function AddDriverModal({ visible, onClose, colors, isDark, dispatcherId }) {
  const [name, setName]       = useState('');
  const [contact, setContact] = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!name || !contact) return;
    setLoading(true);
    try { await inviteDriver(name, contact, dispatcherId); }
    catch (e) { log.error('AddDriverModal', 'inviteDriver failed', e); }
    setLoading(false);
    setSent(true);
  };

  const handleClose = () => { setSent(false); setName(''); setContact(''); onClose(); };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <View style={addS.overlay}>
        <GlassCard variant="floating" accent contentStyle={addS.modal}>
          {sent ? (
            <View style={{ alignItems: 'center', gap: spacing[3] }}>
              <LinearGradient
                colors={['#10b981', '#059669']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[addS.successIcon, shadow.glow]}
              >
                <Icon name="checkmark" size={34} color="#fff" />
              </LinearGradient>
              <Text style={[addS.title, { color: colors.textPrimary }]}>Invite sent</Text>
              <Text style={[addS.sub, { color: colors.textMuted, textAlign: 'center' }]}>
                Driver will receive an invite to join HitchLink.
              </Text>
              <BrandButton label="Done" full size="md" onPress={handleClose} />
            </View>
          ) : (
            <>
              <Text style={[addS.title, { color: colors.textPrimary }]}>Add driver</Text>
              <Text style={[addS.sub, { color: colors.textMuted }]}>Send an invite to a new driver</Text>
              <View style={{ marginTop: spacing[4], gap: spacing[3] }}>
                <View style={[addS.inputWrap, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <Icon name="user" size={16} color={colors.textDisabled} />
                  <TextInput
                    style={[addS.input, { color: colors.textPrimary }]}
                    placeholder="Driver name"
                    placeholderTextColor={colors.textDisabled}
                    value={name}
                    onChangeText={setName}
                  />
                </View>
                <View style={[addS.inputWrap, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <Icon name="mail" size={16} color={colors.textDisabled} />
                  <TextInput
                    style={[addS.input, { color: colors.textPrimary }]}
                    placeholder="Email or phone"
                    placeholderTextColor={colors.textDisabled}
                    value={contact}
                    onChangeText={setContact}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[5] }}>
                <AnimatedPressable onPress={handleClose} hapticStyle="light" pressedScale={0.97}>
                  <View style={[addS.cancelBtn, { borderColor: colors.border }]}>
                    <Text style={[addS.cancelText, { color: colors.textMuted }]}>Cancel</Text>
                  </View>
                </AnimatedPressable>
                <View style={{ flex: 1 }}>
                  <BrandButton
                    label="Send invite"
                    icon="send"
                    iconRight
                    size="md"
                    full
                    loading={loading}
                    onPress={handleSend}
                  />
                </View>
              </View>
            </>
          )}
        </GlassCard>
      </View>
    </Modal>
  );
}

const addS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing[5] },
  modal: { padding: spacing[5], gap: spacing[1] },
  successIcon: { width: 76, height: 76, borderRadius: 38, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: typography.lg, fontWeight: '800', letterSpacing: -0.3 },
  sub:   { fontSize: typography.sm, marginTop: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    borderRadius: radius.md, paddingHorizontal: spacing[3], borderWidth: 1,
  },
  input: { flex: 1, fontSize: typography.base, paddingVertical: spacing[3], fontWeight: '500' },
  cancelBtn: { borderRadius: radius.md, paddingHorizontal: spacing[5], paddingVertical: 13, alignItems: 'center', borderWidth: 1 },
  cancelText: { fontSize: typography.sm, fontWeight: '700' },
});

const makeStyles = (c, insets, isDark) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  mapWrap: { flex: 1 },

  markerOuter: { alignItems: 'center', justifyContent: 'center' },
  markerWrap: {
    width: 38, height: 38, borderRadius: 99,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    overflow: 'hidden',
    ...shadow.cardStrong,
  },
  markerSelected: { width: 46, height: 46, borderWidth: 2.5 },
  markerDot: {
    width: 11, height: 11, borderRadius: 99,
    position: 'absolute', top: -2, right: -2, borderWidth: 1.6,
  },
  markerLabel: {
    position: 'absolute',
    top: -34, alignSelf: 'center',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(1,147,171,0.32)',
    maxWidth: 160,
    ...shadow.card,
  },
  markerLabelText: { fontSize: 11.5, fontWeight: '800', letterSpacing: -0.1 },
  destMarker: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#ef4444',
    ...shadow.cardStrong,
  },
  floatingActionBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },

  liveBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: isDark ? 'rgba(8,12,22,0.86)' : 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(1,147,171,0.22)',
    ...shadow.card,
  },
  liveBadgeText: { color: '#10b981', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },

  floatingCardWrap: {
    position: 'absolute', bottom: 14, left: 12, right: 12,
  },
  floatingCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing[3], gap: spacing[3],
  },
  floatingName:  { fontSize: typography.base, fontWeight: '800', letterSpacing: -0.2 },
  floatingTruck: { fontSize: 11.5, marginTop: 1 },
  floatingStats: { flexDirection: 'row', gap: spacing[3], marginTop: 4 },
  floatingStatRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  floatingStat: { fontSize: 11.5, fontWeight: '600' },

  sheet: {
    height: 320,
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    borderTopWidth: 1, overflow: 'hidden',
  },
  sheetExpanded: { height: SCREEN_H * 0.6 },
  sheetHandle: { alignItems: 'center', paddingVertical: spacing[2] },
  handleBar: { width: 40, height: 4, borderRadius: radius.pill },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[4], paddingBottom: spacing[2] },
  sheetTitle: { fontSize: typography.base, fontWeight: '800', letterSpacing: -0.2 },
  sheetActions: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  iconBtn: { width: 34, height: 34, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginHorizontal: spacing[4], marginBottom: spacing[2],
    borderRadius: radius.md, paddingHorizontal: spacing[3], borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: typography.sm, paddingVertical: spacing[2], fontWeight: '500' },

  tabsScroll: { flexGrow: 0 },
  tabsContent: { paddingHorizontal: spacing[4], paddingBottom: spacing[2], gap: spacing[2] },
  tab: {
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.pill, borderWidth: 1,
    borderColor: c.border, backgroundColor: c.surface2,
  },
  tabText: { fontSize: typography.xs, fontWeight: '600' },

  chatHeader: {},
  chatHeaderInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[3], paddingVertical: spacing[3], gap: spacing[2],
  },
  chatBackBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  chatName:  { color: '#fff', fontSize: typography.base, fontWeight: '800', letterSpacing: -0.2 },
  chatTruck: { color: 'rgba(255,255,255,0.66)', fontSize: typography.xs, marginTop: 1 },
  chatLive: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(16,185,129,0.22)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
  },
  chatLiveText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },

  msgWrap: { },
  msgRight: { alignItems: 'flex-end' },
  msgLeft:  { alignItems: 'flex-start' },
  msgBubble: { maxWidth: '80%', borderRadius: radius.xl, padding: spacing[3] },
  msgText: { fontSize: typography.sm, lineHeight: 19 },
  msgTime: { fontSize: 10, marginTop: 4, textAlign: 'right' },

  chatInputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: spacing[3], gap: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chatTextInput: {
    flex: 1, borderRadius: radius.lg,
    paddingHorizontal: spacing[3], paddingVertical: 10,
    borderWidth: 1, fontSize: typography.sm, maxHeight: 110, fontWeight: '500',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
});
