// @wapixia/ai — Home page prompt

/**
 * Build the user prompt for home page content generation.
 * Expects full onboarding data, returns a prompt string.
 */
export function buildHomePrompt(onboardingData: Record<string, unknown>): string {
  return `Tu dois générer le contenu de la page d'accueil pour ce site web.

DONNÉES DE L'ENTREPRISE :
${JSON.stringify(onboardingData, null, 2)}

Génère un objet JSON avec exactement cette structure :
{
  "hero": {
    "headline": "string — H1 accrocheur 60-80 chars, inclure la ville et le secteur",
    "subheadline": "string — 120-150 chars, USP principale + CTA implicite",
    "ctaPrimary": "string — action principale (ex: 'Prendre rendez-vous', 'Demander un devis')",
    "ctaSecondary": "string — action secondaire (ex: 'Découvrir nos services')"
  },
  "intro": "string — 80-100 mots, réponse directe à 'Qui êtes-vous et que faites-vous ?', commence par le nom de l'entreprise",
  "features": [
    {
      "icon": "string — nom d'icône Lucide React (ex: 'Star', 'Shield', 'Clock')",
      "title": "string — 3-5 mots",
      "description": "string — 20-30 mots"
    }
  ],
  "testimonials": [
    {
      "author": "string — prénom + initiale du nom (ex: 'Marie D.')",
      "role": "string — profil client (ex: 'Cliente depuis 3 ans')",
      "rating": 5,
      "text": "string — 40-60 mots, avis authentique et spécifique au secteur"
    }
  ],
  "faq": [
    {
      "question": "string — question réelle d'un client potentiel, inclure la ville",
      "answer": "string — réponse directe et complète en 40-60 mots"
    }
  ],
  "ctaFinal": {
    "headline": "string — 40-60 chars, urgence ou bénéfice",
    "subtext": "string — 50-70 chars, réassurance",
    "cta": "string — action (identique à ctaPrimary)"
  },
  "seo": {
    "metaTitle": "string — max 60 chars, mot-clé principal + ville + marque",
    "metaDescription": "string — max 160 chars, USP + CTA, inclure ville et secteur",
    "h1": "string — identique à hero.headline"
  }
}

Génère exactement 4 features, 3 testimonials, 5 questions FAQ.
Toutes les questions FAQ doivent inclure le nom de la ville.`
}
