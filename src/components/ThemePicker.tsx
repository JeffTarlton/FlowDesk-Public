import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Check, Sun, Moon, X } from 'lucide-react';
import { useThemeStore, THEMES } from '../store/useThemeStore';

function ThemeOptions({ columns }: { columns: 2 | 3 }) {
  const { mode, theme, setMode, setTheme } = useThemeStore();
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div>
      <div className="grid grid-cols-2 gap-1 p-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-xl">
        {(['light', 'dark'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              mode === m
                ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {m === 'light' ? <Sun size={14} /> : <Moon size={14} />}
            {m === 'light' ? 'Light' : 'Dark'}
          </button>
        ))}
      </div>

      <div className={`grid gap-2.5 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {THEMES.map((t) => {
          const isActive = t.id === theme;
          return (
            // data-theme scopes each card to its own palette, so it previews that theme in the current mode
            <button
              key={t.id}
              data-theme={t.id}
              onClick={() => setTheme(t.id)}
              aria-pressed={isActive}
              title={t.description}
              className={`text-left p-1.5 rounded-xl border-2 bg-white dark:bg-surface-dark transition-colors ${
                isActive
                  ? 'border-primary-500'
                  : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
              }`}
            >
              {/* Miniature kanban board */}
              <div className="flex gap-1 p-1.5 rounded-lg bg-canvas dark:bg-canvas-dark">
                {[3, 2, 1].map((cards, col) => (
                  <div key={col} className="flex-1 flex flex-col gap-1">
                    <div className="h-1 w-3/4 rounded-full bg-gray-300 dark:bg-gray-600" />
                    {Array.from({ length: cards }).map((_, i) => (
                      <div key={i} className="h-2 rounded-sm bg-white dark:bg-surface-dark border-l-2 border-primary-500 shadow-sm" />
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 px-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary-500 shrink-0" />
                <span className="flex-1 text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{t.name}</span>
                {isActive && <Check size={14} className="text-primary-600 dark:text-primary-400 shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="font-semibold text-gray-700 dark:text-gray-300">{current.name}:</span> {current.description}
      </p>
    </div>
  );
}

export default function ThemePicker({ variant = 'sidebar' }: { variant?: 'sidebar' | 'mobile' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useThemeStore((s) => s.theme);
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (variant === 'mobile') {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="flex flex-col items-center p-2 text-gray-400 hover:text-primary-500 transition-colors"
        >
          <Palette size={20} />
          <span className="text-[10px] font-medium mt-1">Theme</span>
        </button>

        {isOpen && createPortal(
          <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm">
            <div
              ref={containerRef}
              className="w-full bg-white dark:bg-surface-dark rounded-t-2xl shadow-xl border-t border-gray-100 dark:border-gray-800 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-slide-up"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white">Theme</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <ThemeOptions columns={3} />
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium text-sm"
      >
        <Palette size={18} />
        <span className="flex-1 text-left">Theme</span>
        <span className="text-xs text-gray-400 truncate">{current.name}</span>
        <span className="w-3 h-3 rounded-full bg-primary-500 ring-2 ring-primary-100 dark:ring-primary-900/60 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-80 p-4 bg-white dark:bg-surface-dark rounded-2xl shadow-xl shadow-black/10 border border-gray-100 dark:border-gray-800 z-50">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">Theme</h3>
          <ThemeOptions columns={2} />
        </div>
      )}
    </div>
  );
}
