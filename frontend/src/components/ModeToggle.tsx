// src/components/ModeToggle.tsx
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export default function ModeToggle() {
  const { theme, setTheme } = useTheme();

  const handleToggle = () => {
    if (theme === 'system' && typeof window !== 'undefined') {
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
      setTheme(prefersDark ? 'light' : 'dark');
      return;
    }

    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark'));

  const nextThemeLabel = isDark ? 'روشن' : 'تاریک';

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={`تغییر تم به حالت ${nextThemeLabel}`}
      title={`تغییر تم به حالت ${nextThemeLabel}`}
      onClick={handleToggle}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
