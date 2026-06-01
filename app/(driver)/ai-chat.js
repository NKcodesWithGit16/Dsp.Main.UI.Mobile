import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, PanResponder, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../src/context/ThemeContext';
import { useAuth }  from '../../src/context/AuthContext';

import GradientHeader from '../../src/components/shared/GradientHeader';
import GlassCard      from '../../src/components/shared/GlassCard';
import Icon           from '../../src/components/shared/Icon';
import AnimatedPressable from '../../src/components/shared/AnimatedPressable';
import { gradients, shadow } from '../../src/theme/colors';

const SUGGESTIONS = [
  { icon: 'clock',  text: 'How many HOS hours do I have left?' },
  { icon: 'pin',    text: 'Where is the nearest truck stop?' },
  { icon: 'info',   text: 'What is the speed limit here?' },
  { icon: 'bell',   text: 'Plan my rest break' },
];

function TypingDots({ color }) {
  const v = useRef([0, 1, 2].map(() => new Animated.Value(0.35))).current;
  useEffect(() => {
    const loops = v.map((val, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(val, { toValue: 1, duration: 360, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.35, duration: 360, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 }}>
      {v.map((val, i) => (
        <Animated.View
          key={i}
          style={{
            width: 6, height: 6, borderRadius: 99,
            backgroundColor: color,
            opacity: val,
            transform: [{ scale: val.interpolate({ inputRange: [0.35, 1], outputRange: [0.85, 1.15] }) }],
          }}
        />
      ))}
    </View>
  );
}

function AiHeaderAvatar() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const ring = {
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }],
    opacity:   pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
  };
  return (
    <View style={styles.headerAvatar}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.4)',
          },
          ring,
        ]}
      />
      <Icon name="sparkles" size={18} color="#fff" />
    </View>
  );
}

export default function AiChat() {
  const { colors, isDark } = useTheme();
  const { userName } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
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
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length, loading]);

  const fallbackReply = (q) => {
    const lower = q.toLowerCase();
    if (lower.includes('hos') || lower.includes('hour'))
      return 'HOS regulations require an 11-hour driving window followed by 10 hours rest. Trucker Path is great for finding nearby truck stops and rest areas.';
    if (lower.includes('route') || lower.includes('direction'))
      return 'For turn-by-turn navigation, use Google Maps or Waze. I can help you plan rest stops and weigh stations along your route.';
    if (lower.includes('weather'))
      return 'Check Weather.com or the NOAA app for real-time road weather. Want tips for driving in specific conditions?';
    if (lower.includes('truck stop') || lower.includes('rest'))
      return 'Trucker Path and Pilot/Flying J apps show parking availability live. Most stops near interstates have truck parking.';
    if (lower.includes('load') || lower.includes('delivery'))
      return 'Your active load info is on the main screen. Contact your dispatcher for specific questions about the assignment.';
    if (lower.includes('speed'))
      return 'Speed limits vary by state for CMVs — many states have a lower truck speed. Check posted signs; when in doubt, stay at or below 65 mph.';
    return `I'm your road assistant — I can help with routes, HOS compliance, weather, rest stops, and load questions. What do you need?`;
  };

  const send = useCallback(async () => {
    const body = input.trim();
    if (!body || loading) return;
    Haptics.selectionAsync().catch(() => {});
    setInput('');
    setError(null);

    const userMsg = { id: `u-${Date.now()}`, role: 'user', text: body };
    const assistantId = `a-${Date.now() + 1}`;
    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', text: '' }]);
    setLoading(true);

    try {
      await new Promise(r => setTimeout(r, 700));
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, text: fallbackReply(body) } : m));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setError(e?.message || 'Something went wrong');
      setMessages(prev => prev.filter(m => m.id !== assistantId));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, userName]);

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: colors.pageBg, transform: [{ translateY: dragY }] }]}
    >
      <View {...pan.panHandlers}>
        <GradientHeader
          gradient={gradients.brand}
          eyebrow="AI Assistant"
          title="Road Copilot"
          subtitle={loading ? 'Thinking…' : 'Ask anything'}
          onBack={() => { Haptics.selectionAsync().catch(() => {}); router.back(); }}
          centerSlot={<AiHeaderAvatar />}
          rightSlot={messages.length > 0 ? (
            <AnimatedPressable
              onPress={() => { setMessages([]); setError(null); }}
              hapticStyle="light"
              pressedScale={0.93}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.clearBtn}>
                <Text style={styles.headerClear}>Clear</Text>
              </View>
            </AnimatedPressable>
          ) : null}
        />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <FlatList
        ref={listRef}
        data={messages}
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
              colors={['rgba(1,147,171,0.30)', 'rgba(6,182,212,0.20)']}
              style={[styles.emptyAvatar, shadow.glow]}
            >
              <Icon name="sparkles" size={36} color="#0193ab" />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>AI Assistant</Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              Ask about routes, traffic, HOS, rest stops, or anything dispatch-related.
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map(q => (
                <AnimatedPressable
                  key={q.text}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setInput(q.text); }}
                  hapticStyle="selection"
                  pressedScale={0.985}
                  containerStyle={{ width: '100%' }}
                >
                  <GlassCard accent cornerRadius={14} contentStyle={styles.suggestionInner}>
                    <View style={styles.suggestionIcon}>
                      <Icon name={q.icon} size={14} color={colors.accent} />
                    </View>
                    <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>{q.text}</Text>
                    <Icon name="chevron" size={14} color={colors.textMuted} />
                  </GlassCard>
                </AnimatedPressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          return (
            <View style={[styles.msgRow, isUser && styles.msgRowRight]}>
              {!isUser && (
                <View style={[styles.aiAvatar, { backgroundColor: 'rgba(1,147,171,0.20)' }]}>
                  <Icon name="sparkles" size={12} color="#0193ab" />
                </View>
              )}
              {isUser ? (
                <View style={styles.bubbleWithTail}>
                  <LinearGradient
                    colors={gradients.brand}
                    style={[styles.bubble, styles.bubbleMe]}
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
                    {item.text ? (
                      <Text style={[styles.bubbleTextThem, { color: colors.textPrimary }]}>{item.text}</Text>
                    ) : (
                      <TypingDots color={colors.textMuted} />
                    )}
                  </View>
                  <View style={[styles.tailThem, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface2,
                    borderColor: colors.border,
                  }]} />
                </View>
              )}
            </View>
          );
        }}
      />

      {error && (
        <View style={[styles.error, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={[styles.inputBar, {
        borderTopColor: colors.border,
        backgroundColor: isDark ? 'rgba(12,18,35,0.96)' : colors.surface1,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
      }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask AI assistant…"
          placeholderTextColor={colors.textDisabled}
          style={[styles.input, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface2,
            borderColor: colors.border,
            color: colors.textPrimary,
          }]}
          multiline
          maxLength={600}
          editable={!loading}
        />
        <AnimatedPressable
          disabled={!input.trim() || loading}
          onPress={send}
          hapticStyle="light"
          pressedScale={0.9}
          containerStyle={{ opacity: input.trim() && !loading ? 1 : 0.4 }}
        >
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.send, shadow.glow]}
          >
            <Icon name="send" size={17} color="#fff" />
          </LinearGradient>
        </AnimatedPressable>
      </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerAvatar: { width: 40, height: 40, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  clearBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)',
  },
  headerClear: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },

  listContent: { padding: 14, gap: 10, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyAvatar: {
    width: 88, height: 88, borderRadius: 99,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  emptyHint: { fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 280, marginBottom: 14 },
  suggestions: { width: '100%', gap: 10, marginTop: 8 },
  suggestionInner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  suggestionIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: 'rgba(1,147,171,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  suggestionText: { flex: 1, fontSize: 13, fontWeight: '600' },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  msgRowRight: { justifyContent: 'flex-end' },
  aiAvatar: { width: 24, height: 24, borderRadius: 99, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },

  bubbleWithTail: { position: 'relative', maxWidth: '78%' },
  bubble: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleThem: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleTextMe: { color: '#fff', fontSize: 13.5, lineHeight: 20, fontWeight: '500' },
  bubbleTextThem: { fontSize: 13.5, lineHeight: 20, fontWeight: '500' },
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

  error: {
    marginHorizontal: 14, marginBottom: 8, padding: 10,
    borderRadius: 10, borderWidth: 1,
  },
  errorText: { color: '#ef4444', fontSize: 12.5, fontWeight: '600' },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, paddingTop: 10, borderTopWidth: 1 },
  input: {
    flex: 1, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1.5, fontSize: 13.5, maxHeight: 120, minHeight: 42, fontWeight: '500',
  },
  send: {
    width: 42, height: 42, borderRadius: 99, alignItems: 'center', justifyContent: 'center',
  },
});
