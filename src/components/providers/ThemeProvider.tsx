'use client'

import { useCallback, useEffect, useState } from 'react'
import { createContext, useContext } from 'react'

type Theme = 'light' | 'dark' | 'system'

const ThemeContext = createContext<{
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (next: Theme) => void
  toggleTheme: () => void
} | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('aethermed_theme') as Theme | null
    if (stored) setThemeState(stored)
    updateResolvedTheme()
  }, [])

  const updateResolvedTheme = useCallback(() => {
    if (theme === 'system') {
      const system = window.matchMedia('(prefers-color-scheme: dark)').matches
      setResolvedTheme(system ? 'dark' : 'light')
    } else {
      setResolvedTheme(theme)
    }
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)
    localStorage.setItem('aethermed_theme', theme)
  }, [theme])

  useEffect(() => {
    updateResolvedTheme()
  }, [theme, updateResolvedTheme])

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => updateResolvedTheme()
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [theme, updateResolvedTheme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      if (prev === 'light') return 'dark'
      if (prev === 'dark') return 'system'
      return 'light'
    })
  }, [])

  if (!mounted) return null

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
