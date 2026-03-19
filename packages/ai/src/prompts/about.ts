// @wapixia/ai — About page prompt

/**
 * Build the user prompt for about page content generation.
 */
export function buildAboutPrompt(onboardingData: Record<string, unknown>): string {
  return `Tu dois générer le contenu de la page "À Propos" pour ce site web.

DONNÉES DE L'ENTREPRISE :
${JSON.stringify(onboardingData, null, 2)}

Génère un objet JSON avec cette structure :
{
  "title": "string — H1 (ex: 'À propos de [nom] — [secteur] à [ville]')",
  "story": "string — 150-200 mots, histoire de l'entreprise en 1ère personne, ton chaleureux",
  "mission": "string — 60-80 mots, mission et valeurs",
  "why": {
    "title": "string — H2 (ex: 'Pourquoi choisir [nom] à [ville] ?')",
    "reasons": [
      { "title": "string — 3-5 mots", "text": "string — 30-40 mots" }
    ]
  },
  "expertise": {
    "title": "string — H2 (ex: 'Notre expertise en [secteur]')",
    "text": "string — 80-100 mots",
    "certifications": []
  },
  "seo": {
    "metaTitle": "string — max 60 chars",
    "metaDescription": "string — max 160 chars"
  }
}

Génère exactement 4 raisons dans le tableau "reasons".
Reste authentique — ne pas inventer de certifications non mentionnées dans les données.`
}
