'use client';
import { useTheme } from '@/components/ThemeProvider';

interface Props {
  className?: string;
}

export default function ThemeToggle({ className = '' }: Props) {
  const { isDark, toggleDark } = useTheme();

  return (
    <button
      onClick={toggleDark}
      aria-label={isDark ? '切換亮色模式 / Switch to light mode' : '切換暗色模式 / Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={`relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100
        dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800
        transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
        ${className}`}
    >
      {/* 太陽（亮色模式顯示） */}
      <svg
        aria-hidden="true"
        className={`w-5 h-5 transition-all ${isDark ? 'opacity-0 scale-50 absolute' : 'opacity-100 scale-100'}`}
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="5" strokeWidth={2} />
        <path strokeLinecap="round" strokeWidth={2}
          d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
      {/* 月亮（暗色模式顯示） */}
      <svg
        aria-hidden="true"
        className={`w-5 h-5 transition-all ${isDark ? 'opacity-100 scale-100' : 'opacity-0 scale-50 absolute'}`}
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    </button>
  );
}
