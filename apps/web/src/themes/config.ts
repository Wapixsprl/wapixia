import type { ThemeConfig } from './types'

export const THEME_CONFIG = {
  artisan: {
    sectors: ['btp'],
    primaryColor: '#1A1A1A',
    accentColor: '#F39C12',
    font: { heading: 'Syne', body: 'DM Sans' },
    ambiance: 'robuste, texture, matières, confiance',
  },
  beaute: {
    sectors: ['beaute', 'fitness'],
    primaryColor: '#2C2C2C',
    accentColor: '#FF6B9D',
    font: { heading: 'Playfair Display', body: 'Inter' },
    ambiance: 'élégant, féminin, luxe accessible, bien-être',
  },
  horeca: {
    sectors: ['horeca'],
    primaryColor: '#1A0A00',
    accentColor: '#E8A020',
    font: { heading: 'Cormorant Garamond', body: 'Source Sans 3' },
    ambiance: 'chaleureux, appétissant, convivial, vivant',
  },
  immobilier: {
    sectors: ['immobilier'],
    primaryColor: '#0D1B2A',
    accentColor: '#C9A84C',
    font: { heading: 'Libre Baskerville', body: 'Lato' },
    ambiance: 'premium, luxe, confiance, sérieux',
  },
  medical: {
    sectors: ['medical'],
    primaryColor: '#0A2A4A',
    accentColor: '#00B4D8',
    font: { heading: 'Nunito', body: 'Open Sans' },
    ambiance: 'rassurant, propre, professionnel, accessible',
  },
  automobile: {
    sectors: ['automobile'],
    primaryColor: '#0A0A0A',
    accentColor: '#E74C3C',
    font: { heading: 'Rajdhani', body: 'Roboto' },
    ambiance: 'dynamique, technologique, puissance, fiabilité',
  },
  commerce: {
    sectors: ['commerce'],
    primaryColor: '#1A1A2E',
    accentColor: '#FF6B35',
    font: { heading: 'Poppins', body: 'Nunito' },
    ambiance: 'coloré, énergie, promo, accessible',
  },
  b2b: {
    sectors: ['b2b', 'asbl', 'autre'],
    primaryColor: '#1E293B',
    accentColor: '#3B82F6',
    font: { heading: 'Plus Jakarta Sans', body: 'Inter' },
    ambiance: 'professionnel, sobre, confiance, expertise',
  },
} as const satisfies Record<string, ThemeConfig>

export type ThemeName = keyof typeof THEME_CONFIG
export type BusinessSector = string

/** Default theme used as fallback */
const DEFAULT_THEME: ThemeName = 'b2b'

/**
 * Resolve a business sector string to its corresponding theme name.
 * Falls back to 'b2b' if the sector is not found.
 */
export function getThemeForSector(sector: BusinessSector): ThemeName {
  const normalized = sector.toLowerCase().trim()
  for (const [themeName, config] of Object.entries(THEME_CONFIG)) {
    if ((config.sectors as readonly string[]).includes(normalized)) {
      return themeName as ThemeName
    }
  }
  return DEFAULT_THEME
}

/**
 * Build a Google Fonts import URL for the heading + body fonts of a theme.
 * Returns a URL suitable for a <link> tag or @import.
 */
export function getGoogleFontsUrl(theme: ThemeName): string {
  const config = THEME_CONFIG[theme]
  const families = [config.font.heading, config.font.body]
  const params = families
    .map((family) => {
      const encoded = family.replace(/ /g, '+')
      return `family=${encoded}:wght@400;500;600;700`
    })
    .join('&')

  return `https://fonts.googleapis.com/css2?${params}&display=swap`
}
