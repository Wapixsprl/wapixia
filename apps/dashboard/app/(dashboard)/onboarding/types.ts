export type Answers = Record<string, unknown>

export interface StepProps {
  answers: Answers
  onUpdate: (key: string, value: unknown) => void
  step: number
}

export interface OnboardingSession {
  id: string
  site_id: string
  current_step: number
  answers: Answers
  status: 'in_progress' | 'generating' | 'done' | 'failed'
}

export interface GenerationStatus {
  status: 'in_progress' | 'generating' | 'done' | 'failed'
  progress: number
  error?: string
}

export const SECTORS = [
  { value: 'restaurant', label: 'Restaurant', icon: '🍽️' },
  { value: 'beauty', label: 'Beaute / Bien-etre', icon: '💆' },
  { value: 'retail', label: 'Commerce de detail', icon: '🛍️' },
  { value: 'construction', label: 'Construction / BTP', icon: '🏗️' },
  { value: 'health', label: 'Sante', icon: '🏥' },
  { value: 'education', label: 'Formation / Education', icon: '📚' },
  { value: 'tech', label: 'Technologie / IT', icon: '💻' },
  { value: 'legal', label: 'Juridique / Comptabilite', icon: '⚖️' },
  { value: 'realestate', label: 'Immobilier', icon: '🏠' },
  { value: 'transport', label: 'Transport / Logistique', icon: '🚚' },
  { value: 'other', label: 'Autre', icon: '📦' },
] as const

export const PRICE_RANGES = [
  { value: 'budget', label: 'Budget - Prix bas' },
  { value: 'medium', label: 'Moyen - Rapport qualite/prix' },
  { value: 'premium', label: 'Premium - Haut de gamme' },
  { value: 'variable', label: 'Variable - Sur devis' },
] as const

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Especes' },
  { value: 'card', label: 'Carte bancaire' },
  { value: 'bancontact', label: 'Bancontact' },
  { value: 'payconiq', label: 'Payconiq' },
  { value: 'virement', label: 'Virement bancaire' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'paypal', label: 'PayPal' },
] as const

export const BOOLEAN_OPTIONS = [
  { key: 'parking', label: 'Parking disponible' },
  { key: 'accessibility', label: 'Accessible PMR' },
  { key: 'delivery', label: 'Livraison' },
  { key: 'online_booking', label: 'Reservation en ligne' },
  { key: 'quote_online', label: 'Devis en ligne' },
] as const

export const LANGUAGES = [
  { value: 'fr', label: 'Francais' },
  { value: 'nl', label: 'Neerlandais' },
  { value: 'en', label: 'Anglais' },
  { value: 'de', label: 'Allemand' },
] as const

export const TONES = [
  { value: 'friendly', label: 'Amical et accessible' },
  { value: 'professional', label: 'Professionnel et serieux' },
  { value: 'expert', label: 'Expert et technique' },
  { value: 'dynamic', label: 'Dynamique et moderne' },
  { value: 'premium', label: 'Premium et elegant' },
] as const

export const DAYS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
] as const

export const RADIUS_OPTIONS = [
  { value: '5', label: '5 km' },
  { value: '10', label: '10 km' },
  { value: '20', label: '20 km' },
  { value: '50', label: '50 km' },
  { value: '100', label: '100 km' },
  { value: 'national', label: 'National' },
  { value: 'international', label: 'International' },
] as const
