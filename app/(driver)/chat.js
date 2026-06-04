import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, PanResponder, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { useAuth }  from '../../src/context/AuthContext';
import {
  fetchDriverMessages,
  sendDriverMessage,
} from '../../src/api/main';
import GradientHeader from '../../src/components/shared/GradientHeader';
import Icon          from '../../src/components/shared/Icon';
import AnimatedPressable from '../../src/components/shared/AnimatedPressable';
import { gradients, shadow } from '../../src/theme/colors';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(d) {
  const date = d instanceof Date ? d : new Date(d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function normalizeMessages(raw, driverId) {
  return (raw || []).map(m => {
    const text = m.message || m.content || m.text || '';
    const sentAtRaw = m.sentAt || m.time || m.createdAt;
    const sentAtTs = sentAtRaw ? new Date(sentAtRaw).getTime() : Date.now();
    const fromDriver = typeof m.fromDriver === 'boolean'
      ? m.fromDriver
      : ((m.senderRole || '').toLowerCase() === 'driver' || m.senderId === driverId);
    return {
      id: String(m.id || m.messageId || `${sentAtTs}-${Math.random()}`),
      fromDriver,
      text,
      time: new Date(sentAtTs),
      sentAt: sentAtTs,
      deletedForEveryone: !!m.deletedForEveryone,
      replyToMessageId: m.replyToMessageId || null,
      replyTo: m.replyTo || null,
      isRead: !!(m.isRead || m.readAt),
      deliveredAt: m.deliveredAt || null,
      delivered: !!m.delivered,
    };
  });
}

// ── Reply quote chips ────────────────────────────────────────────────────────

function ReplyQuoteMe({ author, text }) {
  return (
    <View style={styles.replyQuoteMe}>
      <Text style={styles.replyQuoteAuthorMe} numberOfLines={1}>{author}</Text>
      <Text style={styles.replyQuoteTextMe} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function ReplyQuoteThem({ colors, author, text }) {
  return (
    <View style={[styles.replyQuoteThem, { backgroundColor: 'rgba(0,0,0,0.05)' }]}>
      <Text style={styles.replyQuoteAuthorThem} numberOfLines={1}>{author}</Text>
      <Text style={[styles.replyQuoteTextThem, { color: colors?.textMuted || '#475569' }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

// ── Pin-pane glyph (reply arrow) ─────────────────────────────────────────────

function ReplyGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <Path d="M6 4L2 8L6 12" stroke="#0193ab" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M2 8H10C12 8 14 9.5 14 12.5" stroke="#0193ab" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}

// ── "DS" dispatcher avatar ────────────────────────────────────────────────────

function DispatcherAvatar({ size = 28 }) {
  return (
    <View style={[styles.dsAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.dsAvatarText, { fontSize: size * 0.38 }]}>DS</Text>
    </View>
  );
}

// ── Date separator ────────────────────────────────────────────────────────────

function DateSeparator({ label, colors }) {
  return (
    <View style={styles.dateSep}>
      <View style={[styles.dateSepLine, { backgroundColor: colors.border }]} />
      <Text style={[styles.dateSepText, { color: colors.textMuted }]}>{label}</Text>
      <View style={[styles.dateSepLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DriverChat() {
  const { colors, isDark } = useTheme();
  const { userId } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [messages, setMessages]   = useState([]);
  const [text, setText]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // { id, text, fromDriver }

  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Swipe-down-to-dismiss (same pattern as dispatcher-chat.js)
  const dragY = useRef(new Animated.Value(0)).current;
  const swipePan = useRef(
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

  // ── Fetch + poll every 8s ────────────────────────────────────────────────

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
    const iv = setInterval(tick, 8000);
    return () => { stopped = true; clearInterval(iv); };
  }, [userId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length]);

  // ── Send ─────────────────────────────────────────────────────────────────

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    Haptics.selectionAsync().catch(() => {});

    const rid = replyingTo?.id ?? null;
    const replyContext = replyingTo ? { ...replyingTo } : null;
    const optimistic = {
      id: `tmp-${Date.now()}`,
      fromDriver: true,
      text: body,
      time: new Date(),
      sentAt: Date.now(),
      pending: true,
      replyToMessageId: rid,
      replyTo: replyContext,
    };

    setText('');
    setReplyingTo(null);
    setMessages(prev => [...prev, optimistic]);
    setSending(true);
    try {
      await sendDriverMessage(userId, body, rid);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      console.warn('chat send failed', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
    setSending(false);
  }, [text, sending, userId, replyingTo]);

  // ── Build flat list items with date separators ───────────────────────────

  const listItems = React.useMemo(() => {
    const items = [];
    let lastDateStr = null;
    for (const m of messages) {
      const dateStr = m.time.toDateString();
      if (dateStr !== lastDateStr) {
        items.push({ _type: 'date', id: `date-${dateStr}`, label: formatDateLabel(m.time) });
        lastDateStr = dateStr;
      }
      items.push({ _type: 'msg', ...m });
    }
    return items;
  }, [messages]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: colors.pageBg, transform: [{ translateY: dragY }] }]}
    >
      <View {...swipePan.panHandlers}>
        <GradientHeader
          gradient={gradients.brand}
          eyebrow="Live conversation"
          title="Dispatcher"
          onBack={() => { Haptics.selectionAsync().catch(() => {}); router.back(); }}
          centerSlot={
            <View style={styles.headerAvatarWrap}>
              <DispatcherAvatar size={40} />
            </View>
          }
          rightSlot={
            <View style={[styles.statusPill]}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Active</Text>
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
            data={listItems}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={styles.listContent}
            removeClippedSubviews
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={11}
            ListEmptyComponent={
              <View style={styles.empty}>
                <LinearGradient
                  colors={['rgba(1,147,171,0.24)', 'rgba(6,182,212,0.18)']}
                  style={styles.emptyAvatar}
                >
                  <Icon name="chat" size={30} color="#0193ab" />
                </LinearGradient>
                <Text style={[styles.emptyName, { color: colors.textPrimary }]}>
                  Start a conversation
                </Text>
                <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                  Send a message to your dispatcher — they will be notified in real time.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              if (item._type === 'date') {
                return <DateSeparator label={item.label} colors={colors} />;
              }

              const msg = item;
              const tombstoned = !!msg.deletedForEveryone;
              const hasReply = !!msg.replyTo;
              const replyAuthorLabel = msg.replyTo?.fromDriver ? 'You' : 'Dispatcher';
              const replyText = msg.replyTo?.text || '';

              const onLongPress = () => {
                if (tombstoned || String(msg.id).startsWith('tmp-')) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                setReplyingTo({ id: msg.id, text: msg.text, fromDriver: msg.fromDriver });
              };

              return (
                <View style={[styles.msgRow, msg.fromDriver && styles.msgRowRight]}>
                  {/* Dispatcher avatar on left */}
                  {!msg.fromDriver && (
                    <View style={styles.avatarCol}>
                      <DispatcherAvatar size={28} />
                    </View>
                  )}

                  <Pressable onLongPress={onLongPress} delayLongPress={280} style={{ maxWidth: 280 }}>
                    {msg.fromDriver ? (
                      // ── Driver bubble (outgoing gradient) ──────────────────
                      <View style={styles.bubbleWithTail}>
                        {tombstoned ? (
                          <View style={[styles.bubble, styles.bubbleMe, styles.bubbleTombstone]}>
                            <Text style={styles.tombstoneText}>This message was deleted</Text>
                          </View>
                        ) : (
                          <LinearGradient
                            colors={gradients.brand}
                            style={[styles.bubble, styles.bubbleMe, msg.pending && { opacity: 0.8 }]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                          >
                            {hasReply && <ReplyQuoteMe author={replyAuthorLabel} text={replyText} />}
                            {msg.text ? (
                              <Text style={styles.bubbleTextMe}>{msg.text}</Text>
                            ) : null}
                          </LinearGradient>
                        )}
                        {!tombstoned && (
                          <View style={[styles.tailMe]} />
                        )}
                      </View>
                    ) : (
                      // ── Dispatcher bubble (incoming themed) ────────────────
                      <View style={styles.bubbleWithTail}>
                        <View style={[
                          styles.bubble,
                          styles.bubbleThem,
                          tombstoned && styles.bubbleTombstone,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface2,
                            borderColor: colors.border,
                          },
                        ]}>
                          {tombstoned ? (
                            <Text style={[styles.tombstoneText, { color: colors.textMuted }]}>
                              This message was deleted
                            </Text>
                          ) : (
                            <>
                              {hasReply && <ReplyQuoteThem colors={colors} author={replyAuthorLabel} text={replyText} />}
                              {msg.text ? (
                                <Text style={[styles.bubbleTextThem, { color: colors.textPrimary }]}>
                                  {msg.text}
                                </Text>
                              ) : null}
                            </>
                          )}
                        </View>
                        {!tombstoned && (
                          <View style={[styles.tailThem, {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface2,
                            borderColor: colors.border,
                          }]} />
                        )}
                      </View>
                    )}
                  </Pressable>

                  {/* Meta row: time + sending indicator */}
                  <View style={[
                    styles.metaRow,
                    { justifyContent: msg.fromDriver ? 'flex-end' : 'flex-start' },
                    !msg.fromDriver && { paddingLeft: 36 },
                  ]}>
                    <Text style={[styles.time, { color: colors.textMuted }]}>{formatTime(msg.time)}</Text>
                    {msg.fromDriver && msg.pending && (
                      <Text style={[styles.time, { color: colors.textMuted, marginLeft: 4 }]}>sending…</Text>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* ── Reply pane ──────────────────────────────────────────────────── */}
        {replyingTo && (
          <View style={[styles.pinPane, {
            backgroundColor: isDark ? '#18213a' : colors.surface2,
            borderTopColor: colors.border,
          }]}>
            <View style={styles.pinPaneIcon}>
              <ReplyGlyph />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pinPaneLabel}>
                {`REPLYING TO ${replyingTo.fromDriver ? 'YOURSELF' : 'DISPATCHER'}`}
              </Text>
              <Text style={[styles.pinPaneText, { color: colors.textPrimary }]} numberOfLines={1}>
                {replyingTo.text || ''}
              </Text>
            </View>
            <Pressable
              onPress={() => setReplyingTo(null)}
              style={({ pressed }) => [styles.pinPaneClose, pressed && { opacity: 0.6 }]}
              accessibilityLabel="Cancel reply"
            >
              <Icon name="close" size={14} color={colors.textMuted} />
            </Pressable>
          </View>
        )}

        {/* ── Input bar ──────────────────────────────────────────────────── */}
        <View style={[styles.inputBar, {
          borderTopColor: colors.border,
          backgroundColor: isDark ? 'rgba(12,18,35,0.96)' : colors.surface1,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
        }]}>
          <TextInput
            ref={inputRef}
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
            returnKeyType="default"
          />
          {text.trim() ? (
            <AnimatedPressable
              disabled={sending}
              onPress={send}
              hapticStyle="light"
              pressedScale={0.9}
              containerStyle={{ opacity: !sending ? 1 : 0.4 }}
            >
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[styles.send, shadow.glow]}
              >
                <Icon name="send" size={17} color="#fff" />
              </LinearGradient>
            </AnimatedPressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerAvatarWrap: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },

  // Dispatcher "DS" teal circle
  dsAvatar: {
    backgroundColor: '#0193ab',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0193ab', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  dsAvatarText: {
    color: '#fff', fontWeight: '800', letterSpacing: 0.4,
  },

  // Status pill in header
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.22)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.42)',
  },
  statusDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: '#10b981' },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 14, gap: 8, flexGrow: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyAvatar: {
    width: 78, height: 78, borderRadius: 99,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    shadowColor: '#0193ab', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  emptyName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  emptyHint: { fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 19 },

  // Date separator
  dateSep: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginVertical: 8, paddingHorizontal: 4,
  },
  dateSepLine: { flex: 1, height: 1 },
  dateSepText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },

  // Message rows
  msgRow: { alignItems: 'flex-start', gap: 2 },
  msgRowRight: { alignItems: 'flex-end' },
  avatarCol: { marginRight: 6, marginBottom: 4, alignSelf: 'flex-end' },

  bubbleWithTail: { position: 'relative', maxWidth: 280 },
  bubble: { maxWidth: 280, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleThem: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleTombstone: { backgroundColor: 'rgba(0,0,0,0.12)', opacity: 0.9 },
  tombstoneText: { fontSize: 12.5, fontStyle: 'italic', color: '#fff', opacity: 0.92 },

  bubbleTextMe: { color: '#fff', fontSize: 13.5, lineHeight: 19, fontWeight: '500' },
  bubbleTextThem: { fontSize: 13.5, lineHeight: 19, fontWeight: '500' },

  // Bubble tails
  tailMe: {
    position: 'absolute', right: -3, bottom: 0,
    width: 10, height: 10, backgroundColor: '#0193ab',
    borderBottomLeftRadius: 10,
    transform: [{ rotate: '45deg' }],
  },
  tailThem: {
    position: 'absolute', left: -3, bottom: 0,
    width: 10, height: 10,
    borderBottomRightRadius: 10, borderWidth: 1,
    transform: [{ rotate: '-45deg' }],
  },

  // Reply quote chips
  replyQuoteMe: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderLeftWidth: 3, borderLeftColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 7, marginBottom: 6, maxWidth: 260,
  },
  replyQuoteAuthorMe: { color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.2 },
  replyQuoteTextMe: { color: 'rgba(255,255,255,0.88)', fontSize: 12, marginTop: 1 },
  replyQuoteThem: {
    borderLeftWidth: 3, borderLeftColor: '#0193ab',
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 7, marginBottom: 6, maxWidth: 260,
  },
  replyQuoteAuthorThem: { color: '#0193ab', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.2 },
  replyQuoteTextThem: { fontSize: 12, marginTop: 1 },

  // Meta row (time)
  metaRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 4, marginTop: 2,
  },
  time: { fontSize: 10, fontWeight: '500' },

  // Reply pane above input
  pinPane: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderLeftWidth: 3, borderLeftColor: '#0193ab',
    marginHorizontal: 8,
    borderTopLeftRadius: 8, borderTopRightRadius: 8,
  },
  pinPaneIcon: { width: 22, alignItems: 'center', justifyContent: 'center' },
  pinPaneLabel: { color: '#0193ab', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  pinPaneText: { fontSize: 12.5, marginTop: 1 },
  pinPaneClose: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    gap: 6, padding: 10, paddingTop: 10, borderTopWidth: 1,
  },
  input: {
    flex: 1, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, fontSize: 13.5, maxHeight: 120, minHeight: 42, fontWeight: '500',
  },
  send: {
    width: 42, height: 42, borderRadius: 99,
    alignItems: 'center', justifyContent: 'center',
  },
});
