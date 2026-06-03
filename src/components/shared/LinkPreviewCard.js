import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, Pressable, StyleSheet,
  ActivityIndicator, Animated, Linking,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

function CloseIcon({ color = '#94a3b8' }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 16 16" fill="none">
      <Path d="M3 3l10 10M13 3L3 13" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function GlobeIcon({ color = '#0193ab' }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.7" />
      <Path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"
        stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Extracts the host domain from a full URL, trimming www.
 */
function getDomain(url) {
  try {
    const host = new URL(url).hostname;
    return host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Parses og:title, og:image and og:description from raw HTML using regex.
 * Works for most static websites; SPA-rendered pages may not have OG tags
 * in the initial HTML payload.
 */
function parseOG(html) {
  const get = (patterns) => {
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) return m[1].trim();
    }
    return null;
  };
  return {
    title: get([
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    ]),
    image: get([
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    ]),
    description: get([
      /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i,
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i,
    ]),
  };
}

/**
 * Fetches OG metadata for a given URL.
 * Returns { url, title, image, description } or null on failure.
 */
export async function fetchLinkPreview(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HitchLinkBot/1.0)',
        'Accept': 'text/html',
      },
    });
    clearTimeout(timeout);
    const html = await res.text();
    const { title, image, description } = parseOG(html);
    if (!title && !image) return null;
    return { url, title, image, description };
  } catch {
    return null;
  }
}

/**
 * URL_REGEX — matches http(s) URLs in free text.
 * Returns the first match or null.
 */
export function extractFirstUrl(text) {
  const m = text.match(/https?:\/\/[^\s<>"']+/);
  return m ? m[0] : null;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * LinkPreviewCard — shows a rich OG preview of a URL detected in the input.
 *
 * Props:
 *   preview   – { url, title, image, description } | null
 *   loading   – boolean (show spinner while fetching)
 *   onDismiss – () => void   (user dismisses the card)
 *   colors    – theme colors
 *   isDark    – boolean
 */
export default function LinkPreviewCard({ preview, loading, onDismiss, colors, isDark }) {
  const slideY = useRef(new Animated.Value(32)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const isVisible = loading || !!preview;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, damping: 20, stiffness: 280, mass: 0.75, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 16, duration: 120, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const onOpenUrl = () => {
    if (preview?.url) Linking.openURL(preview.url).catch(() => {});
  };

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          backgroundColor: isDark ? '#1a1f2c' : '#f8faff',
          borderColor: isDark ? 'rgba(1,147,171,0.28)' : 'rgba(1,147,171,0.2)',
          transform: [{ translateY: slideY }],
          opacity,
        },
      ]}
    >
      {/* Accent stripe */}
      <View style={styles.stripe} />

      {loading ? (
        <View style={styles.loadingRow}>
          <GlobeIcon color="#0193ab" />
          <ActivityIndicator size="small" color="#0193ab" />
          <Text style={[styles.loadingText, { color: colors?.textMuted ?? '#94a3b8' }]}>
            Loading preview…
          </Text>
        </View>
      ) : (
        <Pressable style={styles.body} onPress={onOpenUrl}>
          {preview.image ? (
            <Image
              source={{ uri: preview.image }}
              style={styles.thumb}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <GlobeIcon color="#0193ab" />
            </View>
          )}

          <View style={styles.meta}>
            <Text
              style={[styles.domain, { color: '#0193ab' }]}
              numberOfLines={1}
            >
              {getDomain(preview.url)}
            </Text>
            {preview.title ? (
              <Text
                style={[styles.title, { color: colors?.textPrimary ?? '#0f172a' }]}
                numberOfLines={2}
              >
                {preview.title}
              </Text>
            ) : null}
            {preview.description ? (
              <Text
                style={[styles.desc, { color: colors?.textMuted ?? '#94a3b8' }]}
                numberOfLines={1}
              >
                {preview.description}
              </Text>
            ) : null}
          </View>
        </Pressable>
      )}

      <Pressable
        onPress={onDismiss}
        style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.55 }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Dismiss link preview"
      >
        <CloseIcon color={colors?.textMuted ?? '#94a3b8'} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 8,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    shadowColor: '#0193ab',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  stripe: {
    width: 3,
    backgroundColor: '#0193ab',
    alignSelf: 'stretch',
  },
  loadingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  loadingText: { fontSize: 12, fontWeight: '500' },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(1,147,171,0.1)',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, minWidth: 0 },
  domain: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.3, marginBottom: 2 },
  title: { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  desc: { fontSize: 11.5, fontWeight: '400', marginTop: 2 },
  closeBtn: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 6,
  },
});
