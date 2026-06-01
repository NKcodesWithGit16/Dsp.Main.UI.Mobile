import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const MARK         = require('../../../assets/logo-mark.png');
const WORDMARK_LT  = require('../../../assets/wordmark-black.png'); // dark text on light bg
const WORDMARK_DK  = require('../../../assets/wordmark-white.png'); // white text on dark bg

// HitchLink wordmark is roughly 3.5:1 (H-mark + "HitchLink"); the icon-only
// mark is 1:1. Using these fixed ratios keeps the image from stretching
// regardless of the `size` prop.
const WORDMARK_RATIO = 3.5;
const MARK_RATIO     = 1;

/**
 * Brand wordmark — renders the official DispatchR logo PNGs.
 *
 *   size   – overall glyph height (px)
 *   layout – 'horizontal' (mark + word — DEFAULT), 'stacked', 'icon' (mark only)
 *   tone   – 'auto' (theme), 'light' (white text for dark bg), 'dark' (dark text for light bg)
 */
export default function BrandLogo({
  size = 28,
  layout = 'horizontal',
  tone = 'auto',
  style,
}) {
  const { isDark } = useTheme();

  // 'auto' picks the wordmark that contrasts against the surface the logo
  // sits on. Override with `tone="light"` when the logo is on a dark hero
  // photo and the theme is light.
  const useWhite = tone === 'light' || (tone === 'auto' && isDark);
  const wordSrc = useWhite ? WORDMARK_DK : WORDMARK_LT;

  if (layout === 'icon') {
    return (
      <View style={[styles.wrap, style]}>
        <Image
          source={MARK}
          style={{ width: size, height: size }}
          resizeMode="contain"
          accessibilityLabel="HitchLink logo"
        />
      </View>
    );
  }

  // Full wordmark image (mark + text baked in) — picks correct light/dark variant
  const wordWidth  = Math.round(size * WORDMARK_RATIO);
  const wordHeight = size;

  if (layout === 'stacked') {
    return (
      <View style={[styles.stacked, style]}>
        <Image
          source={MARK}
          style={{ width: size * 1.2, height: size * 1.2 }}
          resizeMode="contain"
          accessibilityLabel="HitchLink logo"
        />
        <Image
          source={wordSrc}
          style={{ width: wordWidth, height: Math.round(wordHeight * 0.85) }}
          resizeMode="contain"
        />
      </View>
    );
  }

  // horizontal — single wordmark image since the file already contains the mark + text together
  return (
    <View style={[styles.wrap, style]}>
      <Image
        source={wordSrc}
        style={{ width: wordWidth, height: wordHeight }}
        resizeMode="contain"
        accessibilityLabel="HitchLink logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center' },
  stacked: { alignItems: 'center', gap: 6 },
});
