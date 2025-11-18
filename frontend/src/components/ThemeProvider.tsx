/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';

type Theme = 'light' | 'dark' | 'system';
type Ctx = { theme: Theme; setTheme: (t: Theme) => void };
const ThemeContext = React.createContext<Ctx | null>(null);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'egce-theme',
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setTheme] = React.useState<Theme>(() => {
    try { return (localStorage.getItem(storageKey) as Theme) || defaultTheme; }
    catch { return defaultTheme; }
  });

  React.useEffect(() => {
    const root = document.documentElement;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = (t: Theme) => {
      const isDark = t === 'system' ? mql.matches : t === 'dark';
      root.classList.toggle('dark', isDark);
    };

    apply(theme);
    const onChange = () => theme === 'system' && apply('system');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [theme]);

  React.useEffect(() => {
    try {
      localStorage.setItem(storageKey, theme);
    } catch (error) {
      console.warn('Unable to persist theme preference', error);
    }
  }, [theme, storageKey]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
