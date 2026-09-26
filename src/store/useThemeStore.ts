import { create } from 'zustand';

export type ColorMode = 'light' | 'dark';

// The palettes themselves live in src/themes.css, keyed by these ids
export const THEMES = [
  { id: 'classic', name: 'Classic Blue', description: 'The original FlowDesk look' },
  { id: 'rose-gold', name: 'Rose Gold', description: 'Blush pink with warm copper tones' },
  { id: 'lavender', name: 'Lavender', description: 'Soft lilac with cool violet accents' },
  { id: 'sage', name: 'Sage', description: 'Calm muted green, lovely next to blush' },
  { id: 'peach', name: 'Peach', description: 'Warm apricot with terracotta accents' },
  { id: 'orchid', name: 'Orchid', description: 'Rich berry-violet, striking in dark mode' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

// These keys are also read by the inline script in index.html to avoid a flash of the default theme.
// 'theme' predates color themes and holds light/dark, so existing preferences carry over.
const MODE_KEY = 'theme';
const THEME_KEY = 'color-theme';

function readMode(): ColorMode {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(MODE_KEY) : null;
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readTheme(): ThemeId {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_KEY) : null;
  return THEMES.find((t) => t.id === saved)?.id ?? 'classic';
}

function applyToDocument(mode: ColorMode, theme: ThemeId) {
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.dataset.theme = theme;

  // Tint the mobile browser toolbar to match the theme accent
  const accent = getComputedStyle(root).getPropertyValue('--primary-600').trim();
  if (accent) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${accent})`);
  }
}

interface ThemeState {
  mode: ColorMode;
  theme: ThemeId;
  setMode: (mode: ColorMode) => void;
  toggleMode: () => void;
  setTheme: (theme: ThemeId) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: readMode(),
  theme: readTheme(),

  setMode: (mode) => {
    localStorage.setItem(MODE_KEY, mode);
    applyToDocument(mode, get().theme);
    set({ mode });
  },

  toggleMode: () => get().setMode(get().mode === 'dark' ? 'light' : 'dark'),

  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    applyToDocument(get().mode, theme);
    set({ theme });
  },
}));

applyToDocument(useThemeStore.getState().mode, useThemeStore.getState().theme);
