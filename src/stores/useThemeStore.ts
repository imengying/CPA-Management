import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme } from '@/types';
import { STORAGE_KEY_THEME } from '@/utils/constants';

type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  initializeTheme: () => () => void;
}

const getSystemTheme = (): ResolvedTheme => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

const resolveAutoTheme = (): ResolvedTheme => {
  return getSystemTheme();
};

const applyTheme = (resolved: ResolvedTheme) => {
  if (resolved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    return;
  }

  document.documentElement.removeAttribute('data-theme');
};

const resolveTheme = (theme: Theme): ResolvedTheme =>
  theme === 'auto' ? resolveAutoTheme() : theme;

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'auto',
      resolvedTheme: 'light',

      setTheme: (theme) => {
        const resolved = resolveTheme(theme);
        applyTheme(resolved);
        set({
          theme,
          resolvedTheme: resolved,
        });
      },

      initializeTheme: () => {
        const { theme, setTheme } = get();

        // 应用已保存的主题
        setTheme(theme);

        // 监听系统主题变化（仅在 auto 模式下生效）
        if (!window.matchMedia) {
          return () => {};
        }

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const listener = () => {
          const { theme: currentTheme } = get();
          if (currentTheme === 'auto') {
            const resolved = resolveAutoTheme();
            applyTheme(resolved);
            set({ resolvedTheme: resolved });
          }
        };

        mediaQuery.addEventListener('change', listener);

        return () => mediaQuery.removeEventListener('change', listener);
      },
    }),
    {
      name: STORAGE_KEY_THEME,
    }
  )
);
