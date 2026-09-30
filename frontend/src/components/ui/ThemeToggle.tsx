import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

// Manual light/dark toggle, mirroring redesign-and-blend's theme switch: the
// choice is written to localStorage under the same key ('ah-theme') the
// pre-paint script in _document.tsx reads, and to <html data-theme> so the
// CSS in globals.css (`:root[data-theme="dark"]`) picks it up immediately.
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as 'light' | 'dark') || 'light');
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('ah-theme', next);
    } catch {
      // localStorage can throw in private-browsing/blocked-storage modes --
      // the toggle still works for this page load via the dataset write above.
    }
  };

  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label="Toggle color theme">
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
