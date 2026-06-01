import React from 'react';
import { Image as RNImage } from 'react-native';

/**
 * Thin compatibility wrapper over `expo-image`. Falls back to the RN
 * built-in Image if expo-image isn't installed yet (no native rebuild
 * required for development). Gives us disk caching + priority loading
 * "for free" once expo-image is added.
 *
 * Same prop surface as RN Image so it's a drop-in replacement.
 */
let ExpoImage = null;
try {
  // eslint-disable-next-line global-require
  ExpoImage = require('expo-image').Image;
} catch (_e) {
  ExpoImage = null;
}

export default function CachedImage({
  source,
  style,
  contentFit = 'cover',
  resizeMode,
  priority = 'normal',
  transition = 200,
  accessibilityLabel,
  ...rest
}) {
  if (ExpoImage) {
    return (
      <ExpoImage
        source={source}
        style={style}
        contentFit={contentFit}
        priority={priority}
        transition={transition}
        cachePolicy="memory-disk"
        accessibilityLabel={accessibilityLabel}
        {...rest}
      />
    );
  }
  // Fallback — old behaviour
  return (
    <RNImage
      source={source}
      style={style}
      resizeMode={resizeMode || contentFit}
      accessibilityLabel={accessibilityLabel}
      {...rest}
    />
  );
}
