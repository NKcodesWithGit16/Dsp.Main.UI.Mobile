import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors } from '../theme/colors';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('dispatchr-theme').then((val) => {
      if (val) setIsDark(val === 'dark');
    });
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    AsyncStorage.setItem('dispatchr-theme', next ? 'dark' : 'light');
  };

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
