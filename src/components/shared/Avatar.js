import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, shadow, radius } from '../../theme/colors';
import CachedImage from './CachedImage';

/**
 * Gradient or photo avatar — used for driver rows, header user, etc.
 *
 *   name          – falls back to initials when no `source`
 *   source        – { uri: '…' } or local require()
 *   size          – default 36
 *   gradient      – override default brand gradient
 *   statusColor   – optional bottom-right status pip
 *   pipBorder     – color of the pip's border (typically the row bg)
 *   shadowed      – add brand-glow drop shadow
 */
export default function Avatar({
  name,
  source,
  size = 36,
  gradient = gradients.brand,
  statusColor,
  pipBorder = '#fff',
  shadowed = false,
  style,
}) {
  const initials = name
    ? name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';
  const fontSize = Math.max(10, Math.round(size * 0.38));
  const pipSize  = Math.max(8, Math.round(size * 0.28));

  return (
    <View style={[{ width: size, height: size }, style]}>
      {source ? (
        <View style={[styles.imgWrap, shadowed && shadow.glow, { width: size, height: size, borderRadius: size / 2 }]}>
          <CachedImage
            source={source}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            accessibilityLabel={name ? `${name} avatar` : 'User avatar'}
          />
        </View>
      ) : (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[
            styles.grad,
            shadowed && shadow.glow,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
        </LinearGradient>
      )}
      {statusColor ? (
        <View
          style={[
            styles.pip,
            {
              width: pipSize, height: pipSize, borderRadius: pipSize / 2,
              backgroundColor: statusColor,
              borderColor: pipBorder,
              borderWidth: 1.5,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grad:    { alignItems: 'center', justifyContent: 'center' },
  imgWrap: { overflow: 'hidden' },
  initials:{ color: '#fff', fontWeight: '800', letterSpacing: 0.3 },
  pip:     { position: 'absolute', bottom: 0, right: 0 },
});
