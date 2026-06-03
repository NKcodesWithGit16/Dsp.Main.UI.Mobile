import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

function ThumbIcon({ color = '#0193ab' }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L9 9H3l5 4.5-2 7L12 17l6 3.5-2-7L21 9h-6z"
        stroke={color} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <Path d="M12 17v5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * PinnedMessageBar — fixed accent stripe shown just below the header
 * when a message has been pinned.
 *
 * Props:
 *   message   – the pinned message object { text, type, fromDriver }
 *   onDismiss – called when the user taps the X to unpin
 *   onPress   – optional, called when the bar body is tapped (e.g. scroll to msg)
 *   colors    – theme colors
 *   isDark    – boolean
 */
export default function PinnedMessageBar({ message, onDismiss, onPress, colors, isDark }) {
  const slideY = useRef(new Animated.Value(-52)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (message) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, damping: 20, stiffness: 280, mass: 0.8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: -52, duration: 160, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start();
    }
  }, [!!message]);

  if (!message) return null;

  const preview = message.type === 'voice'
    ? '🎙 Voice message'
    : (message.text || '').replace(/^!!\s/, '') || 'Attachment';

  const authorLabel = message.fromDriver ? 'You' : 'Dispatcher';

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          backgroundColor: isDark ? '#131b2e' : '#f0faff',
          borderBottomColor: isDark ? 'rgba(1,147,171,0.3)' : 'rgba(1,147,171,0.2)',
          transform: [{ translateY: slideY }],
          opacity,
        },
      ]}
    >
      {/* Accent left bar */}
      <View style={styles.accentBar} />

      <Pressable
        onPress={onPress}
        style={styles.body}
        android_ripple={{ color: 'rgba(1,147,171,0.1)' }}
      >
        <View style={styles.iconWrap}>
          <ThumbIcon color="#0193ab" />
        </View>
        <View style={styles.textStack}>
          <Text style={styles.label}>PINNED · {authorLabel}</Text>
          <Text
            style={[styles.preview, { color: colors?.textPrimary ?? '#0f172a' }]}
            numberOfLines={1}
          >
            {preview}
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={onDismiss}
        style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.55 }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Unpin message"
      >
        <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
          <Path
            d="M3 3l10 10M13 3L3 13"
            stroke={colors?.textMuted ?? '#94a3b8'}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </Svg>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    overflow: 'hidden',
    minHeight: 44,
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: '#0193ab',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(1,147,171,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textStack: { flex: 1, minWidth: 0 },
  label: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0193ab',
    letterSpacing: 0.6,
    marginBottom: 1,
  },
  preview: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
});
