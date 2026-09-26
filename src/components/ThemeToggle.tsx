import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';

export default function ThemeToggle() {
  const { mode, toggleMode } = useThemeStore();
  const isDark = mode === 'dark';

  return (
    <button
      onClick={toggleMode}
      className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium text-sm"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
      <span className="flex-1 text-left">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  );
}
