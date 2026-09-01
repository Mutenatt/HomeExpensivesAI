export const colors = {
  bgBase: '#FDF6EE',
  surface: '#FFFFFF',
  textPrimary: '#4C3A2D',
  textSecondary: '#A78B7A',
  borderSubtle: '#F3ECE4',
  positive: '#2F9E6B',
  positiveSurface: '#E3F5EC',
  negative: '#E2685A',
  negativeSurface: '#FBE9E7',
  warning: '#F2A65A',
  accentGradientStart: '#F2A65A',
  accentGradientEnd: '#E2685A',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
};

export const typography = {
  displayXl: { fontSize: 32, fontWeight: '700' as const },
  headingMd: { fontSize: 17, fontWeight: '600' as const },
  bodyMd: { fontSize: 15, fontWeight: '500' as const },
  bodySm: { fontSize: 13, fontWeight: '400' as const },
  labelXs: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.4 },
};

export const shadows = {
  soft: {
    shadowColor: '#4C3A2D',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  fab: {
    shadowColor: '#E2685A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
};
