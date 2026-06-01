import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing } from '../../theme/colors';

/**
 * Tiny markdown renderer. Supports:
 *   • **bold**
 *   • *italic*
 *   • `code`
 *   • leading "• " or "- " for bullet lists
 *   • blank lines as paragraph breaks
 *
 * Intentionally NOT a full CommonMark parser — that's overkill for chat replies.
 */

function parseInline(text, baseStyle) {
  const out = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push(
        <Text key={key++} style={baseStyle}>
          {text.slice(lastIndex, match.index)}
        </Text>,
      );
    }
    const token = match[0];
    if (token.startsWith('**')) {
      out.push(
        <Text key={key++} style={[baseStyle, { fontWeight: '800' }]}>
          {token.slice(2, -2)}
        </Text>,
      );
    } else if (token.startsWith('*')) {
      out.push(
        <Text key={key++} style={[baseStyle, { fontStyle: 'italic' }]}>
          {token.slice(1, -1)}
        </Text>,
      );
    } else if (token.startsWith('`')) {
      out.push(
        <Text
          key={key++}
          style={[baseStyle, mdStyles.code]}
        >
          {token.slice(1, -1)}
        </Text>,
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    out.push(
      <Text key={key++} style={baseStyle}>
        {text.slice(lastIndex)}
      </Text>,
    );
  }
  return out;
}

export default function Markdown({ text, color, fontSize = typography.sm, lineHeight = 20 }) {
  const { colors } = useTheme();
  const resolved = color || colors.textPrimary;
  const baseStyle = { color: resolved, fontSize, lineHeight, fontWeight: '500' };

  if (!text) return null;

  const blocks = text.split(/\n{2,}/);

  return (
    <View>
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        const isBulletBlock = lines.every(l => /^\s*[•\-]\s+/.test(l));
        if (isBulletBlock) {
          return (
            <View key={bi} style={{ marginBottom: bi < blocks.length - 1 ? 8 : 0 }}>
              {lines.map((l, li) => {
                const content = l.replace(/^\s*[•\-]\s+/, '');
                return (
                  <View key={li} style={mdStyles.bulletRow}>
                    <Text style={[baseStyle, { width: 14 }]}>•</Text>
                    <Text style={[baseStyle, { flex: 1 }]}>
                      {parseInline(content, baseStyle)}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        }
        return (
          <Text
            key={bi}
            style={[baseStyle, { marginBottom: bi < blocks.length - 1 ? 8 : 0 }]}
          >
            {lines.map((l, li) => (
              <Text key={li}>
                {parseInline(l, baseStyle)}
                {li < lines.length - 1 ? '\n' : ''}
              </Text>
            ))}
          </Text>
        );
      })}
    </View>
  );
}

const mdStyles = StyleSheet.create({
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginVertical: 2 },
  code: {
    fontFamily: undefined, // platform mono
    backgroundColor: 'rgba(100,116,139,0.16)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
});
