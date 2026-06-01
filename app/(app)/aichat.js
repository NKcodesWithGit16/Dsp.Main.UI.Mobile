import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, Share, Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme }   from '../../src/context/ThemeContext';
import { spacing, typography, radius, glass, shadow, gradients } from '../../src/theme/colors';
import { fetchLoads, fetchDrivers } from '../../src/api/main';

import PageHeader from '../../src/components/shared/PageHeader';
import PageBackground from '../../src/components/shared/PageBackground';
import GlassCard from '../../src/components/shared/GlassCard';
import AnimatedPressable from '../../src/components/shared/AnimatedPressable';
import Icon from '../../src/components/shared/Icon';
import StreamingText from '../../src/components/shared/StreamingText';
import Markdown from '../../src/components/shared/Markdown';

function statusOf(d) {
  if (typeof d.status === 'number') return ['moving', 'idle', 'offline'][d.status] ?? 'offline';
  return (d.status || 'offline').toLowerCase();
}

// ────────────────────────────────────────────────────────────
//  Build the suggested prompts list from the current fleet state.
//  Static prompts feel like menus; adaptive prompts feel like a
//  colleague pointing at what matters right now.
// ────────────────────────────────────────────────────────────
function buildPrompts(loads, drivers) {
  const hot     = loads.filter(l => l.status === 'Hot').length;
  const idle    = drivers.filter(d => statusOf(d) === 'idle').length;
  const moving  = drivers.filter(d => statusOf(d) === 'moving').length;
  const booked  = loads.filter(l => l.status === 'Booked').length;

  const prompts = [];
  if (hot > 0) prompts.push({ icon: 'flame', color: '#ef4444', text: `Triage my ${hot} hot load${hot > 1 ? 's' : ''}` });
  if (idle > 0) prompts.push({ icon: 'truck', color: '#f59e0b', text: `Reassign my ${idle} idle driver${idle > 1 ? 's' : ''}` });
  if (moving > 0) prompts.push({ icon: 'users', color: '#0193ab', text: 'Who is moving right now?' });
  if (booked > 0) prompts.push({ icon: 'chart', color: '#10b981', text: `Summarize today's ${booked} bookings` });

  // Always keep some general prompts so the list never feels sparse
  prompts.push({ icon: 'dollar', color: '#f59e0b', text: 'How does today compare to yesterday?' });
  prompts.push({ icon: 'sparkles', color: '#0193ab', text: 'What should I focus on next?' });

  return prompts.slice(0, 4);
}

// ────────────────────────────────────────────────────────────
//  Generate inline action chips from the assistant reply.
//  These let users act on the answer without typing a follow-up
//  (e.g. tap "Open Loadboard" instead of switching tabs manually).
// ────────────────────────────────────────────────────────────
function actionsForReply(text) {
  const t = text.toLowerCase();
  const acts = [];
  if (/hot|urgent|coverage/.test(t)) acts.push({ key: 'lb', label: 'Open Loadboard', icon: 'box', route: '/(app)/loadboard' });
  if (/driver|idle|fleet|moving|offline/.test(t)) acts.push({ key: 'dr', label: 'See drivers', icon: 'truck', route: '/(app)/drivers' });
  if (/document|bol|rate con|invoice|insurance/.test(t)) acts.push({ key: 'doc', label: 'Documents', icon: 'folder', route: '/(app)/documents' });
  if (/revenue|rate|book/.test(t) && !acts.find(a => a.key === 'lb')) {
    acts.push({ key: 'lb', label: 'Open Loadboard', icon: 'box', route: '/(app)/loadboard' });
  }
  return acts.slice(0, 3);
}

async function callAI(messages, loads, drivers) {
  const last = messages[messages.length - 1].content.toLowerCase();
  if (last.includes('hot')) {
    const hot = loads.filter(l => l.status === 'Hot' || l.status === 'hot');
    return `You have **${hot.length} hot loads** right now.\n\nTop priority:\n${hot.slice(0, 3).map(l => `• ${l.origin} → ${l.destination} ($${(l.rate || 0).toLocaleString()})`).join('\n') || '(none)'}\n\nWant me to help triage them?`;
  }
  if (last.includes('driver') || last.includes('fleet') || last.includes('idle') || last.includes('moving')) {
    const moving  = drivers.filter(d => statusOf(d) === 'moving');
    const idle    = drivers.filter(d => statusOf(d) === 'idle');
    const offline = drivers.filter(d => statusOf(d) === 'offline');
    const nameOf  = d => d.name || [d.firstName, d.lastName].filter(Boolean).join(' ') || 'Driver';
    return `**Fleet status**\n• Moving: ${moving.length} drivers\n• Idle: ${idle.length} drivers\n• Offline: ${offline.length} drivers\n\n**Available:**\n${[...moving, ...idle].slice(0, 5).map(d => `• ${nameOf(d)}`).join('\n') || '(none)'}`;
  }
  if (last.includes('revenue') || last.includes('rate') || last.includes('deliver') || last.includes('booking') || last.includes('booked')) {
    const booked = loads.filter(l => l.status === 'Booked' || l.status === 'booked');
    const total  = booked.reduce((s, l) => s + (l.rate || 0), 0);
    return `**Revenue snapshot**\n• Booked loads: ${booked.length}\n• Total: $${total.toLocaleString()}\n• Avg rate: $${booked.length ? Math.round(total / booked.length).toLocaleString() : 0}`;
  }
  if (last.includes('focus') || last.includes('next') || last.includes('priorit')) {
    const hot = loads.filter(l => l.status === 'Hot').length;
    const idle = drivers.filter(d => statusOf(d) === 'idle').length;
    if (hot > 0) return `Focus on coverage: **${hot} hot load${hot > 1 ? 's' : ''}** still uncovered. If you have idle drivers (${idle}), pairing them is the quickest win.`;
    if (idle > 2) return `Fleet is light on assignments — **${idle} drivers idle**. Browse the loadboard and pair the closest match for each.`;
    return `Things look healthy. Spend the slack on **rate negotiations**, **broker outreach**, or updating documents.`;
  }
  return `I'm your **HitchLink AI** assistant. I can help with:\n• Load analysis & hot-load alerts\n• Fleet status & driver availability\n• Revenue & rate analysis\n• Dispatch decisions\n\nAsk me anything about your fleet — try the suggestions above.`;
}

function TypingDots({ color }) {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const c = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const step = (v, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 380, useNativeDriver: true }),
        Animated.delay(180),
      ]),
    );
    const loops = [step(a, 0), step(b, 140), step(c, 280)];
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);
  const dot = (v) => ({
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
    opacity:   v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
  });
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }, dot(a)]} />
      <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }, dot(b)]} />
      <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }, dot(c)]} />
    </View>
  );
}

function AiAvatar({ size = 32 }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const ring = {
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }],
    opacity:   pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
  };
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size, height: size, borderRadius: size / 2,
            backgroundColor: '#0193ab',
          },
          ring,
        ]}
      />
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }, shadow.glow]}
      >
        <Icon name="sparkles" size={Math.round(size * 0.5)} color="#fff" />
      </LinearGradient>
    </View>
  );
}

export default function AiChatScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const glassFill   = isDark ? glass.fillDarkStrong : glass.fillLightStrong;
  const glassBorder = isDark ? glass.borderDark : glass.borderLightSoft;
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [copied, setCopied]     = useState(null);
  const [loads, setLoads]       = useState([]);
  const [drivers, setDrivers]   = useState([]);
  const listRef = useRef(null);

  useEffect(() => {
    Promise.all([fetchLoads({ pageSize: 50 }), fetchDrivers()])
      .then(([l, d]) => { setLoads(l ?? []); setDrivers(d ?? []); })
      .catch(() => {});
  }, []);

  const prompts = useMemo(() => buildPrompts(loads, drivers), [loads, drivers]);

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
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: reply,
          actions: actionsForReply(reply),
          isStreaming: true,
        },
      ]);
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

  const onActionPress = (action) => {
    if (action.route) router.push(action.route);
  };

  const s = makeStyles(colors);

  return (
    <PageBackground>
      <SafeAreaView style={s.safe} edges={['left', 'right']}>
        <PageHeader
          title="AI Assistant"
          subtitle={loading ? 'Thinking…' : 'Ask anything about your fleet'}
          rightAction={messages.length > 0 ? (
            <AnimatedPressable
              onPress={() => setMessages([])}
              hapticStyle="light"
              pressedScale={0.94}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={s.clearBtn}>
                <Text style={s.clearBtnText}>Clear</Text>
              </View>
            </AnimatedPressable>
          ) : null}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          {messages.length === 0 ? (
            <View style={s.emptyState}>
              <AiAvatar size={80} />
              <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>Ask anything about your fleet</Text>
              <Text style={[s.emptySub, { color: colors.textMuted }]}>
                Real-time insights on dispatch, loads, and drivers
              </Text>
              <View style={s.promptsGrid}>
                {prompts.map((p, i) => (
                  <AnimatedPressable
                    key={i}
                    onPress={() => send(p.text)}
                    hapticStyle="selection"
                    pressedScale={0.985}
                    containerStyle={{ width: '100%' }}
                  >
                    <GlassCard accent cornerRadius={radius.xl} contentStyle={s.promptChipInner}>
                      <View style={[s.promptIconWrap, { backgroundColor: p.color + '1f' }]}>
                        <Icon name={p.icon} size={17} color={p.color} />
                      </View>
                      <Text style={[s.promptText, { color: colors.textSecondary }]}>{p.text}</Text>
                      <Icon name="chevron" size={14} color={colors.textDisabled} />
                    </GlassCard>
                  </AnimatedPressable>
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
              removeClippedSubviews
              initialNumToRender={20}
              maxToRenderPerBatch={10}
              windowSize={11}
              renderItem={({ item: m }) => (
                <View style={[s.msgWrap, m.role === 'user' ? s.msgRight : s.msgLeft]}>
                  {m.role === 'assistant' && <AiAvatar size={30} />}
                  <View style={{ flex: 1, maxWidth: '80%' }}>
                    {m.role === 'user' ? (
                      <LinearGradient
                        colors={gradients.brand}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={[s.msgBubble, s.userBubble]}
                      >
                        <Text style={[s.msgText, { color: '#fff' }]}>{m.content}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={[
                        s.msgBubble, s.aiBubble,
                        { backgroundColor: glassFill, borderColor: m.isError ? colors.danger : glassBorder },
                      ]}>
                        {m.isStreaming ? (
                          <StreamingText
                            text={m.content}
                            speedMs={14}
                            color={colors.textPrimary}
                          />
                        ) : (
                          <Markdown text={m.content} color={colors.textPrimary} />
                        )}
                      </View>
                    )}
                    {m.role === 'assistant' && m.actions?.length > 0 && (
                      <View style={s.actionRow}>
                        {m.actions.map(a => (
                          <AnimatedPressable
                            key={a.key}
                            onPress={() => onActionPress(a)}
                            hapticStyle="selection"
                            pressedScale={0.95}
                          >
                            <LinearGradient
                              colors={gradients.brand}
                              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                              style={s.actionPill}
                            >
                              <Icon name={a.icon} size={12} color="#fff" />
                              <Text style={s.actionPillText}>{a.label}</Text>
                            </LinearGradient>
                          </AnimatedPressable>
                        ))}
                      </View>
                    )}
                    {m.role === 'assistant' && (
                      <View style={s.msgActions}>
                        <AnimatedPressable
                          onPress={() => copyMessage(m.id, m.content)}
                          hapticStyle="light"
                          pressedScale={0.92}
                        >
                          <View style={s.msgAction}>
                            <Icon
                              name={copied === m.id ? 'checkmark' : 'fileText'}
                              size={12}
                              color={copied === m.id ? '#10b981' : colors.textMuted}
                            />
                            <Text style={[s.msgActionText, { color: copied === m.id ? '#10b981' : colors.textMuted }]}>
                              {copied === m.id ? 'Copied' : 'Copy'}
                            </Text>
                          </View>
                        </AnimatedPressable>
                        <AnimatedPressable
                          onPress={() => {
                            const lastUser = [...messages].reverse().find(msg => msg.role === 'user');
                            if (lastUser) send(lastUser.content);
                          }}
                          hapticStyle="light"
                          pressedScale={0.92}
                        >
                          <View style={s.msgAction}>
                            <Icon name="refresh" size={12} color={colors.textMuted} />
                            <Text style={[s.msgActionText, { color: colors.textMuted }]}>Retry</Text>
                          </View>
                        </AnimatedPressable>
                      </View>
                    )}
                  </View>
                </View>
              )}
              ListFooterComponent={loading ? (
                <View style={[s.msgWrap, s.msgLeft]}>
                  <AiAvatar size={30} />
                  <View style={[s.typingBubble, { backgroundColor: glassFill, borderColor: glassBorder }]}>
                    <TypingDots color={colors.accent} />
                  </View>
                </View>
              ) : null}
            />
          )}

          {/* Input */}
          <View style={[s.inputWrap, { backgroundColor: glassFill, borderTopColor: glassBorder }]}>
            <TextInput
              style={[s.input, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
                borderColor: glassBorder,
                color: colors.textPrimary,
              }]}
              placeholder="Ask about your fleet, loads, drivers…"
              placeholderTextColor={colors.textDisabled}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
              onSubmitEditing={() => send()}
              returnKeyType="send"
            />
            <AnimatedPressable
              onPress={loading ? () => setLoading(false) : () => send()}
              disabled={!input.trim() && !loading}
              hapticStyle="light"
              pressedScale={0.9}
              containerStyle={{ opacity: (!input.trim() && !loading) ? 0.4 : 1 }}
            >
              <LinearGradient
                colors={loading ? ['#ef4444', '#dc2626'] : gradients.brand}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[s.sendBtn, shadow.glow]}
              >
                <Icon name={loading ? 'close' : 'send'} size={17} color="#fff" />
              </LinearGradient>
            </AnimatedPressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </PageBackground>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },

  promptChipInner: { flexDirection: 'row', alignItems: 'center', padding: spacing[3], gap: spacing[3] },
  promptIconWrap: { width: 36, height: 36, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  promptText: { fontSize: typography.sm, fontWeight: '700', flex: 1 },

  clearBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(1,147,171,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(1,147,171,0.32)',
  },
  clearBtnText: { color: '#0193ab', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[6], gap: spacing[2] },
  emptyTitle: { fontSize: typography.lg, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3, marginTop: spacing[4] },
  emptySub: { fontSize: typography.sm, textAlign: 'center', marginBottom: spacing[5] },
  promptsGrid: { width: '100%', gap: spacing[3] },

  msgList: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[4] },
  msgWrap: { flexDirection: 'row', gap: spacing[2] },
  msgRight: { justifyContent: 'flex-end' },
  msgLeft:  { justifyContent: 'flex-start', alignItems: 'flex-start' },
  msgBubble: { borderRadius: radius.xl, padding: spacing[4], marginBottom: 4 },
  userBubble: { alignSelf: 'flex-end', borderTopRightRadius: 6, ...shadow.cardStrong },
  aiBubble: { alignSelf: 'flex-start', borderWidth: 1, borderTopLeftRadius: 6 },
  msgText: { fontSize: typography.sm, lineHeight: 20, fontWeight: '500' },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[1], marginBottom: spacing[1] },
  actionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999,
  },
  actionPillText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.1 },

  msgActions: { flexDirection: 'row', gap: spacing[3], paddingHorizontal: spacing[1] },
  msgAction: { paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 4 },
  msgActionText: { fontSize: typography.xs, fontWeight: '700' },

  typingBubble: { borderRadius: radius.xl, padding: spacing[4], borderWidth: 1 },

  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', padding: spacing[3], borderTopWidth: 1, gap: spacing[2] },
  input: {
    flex: 1, borderRadius: radius.xl,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderWidth: 1, fontSize: typography.sm, maxHeight: 120, fontWeight: '500',
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});
