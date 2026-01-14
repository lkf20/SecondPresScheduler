'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'system' | 'accented'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => Promise<void>
  isLoading: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode
  initialTheme?: Theme
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme ?? 'system')
  const [isLoading, setIsLoading] = useState(initialTheme ? false : true)

  // Fetch theme from server on mount
  useEffect(() => {
    async function fetchTheme() {
      try {
        const response = await fetch('/api/user/theme')
        if (response.ok) {
          const data = await response.json()
          setThemeState(data.theme || 'system')
        }
      } catch (error) {
        console.error('Error fetching theme:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTheme()
  }, [])

  // Apply theme to HTML element
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
  }, [theme])

  // Update theme and persist to database
  const setTheme = useCallback(async (newTheme: Theme) => {
    try {
      const response = await fetch('/api/user/theme', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ theme: newTheme }),
      })

      if (response.ok) {
        setThemeState(newTheme)
        try {
          window.localStorage.setItem('theme', newTheme)
        } catch (error) {
          console.error('Error persisting theme:', error)
        }
      } else {
        console.error('Failed to update theme')
      }
    } catch (error) {
      console.error('Error updating theme:', error)
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
