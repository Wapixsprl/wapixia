'use client'

import { createContext, useContext, useMemo } from 'react'
import type { ThemeConfig, ThemeCSSProperties } from './types'
import { THEME_CONFIG, type ThemeName } from './config'

interface ThemeContextValue {
  theme: ThemeName
  config: ThemeConfig
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

interface ThemeProviderProps {
  theme: ThemeName
  children: React.ReactNode
}

/**
 * Provides theme context and applies CSS custom properties to a wrapper div.
 * Wrap your page or layout with this component to enable theming.
 */
export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const config = THEME_CONFIG[theme]

  const cssVars: ThemeCSSProperties = useMemo(
    () => ({
      '--color-primary': config.primaryColor,
      '--color-accent': config.accentColor,
      '--font-heading': `'${config.font.heading}', sans-serif`,
      '--font-body': `'${config.font.body}', sans-serif`,
    }),
    [config],
  )

  const contextValue: ThemeContextValue = useMemo(
    () => ({ theme, config }),
    [theme, config],
  )

  return (
    <ThemeContext.Provider value={contextValue}>
      <div style={cssVars as React.CSSProperties} className="contents">
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

/**
 * Access the current theme name and config inside a ThemeProvider.
 * Throws if used outside of a ThemeProvider.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a <ThemeProvider>')
  }
  return ctx
}
