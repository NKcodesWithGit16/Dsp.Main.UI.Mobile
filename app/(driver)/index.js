import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList,
  TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import {
  fetchActiveLoad, fetchDriverMessages, sendDriverMessage, updateDriverStatus,
} from '../../src/api/main';
import { spacing, typography, radius } from '../../src/theme/colors';

const STATUS_OPTIONS = [
  { key: 'moving',  label: 'Moving',  color: '#10b981', icon: '🟢' },
  { key: 'idle',    label: 'Idle',    color: '#f59e0b', icon: '🟡' },
  { key: 'offline', label: 'Offline', color: '#6b7280', icon: '⚫' },
];

const QUICK_PRESETS = [
  '🚗 On my way',
  '⏱ Running late',
  '✅ Arrived at pickup',
  '📦 Load secured',
  '🏁 Delivered',
];

function formatTime(dateStr) {
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function calcArrival(etaText) {
  if (!etaText) return null;
  const h = (etaText.match(/(\d+)\s*h/i) || [])[1] || 0;
  const m = (etaText.match(/(\d+)\s*m/i) || [])[1] || 0;
  const mins = parseInt(h) * 60 + parseInt(m);
  if (!mins) return null;
  return new Date(Date.now() + mins * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function DriverPortal() {
  const { colors, isDark } = useTheme();
  const { userId, userName, userRole, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState('moving');
  const [statusLoading, setStatusLoading] = useState(false);
  const [activeLoad, setActiveLoad] = useState(null);
  const [loadLoading, setLoadLoading] = useState(true);

  const [chatVisible, setChatVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const chatListRef = useRef(null);

  const [aiVisible, setAiVisible] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Load active assignment
  useEffect(() => {
    if (!userId) return;
    fetchActiveLoad(userId)
      .then(data => setActiveLoad(data))
      .catch(() => {})
      .finally(() => setLoadLoading(false));
  }, [userId]);

  // Poll chat messages
  useEffect(() => {
    if (!userId) return;
    const poll = async () => {
      try {
        const data = await fetchDriverMessages(userId);
        if (data?.length > 0) {
          const normalized = data.map(m => ({
            id: String(m.id || m.messageId || Math.random()),
            fromDriver: m.senderRole === 'driver' || m.senderId === userId,
            text: m.message || m.content || m.text || '',
            time: m.sentAt ? new Date(m.sentAt) : new Date(),
          }));
          setMessages(prev => {
            const newCount = normalized.filter(m => !m.fromDriver).length;
            const prevCount = prev.filter(m => !m.fromDriver).length;
            if (!chatVisible && newCount > prevCount) setUnread(u => u + (newCount - prevCount));
            return normalized;
          });
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, [userId, chatVisible]);

  const changeStatus = async (newStatus) => {
    setStatus(newStatus);
    setStatusLoading(true);
    try { await updateDriverStatus(userId, newStatus); } catch {}
    setStatusLoading(false);
  };

  const sendMessage = useCallback(async (preset) => {
    const text = typeof preset === 'string' ? preset : chatInput.trim();
    if (!text) return;
    if (typeof preset !== 'string') setChatInput('');

    const msg = { id: Date.now().toString(), fromDriver: true, text, time: new Date() };
    setMessages(prev => [...prev, msg]);
    setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);

    try { await sendDriverMessage(userId, text); } catch {}
  }, [chatInput, userId]);

  const sendAiMessage = useCallback(async () => {
    const text = aiInput.trim();
    if (!text || aiLoading) return;
    setAiInput('');

    const userMsg = { id: Date.now().toString(), role: 'user', content: text };
    setAiMessages(prev => [...prev, userMsg]);
    setAiLoading(true);

    try {
      const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
      if (!apiKey) {
        await new Promise(r => setTimeout(r, 800));
        const lower = text.toLowerCase();
        let reply = `I'm your AI road assistant. I can help with routes, weather, rest stops, and load info!`;
        if (lower.includes('route') || lower.includes('direction'))
          reply = '📍 For turn-by-turn navigation, use Google Maps or Waze. I can help you plan rest stops and weigh stations along your route.';
        else if (lower.includes('weather'))
          reply = '🌤 Check Weather.com or the NOAA app for real-time road weather. Would you like tips for driving in specific conditions?';
        else if (lower.includes('rest') || lower.includes('sleep') || lower.includes('hos'))
          reply = '😴 HOS regulations require 11-hour driving window and 10-hour rest. Trucker Path app is great for finding truck stops and rest areas.';
        else if (lower.includes('load') || lower.includes('delivery'))
          reply = `📦 Your active load info is shown on the main screen. Contact your dispatcher if you have questions about the assignment.`;
        setAiMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: reply }]);
      } else {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            system: `You are an AI assistant built into the DispatchR mobile app for truck drivers. Help with routes, HOS compliance, weather, rest stops, load questions, and general driving safety. Be concise — drivers read on the road. Driver name: ${userName}.`,
            messages: [...aiMessages, userMsg].map(m => ({ role: m.role, content: m.content })),
          }),
        });
        const data = await res.json();
        setAiMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: data.content[0].text }]);
      }
    } catch {
      setAiMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Sorry, I ran into an error. Please try again.', isError: true }]);
    } finally {
      setAiLoading(false);
    }
  }, [aiInput, aiMessages, aiLoading, userName]);

  const openMaps = () => {
    if (!activeLoad) return;
    const dest = activeLoad.dropoffLat
      ? `${activeLoad.dropoffLat},${activeLoad.dropoffLng}`
      : encodeURIComponent(activeLoad.destination || '');
    Linking.openURL(`https://maps.google.com/?daddr=${dest}`).catch(() => {});
  };

  const currentStatus = STATUS_OPTIONS.find(s => s.key === status) || STATUS_OPTIONS[0];
  const s = makeStyles(colors);

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      {/* Header */}
      <LinearGradient colors={['#08090e', '#11141c']} style={[s.header, { paddingTop: insets.top + spacing[2] }]}>
        <View style={s.headerLeft}>
          <Text style={s.logoText}>dispatch<Text style={{ color: colors.accent }}>R</Text></Text>
          <View style={[s.roleBadge, { backgroundColor: colors.accentMuted }]}>
            <Text style={[s.roleText, { color: colors.accent }]}>Driver Portal</Text>
          </View>
        </View>
        <View style={s.headerRight}>
          <View style={[s.statusIndicator, { backgroundColor: currentStatus.color + '22', borderColor: currentStatus.color + '55' }]}>
            <View style={[s.statusDot, { backgroundColor: currentStatus.color }]} />
            <Text style={[s.statusIndicatorText, { color: currentStatus.color }]}>{currentStatus.label}</Text>
          </View>
          <TouchableOpacity
            style={[s.avatarBtn, { backgroundColor: colors.surface2 }]}
            onPress={() => Alert.alert('Sign Out', 'Sign out of DispatchR?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: () => { logout(); router.replace('/(auth)/login'); } },
            ])}
          >
            <Text style={[s.avatarText, { color: colors.textSecondary }]}>
              {userName ? userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'DR'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Map placeholder */}
        <View style={[s.mapCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <View style={s.mapInner}>
            {/* Fake road lines */}
            <View style={[s.road, s.roadH, { top: '40%', backgroundColor: colors.border }]} />
            <View style={[s.road, s.roadH, { top: '65%', backgroundColor: colors.border }]} />
            <View style={[s.road, s.roadV, { left: '30%', backgroundColor: colors.border }]} />
            <View style={[s.road, s.roadV, { left: '70%', backgroundColor: colors.border }]} />
            {/* Driver pin */}
            <View style={s.driverPin}>
              <LinearGradient colors={['#6366f1', '#4f46e5']} style={s.driverPinInner}>
                <Text style={s.driverPinIcon}>🚛</Text>
              </LinearGradient>
              <View style={[s.driverPinPulse, { borderColor: colors.accent }]} />
            </View>
            {/* Destination pin */}
            {activeLoad && (
              <View style={s.destPin}>
                <View style={[s.destPinDot, { backgroundColor: colors.danger }]} />
                <Text style={[s.destPinLabel, { backgroundColor: colors.danger, color: '#fff' }]}>DEST</Text>
              </View>
            )}
          </View>
          <View style={[s.mapOverlay, { backgroundColor: colors.surface1 + 'cc' }]}>
            <Text style={[s.mapOverlayText, { color: colors.textMuted }]}>🗺️ Live GPS tracking in production build</Text>
          </View>
          {activeLoad && (
            <TouchableOpacity style={s.openMapsBtn} onPress={openMaps} activeOpacity={0.85}>
              <LinearGradient colors={['#6366f1', '#4f46e5']} style={s.openMapsBtnGrad}>
                <Text style={s.openMapsBtnText}>📍 Navigate</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Active Load Card */}
        {loadLoading ? (
          <View style={[s.card, { backgroundColor: colors.surface1, borderColor: colors.border, alignItems: 'center', padding: spacing[6] }]}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : activeLoad ? (
          <View style={[s.card, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
            <View style={s.loadHeader}>
              <View style={[s.loadPulse, { backgroundColor: colors.success + '22' }]}>
                <View style={[s.loadPulseDot, { backgroundColor: colors.success }]} />
                <Text style={[s.loadPulseText, { color: colors.success }]}>ACTIVE LOAD</Text>
              </View>
              {activeLoad.id && <Text style={[s.loadIdText, { color: colors.textMuted }]}>#{activeLoad.id}</Text>}
            </View>

            {/* Route */}
            <View style={s.routeWrap}>
              <View style={s.routeRow}>
                <View style={[s.routeDot, { backgroundColor: colors.success }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.routeKind, { color: colors.textDisabled }]}>FROM</Text>
                  <Text style={[s.routeCity, { color: colors.textPrimary }]}>{activeLoad.origin || activeLoad.pickupAddress || 'Pickup'}</Text>
                </View>
              </View>
              <View style={[s.routeLine, { backgroundColor: colors.border }]} />
              <View style={s.routeRow}>
                <View style={[s.routeDot, { backgroundColor: colors.danger }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.routeKind, { color: colors.textDisabled }]}>TO</Text>
                  <Text style={[s.routeCity, { color: colors.textPrimary }]}>{activeLoad.destination || activeLoad.dropoffAddress || 'Delivery'}</Text>
                </View>
              </View>
            </View>

            {/* Stats */}
            <View style={s.loadStats}>
              {[
                { label: 'ETA', value: activeLoad.eta || '—' },
                { label: 'Distance', value: activeLoad.miles ? `${activeLoad.miles} mi` : '—' },
                { label: 'Rate', value: activeLoad.rate ? `$${activeLoad.rate.toLocaleString()}` : '—' },
              ].map(stat => (
                <View key={stat.label} style={[s.loadStat, { backgroundColor: colors.surface2 }]}>
                  <Text style={[s.loadStatVal, { color: colors.textPrimary }]}>{stat.value}</Text>
                  <Text style={[s.loadStatLbl, { color: colors.textMuted }]}>{stat.label}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={s.navBtnWrap} onPress={openMaps} activeOpacity={0.85}>
              <LinearGradient colors={['#6366f1', '#4f46e5']} style={s.navBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={s.navBtnText}>📍 Open in Maps</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[s.card, { backgroundColor: colors.surface1, borderColor: colors.border, alignItems: 'center', padding: spacing[6] }]}>
            <Text style={{ fontSize: 40, marginBottom: spacing[3] }}>🚛</Text>
            <Text style={[s.noLoadTitle, { color: colors.textPrimary }]}>No Active Load</Text>
            <Text style={[s.noLoadSub, { color: colors.textMuted }]}>Your next assignment will appear here once a dispatcher assigns you a load.</Text>
          </View>
        )}

        {/* Status Control */}
        <View style={[s.card, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
          <View style={s.statusHead}>
            <View style={[s.statusBigDot, { backgroundColor: currentStatus.color }]} />
            <View>
              <Text style={[s.statusHeadTitle, { color: colors.textPrimary }]}>You're {currentStatus.label}</Text>
              <Text style={[s.statusHeadSub, { color: colors.textMuted }]}>Dispatchers see this in real time</Text>
            </View>
            {statusLoading && <ActivityIndicator color={colors.accent} size="small" style={{ marginLeft: 'auto' }} />}
          </View>
          <View style={s.statusRow}>
            {STATUS_OPTIONS.map(opt => {
              const active = status === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.statusBtn, { borderColor: active ? opt.color : colors.border, backgroundColor: active ? opt.color + '22' : colors.surface2 }]}
                  onPress={() => changeStatus(opt.key)}
                  activeOpacity={0.8}
                >
                  <View style={[s.statusBtnDot, { backgroundColor: opt.color }]} />
                  <Text style={[s.statusBtnText, { color: active ? opt.color : colors.textMuted }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Communication */}
        <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Communication</Text>
        <View style={s.commRow}>
          {/* Dispatcher Chat */}
          <TouchableOpacity
            style={[s.commCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}
            onPress={() => { setChatVisible(true); setUnread(0); }}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#6366f1', '#4f46e5']} style={s.commIconWrap}>
              <Text style={s.commIcon}>💬</Text>
            </LinearGradient>
            <Text style={[s.commLabel, { color: colors.textPrimary }]}>Dispatcher</Text>
            <Text style={[s.commSub, { color: colors.textMuted }]}>
              {unread > 0 ? `${unread} new message${unread > 1 ? 's' : ''}` : 'Chat with your dispatcher'}
            </Text>
            {unread > 0 && (
              <View style={[s.unreadBadge, { backgroundColor: colors.danger }]}>
                <Text style={s.unreadText}>{unread}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* AI Assistant */}
          <TouchableOpacity
            style={[s.commCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}
            onPress={() => setAiVisible(true)}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#8b5cf6', '#6366f1']} style={s.commIconWrap}>
              <Text style={s.commIcon}>✦</Text>
            </LinearGradient>
            <Text style={[s.commLabel, { color: colors.textPrimary }]}>AI Assistant</Text>
            <Text style={[s.commSub, { color: colors.textMuted }]}>Routes, HOS & load help</Text>
          </TouchableOpacity>
        </View>

        {/* Quick messages */}
        <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Quick Messages</Text>
        <View style={s.presetsWrap}>
          {QUICK_PRESETS.map(preset => (
            <TouchableOpacity
              key={preset}
              style={[s.presetBtn, { backgroundColor: colors.surface1, borderColor: colors.border }]}
              onPress={() => { sendMessage(preset); Alert.alert('Sent', `"${preset}" sent to dispatcher.`); }}
              activeOpacity={0.8}
            >
              <Text style={[s.presetText, { color: colors.textSecondary }]}>{preset}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: spacing[8] }} />
      </ScrollView>

      {/* Dispatcher Chat Modal */}
      <Modal visible={chatVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setChatVisible(false)}>
        <View style={[s.modalWrap, { backgroundColor: colors.pageBg }]}>
          <LinearGradient colors={['#4f46e5', '#6366f1']} style={s.chatHeader}>
            <TouchableOpacity onPress={() => setChatVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={s.chatBackText}>← Back</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.chatTitle}>Dispatcher</Text>
              <Text style={s.chatSub}>Active now</Text>
            </View>
            <View style={{ width: 60 }} />
          </LinearGradient>

          <FlatList
            ref={chatListRef}
            data={messages}
            keyExtractor={m => m.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: spacing[4], gap: spacing[3] }}
            ListEmptyComponent={
              <View style={s.chatEmpty}>
                <Text style={{ fontSize: 40, marginBottom: spacing[3] }}>💬</Text>
                <Text style={[s.chatEmptyTitle, { color: colors.textPrimary }]}>No messages yet</Text>
                <Text style={[s.chatEmptySub, { color: colors.textMuted }]}>Send a message to your dispatcher</Text>
              </View>
            }
            renderItem={({ item: m }) => (
              <View style={[s.msgRow, m.fromDriver ? s.msgRowRight : s.msgRowLeft]}>
                {m.fromDriver ? (
                  <LinearGradient colors={['#6366f1', '#4f46e5']} style={s.msgBubble}>
                    <Text style={[s.msgText, { color: '#fff' }]}>{m.text}</Text>
                    <Text style={[s.msgTime, { color: 'rgba(255,255,255,0.55)' }]}>{formatTime(m.time)}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[s.msgBubble, { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }]}>
                    <Text style={[s.msgText, { color: colors.textPrimary }]}>{m.text}</Text>
                    <Text style={[s.msgTime, { color: colors.textDisabled }]}>{formatTime(m.time)}</Text>
                  </View>
                )}
              </View>
            )}
          />

          {/* Quick presets */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.presetsScroll, { borderTopColor: colors.border }]} contentContainerStyle={s.presetsScrollContent}>
            {QUICK_PRESETS.map(p => (
              <TouchableOpacity key={p} style={[s.presetChip, { backgroundColor: colors.accentMuted, borderColor: colors.accent + '44' }]} onPress={() => sendMessage(p)}>
                <Text style={[s.presetChipText, { color: colors.accent }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[s.inputRow, { backgroundColor: colors.surface1, borderTopColor: colors.border }]}>
              <TextInput
                style={[s.textInput, { backgroundColor: colors.surface2, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="Message dispatcher…"
                placeholderTextColor={colors.textDisabled}
                value={chatInput}
                onChangeText={setChatInput}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[s.sendBtnWrap, { opacity: chatInput.trim() ? 1 : 0.4 }]}
                onPress={() => sendMessage()}
                disabled={!chatInput.trim()}
              >
                <LinearGradient colors={['#6366f1', '#4f46e5']} style={s.sendBtn}>
                  <Text style={{ color: '#fff', fontSize: 16 }}>➤</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* AI Assistant Modal */}
      <Modal visible={aiVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAiVisible(false)}>
        <View style={[s.modalWrap, { backgroundColor: colors.pageBg }]}>
          <LinearGradient colors={['#7c3aed', '#6366f1']} style={s.chatHeader}>
            <TouchableOpacity onPress={() => setAiVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={s.chatBackText}>← Back</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.chatTitle}>✦ AI Assistant</Text>
              <Text style={s.chatSub}>{aiLoading ? 'Thinking…' : 'Road & dispatch help'}</Text>
            </View>
            {aiMessages.length > 0 && (
              <TouchableOpacity onPress={() => setAiMessages([])} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Clear</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>

          <FlatList
            data={aiMessages}
            keyExtractor={m => m.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: spacing[4], gap: spacing[3] }}
            ListEmptyComponent={
              <View style={s.chatEmpty}>
                <LinearGradient colors={['#7c3aed', '#6366f1']} style={s.aiEmptyIcon}>
                  <Text style={{ color: '#fff', fontSize: 28 }}>✦</Text>
                </LinearGradient>
                <Text style={[s.chatEmptyTitle, { color: colors.textPrimary }]}>Ask me anything</Text>
                <Text style={[s.chatEmptySub, { color: colors.textMuted }]}>Routes, HOS rules, weather, rest stops, and more</Text>
                <View style={{ gap: spacing[2], width: '100%', marginTop: spacing[4] }}>
                  {['How many HOS hours do I have?', 'Where is the nearest truck stop?', 'What is the speed limit here?'].map(q => (
                    <TouchableOpacity key={q} style={[s.aiSuggestion, { backgroundColor: colors.surface1, borderColor: colors.border }]} onPress={() => { setAiInput(q); }}>
                      <Text style={[s.aiSuggestionText, { color: colors.textSecondary }]}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            }
            renderItem={({ item: m }) => (
              <View style={[s.msgRow, m.role === 'user' ? s.msgRowRight : s.msgRowLeft]}>
                {m.role === 'user' ? (
                  <LinearGradient colors={['#6366f1', '#4f46e5']} style={s.msgBubble}>
                    <Text style={[s.msgText, { color: '#fff' }]}>{m.content}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[s.msgBubble, { backgroundColor: colors.surface1, borderWidth: 1, borderColor: m.isError ? colors.danger : colors.border }]}>
                    <Text style={[s.msgText, { color: colors.textPrimary }]}>{m.content}</Text>
                  </View>
                )}
              </View>
            )}
            ListFooterComponent={aiLoading ? (
              <View style={[s.msgRow, s.msgRowLeft]}>
                <View style={[s.msgBubble, { backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', gap: 5 }}>
                    {[0, 1, 2].map(i => <View key={i} style={[s.dot, { backgroundColor: colors.accent }]} />)}
                  </View>
                </View>
              </View>
            ) : null}
          />

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[s.inputRow, { backgroundColor: colors.surface1, borderTopColor: colors.border }]}>
              <TextInput
                style={[s.textInput, { backgroundColor: colors.surface2, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="Ask AI assistant…"
                placeholderTextColor={colors.textDisabled}
                value={aiInput}
                onChangeText={setAiInput}
                multiline
                maxLength={500}
                onSubmitEditing={sendAiMessage}
                returnKeyType="send"
                editable={!aiLoading}
              />
              <TouchableOpacity
                style={[s.sendBtnWrap, { opacity: (aiInput.trim() && !aiLoading) ? 1 : 0.4 }]}
                onPress={sendAiMessage}
                disabled={!aiInput.trim() || aiLoading}
              >
                <LinearGradient colors={['#7c3aed', '#6366f1']} style={s.sendBtn}>
                  <Text style={{ color: '#fff', fontSize: 16 }}>➤</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.pageBg },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
  headerLeft: { gap: 4 },
  logoText: { color: c.textPrimary, fontSize: typography.lg, fontWeight: '800', letterSpacing: -0.5 },
  roleBadge: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.pill, alignSelf: 'flex-start' },
  roleText: { fontSize: 10, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 99 },
  statusIndicatorText: { fontSize: typography.xs, fontWeight: '700' },
  avatarBtn: { width: 32, height: 32, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: typography.xs, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: spacing[4] },
  // Map
  mapCard: { borderRadius: radius.xl, borderWidth: 1, height: 180, overflow: 'hidden', marginBottom: spacing[4], position: 'relative' },
  mapInner: { flex: 1 },
  road: { position: 'absolute' },
  roadH: { left: 0, right: 0, height: 12 },
  roadV: { top: 0, bottom: 0, width: 12 },
  driverPin: { position: 'absolute', top: '35%', left: '45%', alignItems: 'center' },
  driverPinInner: { width: 44, height: 44, borderRadius: 99, justifyContent: 'center', alignItems: 'center' },
  driverPinIcon: { fontSize: 22 },
  driverPinPulse: { position: 'absolute', width: 60, height: 60, borderRadius: 99, borderWidth: 2, opacity: 0.4 },
  destPin: { position: 'absolute', top: '20%', right: '15%', alignItems: 'center' },
  destPinDot: { width: 14, height: 14, borderRadius: 99 },
  destPinLabel: { fontSize: 9, fontWeight: '800', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, marginTop: 2 },
  mapOverlay: { position: 'absolute', bottom: 8, left: 8, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  mapOverlayText: { fontSize: 10 },
  openMapsBtn: { position: 'absolute', top: 10, right: 10, borderRadius: radius.md, overflow: 'hidden' },
  openMapsBtnGrad: { paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  openMapsBtnText: { color: '#fff', fontSize: typography.xs, fontWeight: '700' },
  // Card
  card: { borderRadius: radius.xl, borderWidth: 1, padding: spacing[4], marginBottom: spacing[4] },
  loadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  loadPulse: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.pill },
  loadPulseDot: { width: 7, height: 7, borderRadius: 99 },
  loadPulseText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  loadIdText: { fontSize: typography.xs, fontWeight: '600' },
  routeWrap: { marginBottom: spacing[4] },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  routeDot: { width: 10, height: 10, borderRadius: 99 },
  routeKind: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 1 },
  routeCity: { fontSize: typography.base, fontWeight: '700' },
  routeLine: { width: 2, height: 20, marginLeft: 4, marginVertical: 4 },
  loadStats: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  loadStat: { flex: 1, borderRadius: radius.lg, padding: spacing[3], alignItems: 'center' },
  loadStatVal: { fontSize: typography.base, fontWeight: '800' },
  loadStatLbl: { fontSize: 10, marginTop: 2 },
  navBtnWrap: { borderRadius: radius.md, overflow: 'hidden' },
  navBtn: { paddingVertical: spacing[3], alignItems: 'center' },
  navBtnText: { color: '#fff', fontSize: typography.base, fontWeight: '700' },
  noLoadTitle: { fontSize: typography.lg, fontWeight: '700', marginBottom: spacing[2] },
  noLoadSub: { fontSize: typography.sm, textAlign: 'center', lineHeight: 20 },
  // Status
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  statusBigDot: { width: 14, height: 14, borderRadius: 99 },
  statusHeadTitle: { fontSize: typography.base, fontWeight: '700' },
  statusHeadSub: { fontSize: typography.xs, marginTop: 1 },
  statusRow: { flexDirection: 'row', gap: spacing[2] },
  statusBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1.5 },
  statusBtnDot: { width: 8, height: 8, borderRadius: 99 },
  statusBtnText: { fontSize: typography.sm, fontWeight: '700' },
  // Communication
  sectionTitle: { fontSize: typography.base, fontWeight: '700', marginBottom: spacing[3] },
  commRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[4] },
  commCard: { flex: 1, borderRadius: radius.xl, borderWidth: 1, padding: spacing[4], alignItems: 'center', position: 'relative' },
  commIconWrap: { width: 44, height: 44, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center', marginBottom: spacing[2] },
  commIcon: { fontSize: 20 },
  commLabel: { fontSize: typography.sm, fontWeight: '700', textAlign: 'center' },
  commSub: { fontSize: typography.xs, textAlign: 'center', marginTop: 2 },
  unreadBadge: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 99, justifyContent: 'center', alignItems: 'center' },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  // Presets
  presetsWrap: { gap: spacing[2], marginBottom: spacing[4] },
  presetBtn: { borderRadius: radius.xl, padding: spacing[4], borderWidth: 1 },
  presetText: { fontSize: typography.sm, fontWeight: '600' },
  // Chat modal
  modalWrap: { flex: 1 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingTop: 56, paddingBottom: spacing[4] },
  chatBackText: { color: 'rgba(255,255,255,0.85)', fontSize: typography.base, fontWeight: '600' },
  chatTitle: { color: '#fff', fontSize: typography.base, fontWeight: '700' },
  chatSub: { color: 'rgba(255,255,255,0.65)', fontSize: typography.xs, marginTop: 1 },
  chatEmpty: { padding: spacing[8], alignItems: 'center' },
  aiEmptyIcon: { width: 64, height: 64, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center', marginBottom: spacing[4] },
  chatEmptyTitle: { fontSize: typography.lg, fontWeight: '700', marginBottom: spacing[2] },
  chatEmptySub: { fontSize: typography.sm, textAlign: 'center' },
  msgRow: { flexDirection: 'row' },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgBubble: { maxWidth: '78%', borderRadius: radius.xl, padding: spacing[3] },
  msgText: { fontSize: typography.sm, lineHeight: 20 },
  msgTime: { fontSize: 10, marginTop: 3, textAlign: 'right' },
  presetsScroll: { flexGrow: 0, borderTopWidth: 1 },
  presetsScrollContent: { padding: spacing[3], gap: spacing[2] },
  presetChip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.pill, borderWidth: 1 },
  presetChipText: { fontSize: typography.xs, fontWeight: '600' },
  inputRow: { flexDirection: 'row', padding: spacing[3], borderTopWidth: 1, gap: spacing[2] },
  textInput: { flex: 1, borderRadius: radius.xl, paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderWidth: 1, fontSize: typography.sm, maxHeight: 120 },
  sendBtnWrap: { borderRadius: radius.pill, overflow: 'hidden', marginTop: 'auto' },
  sendBtn: { width: 44, height: 44, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center' },
  aiSuggestion: { borderRadius: radius.xl, padding: spacing[3], borderWidth: 1 },
  aiSuggestionText: { fontSize: typography.sm },
  dot: { width: 7, height: 7, borderRadius: 99 },
});
