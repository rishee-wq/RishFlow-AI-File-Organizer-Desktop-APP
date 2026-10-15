import React, { createContext, useContext, useEffect, useState } from 'react';
import { pythonAPI } from '@/api/pywebview';

export type ThemeType = 'abyss' | 'lagoon' | 'glacier';

export const THEMES: Array<{
  id: ThemeType;
  name: string;
  description: string;
  swatch: [string, string, string]; // background, surface, accent
}> = [
  { id: 'abyss', name: 'Abyss', description: 'Midnight ocean, electric cyan', swatch: ['#02060b', '#0c1a24', '#64cefb'] },
  { id: 'lagoon', name: 'Lagoon', description: 'Deep teal, bioluminescent glow', swatch: ['#010b0a', '#0a1f1d', '#2ee6c5'] },
  { id: 'glacier', name: 'Glacier', description: 'Bright ice, clear blue water', swatch: ['#eef6fb', '#ffffff', '#0284c7'] },
];

const STORAGE_KEY = 'rishflow-theme';
const ALL = THEMES.map((t) => t.id);

// Map themes from the previous UI onto the new currents
function normalize(value: unknown): ThemeType | null {
  if (typeof value !== 'string') return null;
  if ((ALL as string[]).includes(value)) return value as ThemeType;
  if (value === 'aqua-circuit') return 'glacier';
  if (value === 'water-flow' || value === 'neural-dark' || value === 'ember-flux') return 'abyss';
  return null;
}

function readLocal(): ThemeType | null {
  try {
    return normalize(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>(() => readLocal() ?? 'abyss');

  // pywebview may run in private mode (localStorage wiped per launch), so the
  // backend's state.json is the durable source of truth.
  useEffect(() => {
    pythonAPI
      .initialize()
      .then(() => (pythonAPI.available ? pythonAPI.loadState('theme') : null))
      .then((res) => {
        const saved = normalize(res?.value);
        if (saved) setThemeState(saved);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    ALL.forEach((t) => root.classList.remove(`theme-${t}`));
    root.classList.add(`theme-${theme}`);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  const setTheme = (next: ThemeType) => {
    setThemeState(next);
    if (pythonAPI.available) pythonAPI.saveState('theme', next).catch(() => {});
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
