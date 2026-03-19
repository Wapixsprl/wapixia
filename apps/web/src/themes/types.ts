/** Font pair configuration for a theme */
export interface ThemeFonts {
  /** Font family for headings (h1-h6) */
  heading: string
  /** Font family for body text */
  body: string
}

/** Full theme configuration for a business sector */
export interface ThemeConfig {
  /** Business sectors that map to this theme */
  sectors: readonly string[]
  /** Primary color (dark, used for backgrounds/text) */
  primaryColor: string
  /** Accent color (vibrant, used for CTAs/highlights) */
  accentColor: string
  /** Google Fonts font pair */
  font: ThemeFonts
  /** Descriptive ambiance keywords (French) */
  ambiance: string
}

/** CSS custom properties applied by the theme provider */
export interface ThemeCSSProperties {
  '--color-primary': string
  '--color-accent': string
  '--font-heading': string
  '--font-body': string
}
