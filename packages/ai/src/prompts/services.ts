// @wapixia/ai — Services page prompt

/**
 * Build the user prompt for services page content generation.
 */
export function buildServicesPrompt(onboardingData: Record<string, unknown>): string {
  const services = Array.isArray(onboardingData['services']) ? onboardingData['services'] : []
  const serviceCount = services.length

  return `Tu dois générer le contenu de la page services pour ce site web.

DONNÉES DE L'ENTREPRISE :
${JSON.stringify(onboardingData, null, 2)}

SERVICES DÉCLARÉS : ${JSON.stringify(services)}

Génère un objet JSON avec cette structure :
{
  "title": "string — H1 en format réponse directe (ex: 'Nos services de coiffure à Mouscron')",
  "intro": "string — 80-100 mots TLDR-first : répondre directement à 'quels services proposez-vous ?'",
  "services": [
    {
      "name": "string — nom exact du service",
      "h2": "string — titre H2 en format question (ex: 'Combien coûte une coloration à Mouscron ?')",
      "description": "string — 100-150 mots, description détaillée avec bénéfices",
      "details": "string — 40-60 mots supplémentaires sur le processus ou les matériaux",
      "duration": "string ou null — durée estimée si applicable",
      "priceFrom": "string ou null — prix indicatif si applicable",
      "faq": [
        {
          "question": "string — question spécifique à ce service",
          "answer": "string — réponse directe 30-50 mots"
        }
      ]
    }
  ],
  "seo": {
    "metaTitle": "string — max 60 chars",
    "metaDescription": "string — max 160 chars"
  }
}

Génère le contenu pour TOUS les services listés (${String(serviceCount)} services).
Chaque service doit avoir 2 questions FAQ.`
}
