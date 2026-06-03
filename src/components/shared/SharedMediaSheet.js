import React, { useMemo } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, FlatList,
  Image, Dimensions, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';
import { getStickerSvg } from '../../data/stickers';

const { width: SCREEN_W } = Dimensions.get('window');
const COLS = 3;
const CELL = (SCREEN_W - 4) / COLS;   // 2px gaps on edges + between cols

function CloseIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function PlayIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.5)" />
      <Path d="M10 8l6 4-6 4V8z" fill="#fff" />
    </Svg>
  );
}

function ImageIcon({ color = '#94a3b8' }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Pressable>
        <Path d="M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14z"
          stroke={color} strokeWidth="1.7" />
        <Circle cx="8.5" cy="8.5" r="1.5" stroke={color} strokeWidth="1.7" />
        <Path d="M21 15l-5-5L5 21" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      </Pressable>
    </Svg>
  );
}

/**
 * Extracts all photo / video / gif / sticker attachments from a messages array.
 */
function extractMedia(messages) {
  const items = [];
  for (const msg of messages) {
    if (!msg.attachments) continue;
    for (const att of msg.attachments) {
      const kind = att.kind;
      if (kind === 'photo' || kind === 'video' || kind === 'gif' || kind === 'sticker') {
        items.push({ ...att, _msgId: msg.id, _msgTime: msg.time, _fromDriver: msg.fromDriver });
      }
    }
  }
  return items.reverse(); // newest first
}

function MediaCell({ item }) {
  const onOpen = () => {
    const url = item.url || item.externalUrl || item.thumbnailUrl;
    if (url) Linking.openURL(url).catch(() => {});
  };

  // Sticker — render SVG inline
  if (item.kind === 'sticker') {
    const svg = item.caption ? getStickerSvg(item.caption) : null;
    return (
      <View style={[styles.cell, { width: CELL, height: CELL }]}>
        {svg
          ? <SvgXml xml={svg} width={CELL - 8} height={CELL - 8} style={{ alignSelf: 'center' }} />
          : <View style={styles.cellPlaceholder}><Text style={{ fontSize: 28 }}>🏷</Text></View>
        }
      </View>
    );
  }

  const uri = item.thumbnailUrl || item.url || item.externalUrl;
  if (!uri) {
    return (
      <View style={[styles.cell, styles.cellPlaceholder, { width: CELL, height: CELL }]}>
        <ImageIcon />
      </View>
    );
  }

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.cell, { width: CELL, height: CELL, opacity: pressed ? 0.82 : 1 }]}
    >
      <Image source={{ uri }} style={styles.cellImage} resizeMode="cover" />
      {item.kind === 'video' && (
        <View style={styles.playOverlay}><PlayIcon /></View>
      )}
      {item.kind === 'gif' && (
        <View style={styles.gifBadge}>
          <Text style={styles.gifLabel}>GIF</Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * SharedMediaSheet — bottom-sheet modal showing all photos, videos,
 * GIFs and stickers exchanged in the conversation.
 *
 * Props:
 *   visible   – boolean
 *   messages  – the full messages array from the chat
 *   onClose   – () => void
 *   colors    – theme colors
 *   isDark    – boolean
 */
export default function SharedMediaSheet({ visible, messages, onClose, colors, isDark }) {
  const insets = useSafeAreaInsets();
  const media = useMemo(() => extractMedia(messages || []), [messages]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[
          styles.sheet,
          {
            backgroundColor: isDark ? '#11141c' : '#ffffff',
            paddingBottom: insets.bottom + 12,
          },
        ]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)' }]} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors?.textPrimary ?? '#0f172a' }]}>
                Shared Media
              </Text>
              <Text style={[styles.subtitle, { color: colors?.textMuted ?? '#94a3b8' }]}>
                {media.length} {media.length === 1 ? 'item' : 'items'}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <CloseIcon />
            </Pressable>
          </View>

          {media.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <ImageIcon color={isDark ? '#94a3b8' : '#64748b'} />
              </View>
              <Text style={[styles.emptyText, { color: colors?.textMuted ?? '#94a3b8' }]}>
                No photos, videos or GIFs yet
              </Text>
            </View>
          ) : (
            <FlatList
              data={media}
              keyExtractor={(item, i) => `${item._msgId}-${i}`}
              numColumns={COLS}
              renderItem={({ item }) => <MediaCell item={item} />}
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
              initialNumToRender={18}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.46)',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '82%',
    overflow: 'hidden',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  grid: {
    padding: 2,
    gap: 2,
  },
  cell: {
    margin: 1,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  cellImage: {
    width: '100%',
    height: '100%',
  },
  cellPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(1,147,171,0.08)',
  },
  playOverlay: {
    position: 'absolute',
    left: 0, top: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gifBadge: {
    position: 'absolute',
    bottom: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  gifLabel: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(1,147,171,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { fontSize: 14, fontWeight: '500' },
});
