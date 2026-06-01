import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

/**
 * Tiny inline trend graph — exactly matches the .home-kpi-spark on the
 * web dashboard (filled area + 1.7 px stroke).
 */
export default function Sparkline({
  points = [],
  width = 64,
  height = 26,
  color = '#0193ab',
  fillOpacity = 0.18,
}) {
  if (!points || points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * step;
    const y = height - ((p - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const path = `M ${coords.join(' L ')}`;
  const area = `${path} L ${width},${height} L 0,${height} Z`;
  const gradId = `sparkGrad-${Math.round(width)}-${Math.round(height)}-${color.replace('#','')}`;

  return (
    <Svg width={width} height={height} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"  stopColor={color} stopOpacity={fillOpacity} />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={area} fill={`url(#${gradId})`} />
      <Path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
