import React, { useEffect, useState } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Check localStorage first
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') {
      return stored
    }
    // Fall back to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  return { theme, toggleTheme }
}

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      className={`theme-toggle ${className}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
    >
      {theme === 'light' ? (
        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5" />
          <path d="m12 1-3 3-3-3 3-3 3 3zM12 23l-3-3-3 3 3 3 3-3zM20.49 3.51l-3 3-3-3 3-3 3 3zM6.51 20.49l-3-3-3 3 3 3 3-3zM1 12l3-3-3-3v6zM23 12l-3 3 3 3v-6zM20.49 20.49l-3-3-3 3 3 3 3-3zM6.51 3.51l-3 3-3-3 3-3 3 3z" />
        </svg>
      )}
    </button>
  )
}