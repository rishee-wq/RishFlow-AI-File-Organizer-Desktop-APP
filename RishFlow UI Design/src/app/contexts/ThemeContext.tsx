import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeType = 'neural-dark' | 'aqua-circuit' | 'ember-flux';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeType>('neural-dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('rishflow-theme') as ThemeType;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    // Remove all theme classes
    document.documentElement.classList.remove('theme-neural-dark', 'theme-aqua-circuit', 'theme-ember-flux');
    // Add current theme class
    document.documentElement.classList.add(`theme-${theme}`);
    // Save to localStorage
    localStorage.setItem('rishflow-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
