import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Pressable, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../context/ThemeContext';
import { gradients, glass, shadow, radius, spacing, typography } from '../../theme/colors';
import Icon from './Icon';

const DEFAULT_ACTIONS = [
  { key: 'load',   label: 'Post load',     icon: 'box',      gradient: ['#0193ab', '#04285a'],   route: '/(app)/loadboard' },
  { key: 'driver', label: 'Add driver',    icon: 'truck',    gradient: ['#06b6d4', '#0193ab'],   route: '/(app)/drivers' },
  { key: 'doc',    label: 'Upload doc',    icon: 'upload',   gradient: ['#10b981', '#06b6d4'],   route: '/(app)/documents' },
  { key: 'ai',     label: 'Ask AI',        icon: 'sparkles', gradient: ['#f59e0b', '#dc2626'],   route: '/(app)/aichat' },
];

/**
 * Floating "+" action button. Pulses brand teal, opens a sheet of quick
 * actions (Post Load / Add Driver / Upload Doc / Ask AI). Available on every
 * tab; configure `actions` to swap the targets.
 */
export default function FAB({ actions = DEFAULT_ACTIONS, bottom = 86 }) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const rotate = useRef(new Animated.Value(0)).current;
  const pulse  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    Animated.spring(rotate, {
      toValue: open ? 1 : 0,
      damping: 18, stiffness: 240,
      useNativeDriver: true,
    }).start();
  }, [open]);

  const rotateDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '135deg'] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  const onAction = (action) => {
    Haptics.selectionAsync().catch(() => {});
    setOpen(false);
    if (action.onPress) action.onPress();
    else if (action.route) setTimeout(() => router.push(action.route), 80);
  };

  return (
    <>
      <View pointerEvents="box-none" style={[fabStyles.fabWrap, { bottom }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            fabStyles.pulse,
            { transform: [{ scale: pulseScale }], opacity: pulseOpacity, backgroundColor: '#0193ab' },
          ]}
        />
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setOpen(o => !o);
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[fabStyles.fab, shadow.glow]}
          >
            <Animated.View style={{ transform: [{ rotate: rotateDeg }] }}>
              <Icon name="plus" size={24} color="#fff" />
            </Animated.View>
          </LinearGradient>
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={fabStyles.backdrop} onPress={() => setOpen(false)}>
          <View pointerEvents="box-none" style={[fabStyles.sheetWrap, { paddingBottom: bottom + 72 }]}>
            <BlurView
              intensity={isDark ? 80 : 60}
              tint={isDark ? 'dark' : 'light'}
              style={fabStyles.sheetBlur}
            >
              <View style={[
                fabStyles.sheet,
                {
                  backgroundColor: isDark ? 'rgba(17,22,34,0.72)' : 'rgba(255,255,255,0.86)',
                  borderColor: isDark ? glass.borderDark : glass.borderLightSoft,
                },
              ]}>
                <Text style={[fabStyles.sheetTitle, { color: colors.textPrimary }]}>Quick actions</Text>
                {actions.map((a, i) => (
                  <Pressable
                    key={a.key}
                    onPress={() => onAction(a)}
                    style={({ pressed }) => [
                      fabStyles.action,
                      { borderBottomColor: colors.borderSubtle, borderBottomWidth: i === actions.length - 1 ? 0 : StyleSheet.hairlineWidth },
                      pressed && { backgroundColor: colors.surface2 },
                    ]}
                  >
                    <LinearGradient
                      colors={a.gradient}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={fabStyles.actionIcon}
                    >
                      <Icon name={a.icon} size={18} color="#fff" />
                    </LinearGradient>
                    <Text style={[fabStyles.actionLabel, { color: colors.textPrimary }]}>{a.label}</Text>
                    <Icon name="chevron" size={14} color={colors.textDisabled} />
                  </Pressable>
                ))}
              </View>
            </BlurView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const fabStyles = StyleSheet.create({
  fabWrap: {
    position: 'absolute',
    right: spacing[5],
    width: 60, height: 60,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 50,
  },
  pulse: {
    position: 'absolute',
    width: 60, height: 60, borderRadius: 30,
  },
  fab: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    paddingHorizontal: spacing[5],
  },
  sheetBlur: {
    borderRadius: radius['2xl'],
    overflow: 'hidden',
  },
  sheet: {
    borderRadius: radius['2xl'],
    borderWidth: 1,
    padding: spacing[2],
  },
  sheetTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    opacity: 0.7,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radius.lg,
  },
  actionIcon: {
    width: 38, height: 38, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: typography.sm,
    fontWeight: '700',
  },
});
