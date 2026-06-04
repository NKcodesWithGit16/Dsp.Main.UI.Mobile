import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated, PanResponder, Alert, Pressable, Linking, Image as RNImage,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import EmojiPicker from 'rn-emoji-keyboard';
import { SvgXml } from 'react-native-svg';
import StickerPicker from '../../src/components/shared/StickerPicker';
import GifPicker from '../../src/components/shared/GifPicker';
import { getStickerSvg } from '../../src/data/stickers';

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
  signChatAttachment,
  uploadChatAttachment,
  sendChatMessageWithAttachments,
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
import PinnedMessageBar from '../../src/components/shared/PinnedMessageBar';
import MentionSuggestions from '../../src/components/shared/MentionSuggestions';
import SharedMediaSheet from '../../src/components/shared/SharedMediaSheet';
import LinkPreviewCard, { fetchLinkPreview, extractFirstUrl } from '../../src/components/shared/LinkPreviewCard';
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

// Mentionable people in the dispatcher chat. In production these would be
// fetched from the fleet API; here we include the dispatcher + known drivers.
const MENTION_DRIVERS = [
  { id: 'dispatcher', name: 'Dispatcher', role: 'Fleet Dispatcher' },
  { id: 'd1', name: 'James Wilson',   role: 'Driver' },
  { id: 'd2', name: 'Maria Garcia',   role: 'Driver' },
  { id: 'd3', name: 'Robert Chen',    role: 'Driver' },
  { id: 'd4', name: 'Sarah Johnson',  role: 'Driver' },
  { id: 'd5', name: 'Mike Thompson',  role: 'Driver' },
  { id: 'd6', name: 'Linda Martinez', role: 'Driver' },
];

// Regex that matches @Name mentions — capitalised first + optional last word.
// Intentionally conservative: requires capital first letter so @all or @everyone
// don't accidentally highlight.
const MENTION_RE = /@([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g;

/**
 * MentionText — renders message text with @Name mentions highlighted in
 * the brand teal. Works for both "me" (white) and "them" (themed) bubbles.
 */
function MentionText({ text, baseStyle, accentColor = '#5dd0e3', knownNames }) {
  if (!text) return null;
  const parts = [];
  let last = 0;
  let m;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: text.slice(last, m.index), mention: false });
    const isKnown = !knownNames || knownNames.has(m[1]);
    parts.push({ t: m[0], mention: isKnown });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ t: text.slice(last), mention: false });

  return (
    <Text style={baseStyle}>
      {parts.map((p, i) =>
        p.mention
          ? <Text key={i} style={[baseStyle, { color: accentColor, fontWeight: '800' }]}>{p.t}</Text>
          : <Text key={i}>{p.t}</Text>,
      )}
    </Text>
  );
}

function formatTime(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// Inline attachment renderer. Document = card with name + size; photo/gif =
// inline image. Tap opens the original via the OS handler (browser / native viewer).
function AttachmentChip({ att, fromMe, colors, isDark }) {
  const onOpen = () => {
    const url = att.url || att.externalUrl;
    if (url) Linking.openURL(url).catch(() => {});
  };
  if (att._pending) {
    return (
      <View style={[attStyles.doc, fromMe ? attStyles.docMe : { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.04)' }]}>
        <ActivityIndicator size="small" color={fromMe ? '#fff' : colors.accent} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[attStyles.name, { color: fromMe ? '#fff' : colors.textPrimary }]} numberOfLines={1}>{att.caption || 'Attachment'}</Text>
          <Text style={[attStyles.sub, { color: fromMe ? 'rgba(255,255,255,0.7)' : colors.textMuted }]}>Uploading…</Text>
        </View>
      </View>
    );
  }
  if (att.kind === 'sticker') {
    // Built-in stickers ship inline in src/data/stickers.js. caption is "packId/stickerId".
    const svg = att.caption ? getStickerSvg(att.caption) : null;
    if (svg) {
      return <SvgXml xml={svg} width={140} height={140} style={{ marginBottom: 4 }} />;
    }
    const src = att.url || att.externalUrl;
    return src ? <RNImage source={{ uri: src }} style={attStyles.image} accessibilityLabel={att.caption || 'sticker'} /> : null;
  }
  if (att.kind === 'video') {
    const poster = att.thumbnailUrl;
    return (
      <Pressable onPress={onOpen} style={attStyles.videoWrap}>
        {poster ? <RNImage source={{ uri: poster }} style={attStyles.image} /> : <View style={[attStyles.image, { backgroundColor: '#000' }]} />}
        <View style={attStyles.playOverlay}>
          <Icon name="send" size={24} color="#fff" />
        </View>
        {att.durationSeconds ? (
          <View style={attStyles.durationBadge}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
              {Math.floor(att.durationSeconds / 60)}:{String(att.durationSeconds % 60).padStart(2, '0')}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  }
  if (att.kind === 'photo' || att.kind === 'gif') {
    const src = att.url || att.externalUrl;
    if (!src) return null;
    return (
      <Pressable onPress={onOpen}>
        <RNImage source={{ uri: src }} style={attStyles.image} accessibilityLabel={att.caption || att.kind} />
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onOpen} style={[attStyles.doc, fromMe ? attStyles.docMe : { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.04)' }]}>
      <View style={[attStyles.icon, { backgroundColor: fromMe ? 'rgba(255,255,255,0.2)' : 'rgba(91,108,255,0.16)' }]}>
        <Icon name="fileText" size={16} color={fromMe ? '#fff' : '#5b6cff'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[attStyles.name, { color: fromMe ? '#fff' : colors.textPrimary }]} numberOfLines={1}>
          {att.caption || 'Document'}
        </Text>
        <Text style={[attStyles.sub, { color: fromMe ? 'rgba(255,255,255,0.7)' : colors.textMuted }]} numberOfLines={1}>
          {[att.mimeType?.split('/')[1]?.toUpperCase(), fmtSize(att.sizeBytes)].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

const attStyles = StyleSheet.create({
  doc:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, marginBottom: 4, minWidth: 200 },
  docMe:  { backgroundColor: 'rgba(255,255,255,0.18)' },
  icon:   { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  name:   { fontSize: 13, fontWeight: '600' },
  sub:    { fontSize: 11, marginTop: 1 },
  image:  { width: 220, height: 220, borderRadius: 10, marginBottom: 4, backgroundColor: 'rgba(0,0,0,0.05)' },
  videoWrap: { width: 220, height: 220, borderRadius: 10, marginBottom: 4, overflow: 'hidden', position: 'relative', backgroundColor: '#000' },
  playOverlay: {
    position: 'absolute', left: 0, top: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute', right: 8, bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
});

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
      attachments: Array.isArray(m.attachments) ? m.attachments : null,
      // Read/delivery status (for dispatcher-sent messages status ticks)
      isRead: !!(m.isRead || m.readAt),
      readAt: m.readAt || null,
      deliveredAt: m.deliveredAt || null,
      delivered: !!(m.delivered || m.deliveredAt),
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

/**
 * StatusTick — tiny inline SVG checkmarks for dispatcher-sent messages.
 * Shows the delivery/read state of each dispatcher message:
 *   - isRead / readAt      → double tick, teal (#0193ab)
 *   - deliveredAt/delivered → double tick, gray
 *   - otherwise            → single tick, gray (sent)
 */
function StatusTick({ msg }) {
  const isRead      = !!(msg.isRead || msg.readAt);
  const isDelivered = !!(msg.deliveredAt || msg.delivered);
  const double      = isRead || isDelivered;
  const color       = isRead ? '#0193ab' : '#94a3b8';

  // Single SVG checkmark path (10×10 viewport matching the existing Checkmark glyph scale)
  const TickSvg = ({ style }) => (
    <Svg width={10} height={10} viewBox="0 0 10 10" fill="none" style={style}>
      <Path d="M2 5.5L4.2 7.8L8 3" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 4 }}>
      <TickSvg />
      {double && <TickSvg style={{ marginLeft: -4 }} />}
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
  const [pendingDocs, setPendingDocs] = useState([]);     // { id, name, size, mimeType, uri, status, progress }
  const [activeLoad, setActiveLoad] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  // Message interactions
  const [sheetTarget, setSheetTarget] = useState(null);    // message currently long-pressed
  const [replyingTo, setReplyingTo] = useState(null);      // { id, text, type, fromDriver }
  const [editingMessage, setEditingMessage] = useState(null); // { id, originalText }
  const [hiddenForMe, setHiddenForMe] = useState(() => new Set());
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // ── Phase 2 state ─────────────────────────────────────────────────────────
  // Pin
  const [pinnedMessage, setPinnedMessage] = useState(null);
  // In-chat search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Shared media sheet
  const [sharedMediaOpen, setSharedMediaOpen] = useState(false);
  // Link preview
  const [linkPreview, setLinkPreview] = useState(null);          // { url, title, image, description }
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false);
  const linkPreviewDismissed = useRef(null);   // last URL the user explicitly dismissed
  const linkFetchTimer = useRef(null);
  // Known mention names set (for highlight matching)
  const knownMentionNames = useRef(new Set(MENTION_DRIVERS.map(d => d.name))).current;

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

  // ── Link preview: watch text for URLs, debounced 800ms ────────────────────
  useEffect(() => {
    clearTimeout(linkFetchTimer.current);
    const url = extractFirstUrl(text);
    if (!url || url === linkPreviewDismissed.current) {
      // No URL or user already dismissed this one → clear any existing preview.
      if (!url) {
        setLinkPreview(null);
        setLinkPreviewLoading(false);
      }
      return;
    }
    // Same URL already loaded — don't re-fetch.
    if (linkPreview?.url === url) return;

    setLinkPreviewLoading(true);
    linkFetchTimer.current = setTimeout(async () => {
      const preview = await fetchLinkPreview(url);
      setLinkPreviewLoading(false);
      if (preview) {
        setLinkPreview(preview);
      } else {
        // Fetch succeeded but no OG data — treat as dismissed so we don't retry.
        linkPreviewDismissed.current = url;
      }
    }, 800);

    return () => clearTimeout(linkFetchTimer.current);
  }, [text]);

  // ── Pin handler ────────────────────────────────────────────────────────────
  const onPin = useCallback((msg) => {
    setPinnedMessage(prev =>
      prev && String(prev.id) === String(msg.id) ? null : msg,
    );
    Haptics.selectionAsync().catch(() => {});
  }, []);

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

    if (!body && !pendingPhoto && pendingDocs.length === 0) return;
    if (sending) return;
    Haptics.selectionAsync().catch(() => {});
    if (urgent) body = `!! ${body}`;
    if (typeof preset !== 'string') {
      setText('');
      // Clear link preview state when message is sent.
      setLinkPreview(null);
      setLinkPreviewLoading(false);
      linkPreviewDismissed.current = null;
    }
    const sentPhoto = pendingPhoto;
    setPendingPhoto(null);
    const docsForSend = pendingDocs;
    const wasUrgent = urgent;
    setUrgent(false);
    const rid = replyingTo?.id;
    const replyContext = replyingTo ? { ...replyingTo } : null;
    const optimistic = {
      id: `tmp-${Date.now()}`, fromDriver: true, text: body, time: new Date(),
      sentAt: Date.now(), pending: true, urgent: wasUrgent, photoUri: sentPhoto?.uri,
      replyToMessageId: rid, replyTo: replyContext,
      attachments: docsForSend.map(d => ({ id: d.id, kind: 'document', caption: d.name, sizeBytes: d.size, mimeType: d.mimeType, _pending: true })),
    };
    setMessages(prev => [...prev, optimistic]);
    setReplyingTo(null);
    setSending(true);
    try {
      const refs = [];
      // Photo first so it appears above docs in the bundle.
      if (sentPhoto) {
        const mime = sentPhoto.mimeType || 'image/jpeg';
        const sizeBytes = sentPhoto.fileSize || 0;
        const signed = await signChatAttachment(userId, { kind: 'photo', mimeType: mime, sizeBytes });
        await uploadChatAttachment(signed.uploadUrl, sentPhoto.uri, mime);
        refs.push({
          storageKey: signed.storageKey,
          kind: 'photo',
          mimeType: mime,
          sizeBytes,
          width: sentPhoto.width,
          height: sentPhoto.height,
        });
      }
      for (const doc of docsForSend) {
        setPendingDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'uploading' } : d));
        const signed = await signChatAttachment(userId, {
          kind: 'document',
          mimeType: doc.mimeType,
          sizeBytes: doc.size,
        });
        await uploadChatAttachment(signed.uploadUrl, doc.uri, doc.mimeType);
        refs.push({
          storageKey: signed.storageKey,
          kind: 'document',
          mimeType: doc.mimeType,
          sizeBytes: doc.size,
          filename: doc.name,
        });
      }

      if (refs.length > 0) {
        await sendChatMessageWithAttachments(userId, {
          text: body || null,
          attachments: refs,
          replyToMessageId: rid,
          senderId: userId,
          senderRole: 'driver',
        });
        setPendingDocs([]);
      } else {
        await sendDriverMessage(userId, body, rid);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      console.warn('send failed', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      // Leave pendingDocs in place so the user can retry; mark them as errored.
      setPendingDocs(prev => prev.map(d => ({ ...d, status: 'error' })));
    }
    setSending(false);
  }, [text, sending, userId, urgent, pendingPhoto, pendingDocs, replyingTo, editingMessage, me]);

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

  // 50 MB cap matches the backend's MaxAttachmentBytes — fail fast on the client
  // so we don't burn upload bandwidth on a doc the server will reject.
  const MAX_DOC_BYTES = 50 * 1024 * 1024;

  const onAttachDocs = async () => {
    Haptics.selectionAsync().catch(() => {});
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const assets = res.assets || (res.uri ? [res] : []);
      const accepted = [];
      for (const a of assets) {
        if (a.size && a.size > MAX_DOC_BYTES) {
          Alert.alert('File too large', `"${a.name}" exceeds the 50 MB limit.`);
          continue;
        }
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: a.name || 'Document',
          size: a.size || 0,
          mimeType: a.mimeType || 'application/octet-stream',
          uri: a.uri,
          status: 'pending',
          progress: 0,
        });
      }
      if (accepted.length) setPendingDocs(prev => [...prev, ...accepted]);
    } catch (e) {
      console.warn('document picker failed', e);
    }
  };

  const removePendingDoc = (id) => {
    setPendingDocs(prev => prev.filter(d => d.id !== id));
  };

  const onCamera = async () => {
    Haptics.selectionAsync().catch(() => {});
    Alert.alert(
      'Attach media',
      'What would you like to send?',
      [
        { text: 'Take photo', onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return Alert.alert('Camera blocked', 'Enable camera access in Settings.');
          const r = await ImagePicker.launchCameraAsync({ quality: 0.65, allowsEditing: false });
          if (!r.canceled && r.assets?.[0]) setPendingPhoto(r.assets[0]);
        } },
        { text: 'Choose photo', onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return Alert.alert('Library blocked', 'Enable photo library access in Settings.');
          const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.65, allowsEditing: false, mediaTypes: ImagePicker.MediaTypeOptions.Images });
          if (!r.canceled && r.assets?.[0]) setPendingPhoto(r.assets[0]);
        } },
        { text: 'Choose video', onPress: () => onPickVideo() },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  // 60s cap matches the brief — anything longer is a different product (calls).
  const MAX_VIDEO_SECS = 60;

  const onPickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Library blocked', 'Enable photo library access in Settings.');
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      videoMaxDuration: MAX_VIDEO_SECS,
      quality: 0.7,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const asset = r.assets[0];
    const durationSec = asset.duration ? Math.round(asset.duration / 1000) : 0;
    if (durationSec > MAX_VIDEO_SECS + 1) {
      return Alert.alert('Video too long', `Videos must be ${MAX_VIDEO_SECS}s or less. This one is ${durationSec}s.`);
    }
    setSending(true);
    try {
      // Generate poster from the first frame so the bubble can render before the
      // video downloads on the receiver side.
      const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 100, quality: 0.7 });
      const videoMime = asset.mimeType || 'video/mp4';
      const videoSize = asset.fileSize || 0;
      const videoSign = await signChatAttachment(userId, { kind: 'video', mimeType: videoMime, sizeBytes: videoSize });
      const thumbSign = await signChatAttachment(userId, { kind: 'photo', mimeType: 'image/jpeg', sizeBytes: 0 });
      await Promise.all([
        uploadChatAttachment(videoSign.uploadUrl, asset.uri, videoMime),
        uploadChatAttachment(thumbSign.uploadUrl, thumbUri, 'image/jpeg'),
      ]);
      await sendChatMessageWithAttachments(userId, {
        attachments: [{
          storageKey: videoSign.storageKey,
          thumbnailKey: thumbSign.storageKey,
          kind: 'video',
          mimeType: videoMime,
          sizeBytes: videoSize,
          durationSeconds: durationSec,
          width: asset.width,
          height: asset.height,
        }],
        senderId: userId,
        senderRole: 'driver',
        replyToMessageId: replyingTo?.id,
      });
      setReplyingTo(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      console.warn('video send failed', err);
      Alert.alert('Send failed', 'Could not send the video. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setSending(false);
    }
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

  // ── @mention derived state ─────────────────────────────────────────────────
  // Detect "@partial" at the end of the current input value.
  // We allow letters, spaces, dots and hyphens after @ so partial last-names work.
  const mentionMatch = text.match(/@([\w .'-]*)$/);
  const mentionQuery  = mentionMatch ? mentionMatch[1].toLowerCase().trim() : null;
  const mentionSuggestions = mentionQuery !== null
    ? MENTION_DRIVERS.filter(d => d.name.toLowerCase().includes(mentionQuery))
    : [];
  // Only show the panel when there's something after the @.
  const showMentions = mentionQuery !== null && mentionSuggestions.length > 0;

  const onSelectMention = (name) => {
    // Replace everything from the last @ to end-of-string with "@Name ".
    const newText = text.replace(/@[\w .'-]*$/, `@${name} `);
    setText(newText);
    inputRef.current?.focus();
  };

  // ── In-chat search: filtered message ids ──────────────────────────────────
  const searchQueryTrimmed = searchQuery.trim().toLowerCase();
  const searchMatchIds = searchQueryTrimmed.length >= 2
    ? new Set(
        messages
          .filter(m => (m.text || '').toLowerCase().includes(searchQueryTrimmed))
          .map(m => String(m.id)),
      )
    : null;

  // ── Pinned message scroll helper ───────────────────────────────────────────
  const scrollToPinned = () => {
    if (!pinnedMessage || !listRef.current) return;
    const visibleMessages = messages.filter(m => !hiddenForMe.has(String(m.id)));
    const idx = visibleMessages.findIndex(m => String(m.id) === String(pinnedMessage.id));
    if (idx >= 0) {
      listRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
    }
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
            <View style={styles.headerRight}>
              <Pressable
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setSearchOpen(s => !s); setSearchQuery(''); }}
                style={[styles.headerIconBtn, searchOpen && styles.headerIconBtnActive]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Search messages"
              >
                <Icon name="search" size={15} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setSharedMediaOpen(true); }}
                style={styles.headerIconBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Shared media"
              >
                <Icon name="image" size={15} color="#fff" />
              </Pressable>
              <View style={styles.statusPill}>
                <LiveDot color="#10b981" size={6} />
                <Text style={styles.headerSub}>Active</Text>
              </View>
            </View>
          }
        />
      </View>

      {/* ── Pinned message bar ─────────────────────────────────────────────── */}
      <PinnedMessageBar
        message={pinnedMessage}
        onDismiss={() => setPinnedMessage(null)}
        onPress={scrollToPinned}
        colors={colors}
        isDark={isDark}
      />

      {/* ── In-chat search bar ─────────────────────────────────────────────── */}
      {searchOpen && (
        <View style={[styles.searchBar, {
          backgroundColor: isDark ? '#18213a' : colors.surface2,
          borderBottomColor: colors.border,
        }]}>
          <Icon name="search" size={16} color={colors.textMuted} />
          <TextInput
            autoFocus
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search messages…"
            placeholderTextColor={colors.textDisabled}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Text style={[styles.searchCount, { color: colors.textMuted }]}>
              {searchMatchIds?.size ?? 0} found
            </Text>
          )}
          <Pressable onPress={() => { setSearchOpen(false); setSearchQuery(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

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

            // Highlight row if it matches the current search query.
            const isSearchMatch = searchMatchIds && searchMatchIds.has(String(item.id));

            return (
              <View style={[
                styles.msgRow,
                item.fromDriver && styles.msgRowRight,
                isSearchMatch && {
                  backgroundColor: isDark ? 'rgba(1,147,171,0.12)' : 'rgba(1,147,171,0.08)',
                  borderRadius: 12,
                  paddingHorizontal: 4,
                  paddingVertical: 2,
                },
              ]}>
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
                      ) : (item.text || (item.attachments && item.attachments.length > 0)) ? (
                        <LinearGradient
                          colors={item.urgent ? ['#ef4444', '#dc2626'] : gradients.brand}
                          style={[styles.bubble, styles.bubbleMe, item.pending && { opacity: 0.8 }]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          {hasReply && <ReplyQuoteMe author={replyAuthorLabel} text={replyText} />}
                          {item.attachments?.map(att => (
                            <AttachmentChip key={att.id} att={att} fromMe colors={colors} isDark={isDark} />
                          ))}
                          {item.text ? (
                            <MentionText
                              text={item.text.replace(/^!!\s/, '')}
                              baseStyle={styles.bubbleTextMe}
                              accentColor="rgba(255,255,255,0.95)"
                              knownNames={knownMentionNames}
                            />
                          ) : null}
                          {item.editedAt && !tombstoned ? (
                            <Text style={styles.editedBadge}> (edited)</Text>
                          ) : null}
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
                            {item.attachments?.map(att => (
                              <AttachmentChip key={att.id} att={att} colors={colors} isDark={isDark} />
                            ))}
                            {item.text ? (
                              <MentionText
                                text={item.text}
                                baseStyle={[styles.bubbleTextThem, { color: colors.textPrimary }]}
                                accentColor={colors.accent}
                                knownNames={knownMentionNames}
                              />
                            ) : null}
                            {item.editedAt && !tombstoned ? (
                              <Text style={[styles.editedBadge, { color: colors.textMuted }]}> (edited)</Text>
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
                  {/* Status ticks for dispatcher-sent messages (fromDriver === false) */}
                  {!item.fromDriver && !tombstoned && (
                    <StatusTick msg={item} />
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

      {/* Pending document chips */}
      {pendingDocs.length > 0 ? (
        <View style={[styles.photoPreviewBar, { backgroundColor: colors.surface2, borderTopColor: colors.border, flexDirection: 'column', alignItems: 'stretch', gap: 6 }]}>
          {pendingDocs.map(d => (
            <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.photoPreviewClose, { backgroundColor: 'rgba(91,108,255,0.16)' }]}>
                <Icon name="fileText" size={16} color="#5b6cff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.photoPreviewLabel, { color: colors.textPrimary }]} numberOfLines={1}>{d.name}</Text>
                <Text style={[styles.photoPreviewSub, { color: d.status === 'error' ? '#ef4444' : colors.textMuted }]} numberOfLines={1}>
                  {d.status === 'uploading'
                    ? 'Uploading…'
                    : d.status === 'error'
                      ? 'Upload failed — tap send to retry'
                      : `${(d.size / 1024).toFixed(0)} KB`}
                </Text>
              </View>
              <AnimatedPressable onPress={() => removePendingDoc(d.id)} pressedScale={0.85} hapticStyle="light" disabled={d.status === 'uploading'}>
                <View style={[styles.photoPreviewClose, { opacity: d.status === 'uploading' ? 0.4 : 1 }]}>
                  <Icon name="close" size={16} color={colors.textMuted} />
                </View>
              </AnimatedPressable>
            </View>
          ))}
        </View>
      ) : null}

      {/* ── Link preview ──────────────────────────────────────────────────── */}
      <LinkPreviewCard
        preview={linkPreview}
        loading={linkPreviewLoading}
        onDismiss={() => {
          const url = extractFirstUrl(text);
          if (url) linkPreviewDismissed.current = url;
          setLinkPreview(null);
          setLinkPreviewLoading(false);
        }}
        colors={colors}
        isDark={isDark}
      />

      {/* ── @Mention suggestions ──────────────────────────────────────────── */}
      <MentionSuggestions
        suggestions={mentionSuggestions}
        visible={showMentions}
        onSelect={onSelectMention}
        colors={colors}
        isDark={isDark}
      />

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
          <AnimatedPressable onPress={onAttachDocs} hapticStyle="light" pressedScale={0.88}>
            <View style={[styles.inputIconBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }]}>
              <Icon name="fileText" size={18} color={colors.textMuted} />
            </View>
          </AnimatedPressable>
        )}
        {!isRecording && (
          <AnimatedPressable
            onPress={() => { Haptics.selectionAsync().catch(() => {}); setEmojiOpen(true); }}
            hapticStyle="light"
            pressedScale={0.88}
          >
            <View style={[styles.inputIconBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }]}>
              <Icon name="smile" size={18} color={colors.textMuted} />
            </View>
          </AnimatedPressable>
        )}
        {!isRecording && (
          <AnimatedPressable
            onPress={() => { Haptics.selectionAsync().catch(() => {}); setStickerOpen(true); }}
            hapticStyle="light"
            pressedScale={0.88}
          >
            <View style={[styles.inputIconBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }]}>
              <Icon name="star" size={18} color={colors.textMuted} />
            </View>
          </AnimatedPressable>
        )}
        {!isRecording && (
          <AnimatedPressable
            onPress={() => { Haptics.selectionAsync().catch(() => {}); setGifOpen(true); }}
            hapticStyle="light"
            pressedScale={0.88}
          >
            <View style={[styles.inputIconBtn, { borderColor: colors.border, backgroundColor: colors.surface2, paddingHorizontal: 6 }]}>
              <Text style={{ fontSize: 10, fontWeight: '900', color: colors.textMuted, letterSpacing: 0.5 }}>GIF</Text>
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
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
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
        {(isRecording || (!text.trim() && !pendingPhoto && pendingDocs.length === 0)) && (
          <VoiceRecorder
            onSend={handleVoiceSend}
            onRecordingChange={setIsRecording}
            disabled={sending}
            colors={colors}
            gradients={gradients}
            isDark={isDark}
          />
        )}
        {!isRecording && (text.trim() || pendingPhoto || pendingDocs.length > 0) && (
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
        isPinned={!!sheetTarget && !!pinnedMessage && String(pinnedMessage.id) === String(sheetTarget?.id)}
        onClose={() => setSheetTarget(null)}
        onReply={() => onReply(sheetTarget)}
        onReact={(emoji) => onToggleReaction(sheetTarget, emoji, false)}
        onCopy={() => onCopy(sheetTarget)}
        onEdit={() => onEdit(sheetTarget)}
        onDelete={(scope) => onDelete(sheetTarget, scope)}
        onPin={() => onPin(sheetTarget)}
      />

      <GifPicker
        visible={gifOpen}
        onClose={() => setGifOpen(false)}
        onPick={async (gif) => {
          try {
            await sendChatMessageWithAttachments(userId, {
              attachments: [{
                kind: 'gif',
                externalUrl: gif.full,
                caption: gif.title,
                width: gif.width,
                height: gif.height,
              }],
              senderId: userId,
              senderRole: 'driver',
              replyToMessageId: replyingTo?.id,
            });
            setReplyingTo(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          } catch (e) {
            console.warn('gif send failed', e);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          }
        }}
        colors={colors}
        isDark={isDark}
      />

      <StickerPicker
        visible={stickerOpen}
        onClose={() => setStickerOpen(false)}
        onPick={async (ref) => {
          try {
            await sendChatMessageWithAttachments(userId, {
              attachments: [{ kind: 'sticker', caption: ref }],
              senderId: userId,
              senderRole: 'driver',
              replyToMessageId: replyingTo?.id,
            });
            setReplyingTo(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          } catch (e) {
            console.warn('sticker send failed', e);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          }
        }}
        colors={colors}
        isDark={isDark}
      />

      {/* ── Shared Media Sheet ────────────────────────────────────────────── */}
      <SharedMediaSheet
        visible={sharedMediaOpen}
        messages={messages}
        onClose={() => setSharedMediaOpen(false)}
        colors={colors}
        isDark={isDark}
      />

      <EmojiPicker
        open={emojiOpen}
        onClose={() => setEmojiOpen(false)}
        onEmojiSelected={(e) => {
          const native = e?.emoji || '';
          if (!native) return;
          const safeStart = Math.min(selection.start, text.length);
          const safeEnd   = Math.min(selection.end,   text.length);
          const next = text.slice(0, safeStart) + native + text.slice(safeEnd);
          setText(next);
          const newPos = safeStart + native.length;
          setSelection({ start: newPos, end: newPos });
        }}
        enableRecentlyUsed
        enableSearchBar
        categoryPosition="top"
        theme={isDark ? {
          backdrop: 'rgba(0,0,0,0.5)',
          knob: '#5b6cff',
          container: '#0c1224',
          header: '#94a3b8',
          skinTonesContainer: '#1a2240',
          category: { icon: '#94a3b8', iconActive: '#5b6cff', container: '#1a2240', containerActive: '#5b6cff' },
          search: { background: '#1a2240', text: '#f1f5f9', placeholder: '#64748b', icon: '#94a3b8' },
          emoji: { selected: '#5b6cff' },
        } : undefined}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerAvatar: { width: 40, height: 40, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },

  // Header right cluster: icon buttons + status pill
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIconBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headerIconBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.36)',
  },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.22)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.42)',
  },
  headerSub: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },

  // In-chat search bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1, fontSize: 14, fontWeight: '500',
    paddingVertical: 0,
  },
  searchCount: { fontSize: 11, fontWeight: '600' },

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
