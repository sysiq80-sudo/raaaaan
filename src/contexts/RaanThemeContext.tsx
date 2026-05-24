/**
 * RaanThemeContext — سياق الثيم المشترك لكل تطبيق الراكب
 * يضمن تزامن الثيم عبر جميع الصفحات فور التغيير
 */
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export type RaanTheme = 'dark' | 'light';

const THEME_KEY = 'raan-rider-theme';

const getSaved = (): RaanTheme => {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {}
  return 'dark';
};

const applyClass = (theme: RaanTheme) => {
  const root = document.documentElement;
  root.classList.remove('light-rider');
  if (theme === 'light') root.classList.add('light-rider');
};

/* ── Context Shape ── */
interface ThemeContextType {
  theme: RaanTheme;
  isDark: boolean;
  isLight: boolean;
  setTheme: (t: RaanTheme) => void;
  toggleTheme: () => void;
  // للتوافق مع useTheme القديم
  resolvedTheme: RaanTheme;
}

const RaanThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  isDark: true,
  isLight: false,
  setTheme: () => {},
  toggleTheme: () => {},
  resolvedTheme: 'dark',
});

/* ── Provider ── */
export const RaanThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<RaanTheme>(getSaved);

  // طبّق الكلاس فور تغيير الثيم أو عند أول تحميل
  useEffect(() => {
    applyClass(theme);
  }, [theme]);

  const setTheme = useCallback((t: RaanTheme) => {
    try { localStorage.setItem(THEME_KEY, t); } catch {}
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <RaanThemeContext.Provider value={{
      theme,
      isDark: theme === 'dark',
      isLight: theme === 'light',
      setTheme,
      toggleTheme,
      resolvedTheme: theme,
    }}>
      {children}
    </RaanThemeContext.Provider>
  );
};

/* ── Hook ── */
export const useRaanTheme = () => useContext(RaanThemeContext);
