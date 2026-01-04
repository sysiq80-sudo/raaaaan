import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'app-theme';

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(THEME_KEY) as Theme) || 'system';
    }
    return 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = (newTheme: Theme) => {
      let effectiveTheme: 'light' | 'dark';
      
      if (newTheme === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        effectiveTheme = newTheme;
      }
      
      root.classList.remove('light', 'dark');
      root.classList.add(effectiveTheme);
      setResolvedTheme(effectiveTheme);
    };

    applyTheme(theme);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(THEME_KEY, newTheme);
    setThemeState(newTheme);
  };

  return { theme, setTheme, resolvedTheme };
};
