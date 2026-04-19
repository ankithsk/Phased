import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'pcc.theme'

function initialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
  return saved ?? 'dark'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  // If another part of the app (e.g. command palette) toggles the theme by
  // writing to the DOM + localStorage directly, re-sync this hook's state so
  // any consumers (like the ThemeToggle icon) don't drift out of sync.
  useEffect(() => {
    const resync = () => {
      const nowDark = document.documentElement.classList.contains('dark')
      setTheme(nowDark ? 'dark' : 'light')
    }
    window.addEventListener('pcc:theme-changed', resync as EventListener)
    return () => window.removeEventListener('pcc:theme-changed', resync as EventListener)
  }, [])

  return {
    theme,
    setTheme,
    toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }
}
