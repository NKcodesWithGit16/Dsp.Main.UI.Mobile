import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Modal, Pressable, ScrollView, TextInput,
  Image as RNImage, ActivityIndicator, StyleSheet,
} from 'react-native';
import { searchGifs, getTrendingGifs, isTenorConfigured } from '../../api/tenor';

/**
 * GIF picker bottom-sheet. Trending shown on open; typing a query debounces a
 * search at 400ms. Tap → onPick(gif) where gif = { id, title, preview, full, width, height }.
 */
export default function GifPicker({ visible, onClose, onPick, colors, isDark }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const timerRef = useRef(null);

  const fetchGifs = useCallback(async (q) => {
    if (!isTenorConfigured()) {
      setErr('Set EXPO_PUBLIC_TENOR_API_KEY to enable GIF search.');
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const list = q.trim() ? await searchGifs(q) : await getTrendingGifs();
      setResults(list);
    } catch (e) {
      setErr(e.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (timerRef.current) globalThis.clearTimeout(timerRef.current);
    timerRef.current = globalThis.setTimeout(() => fetchGifs(query), 400);
    return () => globalThis.clearTimeout(timerRef.current);
  }, [visible, query, fetchGifs]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: isDark ? '#0c1224' : '#fff' }]}
          onPress={(e) => e.stopPropagation?.()}
        >
          <View style={styles.handle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search GIFs…"
            placeholderTextColor={colors?.textMuted || '#94a3b8'}
            autoFocus
            style={[styles.search, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
              color: colors?.textPrimary || (isDark ? '#f1f5f9' : '#0f172a'),
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
            }]}
          />
          {err ? (
            <Text style={[styles.msg, { color: '#dc2626' }]}>{err}</Text>
          ) : loading ? (
            <View style={styles.loadingWrap}><ActivityIndicator color="#5b6cff" /></View>
          ) : results.length === 0 ? (
            <Text style={[styles.msg, { color: colors?.textMuted || '#64748b' }]}>No results — try another search.</Text>
          ) : (
            <ScrollView contentContainerStyle={styles.grid}>
              {results.map(g => (
                <Pressable
                  key={g.id}
                  onPress={() => { onPick?.(g); onClose?.(); }}
                  style={styles.cell}
                  android_ripple={{ color: 'rgba(91,108,255,0.18)' }}
                >
                  <RNImage source={{ uri: g.preview }} style={styles.cellImg} />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:       { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 28, maxHeight: '70%' },
  handle:      { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(148,163,184,0.5)', alignSelf: 'center', marginTop: 8, marginBottom: 8 },
  search:      { marginHorizontal: 12, marginBottom: 8, padding: 10, borderRadius: 10, borderWidth: 1, fontSize: 14 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', padding: 6, gap: 4 },
  cell:        { width: '48%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(15,23,42,0.06)' },
  cellImg:     { width: '100%', height: '100%' },
  msg:         { textAlign: 'center', padding: 24, fontSize: 13 },
  loadingWrap: { padding: 32, alignItems: 'center' },
});
