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

  return {
    theme,
    setTheme,
    toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }
}
