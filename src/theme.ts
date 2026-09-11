import { useColorScheme } from 'react-native';

export interface Theme {
  bg: string;
  card: string;
  cardAlt: string;
  text: string;
  textSecondary: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  danger: string;
  border: string;
  success: string;
  isDark: boolean;
}

// Hearth palette: warm terracotta on cream — a kitchen-table school, not an
// institution. Night mode is deep cocoa with a glowing apricot accent.
// Visually unrelated to our other apps (green, teal, blue, purple).
export const lightTheme: Theme = {
  bg: '#FBF7F2',
  card: '#FFFFFF',
  cardAlt: '#F3EAE0',
  text: '#2A211A',
  textSecondary: '#6B5B4E',
  textFaint: '#A08E7E',
  accent: '#B5532A',
  accentSoft: '#FBE5D8',
  danger: '#C53030',
  border: '#E8DDD2',
  success: '#2F7D4F',
  isDark: false,
};

export const darkTheme: Theme = {
  bg: '#1C1512',
  card: '#261E19',
  cardAlt: '#332924',
  text: '#F5EDE4',
  textSecondary: '#C7B5A5',
  textFaint: '#8C7A6B',
  accent: '#F0955B',
  accentSoft: '#3D2A1E',
  danger: '#F56565',
  border: '#3A2E27',
  success: '#68B587',
  isDark: true,
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}

export const fonts = {
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};
