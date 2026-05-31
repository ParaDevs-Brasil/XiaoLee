'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/providers/theme-context'
import { SunIcon, MoonIcon } from '@heroicons/react/24/solid'

export const ThemeToggle = () => {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 mx-2 hover:scale-120 cursor-pointer transition-all duration-300 easy-in-out rounded-full text-[var(--text-primary)]"
      aria-label="Toggle Dark Mode"
    >
      {theme === 'dark' ? (
        <SunIcon className="w-6 h-6 text-[var(--text-primary)]" />
      ) : (
        <MoonIcon className="w-6 h-6 text-[var(--text-primary)]" />
      )}
    </button>
  )
} 