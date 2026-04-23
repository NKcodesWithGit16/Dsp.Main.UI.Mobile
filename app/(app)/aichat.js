import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/context/ThemeContext';
import { spacing, typography, radius } from '../../src/theme/colors';
import { fetchLoads, fetchDrivers } from '../../src/api/main';

const SUGGESTED_PROMPTS = [
  { icon: '🔥', text: 'What are my hot loads?' },
  { icon: '🚛', text: 'Show fleet utilization stats' },
  { icon: '👤', text: 'Which drivers are available?' },
  { icon: '📊', text: "Summarize today's deliveries" },
];

function buildContext(loads, drivers) {
  const statusOf = d => {
    if (typeof d.status === 'number') return ['moving', 'idle', 'offline'][d.status] ?? 'offline';
    return (d.status || 'offline').toLowerCase();
  };
  const moving = drivers.filter(d => statusOf(d) === 'moving').length;
  const idle = drivers.filter(d => statusOf(d) === 'idle').length;
  const offline = drivers.filter(d => statusOf(d) === 'offline').length;
  const hot = loads.filter(l => l.status === 'Hot' || l.status === 'hot').length;
  const booked = loads.filter(l => l.status === 'Booked' || l.status === 'booked').length;
  return `You are a dispatch assistant for DispatchR. Current fleet: ${drivers.length} drivers (${moving} moving, ${idle} idle, ${offline} offline). Hot loads: ${hot}. Booked loads: ${booked}. Total loads: ${loads.length}. Answer concisely and professionally.`;
}

async function callAI(messages, loads, drivers) {
  const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  const statusOf = d => {
    if (typeof d.status === 'number') return ['moving', 'idle', 'offline'][d.status] ?? 'offline';
    return (d.status || 'offline').toLowerCase();
  };
  if (!API_KEY) {
    const last = messages[messages.length - 1].content.toLowerCase();
    if (last.includes('hot')) {
      const hot = loads.filter(l => l.status === 'Hot' || l.status === 'hot');
      return `You have **${hot.length} hot loads** right now.\n\nTop priority:\n${hot.slice(0, 3).map(l => `• ${l.origin} → ${l.destination} ($${(l.rate || 0).toLocaleString()})`).join('\n') || '(none)'}`;
    }
    if (last.includes('driver') || last.includes('fleet')) {
      const moving = drivers.filter(d => statusOf(d) === 'moving');
      const idle = drivers.filter(d => statusOf(d) === 'idle');
      const offline = drivers.filter(d => statusOf(d) === 'offline');
      const nameOf = d => d.name || [d.firstName, d.lastName].filter(Boolean).join(' ') || 'Driver';
      return `**Fleet Status**\n• 🟢 Moving: ${moving.length} drivers\n• 🟡 Idle: ${idle.length} drivers\n• ⚫ Offline: ${offline.length} drivers\n\n**Available:**\n${[...moving, ...idle].slice(0, 5).map(d => `• ${nameOf(d)}`).join('\n') || '(none)'}`;
    }
    if (last.includes('revenue') || last.includes('rate') || last.includes('deliver')) {
      const booked = loads.filter(l => l.status === 'Booked' || l.status === 'booked');
      const total = booked.reduce((s, l) => s + (l.rate || 0), 0);
      return `**Revenue**\n• Booked loads: ${booked.length}\n• Total: $${total.toLocaleString()}\n• Avg rate: $${booked.length ? Math.round(total / booked.length).toLocaleString() : 0}`;
    }
    return `I'm your **DispatchR AI** assistant. I can help with:\n• Load analysis & hot load alerts\n• Fleet status & driver availability\n• Revenue & rate analysis\n• Dispatch decisions\n\nAsk me anything about your fleet!`;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: buildContext(loads, drivers),
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error('AI request failed');
  const data = await res.json();
  return data.content[0].text;
}

export default function AiChatScreen() {
  const { colors } = useTheme();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [loads, setLoads] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const listRef = useRef(null);

  useEffect(() => {
    Promise.all([fetchLoads({ pageSize: 50 }), fetchDrivers()]).then(([l, d]) => {
      setLoads(l);
      setDrivers(d);
    }).catch(() => {});
  }, []);

  const send = useCallback(async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');

    const userMsg = { id: Date.now().toString(), role: 'user', content: q };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const reply = await callAI(nextMessages.map(m => ({ role: m.role, content: m.content })), loads, drivers);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', isError: true }]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, messages, loading, loads, drivers]);

  const copyMessage = (id, text) => {
    Share.share({ message: text }).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const s = makeStyles(colors);

  return (
    <SafeAreaView style={s.safe} edges={['left', 'right']}>
      {/* Header */}
      <LinearGradient colors={['#4f46e5', '#6366f1', '#818cf8']} style={s.header}>
        <View style={s.aiAvatar}>
          <Text style={s.aiAvatarIcon}>✦</Text>
          {loading && <View style={[s.loadingRing, { borderColor: 'rgba(255,255,255,0.5)' }]} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>AI Dispatcher</Text>
          <Text style={s.headerSub}>{loading ? 'Thinking…' : 'Your logistics assistant'}</Text>
        </View>
        {messages.length > 0 && (
          <TouchableOpacity
            style={s.clearBtn}
            onPress={() => setMessages([])}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>🗑️</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        {messages.length === 0 ? (
          <View style={s.emptyState}>
            <LinearGradient colors={['#4f46e5', '#6366f1', '#818cf8']} style={s.emptyIcon}>
              <Text style={s.emptyIconText}>✦</Text>
            </LinearGradient>
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>Ask anything about your fleet</Text>
            <Text style={[s.emptySub, { color: colors.textMuted }]}>Get instant insights on dispatch, loads, and drivers</Text>
            <View style={s.promptsGrid}>
              {SUGGESTED_PROMPTS.map((p, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.promptChip, { backgroundColor: colors.surface1, borderColor: colors.border }]}
                  onPress={() => send(p.text)}
                  activeOpacity={0.8}
                >
                  <Text style={s.promptIcon}>{p.icon}</Text>
                  <Text style={[s.promptText, { color: colors.textSecondary }]}>{p.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            style={{ flex: 1 }}
            contentContainerStyle={s.msgList}
            renderItem={({ item: m }) => (
              <View style={[s.msgWrap, m.role === 'user' ? s.msgRight : s.msgLeft]}>
                {m.role === 'assistant' && (
                  <LinearGradient colors={['#4f46e5', '#6366f1']} style={s.msgAvatar}>
                    <Text style={s.msgAvatarIcon}>✦</Text>
                  </LinearGradient>
                )}
                <View style={{ flex: 1, maxWidth: '80%' }}>
                  {m.role === 'user' ? (
                    <LinearGradient colors={['#6366f1', '#4f46e5']} style={[s.msgBubble, s.userBubble]}>
                      <Text style={[s.msgText, { color: '#fff' }]}>{m.content}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[s.msgBubble, s.aiBubble, { backgroundColor: colors.surface1, borderColor: m.isError ? colors.danger : colors.border }]}>
                      <Text style={[s.msgText, { color: colors.textPrimary }]}>{m.content}</Text>
                    </View>
                  )}
                  {m.role === 'assistant' && (
                    <View style={s.msgActions}>
                      <TouchableOpacity onPress={() => copyMessage(m.id, m.content)} style={s.msgAction}>
                        <Text style={[s.msgActionText, { color: copied === m.id ? colors.success : colors.textMuted }]}>
                          {copied === m.id ? '✓ Copied' : '📋 Copy'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => {
                        const lastUser = [...messages].reverse().find(msg => msg.role === 'user');
                        if (lastUser) send(lastUser.content);
                      }} style={s.msgAction}>
                        <Text style={[s.msgActionText, { color: colors.textMuted }]}>🔄 Retry</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}
            ListFooterComponent={loading ? (
              <View style={s.msgLeft}>
                <LinearGradient colors={['#4f46e5', '#6366f1']} style={s.msgAvatar}>
                  <Text style={s.msgAvatarIcon}>✦</Text>
                </LinearGradient>
                <View style={[s.typingBubble, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
                  <View style={s.typingDots}>
                    {[0, 1, 2].map(i => (
                      <View key={i} style={[s.dot, { backgroundColor: colors.accent }]} />
                    ))}
                  </View>
                </View>
              </View>
            ) : null}
          />
        )}

        {/* Input */}
        <View style={[s.inputWrap, { backgroundColor: colors.surface1, borderTopColor: colors.border }]}>
          <TextInput
            style={[s.input, { backgroundColor: colors.surface2, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="Ask about your fleet, loads, drivers…"
            placeholderTextColor={colors.textDisabled}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            onSubmitEditing={() => send()}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[s.sendBtnWrap, { opacity: (!input.trim() && !loading) ? 0.4 : 1 }]}
            onPress={loading ? () => setLoading(false) : () => send()}
            disabled={!input.trim() && !loading}
          >
            <LinearGradient
              colors={loading ? ['#ef4444', '#dc2626'] : ['#6366f1', '#4f46e5']}
              style={s.sendBtn}
            >
              <Text style={{ color: '#fff', fontSize: 15 }}>{loading ? '■' : '➤'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingTop: 56, paddingBottom: spacing[4], gap: spacing[3] },
  aiAvatar: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  aiAvatarIcon: { color: '#fff', fontSize: 22, fontWeight: '700' },
  loadingRing: { position: 'absolute', width: 48, height: 48, borderRadius: 99, borderWidth: 2 },
  headerTitle: { color: '#fff', fontSize: typography.base, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: typography.xs, marginTop: 1 },
  clearBtn: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[6] },
  emptyIcon: { width: 72, height: 72, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center', marginBottom: spacing[4] },
  emptyIconText: { color: '#fff', fontSize: 32 },
  emptyTitle: { fontSize: typography.lg, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: typography.sm, textAlign: 'center', marginTop: spacing[2], marginBottom: spacing[6] },
  promptsGrid: { width: '100%', gap: spacing[3] },
  promptChip: { flexDirection: 'row', alignItems: 'center', padding: spacing[4], borderRadius: radius.xl, borderWidth: 1, gap: spacing[3] },
  promptIcon: { fontSize: 20 },
  promptText: { fontSize: typography.sm, fontWeight: '600', flex: 1 },
  msgList: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[4] },
  msgWrap: { flexDirection: 'row', gap: spacing[2] },
  msgRight: { justifyContent: 'flex-end' },
  msgLeft: { justifyContent: 'flex-start', alignItems: 'flex-start' },
  msgAvatar: { width: 30, height: 30, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center', marginTop: 4, flexShrink: 0 },
  msgAvatarIcon: { color: '#fff', fontSize: 13 },
  msgBubble: { borderRadius: radius.xl, padding: spacing[4], marginBottom: 4 },
  userBubble: { alignSelf: 'flex-end' },
  aiBubble: { alignSelf: 'flex-start', borderWidth: 1 },
  msgText: { fontSize: typography.sm, lineHeight: 20 },
  msgActions: { flexDirection: 'row', gap: spacing[3], paddingHorizontal: spacing[1] },
  msgAction: { paddingVertical: 2 },
  msgActionText: { fontSize: typography.xs },
  typingBubble: { borderRadius: radius.xl, padding: spacing[4], borderWidth: 1 },
  typingDots: { flexDirection: 'row', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 99 },
  inputWrap: { flexDirection: 'row', padding: spacing[3], borderTopWidth: 1, gap: spacing[2] },
  input: { flex: 1, borderRadius: radius.xl, paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderWidth: 1, fontSize: typography.sm, maxHeight: 120 },
  sendBtnWrap: { borderRadius: radius.pill, overflow: 'hidden', marginTop: 'auto' },
  sendBtn: { width: 44, height: 44, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center' },
});
