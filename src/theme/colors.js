/* ============================================================
   HitchLink mobile — design tokens
   Mirrors HitchLink_frontend/src/theme.css exactly so the
   mobile app and the web app share one design language.
   Brand: navy #04285a + teal #0193ab.
   ============================================================ */

export const lightColors = {
  // ── Surfaces (page → surface → surface-2 → surface-3 → elevated) ──
  pageBg:        '#eef0f7',
  surface1:      '#f7f8fc',
  surface2:      '#eceef5',
  surface3:      '#e2e5ee',
  elevated:      '#ffffff',
  inputBg:       '#fafbfc',

  // ── Borders ──
  border:        'rgba(15, 23, 42, 0.14)',
  borderSoft:    'rgba(15, 23, 42, 0.08)',
  borderStrong:  'rgba(15, 23, 42, 0.22)',
  borderSubtle:  'rgba(15, 23, 42, 0.08)',

  // ── Text ──
  textPrimary:   '#0f172a',
  textSecondary: '#3d4663',
  textMuted:     '#5a6478',
  textSubtle:    '#475569',
  textDisabled:  '#9aa3b8',
  textInverse:   '#ffffff',

  // ── Brand accents ──
  accent:        '#0193ab',
  accentHover:   '#017a90',
  accentDark:    '#04285a',
  accentText:    '#0b7185',
  accentLight:   'rgba(1, 147, 171, 0.10)',
  accentMuted:   'rgba(1, 147, 171, 0.12)',
  accentRing:    'rgba(1, 147, 171, 0.45)',

  // ── Brand primitives (mirrors --brand-*) ──
  brandNavy:      '#04285a',
  brandNavy700:   '#114a93',
  brandTeal:      '#0193ab',
  brandTeal300:   '#5dd0e3',

  // ── Semantic ──
  success:       '#10b981',
  successBg:     'rgba(16, 185, 129, 0.12)',
  successText:   '#059669',

  warning:       '#f59e0b',
  warningBg:     'rgba(245, 158, 11, 0.14)',
  warningText:   '#b45309',

  danger:        '#ef4444',
  dangerBg:      'rgba(239, 68, 68, 0.12)',
  dangerText:    '#dc2626',

  info:          '#06b6d4',
  infoBg:        'rgba(6, 182, 212, 0.12)',
  infoText:      '#0e7490',

  // ── Overlays / misc ──
  overlay:       'rgba(15, 23, 42, 0.42)',
  cardShadow:    'rgba(1, 147, 171, 0.10)',
  glassBg:       'rgba(255, 255, 255, 0.62)',
};

export const darkColors = {
  pageBg:        '#08090e',
  surface1:      '#11141c',
  surface2:      '#1a1f2c',
  surface3:      '#232838',
  elevated:      '#1c2132',
  inputBg:       '#1a1f2c',

  border:        'rgba(255, 255, 255, 0.13)',
  borderSoft:    'rgba(255, 255, 255, 0.07)',
  borderStrong:  'rgba(255, 255, 255, 0.22)',
  borderSubtle:  'rgba(255, 255, 255, 0.07)',

  textPrimary:   '#f1f5f9',
  textSecondary: '#cbd5e1',
  textMuted:     '#94a3b8',
  textSubtle:    '#cbd5e1',
  textDisabled:  '#4a5268',
  textInverse:   '#0f172a',

  accent:        '#1fb6ce',
  accentHover:   '#4fcfe4',
  accentDark:    '#0a3a78',
  accentText:    '#5fd3e6',
  accentLight:   'rgba(31, 182, 206, 0.18)',
  accentMuted:   'rgba(31, 182, 206, 0.16)',
  accentRing:    'rgba(31, 182, 206, 0.55)',

  brandNavy:      '#0a3a78',
  brandNavy700:   '#1e63b0',
  brandTeal:      '#1fb6ce',
  brandTeal300:   '#7fdcec',

  success:       '#10b981',
  successBg:     'rgba(16, 185, 129, 0.18)',
  successText:   '#34d399',

  warning:       '#fbbf24',
  warningBg:     'rgba(245, 158, 11, 0.18)',
  warningText:   '#fbbf24',

  danger:        '#f87171',
  dangerBg:      'rgba(239, 68, 68, 0.18)',
  dangerText:    '#f87171',

  info:          '#22d3ee',
  infoBg:        'rgba(6, 182, 212, 0.16)',
  infoText:      '#22d3ee',

  overlay:       'rgba(0, 0, 0, 0.62)',
  cardShadow:    'rgba(0, 0, 0, 0.42)',
  glassBg:       'rgba(17, 22, 34, 0.72)',
};

// ────────────────────────────────────────────────────────────
//  Typography scale — Inter (system fallback chain)
// ────────────────────────────────────────────────────────────
export const typography = {
  xs:    11,
  sm:    13,
  base:  15,
  md:    17,
  lg:    20,
  xl:    24,
  '2xl': 28,
  '3xl': 34,
  '4xl': 42,
};

export const fontFamily = {
  // Inter is bundled by Expo on iOS/Android via system stack;
  // we fall back to the platform default if unavailable.
  sans: undefined, // let RN pick platform default (San Francisco / Roboto)
  mono: undefined,
};

// 4-pt grid
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
};

export const radius = {
  xs:    4,
  sm:    6,
  md:    10,
  lg:    14,
  xl:    18,
  '2xl': 22,
  '3xl': 28,
  pill:  999,
};

// ────────────────────────────────────────────────────────────
//  Gradients — brand-aligned navy + teal palette
// ────────────────────────────────────────────────────────────
export const gradients = {
  // Page background washes
  pageHeroLight: ['#c8d0f4', '#d4daf7', '#dce3fb', '#e0e8ff'],
  pageHeroDark:  ['#08090e', '#0c1020', '#08090e'],

  // Brand
  brand:         ['#04285a', '#0193ab'],          // navy → teal (matches --accent-grad)
  brandVivid:    ['#0193ab', '#114a93'],          // matches --accent-grad-vivid
  brandSoft:     ['#5dd0e3', '#0193ab', '#04285a'],
  brandSheen:    ['#0193ab', '#06b6d4', '#5dd0e3'],

  // Hero/auth
  heroPrimary:   ['#04285a', '#0a3d7d', '#0193ab'],
  heroAi:        ['#04285a', '#0193ab'],
  heroDispatch:  ['#0193ab', '#06b6d4'],

  // Status / accents
  cyan:          ['#06b6d4', '#0891b2'],
  amber:         ['#f59e0b', '#d97706'],
  success:       ['#10b981', '#059669'],
  danger:        ['#ef4444', '#dc2626'],
  hot:           ['#ef4444', '#f59e0b'],

  // Glass washes
  glassWashLight: ['rgba(255,255,255,0.82)', 'rgba(255,255,255,0.55)'],
  glassWashDark:  ['rgba(17,22,34,0.78)', 'rgba(8,12,22,0.55)'],

  // Mesh-style decorations
  meshTopLight:  ['rgba(1,147,171,0.24)', 'transparent'],
  meshBottomNavy:['rgba(4,40,90,0.28)', 'transparent'],
};

// ────────────────────────────────────────────────────────────
//  Glass tokens (used as fill over a BlurView)
// ────────────────────────────────────────────────────────────
export const glass = {
  fillLight:        'rgba(255, 255, 255, 0.62)',
  fillLightStrong:  'rgba(255, 255, 255, 0.78)',
  fillLightFloat:   'rgba(255, 255, 255, 0.88)',
  borderLight:      'rgba(255, 255, 255, 0.85)',
  borderLightSoft:  'rgba(1, 147, 171, 0.18)',

  fillDark:         'rgba(17, 22, 34, 0.66)',
  fillDarkStrong:   'rgba(17, 22, 34, 0.78)',
  fillDarkFloat:    'rgba(13, 17, 26, 0.86)',
  borderDark:       'rgba(255, 255, 255, 0.09)',
  borderDarkSoft:   'rgba(31, 182, 206, 0.25)',

  // BlurView intensity (iOS, Android)
  blurIosLight: 60,
  blurAndLight: 90,
  blurIosDark:  72,
  blurAndDark:  100,
};

// ────────────────────────────────────────────────────────────
//  Shadows — tinted teal for brand cohesion
// ────────────────────────────────────────────────────────────
export const shadow = {
  card: {
    shadowColor: '#0193ab',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 4,
  },
  cardStrong: {
    shadowColor: '#0193ab',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 8,
  },
  floating: {
    shadowColor: '#04285a',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 12,
  },
  glow: {
    shadowColor: '#0193ab',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.42,
    shadowRadius: 16,
    elevation: 8,
  },
  glowNavy: {
    shadowColor: '#04285a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.42,
    shadowRadius: 20,
    elevation: 10,
  },
};

// ────────────────────────────────────────────────────────────
//  Photo library — Unsplash, brand-aligned (navy/teal/logistics)
//  We use ?w=&q=&fm=&auto= so loads stay fast on phones.
//  Photo IDs are locked, so the visuals don't drift over time.
// ────────────────────────────────────────────────────────────
const u = (id, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&fm=jpg&auto=format&fit=crop`;

export const photos = {
  // Hero — semi truck on highway at dusk (cool blue tones)
  heroDispatcher: u('1601584115197-04ecc0da31d7'),    // truck on open highway
  heroDriver:     u('1586528116311-ad8dd3c8310d'),    // truck interior road perspective
  heroBroker:     u('1521791136064-7986c2920216'),    // warehouse / office
  heroAuth:       u('1494412651409-8963ce7935a7'),    // truck + sunset, cool palette
  heroLanding:    u('1601584115197-04ecc0da31d7'),

  // Quick-action accent images
  drivers:        u('1601584115197-04ecc0da31d7', 800),
  loads:          u('1586528116311-ad8dd3c8310d', 800),
  documents:      u('1554224155-6726b3ff858f', 800),    // paperwork
  ai:             u('1593642634402-b0eb5e2eebc9', 800), // tech / glow

  // Empty state illustrations (still photographic, but neutral)
  emptyLoads:     u('1494412651409-8963ce7935a7', 800),
  emptyDrivers:   u('1605164599901-db7f68c4b714', 800), // parked fleet
  emptyDocs:      u('1554224155-6726b3ff858f', 800),
};
