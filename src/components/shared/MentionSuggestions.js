import React, { useRef, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, Animated,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

function AtIcon({ color = '#0193ab' }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth="1.8" />
      <Path
        d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.4 7"
        stroke={color} strokeWidth="1.8" strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * MentionSuggestions — animated list shown above the input bar
 * when the user types "@" in the message field.
 *
 * Props:
 *   suggestions  – [{ id, name, role? }]   filtered list to show
 *   visible      – boolean
 *   onSelect     – (name: string) => void   called when a row is tapped
 *   colors       – theme colors
 *   isDark       – boolean
 */
export default function MentionSuggestions({ suggestions, visible, onSelect, colors, isDark }) {
  const slideY = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && suggestions.length > 0) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, damping: 22, stiffness: 300, mass: 0.7, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 20, duration: 120, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, suggestions.length]);

  if (!visible || suggestions.length === 0) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          backgroundColor: isDark ? '#1a1f2c' : '#ffffff',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          transform: [{ translateY: slideY }],
          opacity,
          // limit height for long lists
          maxHeight: Math.min(suggestions.length * 52, 210),
        },
      ]}
    >
      {suggestions.map((item, idx) => {
        const initials = item.name
          .split(' ')
          .slice(0, 2)
          .map(w => w[0]?.toUpperCase() ?? '')
          .join('');
        const isLast = idx === suggestions.length - 1;

        return (
          <Pressable
            key={item.id}
            onPress={() => onSelect(item.name)}
            style={({ pressed }) => [
              styles.row,
              !isLast && {
                borderBottomWidth: 1,
                borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              },
              pressed && { backgroundColor: isDark ? 'rgba(1,147,171,0.1)' : 'rgba(1,147,171,0.06)' },
            ]}
          >
            {/* Avatar chip */}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            <View style={styles.textStack}>
              <View style={styles.nameRow}>
                <AtIcon color="#0193ab" />
                <Text style={[styles.name, { color: colors?.textPrimary ?? '#0f172a' }]}>
                  {item.name}
                </Text>
              </View>
              {item.role ? (
                <Text style={[styles.role, { color: colors?.textMuted ?? '#94a3b8' }]}>
                  {item.role}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#0193ab',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(1,147,171,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0193ab',
    letterSpacing: 0.3,
  },
  textStack: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  role: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
});
