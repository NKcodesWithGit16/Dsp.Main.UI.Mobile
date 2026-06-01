import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

// Strip rendered under a message bubble. Tapping a chip toggles the current
// user's reaction (add / remove / swap with another emoji).
export default function Reactions({ reactions, me, onToggle, isDark }) {
  if (!reactions?.length) return null;

  return (
    <View style={styles.row}>
      {reactions.map((r) => {
        const mine = !!me && r.reactors?.some(x =>
          String(x.id) === String(me.id) && x.role === me.role,
        );
        return (
          <Pressable
            key={r.emoji}
            onPress={() => onToggle?.(r.emoji, mine)}
            style={({ pressed }) => [
              styles.chip,
              isDark && styles.chipDark,
              mine && (isDark ? styles.chipMineDark : styles.chipMine),
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.emoji}>{r.emoji}</Text>
            {r.count > 1 && (
              <Text style={[
                styles.count,
                mine && { color: isDark ? '#67e8f9' : '#0193ab' },
                isDark && !mine && { color: '#e2e8f0' },
              ]}>
                {r.count}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 3,
    maxWidth: 280,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#fff',
  },
  chipDark: {
    backgroundColor: '#1c2540',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipMine: {
    backgroundColor: 'rgba(1,147,171,0.15)',
    borderColor: 'rgba(1,147,171,0.45)',
  },
  chipMineDark: {
    backgroundColor: 'rgba(6,182,212,0.18)',
    borderColor: 'rgba(6,182,212,0.55)',
  },
  emoji: { fontSize: 13, lineHeight: 15 },
  count: {
    fontSize: 10.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: '#0f172a',
  },
});
