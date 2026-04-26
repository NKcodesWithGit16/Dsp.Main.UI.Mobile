export const lightColors = {
  pageBg: '#eef0f7',
  surface1: '#f7f8fc',
  surface2: '#e2e5ee',
  elevated: '#ffffff',
  border: '#d0d5e8',
  borderSubtle: '#e8eaf2',
  textPrimary: '#0f172a',
  textSecondary: '#3d4663',
  textMuted: '#5a6478',
  textDisabled: '#9aa3b8',
  accent: '#6366f1',
  accentDark: '#4f46e5',
  accentLight: '#e0e1ff',
  accentMuted: '#eef2ff',
  success: '#10b981',
  successBg: '#d1fae5',
  warning: '#f59e0b',
  warningBg: '#fef3c7',
  danger: '#ef4444',
  dangerBg: '#fee2e2',
  info: '#06b6d4',
  infoBg: '#cffafe',
  purple: '#8b5cf6',
  purpleBg: '#ede9fe',
  overlay: 'rgba(15,23,42,0.4)',
  cardShadow: 'rgba(99,102,241,0.08)',
  glassBg: 'rgba(247,248,252,0.85)',
};

export const darkColors = {
  pageBg: '#08090e',
  surface1: '#11141c',
  surface2: '#1a1f2e',
  elevated: '#232838',
  border: '#2d3348',
  borderSubtle: '#1e2335',
  textPrimary: '#f1f5f9',
  textSecondary: '#b8c0d4',
  textMuted: '#7b869e',
  textDisabled: '#4a5268',
  accent: '#818cf8',
  accentDark: '#6366f1',
  accentLight: '#1e2060',
  accentMuted: '#1a1f3a',
  success: '#34d399',
  successBg: '#064e3b',
  warning: '#fbbf24',
  warningBg: '#451a03',
  danger: '#f87171',
  dangerBg: '#450a0a',
  info: '#22d3ee',
  infoBg: '#083344',
  purple: '#a78bfa',
  purpleBg: '#2e1065',
  overlay: 'rgba(0,0,0,0.6)',
  cardShadow: 'rgba(0,0,0,0.4)',
  glassBg: 'rgba(17,20,28,0.90)',
};

export const typography = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 34,
};

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
};

export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 22,
  pill: 999,
};

/* ──────────────────────────────────────────────
   Premium UI tokens — glass, gradients, shadows
   ────────────────────────────────────────────── */

export const gradients = {
  // Page background washes (subtle, behind content)
  pageHeroLight: ['#dbe1f8', '#e1e6fb', '#e6ecff'],
  pageHeroDark:  ['#0a0d14', '#0c1020', '#0a0d14'],

  // Brand accents
  brand:         ['#6366f1', '#4f46e5'],
  brandSoft:     ['#818cf8', '#6366f1', '#4f46e5'],
  violet:        ['#7c3aed', '#6366f1'],
  indigoViolet:  ['#6366f1', '#8b5cf6'],
  cyan:          ['#06b6d4', '#0891b2'],
  amber:         ['#f59e0b', '#d97706'],
  success:       ['#10b981', '#059669'],
  danger:        ['#ef4444', '#dc2626'],

  // Hero pills — used by GradientHeader
  heroPrimary:   ['#4f46e5', '#6366f1', '#818cf8'],
  heroAi:        ['#7c3aed', '#6366f1'],
  heroDispatch:  ['#4f46e5', '#6366f1'],

  // Subtle overlay tints for cards
  glassWashLight: ['rgba(255,255,255,0.78)', 'rgba(255,255,255,0.55)'],
  glassWashDark:  ['rgba(18,22,38,0.72)', 'rgba(12,18,35,0.55)'],
};

// expo-blur intensities by platform — iOS gets lighter, Android pushes harder
// since BlurView on Android is more rendered-fill than true backdrop blur.
export const glass = {
  // Light mode tints used as the fill *over* the BlurView
  fillLight:        'rgba(255,255,255,0.62)',
  fillLightStrong:  'rgba(255,255,255,0.78)',
  fillLightFloat:   'rgba(255,255,255,0.85)',
  borderLight:      'rgba(255,255,255,0.85)',
  borderLightSoft:  'rgba(99,102,241,0.18)',

  // Dark mode tints
  fillDark:        'rgba(18,22,38,0.66)',
  fillDarkStrong:  'rgba(18,22,38,0.78)',
  fillDarkFloat:   'rgba(18,22,38,0.88)',
  borderDark:      'rgba(255,255,255,0.08)',
  borderDarkSoft:  'rgba(99,102,241,0.25)',

  // BlurView intensities (iOS, Android)
  blurIosLight: 60,
  blurAndLight: 90,
  blurIosDark:  72,
  blurAndDark:  100,
};

// Shadow presets — elevation on Android, shadow* on iOS.
export const shadow = {
  card: {
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  cardStrong: {
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 8,
  },
  floating: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 26,
    elevation: 10,
  },
  glow: {
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },
};
