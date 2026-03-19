// @wapixia/ai — Contact page prompt

/**
 * Build the user prompt for contact page content generation.
 */
export function buildContactPrompt(onboardingData: Record<string, unknown>): string {
  return `Tu dois générer le contenu de la page Contact pour ce site web.

DONNÉES DE L'ENTREPRISE :
${JSON.stringify(onboardingData, null, 2)}

Génère un objet JSON avec cette structure :
{
  "title": "string — H1 (ex: 'Contactez [nom] à [ville]')",
  "intro": "string — 40-60 mots TLDR-first, inviter au contact de manière chaleureuse",
  "address_section": {
    "title": "string — H2 (ex: 'Où nous trouver ?')",
    "directions": "string — 30-50 mots, comment se rendre sur place, points de repère locaux"
  },
  "hours_section": {
    "title": "string — H2 (ex: 'Nos horaires d'ouverture')",
    "note": "string ou null — note sur les horaires (ex: 'Sur rendez-vous le samedi')"
  },
  "form_section": {
    "title": "string — H2 (ex: 'Envoyez-nous un message')",
    "subtitle": "string — 20-30 mots d'encouragement"
  },
  "seo": {
    "metaTitle": "string — max 60 chars (inclure adresse)",
    "metaDescription": "string — max 160 chars (téléphone + horaires + ville)"
  }
}`
}
