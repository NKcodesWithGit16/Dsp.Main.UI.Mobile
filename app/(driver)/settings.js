import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, ActivityIndicator,
  TouchableOpacity, Animated, PanResponder, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { fetchDriver, updateDriverSettings } from '../../src/api/main';
import GradientHeader from '../../src/components/shared/GradientHeader';
import { gradients, glass, shadow } from '../../src/theme/colors';

export default function DriverSettings() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { userId } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoAccept, setAutoAccept] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const d = await fetchDriver(userId);
      if (d) setAutoAccept(!!d.autoAcceptLoads);
    } catch {}
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggleAutoAccept = useCallback(async (next) => {
    Haptics.selectionAsync().catch(() => {});
    setAutoAccept(next);
    setSaving(true);
    try {
      await updateDriverSettings(userId, { autoAcceptLoads: next });
    } catch {
      // Revert on failure.
      setAutoAccept(!next);
    } finally {
      setSaving(false);
    }
  }, [userId]);

  // Swipe-down-to-dismiss (matches dispatcher-chat).
  const dragY = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) dragY.setValue(Math.min(g.dy, 220)); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.8) {
          Animated.timing(dragY, { toValue: 600, duration: 200, useNativeDriver: true })
            .start(() => router.back());
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: colors.pageBg, transform: [{ translateY: dragY }] }]}
    >
      <View {...pan.panHandlers}>
        <GradientHeader
          gradient={gradients.heroDispatch}
          eyebrow="Preferences"
          title="Settings"
          onBack={() => { Haptics.selectionAsync().catch(() => {}); router.back(); }}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
        >
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>LOADS</Text>

          <View style={[styles.card, shadow.card, {
            backgroundColor: isDark ? glass.fillDarkStrong : glass.fillLightStrong,
            borderColor: isDark ? glass.borderDarkSoft : glass.borderLightSoft,
          }]}>
            <View style={styles.row}>
              <LinearGradient colors={['#22c55e', '#16a34a']} style={styles.rowIcon}>
                <Text style={styles.rowIconText}>✓</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Auto-accept loads</Text>
                <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                  Skip the accept/deny prompt — new loads go straight onto your queue.
                </Text>
              </View>
              <Switch
                value={autoAccept}
                onValueChange={toggleAutoAccept}
                disabled={saving}
                trackColor={{ false: isDark ? '#374151' : '#cbd5e1', true: '#6366f1' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 18 }]}>APPEARANCE</Text>

          <View style={[styles.card, shadow.card, {
            backgroundColor: isDark ? glass.fillDarkStrong : glass.fillLightStrong,
            borderColor: isDark ? glass.borderDarkSoft : glass.borderLightSoft,
          }]}>
            <TouchableOpacity activeOpacity={0.7} onPress={toggleTheme} style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.1)' }]}>
                <Text style={styles.rowIconEmoji}>{isDark ? '🌙' : '☀️'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Theme</Text>
                <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                  Currently {isDark ? 'Dark' : 'Light'} — tap to switch
                </Text>
              </View>
              <Text style={[styles.chev, { color: colors.textMuted }]}>›</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, gap: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginLeft: 4, marginBottom: 8 },
  card: { borderRadius: 16, borderWidth: 1, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  rowIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowIconText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  rowIconEmoji: { fontSize: 18 },
  rowTitle: { fontSize: 14.5, fontWeight: '700', letterSpacing: -0.1 },
  rowSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  chev: { fontSize: 20, fontWeight: '600' },
});
