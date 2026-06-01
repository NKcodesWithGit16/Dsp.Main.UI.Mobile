import React from 'react';
import Svg, { Path, Circle, Line, Rect, G } from 'react-native-svg';

/**
 * Brand-aligned SVG icon set — mirrors the inline icons used on
 * HitchLink_frontend (see Home.jsx's `I` map). Stroke-based, 1.7–2 px,
 * round caps/joins, currentColor-driven.
 *
 * Usage:
 *   <Icon name="truck" size={20} color="#0193ab" />
 */

const SP = ({ stroke = 1.8 }) => ({
  fill: 'none', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round',
});

function IconSvg({ children, size = 20, color = '#0f172a', viewBox = '0 0 24 24', style }) {
  return (
    <Svg width={size} height={size} viewBox={viewBox} style={style}>
      <G stroke={color} fill="none">{children}</G>
    </Svg>
  );
}

function FilledSvg({ children, size = 20, color = '#0f172a', viewBox = '0 0 24 24', style }) {
  return (
    <Svg width={size} height={size} viewBox={viewBox} style={style}>
      <G fill={color}>{children}</G>
    </Svg>
  );
}

// ────────────────────────────────────────────────────────────
//  Icon definitions
// ────────────────────────────────────────────────────────────
const ICONS = {
  truck: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.8 })} d="M2 16V6a1 1 0 0 1 1-1h11v11" />
      <Path {...SP({ stroke: 1.8 })} d="M14 9h5l3 4v3h-2" />
      <Circle cx="7"  cy="18" r="2" {...SP({ stroke: 1.8 })} />
      <Circle cx="17" cy="18" r="2" {...SP({ stroke: 1.8 })} />
      <Path {...SP({ stroke: 1.8 })} d="M9 18h6" />
    </IconSvg>
  ),
  box: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.8 })} d="M21 8 12 3 3 8v8l9 5 9-5z" />
      <Path {...SP({ stroke: 1.8 })} d="M3 8l9 5 9-5" />
      <Path {...SP({ stroke: 1.8 })} d="M12 13v8" />
    </IconSvg>
  ),
  check: (p) => (
    <IconSvg {...p}>
      <Circle cx="12" cy="12" r="9" {...SP({ stroke: 1.9 })} />
      <Path {...SP({ stroke: 1.9 })} d="m8.5 12 2.5 2.5L16 9.5" />
    </IconSvg>
  ),
  checkmark: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 2.2 })} d="m5 12 4.5 4.5L19 7" />
    </IconSvg>
  ),
  dollar: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.9 })} d="M12 2v20" />
      <Path {...SP({ stroke: 1.9 })} d="M17 6.5a4 4 0 0 0-3.5-2H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H9.5A4 4 0 0 1 6 14" />
    </IconSvg>
  ),
  flame: (p) => (
    <FilledSvg {...p}>
      <Path d="M12 2s4 4.5 4 8.5a4 4 0 0 1-4.6 4 4 4 0 0 0 1.6-3.5c0-1.6-1-2.5-1-2.5s-3 2-3 5.5A4 4 0 0 0 12 18a6 6 0 0 0 6-6c0-5-6-10-6-10z" />
    </FilledSvg>
  ),
  alertTriangle: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.9 })} d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <Path {...SP({ stroke: 1.9 })} d="M12 9v4" />
      <Circle cx="12" cy="17" r="0.8" fill={p.color} stroke="none" />
    </IconSvg>
  ),
  powerOff: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.9 })} d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <Path {...SP({ stroke: 1.9 })} d="M12 2v10" />
    </IconSvg>
  ),
  arrow: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 2 })} d="M5 12h14M13 5l7 7-7 7" />
    </IconSvg>
  ),
  arrowLeft: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 2 })} d="M19 12H5M11 19l-7-7 7-7" />
    </IconSvg>
  ),
  chevron: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 2 })} d="m9 6 6 6-6 6" />
    </IconSvg>
  ),
  chevronDown: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 2 })} d="m6 9 6 6 6-6" />
    </IconSvg>
  ),
  map: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" />
      <Path {...SP({ stroke: 1.7 })} d="M9 4v14M15 6v14" />
    </IconSvg>
  ),
  list: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M3 6h18M3 12h18M3 18h18" />
    </IconSvg>
  ),
  folder: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </IconSvg>
  ),
  folderOpen: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3z" />
      <Path {...SP({ stroke: 1.7 })} d="M3 9h18l-2.5 9.5a2 2 0 0 1-2 1.5H5a2 2 0 0 1-2-1.5z" />
    </IconSvg>
  ),
  chart: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M3 3v18h18" />
      <Path {...SP({ stroke: 1.7 })} d="M7 14l4-4 3 3 6-7" />
    </IconSvg>
  ),
  trendUp: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 2.2 })} d="m4 17 6-6 4 4 6-7" />
      <Path {...SP({ stroke: 2.2 })} d="M14 7h6v6" />
    </IconSvg>
  ),
  trendDown: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 2.2 })} d="m4 7 6 6 4-4 6 7" />
      <Path {...SP({ stroke: 2.2 })} d="M14 17h6v-6" />
    </IconSvg>
  ),
  sparkles: (p) => (
    <FilledSvg {...p}>
      <Path d="M12 3 13.6 8.4 19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" />
      <Path opacity="0.7" d="M19 14l.8 2.7L22 17.5l-2.2.8L19 21l-.8-2.7L16 17.5l2.2-.8z" />
    </FilledSvg>
  ),
  pkg: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="m21 16-9 5-9-5V8l9-5 9 5z" />
      <Path {...SP({ stroke: 1.7 })} d="M3 8l9 5 9-5" />
    </IconSvg>
  ),
  car: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M5 17h14M3 17l1.5-5h15L21 17" />
      <Circle cx="7"  cy="18" r="1.5" {...SP({ stroke: 1.7 })} />
      <Circle cx="17" cy="18" r="1.5" {...SP({ stroke: 1.7 })} />
    </IconSvg>
  ),
  fileText: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path {...SP({ stroke: 1.7 })} d="M14 2v6h6M8 13h8M8 17h6" />
    </IconSvg>
  ),
  refresh: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.8 })} d="M21 12a9 9 0 1 1-3-6.7" />
      <Path {...SP({ stroke: 1.8 })} d="M21 4v5h-5" />
    </IconSvg>
  ),
  bolt: (p) => (
    <FilledSvg {...p}>
      <Path d="M13 2 3 14h7l-1 8 10-12h-7z" />
    </FilledSvg>
  ),
  search: (p) => (
    <IconSvg {...p}>
      <Circle cx="11" cy="11" r="7" {...SP({ stroke: 1.8 })} />
      <Path {...SP({ stroke: 1.8 })} d="m20 20-3.5-3.5" />
    </IconSvg>
  ),
  filter: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M3 5h18M6 12h12M10 19h4" />
    </IconSvg>
  ),
  options: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.8 })} d="M4 6h11M19 6h1M4 12h1M9 12h11M4 18h11M19 18h1" />
      <Circle cx="17" cy="6"  r="2" {...SP({ stroke: 1.8 })} />
      <Circle cx="7"  cy="12" r="2" {...SP({ stroke: 1.8 })} />
      <Circle cx="17" cy="18" r="2" {...SP({ stroke: 1.8 })} />
    </IconSvg>
  ),
  star: (p) => (
    <FilledSvg {...p}>
      <Path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1z" />
    </FilledSvg>
  ),
  starOutline: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.6 })} d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1z" />
    </IconSvg>
  ),
  close: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 2 })} d="M6 6l12 12M18 6L6 18" />
    </IconSvg>
  ),
  plus: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 2 })} d="M12 5v14M5 12h14" />
    </IconSvg>
  ),
  mail: (p) => (
    <IconSvg {...p}>
      <Rect x="3" y="5" width="18" height="14" rx="2" {...SP({ stroke: 1.7 })} />
      <Path {...SP({ stroke: 1.7 })} d="m3 7 9 6 9-6" />
    </IconSvg>
  ),
  phone: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.8a2 2 0 0 1-.45 2.11L8 9.91a16 16 0 0 0 6 6l1.27-1.38a2 2 0 0 1 2.11-.45c.9.35 1.84.6 2.8.72A2 2 0 0 1 22 16.92z" />
    </IconSvg>
  ),
  lock: (p) => (
    <IconSvg {...p}>
      <Rect x="4" y="10" width="16" height="11" rx="2" {...SP({ stroke: 1.7 })} />
      <Path {...SP({ stroke: 1.7 })} d="M8 10V7a4 4 0 0 1 8 0v3" />
    </IconSvg>
  ),
  user: (p) => (
    <IconSvg {...p}>
      <Circle cx="12" cy="8" r="4" {...SP({ stroke: 1.7 })} />
      <Path {...SP({ stroke: 1.7 })} d="M4 21a8 8 0 0 1 16 0" />
    </IconSvg>
  ),
  users: (p) => (
    <IconSvg {...p}>
      <Circle cx="9" cy="8" r="3.5" {...SP({ stroke: 1.7 })} />
      <Path {...SP({ stroke: 1.7 })} d="M2 20a7 7 0 0 1 14 0" />
      <Path {...SP({ stroke: 1.7 })} d="M17 11a3 3 0 0 0 0-6" />
      <Path {...SP({ stroke: 1.7 })} d="M22 20a6 6 0 0 0-6-6" />
    </IconSvg>
  ),
  eye: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
      <Circle cx="12" cy="12" r="3" {...SP({ stroke: 1.7 })} />
    </IconSvg>
  ),
  eyeOff: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.86 20.86 0 0 1 5.06-5.94" />
      <Path {...SP({ stroke: 1.7 })} d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a20.94 20.94 0 0 1-3.17 4.19" />
      <Path {...SP({ stroke: 1.7 })} d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <Line x1="2" y1="2" x2="22" y2="22" {...SP({ stroke: 1.7 })} />
    </IconSvg>
  ),
  settings: (p) => (
    <IconSvg {...p}>
      <Circle cx="12" cy="12" r="3" {...SP({ stroke: 1.7 })} />
      <Path {...SP({ stroke: 1.7 })} d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </IconSvg>
  ),
  sun: (p) => (
    <IconSvg {...p}>
      <Circle cx="12" cy="12" r="4" {...SP({ stroke: 1.8 })} />
      <Path {...SP({ stroke: 1.8 })} d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </IconSvg>
  ),
  moon: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.8 })} d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </IconSvg>
  ),
  globe: (p) => (
    <IconSvg {...p}>
      <Circle cx="12" cy="12" r="9" {...SP({ stroke: 1.7 })} />
      <Path {...SP({ stroke: 1.7 })} d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </IconSvg>
  ),
  logout: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path {...SP({ stroke: 1.7 })} d="m16 17 5-5-5-5M21 12H9" />
    </IconSvg>
  ),
  chat: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
    </IconSvg>
  ),
  send: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
    </IconSvg>
  ),
  pin: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx="12" cy="10" r="3" {...SP({ stroke: 1.7 })} />
    </IconSvg>
  ),
  clock: (p) => (
    <IconSvg {...p}>
      <Circle cx="12" cy="12" r="9" {...SP({ stroke: 1.7 })} />
      <Path {...SP({ stroke: 1.7 })} d="M12 7v5l3 2" />
    </IconSvg>
  ),
  bell: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path {...SP({ stroke: 1.7 })} d="M13.7 21a2 2 0 0 1-3.4 0" />
    </IconSvg>
  ),
  briefcase: (p) => (
    <IconSvg {...p}>
      <Rect x="2" y="7" width="20" height="14" rx="2" {...SP({ stroke: 1.7 })} />
      <Path {...SP({ stroke: 1.7 })} d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </IconSvg>
  ),
  navigation: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="m3 11 19-9-9 19-2-8z" />
    </IconSvg>
  ),
  camera: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="4" {...SP({ stroke: 1.7 })} />
    </IconSvg>
  ),
  upload: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path {...SP({ stroke: 1.7 })} d="m17 8-5-5-5 5M12 3v12" />
    </IconSvg>
  ),
  download: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path {...SP({ stroke: 1.7 })} d="m7 10 5 5 5-5M12 15V3" />
    </IconSvg>
  ),
  pencil: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
    </IconSvg>
  ),
  info: (p) => (
    <IconSvg {...p}>
      <Circle cx="12" cy="12" r="9" {...SP({ stroke: 1.7 })} />
      <Path {...SP({ stroke: 1.7 })} d="M12 16v-4M12 8h.01" />
    </IconSvg>
  ),
  heart: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </IconSvg>
  ),
  shield: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </IconSvg>
  ),
  zap: (p) => (
    <FilledSvg {...p}>
      <Path d="M13 2 3 14h7l-1 8 10-12h-7z" />
    </FilledSvg>
  ),
  ai: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M12 2v3M12 19v3M4 12H1M23 12h-3M5.6 5.6 7.7 7.7M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <Circle cx="12" cy="12" r="4" {...SP({ stroke: 1.7 })} />
    </IconSvg>
  ),
  home: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} d="M3 12 12 3l9 9" />
      <Path {...SP({ stroke: 1.7 })} d="M5 10v11h14V10" />
    </IconSvg>
  ),
  homeFilled: (p) => (
    <IconSvg {...p}>
      <Path {...SP({ stroke: 1.7 })} fill={p.color} d="M3 12 12 3l9 9z" />
      <Path {...SP({ stroke: 1.7 })} fill={p.color} d="M5 10h14v11H5z" />
    </IconSvg>
  ),
};

export default function Icon({ name, size = 20, color = '#0f172a', style }) {
  const Component = ICONS[name];
  if (!Component) {
    if (__DEV__) console.warn(`[Icon] unknown name: ${name}`);
    return null;
  }
  return Component({ size, color, style });
}

export const ICON_NAMES = Object.keys(ICONS);
