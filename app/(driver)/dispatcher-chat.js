import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated, PanResponder, Alert, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { useAuth }  from '../../src/context/AuthContext';
import {
  fetchDriverMessages,
  sendDriverMessage,
  fetchActiveLoad,
  sendDriverVoiceMessage,
  editChatMessage,
  deleteChatMessage,
  reactToChatMessage,
  removeChatReaction,
} from '../../src/api/main';
import GradientHeader from '../../src/components/shared/GradientHeader';
import Icon          from '../../src/components/shared/Icon';
import LiveDot       from '../../src/components/shared/LiveDot';
import AnimatedPressable from '../../src/components/shared/AnimatedPressable';
import CachedImage   from '../../src/components/shared/CachedImage';
import VoiceRecorder from '../../src/components/shared/VoiceRecorder';
import VoiceMessage  from '../../src/components/shared/VoiceMessage';
import MessageActionsSheet from '../../src/components/shared/MessageActionsSheet';
import Reactions     from '../../src/components/shared/Reactions';
import { gradients, shadow } from '../../src/theme/colors';

// Different presets surface in different phases of the trip. A driver 30m
// from delivery doesn't need "On my way" — they need "Arrived" and "POD ready".
const PRESET_SETS = {
  default:      [
    { icon: 'truck',   text: 'On my way' },
    { icon: 'clock',   text: 'Running late' },
    { icon: 'check',   text: 'Arrived' },
  ],
  prePickup:    [
    { icon: 'truck',   text: 'En route to pickup' },
    { icon: 'clock',   text: '30 min ETA' },
    { icon: 'phone',   text: 'Need shipper number' },
  ],
  inTransit:    [
    { icon: 'navigation', text: 'Smooth sailing' },
    { icon: 'alertTriangle', text: 'Traffic delay' },
    { icon: 'clock',   text: 'Updated ETA?' },
  ],
  nearDelivery: [
    { icon: 'check',   text: 'At delivery' },
    { icon: 'fileText', text: 'POD ready to upload' },
    { icon: 'pin',     text: 'Where do I park?' },
  ],
};

function formatTime(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function normalizeMessages(raw, driverId) {
  return (raw || []).map(m => {
    const text = m.message || m.content || m.text || '';
    const isVoice = m.type === 'voice' || !!m.audioUrl;
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
      urgent: m.urgent === true || /^!!\s/.test(text),
      photoUri: m.photoUri || null,
      type: isVoice ? 'voice' : 'text',
      audioUrl: m.audioUrl || null,
      durationSeconds: m.durationSeconds ?? null,
      waveformPeaks: m.waveformPeaks || null,
      // Interaction state from the new backend payload.
      editedAt: m.editedAt ? new Date(m.editedAt) : null,
      deletedForEveryone: !!m.deletedForEveryone,
      replyToMessageId: m.replyToMessageId || null,
      replyTo: m.replyTo || null,
      reactions: Array.isArray(m.reactions) ? m.reactions : null,
    };
  });
}

// Tiny pencil/reply glyph for the pin pane — the shared Icon set doesn't have these.
function PinPaneGlyph({ kind }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      {kind === 'edit' ? (
        <Path d="M11 2L14 5L5 14H2V11L11 2Z" stroke="#0193ab" strokeWidth="1.5" strokeLinejoin="round"/>
      ) : (
        <>
          <Path d="M6 4L2 8L6 12" stroke="#0193ab" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          <Path d="M2 8H10C12 8 14 9.5 14 12.5" stroke="#0193ab" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      )}
    </Svg>
  );
}

// Small reply-quote chip rendered inside an outgoing (gradient) bubble.
function ReplyQuoteMe({ author, text }) {
  return (
    <View style={styles.replyQuoteMe}>
      <Text style={styles.replyQuoteAuthorMe} numberOfLines={1}>{author}</Text>
      <Text style={styles.replyQuoteTextMe} numberOfLines={1}>{text}</Text>
    </View>
  );
}

// Reply-quote chip for incoming bubbles (themed surface).
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

function Checkmark({ read, color }) {
  return (
    <View style={{ flexDirection: 'row', marginLeft: 4 }}>
      <Icon name="checkmark" size={11} color={color} />
      {read && (
        <View style={{ marginLeft: -4 }}>
          <Icon name="checkmark" size={11} color={color} />
        </View>
      )}
    </View>
  );
}

export default function DispatcherChat() {
  const { colors, isDark } = useTheme();
  const { userId } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [urgent, setUrgent]     = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [activeLoad, setActiveLoad] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  // Message interactions
  const [sheetTarget, setSheetTarget] = useState(null);    // message currently long-pressed
  const [replyingTo, setReplyingTo] = useState(null);      // { id, text, type, fromDriver }
  const [editingMessage, setEditingMessage] = useState(null); // { id, originalText }
  const [hiddenForMe, setHiddenForMe] = useState(() => new Set());
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Actor identity sent to the backend — driver's userId + role.
  const me = { id: userId, role: 'driver' };

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
    if (!userId) return;
    fetchActiveLoad(userId).then(setActiveLoad).catch(() => {});
  }, [userId]);

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length]);

  // Pick smart presets based on active load + progress
  const presets = (() => {
    if (!activeLoad) return PRESET_SETS.default;
    // Without precise progress tracking here we use a coarse heuristic
    // based on common states from the API.
    if (activeLoad.pickupArrivedAt && activeLoad.loadedAt) {
      // could be in-transit or near delivery — without remaining miles we
      // default to in-transit; the driver portal already shows the smart
      // POD card when near-delivery so this is a sane fallback.
      return PRESET_SETS.inTransit;
    }
    if (activeLoad.pickupArrivedAt) return PRESET_SETS.inTransit;
    return PRESET_SETS.prePickup;
  })();

  const send = useCallback(async (preset) => {
    let body = typeof preset === 'string' ? preset.trim() : text.trim();

    // Edit mode — submit the edit instead of sending a new message.
    if (editingMessage) {
      if (!body || body === editingMessage.originalText) {
        setEditingMessage(null);
        setText('');
        return;
      }
      try {
        await editChatMessage(editingMessage.id, body, me);
        // Patch locally so the next poll doesn't roll us back visually.
        setMessages(prev => prev.map(m =>
          String(m.id) === String(editingMessage.id)
            ? { ...m, text: body, editedAt: new Date() }
            : m,
        ));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      setEditingMessage(null);
      setText('');
      return;
    }

    if (!body && !pendingPhoto) return;
    if (sending) return;
    Haptics.selectionAsync().catch(() => {});
    if (urgent) body = `!! ${body}`;
    if (typeof preset !== 'string') setText('');
    const sentPhoto = pendingPhoto;
    setPendingPhoto(null);
    const wasUrgent = urgent;
    setUrgent(false);
    const rid = replyingTo?.id;
    const replyContext = replyingTo ? { ...replyingTo } : null;
    const optimistic = {
      id: `tmp-${Date.now()}`, fromDriver: true, text: body, time: new Date(),
      sentAt: Date.now(), pending: true, urgent: wasUrgent, photoUri: sentPhoto?.uri,
      replyToMessageId: rid, replyTo: replyContext,
    };
    setMessages(prev => [...prev, optimistic]);
    setReplyingTo(null);
    setSending(true);
    try {
      await sendDriverMessage(userId, body, rid);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
    setSending(false);
  }, [text, sending, userId, urgent, pendingPhoto, replyingTo, editingMessage, me]);

  // ─── Action handlers (long-press → sheet → these) ──────────────────────────
  const onReply = useCallback((msg) => {
    setReplyingTo({ id: msg.id, text: msg.text, type: msg.type, fromDriver: msg.fromDriver });
    setEditingMessage(null);
  }, []);

  const onCopy = useCallback(async (msg) => {
    if (msg?.text) {
      try { await Clipboard.setStringAsync(msg.text); } catch {}
    }
  }, []);

  const onEdit = useCallback((msg) => {
    setEditingMessage({ id: msg.id, originalText: msg.text || '' });
    setText(msg.text || '');
    setReplyingTo(null);
  }, []);

  const onDelete = useCallback(async (msg, scope) => {
    if (scope === 'me') {
      setHiddenForMe(prev => {
        const next = new Set(prev);
        next.add(String(msg.id));
        return next;
      });
    } else if (scope === 'everyone') {
      // Optimistic tombstone — server confirms with the next poll.
      setMessages(prev => prev.map(m =>
        String(m.id) === String(msg.id)
          ? { ...m, deletedForEveryone: true, text: '', audioUrl: null }
          : m,
      ));
    }
    try {
      await deleteChatMessage(msg.id, scope, me);
    } catch (err) {
      console.warn('delete failed', err);
      if (scope === 'me') {
        setHiddenForMe(prev => { const n = new Set(prev); n.delete(String(msg.id)); return n; });
      }
    }
  }, [me]);

  const onToggleReaction = useCallback(async (msg, emoji, alreadyMine) => {
    try {
      if (alreadyMine) await removeChatReaction(msg.id, me);
      else             await reactToChatMessage(msg.id, emoji, me);
    } catch (err) {
      console.warn('reaction failed', err);
    }
  }, [me]);

  const onCamera = async () => {
    Haptics.selectionAsync().catch(() => {});
    Alert.alert(
      'Attach photo',
      'How do you want to add a photo?',
      [
        { text: 'Take photo', onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return Alert.alert('Camera blocked', 'Enable camera access in Settings.');
          const r = await ImagePicker.launchCameraAsync({ quality: 0.65, allowsEditing: false });
          if (!r.canceled && r.assets?.[0]) setPendingPhoto(r.assets[0]);
        } },
        { text: 'Choose from library', onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return Alert.alert('Library blocked', 'Enable photo library access in Settings.');
          const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.65, allowsEditing: false, mediaTypes: ImagePicker.MediaTypeOptions.Images });
          if (!r.canceled && r.assets?.[0]) setPendingPhoto(r.assets[0]);
        } },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleVoiceSend = useCallback(async (payload) => {
    if (!userId) return;
    // Optimistic placeholder while the upload + next poll race.
    const tmpId = `tmp-voice-${Date.now()}`;
    const rid = replyingTo?.id;
    const replyContext = replyingTo ? { ...replyingTo } : null;
    setReplyingTo(null);
    const optimistic = {
      id: tmpId,
      fromDriver: true,
      text: '',
      replyToMessageId: rid,
      replyTo: replyContext,
      time: new Date(),
      sentAt: Date.now(),
      pending: true,
      type: 'voice',
      durationSeconds: Math.round(payload.durationSeconds),
      waveformPeaks: (payload.peaks || []).join(','),
      audioUrl: null,                          // local URI not needed — server returns one
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const result = await sendDriverVoiceMessage(userId, { ...payload, replyToMessageId: rid });
      // Replace the optimistic row with the server-confirmed one so playback works.
      if (result?.id) {
        setMessages(prev => prev.map(m => m.id === tmpId ? ({
          ...m,
          id: String(result.id),
          pending: false,
          audioUrl: result.audioUrl,
          durationSeconds: result.durationSeconds ?? m.durationSeconds,
          waveformPeaks: result.waveformPeaks ?? m.waveformPeaks,
        }) : m));
      }
    } catch (err) {
      // Drop the placeholder on failure so the user can retry cleanly.
      setMessages(prev => prev.filter(m => m.id !== tmpId));
      throw err;
    }
  }, [userId]);

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
      <View {...pan.panHandlers}>
        <GradientHeader
          gradient={gradients.brand}
          eyebrow="Live conversation"
          title="Dispatcher"
          onBack={() => { Haptics.selectionAsync().catch(() => {}); router.back(); }}
          centerSlot={
            <View style={styles.headerAvatar}>
              <Icon name="briefcase" size={18} color="#fff" />
            </View>
          }
          rightSlot={
            <View style={styles.statusPill}>
              <LiveDot color="#10b981" size={6} />
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
          data={messages.filter(m => !hiddenForMe.has(String(m.id)))}
          keyExtractor={(m) => m.id}
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
              <Text style={[styles.emptyName, { color: colors.textPrimary }]}>Start a conversation</Text>
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                Send a message to your dispatcher — they'll be notified in real time.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isLastFromDriver = item.fromDriver && index === lastDriverIdx;
            const hasBeenRead = isLastFromDriver && lastDispatcherAfter(index);
            const tombstoned = !!item.deletedForEveryone;
            const hasReply = !!item.replyTo;
            const replyAuthorLabel = item.replyTo?.fromDriver ? 'You' : 'Dispatcher';
            const replyText = item.replyTo?.type === 'voice'
              ? '🎙 Voice message'
              : (item.replyTo?.text || '');

            const openSheet = () => {
              if (tombstoned || String(item.id).startsWith('tmp-')) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setSheetTarget(item);
            };

            return (
              <View style={[styles.msgRow, item.fromDriver && styles.msgRowRight]}>
                <Pressable onLongPress={openSheet} delayLongPress={280}>
                  {item.fromDriver ? (
                    <View style={styles.bubbleWithTail}>
                      {item.urgent && !tombstoned ? (
                        <View style={styles.urgentTag}>
                          <Icon name="flame" size={11} color="#fff" />
                          <Text style={styles.urgentTagText}>URGENT</Text>
                        </View>
                      ) : null}
                      {item.photoUri && !tombstoned ? (
                        <View style={styles.bubblePhotoMe}>
                          <CachedImage source={{ uri: item.photoUri }} style={styles.bubbleImg} accessibilityLabel="Attached photo" />
                        </View>
                      ) : null}

                      {tombstoned ? (
                        <View style={[styles.bubble, styles.bubbleMe, styles.bubbleTombstone]}>
                          <Text style={styles.tombstoneText}>🗑  This message was deleted</Text>
                        </View>
                      ) : item.type === 'voice' ? (
                        <LinearGradient
                          colors={gradients.brand}
                          style={[styles.bubble, styles.bubbleMe, styles.bubbleVoice, item.pending && { opacity: 0.7 }]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          {hasReply && <ReplyQuoteMe author={replyAuthorLabel} text={replyText} />}
                          <VoiceMessage message={item} fromMe colors={colors} isDark={isDark} />
                        </LinearGradient>
                      ) : item.text ? (
                        <LinearGradient
                          colors={item.urgent ? ['#ef4444', '#dc2626'] : gradients.brand}
                          style={[styles.bubble, styles.bubbleMe, item.pending && { opacity: 0.8 }]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          {hasReply && <ReplyQuoteMe author={replyAuthorLabel} text={replyText} />}
                          <Text style={styles.bubbleTextMe}>
                            {item.text.replace(/^!!\s/, '')}
                            {item.editedAt && <Text style={styles.editedBadge}> (edited)</Text>}
                          </Text>
                        </LinearGradient>
                      ) : null}
                      {!tombstoned && <View style={[styles.tailMe, item.urgent && { backgroundColor: '#dc2626' }]} />}
                    </View>
                  ) : (
                    <View style={styles.bubbleWithTail}>
                      <View style={[
                        styles.bubble,
                        styles.bubbleThem,
                        item.type === 'voice' && !tombstoned && styles.bubbleVoice,
                        tombstoned && styles.bubbleTombstone,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface2,
                          borderColor: colors.border,
                        },
                      ]}>
                        {tombstoned ? (
                          <Text style={[styles.tombstoneText, { color: colors.textMuted }]}>🗑  This message was deleted</Text>
                        ) : item.type === 'voice' ? (
                          <>
                            {hasReply && <ReplyQuoteThem colors={colors} author={replyAuthorLabel} text={replyText} />}
                            <VoiceMessage message={item} fromMe={false} colors={colors} isDark={isDark} />
                          </>
                        ) : (
                          <>
                            {hasReply && <ReplyQuoteThem colors={colors} author={replyAuthorLabel} text={replyText} />}
                            <Text style={[styles.bubbleTextThem, { color: colors.textPrimary }]}>
                              {item.text}
                              {item.editedAt && <Text style={[styles.editedBadge, { color: colors.textMuted }]}> (edited)</Text>}
                            </Text>
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

                {!tombstoned && (
                  <Reactions
                    reactions={item.reactions}
                    me={me}
                    isDark={isDark}
                    onToggle={(emoji, mine) => onToggleReaction(item, emoji, mine)}
                  />
                )}

                <View style={[
                  styles.metaRow,
                  { justifyContent: item.fromDriver ? 'flex-end' : 'flex-start' },
                ]}>
                  <Text style={[styles.time, { color: colors.textMuted }]}>{formatTime(item.time)}</Text>
                  {item.fromDriver && !item.pending && !tombstoned && (
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

      {/* Quick presets (contextual) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.presets, { borderTopColor: colors.border }]}
        contentContainerStyle={styles.presetsContent}
      >
        {presets.map(p => (
          <AnimatedPressable
            key={p.text}
            onPress={() => send(p.text)}
            hapticStyle="selection"
            pressedScale={0.94}
          >
            <View style={[styles.preset, {
              backgroundColor: isDark ? 'rgba(1,147,171,0.14)' : 'rgba(1,147,171,0.08)',
              borderColor: isDark ? 'rgba(1,147,171,0.32)' : 'rgba(1,147,171,0.24)',
            }]}>
              <Icon name={p.icon} size={13} color={colors.accent} />
              <Text style={[styles.presetText, { color: colors.accent }]}>{p.text}</Text>
            </View>
          </AnimatedPressable>
        ))}
      </ScrollView>

      {/* Reply / Edit pane */}
      {(replyingTo || editingMessage) && (
        <View style={[styles.pinPane, { backgroundColor: isDark ? '#18213a' : colors.surface2, borderTopColor: colors.border }]}>
          <View style={styles.pinPaneIcon}>
            <PinPaneGlyph kind={editingMessage ? 'edit' : 'reply'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pinPaneLabel}>
              {editingMessage ? 'EDITING' : `REPLYING TO ${replyingTo?.fromDriver ? 'YOURSELF' : 'DISPATCHER'}`}
            </Text>
            <Text style={[styles.pinPaneText, { color: colors.textPrimary }]} numberOfLines={1}>
              {editingMessage
                ? editingMessage.originalText
                : (replyingTo?.type === 'voice' ? '🎙 Voice message' : (replyingTo?.text || ''))}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setReplyingTo(null);
              if (editingMessage) { setEditingMessage(null); setText(''); }
            }}
            style={({ pressed }) => [styles.pinPaneClose, pressed && { opacity: 0.6 }]}
            accessibilityLabel="Cancel"
          >
            <Icon name="close" size={14} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      {/* Pending photo preview */}
      {pendingPhoto ? (
        <View style={[styles.photoPreviewBar, { backgroundColor: colors.surface2, borderTopColor: colors.border }]}>
          <CachedImage source={{ uri: pendingPhoto.uri }} style={styles.photoPreview} accessibilityLabel="Pending photo preview" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.photoPreviewLabel, { color: colors.textPrimary }]}>Photo attached</Text>
            <Text style={[styles.photoPreviewSub, { color: colors.textMuted }]} numberOfLines={1}>
              Will send with your next message
            </Text>
          </View>
          <AnimatedPressable onPress={() => setPendingPhoto(null)} pressedScale={0.85} hapticStyle="light">
            <View style={styles.photoPreviewClose}>
              <Icon name="close" size={16} color={colors.textMuted} />
            </View>
          </AnimatedPressable>
        </View>
      ) : null}

      {/* Input */}
      <View style={[styles.inputBar, {
        borderTopColor: colors.border,
        backgroundColor: isDark ? 'rgba(12,18,35,0.96)' : colors.surface1,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
      }]}>
        {!isRecording && (
          <AnimatedPressable onPress={onCamera} hapticStyle="light" pressedScale={0.88}>
            <View style={[styles.inputIconBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }]}>
              <Icon name="camera" size={18} color={colors.textMuted} />
            </View>
          </AnimatedPressable>
        )}
        {!isRecording && (
          <AnimatedPressable
            onPress={() => setUrgent(u => !u)}
            hapticStyle={urgent ? 'warning' : 'light'}
            pressedScale={0.88}
          >
            <View style={[
              styles.inputIconBtn,
              {
                borderColor: urgent ? '#ef4444' : colors.border,
                backgroundColor: urgent ? 'rgba(239,68,68,0.16)' : colors.surface2,
              },
            ]}>
              <Icon name="flame" size={18} color={urgent ? '#ef4444' : colors.textMuted} />
            </View>
          </AnimatedPressable>
        )}
        {!isRecording && (
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder={urgent ? 'URGENT message…' : 'Message dispatcher…'}
            placeholderTextColor={urgent ? 'rgba(239,68,68,0.8)' : colors.textDisabled}
            style={[styles.input, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface2,
              borderColor: urgent ? '#ef4444' : colors.border,
              color: colors.textPrimary,
            }]}
            multiline
            maxLength={500}
          />
        )}
        {/* While idle: mic button next to send. While recording: full-width recorder bar. */}
        {(isRecording || (!text.trim() && !pendingPhoto)) && (
          <VoiceRecorder
            onSend={handleVoiceSend}
            onRecordingChange={setIsRecording}
            disabled={sending}
            colors={colors}
            gradients={gradients}
            isDark={isDark}
          />
        )}
        {!isRecording && (text.trim() || pendingPhoto) && (
          <AnimatedPressable
            disabled={sending}
            onPress={() => send()}
            hapticStyle="light"
            pressedScale={0.9}
            containerStyle={{ opacity: !sending ? 1 : 0.4 }}
          >
            <LinearGradient
              colors={urgent ? ['#ef4444', '#dc2626'] : gradients.brand}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[styles.send, shadow.glow]}
            >
              <Icon name="send" size={17} color="#fff" />
            </LinearGradient>
          </AnimatedPressable>
        )}
      </View>
      </KeyboardAvoidingView>

      <MessageActionsSheet
        visible={!!sheetTarget}
        message={sheetTarget}
        fromMe={sheetTarget?.fromDriver === true}
        onClose={() => setSheetTarget(null)}
        onReply={() => onReply(sheetTarget)}
        onReact={(emoji) => onToggleReaction(sheetTarget, emoji, false)}
        onCopy={() => onCopy(sheetTarget)}
        onEdit={() => onEdit(sheetTarget)}
        onDelete={(scope) => onDelete(sheetTarget, scope)}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerAvatar: { width: 40, height: 40, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.22)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.42)',
  },
  headerSub: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },

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

  msgRow: { alignItems: 'flex-start', gap: 2 },
  msgRowRight: { alignItems: 'flex-end' },
  bubbleWithTail: { position: 'relative', maxWidth: 280 },
  bubble: { maxWidth: 280, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleThem: { borderBottomLeftRadius: 4, borderWidth: 1 },
  // Voice bubble needs more horizontal room for the waveform + play + speed pill.
  bubbleVoice: { minWidth: 240, paddingHorizontal: 8, paddingVertical: 7 },

  // Tombstone bubble (delete for everyone) — italic, low-emphasis fill.
  bubbleTombstone: {
    backgroundColor: 'rgba(0,0,0,0.12)',
    opacity: 0.9,
  },
  tombstoneText: {
    fontSize: 12.5,
    fontStyle: 'italic',
    color: '#fff',
    opacity: 0.92,
  },

  // Inline "(edited)" mark appended to text.
  editedBadge: {
    fontSize: 10,
    fontWeight: '500',
    fontStyle: 'italic',
    opacity: 0.7,
  },

  // Quote chip rendered inside the bubble for reply context.
  replyQuoteMe: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    marginBottom: 6,
    maxWidth: 260,
  },
  replyQuoteAuthorMe: {
    color: '#fff',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  replyQuoteTextMe: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    marginTop: 1,
  },
  replyQuoteThem: {
    borderLeftWidth: 3,
    borderLeftColor: '#0193ab',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    marginBottom: 6,
    maxWidth: 260,
  },
  replyQuoteAuthorThem: {
    color: '#0193ab',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  replyQuoteTextThem: {
    fontSize: 12,
    marginTop: 1,
  },

  // Reply / Edit pane above the input.
  pinPane: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: '#0193ab',
    marginHorizontal: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  pinPaneIcon: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinPaneLabel: {
    color: '#0193ab',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pinPaneText: {
    fontSize: 12.5,
    marginTop: 1,
  },
  pinPaneClose: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleTextMe: { color: '#fff', fontSize: 13.5, lineHeight: 19, fontWeight: '500' },
  bubbleTextThem: { fontSize: 13.5, lineHeight: 19, fontWeight: '500' },
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
  urgentTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: '#ef4444',
    borderRadius: 999, alignSelf: 'flex-end',
    marginBottom: 4,
  },
  urgentTagText: { color: '#fff', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  bubblePhotoMe: {
    borderRadius: 14, overflow: 'hidden',
    marginBottom: 4,
    alignSelf: 'flex-end',
  },
  bubbleImg: { width: 180, height: 180, borderRadius: 14 },

  metaRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginTop: 2 },
  time: { fontSize: 10, fontWeight: '500' },

  presets: { flexGrow: 0, borderTopWidth: 1 },
  presetsContent: { padding: 10, gap: 7 },
  preset: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
  },
  presetText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },

  photoPreviewBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1,
  },
  photoPreview: { width: 44, height: 44, borderRadius: 8 },
  photoPreviewLabel: { fontSize: 13, fontWeight: '700' },
  photoPreviewSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  photoPreviewClose: { padding: 4 },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, padding: 10, paddingTop: 10, borderTopWidth: 1 },
  inputIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  input: {
    flex: 1, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, fontSize: 13.5, maxHeight: 120, minHeight: 42, fontWeight: '500',
  },
  send: {
    width: 42, height: 42, borderRadius: 99, alignItems: 'center', justifyContent: 'center',
  },
});
