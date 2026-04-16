import { useEffect } from 'react'

/**
 * Register a global hotkey. Combo is a "+"-separated string.
 * Use "cmd" or "ctrl" interchangeably — matches either meta/ctrl to
 * normalize behavior across Mac and Windows.
 * Examples: "cmd+k", "cmd+shift+n", "esc"
 */
export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void) {
  useEffect(() => {
    const parts = combo.toLowerCase().split('+')
    const needMod = parts.includes('ctrl') || parts.includes('cmd')
    const needShift = parts.includes('shift')
    const needAlt = parts.includes('alt')
    const key = parts[parts.length - 1]

    const onKey = (e: KeyboardEvent) => {
      if (needMod && !(e.ctrlKey || e.metaKey)) return
      if (needShift && !e.shiftKey) return
      if (needAlt && !e.altKey) return
      if (!needShift && e.shiftKey && key !== 'shift') { /* allow extra modifiers on plain keys */ }
      if (e.key.toLowerCase() !== key) return
      handler(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [combo, handler])
}
