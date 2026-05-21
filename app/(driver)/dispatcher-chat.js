import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Animated, PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { fetchDriverMessages, sendDriverMessage } from '../../src/api/main';
import GradientHeader from '../../src/components/shared/GradientHeader';
import { gradients } from '../../src/theme/colors';

const QUICK_PRESETS = ['🚗 On my way', '⏱ Running late', '✅ Arrived'];

function formatTime(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function normalizeMessages(raw, driverId) {
  return (raw || []).map(m => ({
    id: String(m.id || m.messageId || `${m.sentAt}-${Math.random()}`),
    fromDriver: (m.senderRole || '').toLowerCase() === 'driver' || m.senderId === driverId,
    text: m.message || m.content || m.text || '',
    time: m.sentAt ? new Date(m.sentAt) : new Date(),
    sentAt: m.sentAt ? new Date(m.sentAt).getTime() : Date.now(),
  }));
}

function Checkmark({ read, color }) {
  return (
    <Text style={{ color, fontSize: 11, fontWeight: '800', marginLeft: 4, letterSpacing: -2 }}>
      {read ? '✓✓' : '✓'}
    </Text>
  );
}

export default function DispatcherChat() {
  const { colors, isDark } = useTheme();
  const { userId } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  // Swipe-down-to-dismiss
  const dragY = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragY.setValue(Math.min(g.dy, 220));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.6) {
          Haptics.selectionAsync().catch(() => {});
          Animated.timing(dragY, { toValue: 400, duration: 180, useNativeDriver: true })
            .start(() => router.back());
        } else {
          Animated.spring(dragY, { toValue: 0, damping: 18, stiffness: 260, mass: 0.9, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, { toValue: 0, damping: 18, stiffness: 260, mass: 0.9, useNativeDriver: true }).start();
      },
    }),
  ).current;

  useEffect(() => {
    if (!userId) return;
    let stopped = false;
    const tick = async () => {
      try {
        const raw = await fetchDriverMessages(userId);
        if (!stopped) {
          setMessages(normalizeMessages(raw, userId));
          setLoading(false);
        }
      } catch { setLoading(false); }
    };
    tick();
    const iv = setInterval(tick, 4500);
    return () => { stopped = true; clearInterval(iv); };
  }, [userId]);

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length]);

  const send = useCallback(async (preset) => {
    const body = typeof preset === 'string' ? preset.trim() : text.trim();
    if (!body || sending) return;
    Haptics.selectionAsync().catch(() => {});
    if (typeof preset !== 'string') setText('');
    const optimistic = {
      id: `tmp-${Date.now()}`, fromDriver: true, text: body, time: new Date(),
      sentAt: Date.now(), pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setSending(true);
    try {
      await sendDriverMessage(userId, body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
    setSending(false);
  }, [text, sending, userId]);

  const lastDriverIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].fromDriver) return i;
    return -1;
  })();
  const lastDispatcherAfter = (idx) => {
    if (idx < 0) return false;
    for (let i = idx + 1; i < messages.length; i++) if (!messages[i].fromDriver) return true;
    return false;
  };

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: colors.pageBg, transform: [{ translateY: dragY }] }]}
    >
      {/* Header (swipe-down capture area) */}
      <View {...pan.panHandlers}>
        <GradientHeader
          gradient={gradients.heroDispatch}
          eyebrow="Live conversation"
          title="Dispatcher"
          onBack={() => { Haptics.selectionAsync().catch(() => {}); router.back(); }}
          centerSlot={
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>D</Text>
            </View>
          }
          rightSlot={
            <View style={styles.statusPill}>
              <View style={styles.headerDot} />
              <Text style={styles.headerSub}>Active</Text>
            </View>
          }
        />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <LinearGradient
                colors={['rgba(99,102,241,0.22)', 'rgba(139,92,246,0.18)']}
                style={styles.emptyAvatar}
              >
                <Text style={{ fontSize: 30 }}>💬</Text>
              </LinearGradient>
              <Text style={[styles.emptyName, { color: colors.textPrimary }]}>Start a conversation</Text>
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                Send a message to your dispatcher — they'll be notified in real time.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isLastFromDriver = item.fromDriver && index === lastDriverIdx;
            const hasBeenRead = isLastFromDriver && lastDispatcherAfter(index);
            return (
              <View style={[styles.msgRow, item.fromDriver && styles.msgRowRight]}>
                {item.fromDriver ? (
                  <View style={styles.bubbleWithTail}>
                    <LinearGradient
                      colors={['#6366f1', '#8b5cf6']}
                      style={[styles.bubble, styles.bubbleMe, item.pending && { opacity: 0.8 }]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text style={styles.bubbleTextMe}>{item.text}</Text>
                    </LinearGradient>
                    <View style={styles.tailMe} />
                  </View>
                ) : (
                  <View style={styles.bubbleWithTail}>
                    <View style={[styles.bubble, styles.bubbleThem, {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface2,
                      borderColor: colors.border,
                    }]}>
                      <Text style={[styles.bubbleTextThem, { color: colors.textPrimary }]}>{item.text}</Text>
                    </View>
                    <View style={[styles.tailThem, {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface2,
                      borderColor: colors.border,
                    }]} />
                  </View>
                )}
                <View style={[
                  styles.metaRow,
                  { justifyContent: item.fromDriver ? 'flex-end' : 'flex-start' },
                ]}>
                  <Text style={[styles.time, { color: colors.textMuted }]}>{formatTime(item.time)}</Text>
                  {item.fromDriver && !item.pending && (
                    <Checkmark read={hasBeenRead} color={hasBeenRead ? colors.accent : colors.textMuted} />
                  )}
                  {item.fromDriver && item.pending && (
                    <Text style={[styles.time, { color: colors.textMuted, marginLeft: 4 }]}>sending…</Text>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Quick presets */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.presets, { borderTopColor: colors.border }]}
        contentContainerStyle={styles.presetsContent}
      >
        {QUICK_PRESETS.map(p => (
          <TouchableOpacity
            key={p}
            onPress={() => send(p)}
            style={[styles.preset, {
              backgroundColor: isDark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.08)',
              borderColor: isDark ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.25)',
            }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.presetText, { color: colors.accent }]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input */}
      <View style={[styles.inputBar, {
        borderTopColor: colors.border,
        backgroundColor: isDark ? 'rgba(12,18,35,0.96)' : colors.surface1,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
      }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message dispatcher…"
          placeholderTextColor={colors.textDisabled}
          style={[styles.input, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface2,
            borderColor: colors.border,
            color: colors.textPrimary,
          }]}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          disabled={!text.trim() || sending}
          onPress={() => send()}
          activeOpacity={0.85}
          style={[styles.sendWrap, { opacity: text.trim() && !sending ? 1 : 0.4 }]}
        >
          <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.send}>
            <Text style={styles.sendIcon}>➤</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerAvatar: { width: 40, height: 40, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.22)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)',
  },
  headerDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: '#22c55e' },
  headerSub: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 14, gap: 8, flexGrow: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyAvatar: {
    width: 78, height: 78, borderRadius: 99,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  emptyName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  emptyHint: { fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 19 },

  msgRow: { alignItems: 'flex-start', gap: 2 },
  msgRowRight: { alignItems: 'flex-end' },
  bubbleWithTail: { position: 'relative' },
  bubble: { maxWidth: 280, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleThem: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleTextMe: { color: '#fff', fontSize: 13.5, lineHeight: 19 },
  bubbleTextThem: { fontSize: 13.5, lineHeight: 19 },
  tailMe: {
    position: 'absolute', right: -3, bottom: 0,
    width: 10, height: 10, backgroundColor: '#8b5cf6',
    borderBottomLeftRadius: 10,
    transform: [{ rotate: '45deg' }],
  },
  tailThem: {
    position: 'absolute', left: -3, bottom: 0,
    width: 10, height: 10,
    borderBottomRightRadius: 10, borderWidth: 1,
    transform: [{ rotate: '-45deg' }],
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginTop: 2 },
  time: { fontSize: 10 },

  presets: { flexGrow: 0, borderTopWidth: 1 },
  presetsContent: { padding: 10, gap: 7 },
  preset: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  presetText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, paddingTop: 10, borderTopWidth: 1 },
  input: {
    flex: 1, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1.5, fontSize: 13.5, maxHeight: 120, minHeight: 42,
  },
  sendWrap: { width: 42, height: 42, borderRadius: 99, overflow: 'hidden' },
  send: {
    width: 42, height: 42, borderRadius: 99, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  sendIcon: { color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 1 },
});
