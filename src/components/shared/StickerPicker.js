import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { STICKER_PACKS } from '../../data/stickers';

/**
 * Sticker picker modal. Tap a sticker → send immediately (no compose step).
 * Same UX as the web sticker picker.
 *
 *   <StickerPicker
 *     visible={open}
 *     onClose={() => setOpen(false)}
 *     onPick={(ref) => sendSticker(ref)}    // ref = "packId/stickerId"
 *     colors={colors}
 *     isDark={isDark}
 *   />
 */
export default function StickerPicker({ visible, onClose, onPick, colors, isDark }) {
  const [activePackId, setActivePackId] = useState(STICKER_PACKS[0].id);
  const pack = STICKER_PACKS.find(p => p.id === activePackId) || STICKER_PACKS[0];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: isDark ? '#0c1224' : '#fff' }]}
          onPress={(e) => e.stopPropagation?.()}
        >
          <View style={styles.handle} />
          <View style={[styles.tabBar, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
              {STICKER_PACKS.map(p => (
                <Pressable
                  key={p.id}
                  onPress={() => setActivePackId(p.id)}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: p.id === activePackId
                        ? (isDark ? 'rgba(91,108,255,0.22)' : 'rgba(91,108,255,0.15)')
                        : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'),
                    },
                  ]}
                >
                  <SvgXml xml={p.cover} width={28} height={28} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <Text style={[styles.packName, { color: colors?.textPrimary || (isDark ? '#f1f5f9' : '#0f172a') }]}>
            {pack.name}
          </Text>
          <ScrollView contentContainerStyle={styles.grid}>
            {pack.stickers.map(s => (
              <Pressable
                key={s.id}
                style={styles.cell}
                onPress={() => { onPick?.(`${pack.id}/${s.id}`); onClose?.(); }}
                android_ripple={{ color: 'rgba(91,108,255,0.18)', borderless: true }}
              >
                <SvgXml xml={s.svg} width="100%" height="100%" />
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:    { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 28, maxHeight: '70%' },
  handle:   { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(148,163,184,0.5)', alignSelf: 'center', marginTop: 8, marginBottom: 8 },
  tabBar:   { borderBottomWidth: 1 },
  tabBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab:      { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  packName: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 14, paddingTop: 8 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 6 },
  cell:     { width: '30%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: 6 },
});
