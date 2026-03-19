// @wapixia/ai — FAQ page prompt

/**
 * Build the user prompt for FAQ page content generation.
 * Generates 12-15 questions in 3 categories, optimized for AEO / Schema.org FAQPage.
 */
export function buildFAQPrompt(onboardingData: Record<string, unknown>): string {
  return `Tu dois générer une FAQ complète pour ce site web.
Cette FAQ sera balisée en Schema.org FAQPage pour Google et les IA génératives.

DONNÉES DE L'ENTREPRISE :
${JSON.stringify(onboardingData, null, 2)}

Génère un objet JSON avec cette structure :
{
  "title": "string — H1 (ex: 'Questions fréquentes — [nom] à [ville]')",
  "intro": "string — 40-60 mots TLDR-first",
  "categories": [
    {
      "name": "string — catégorie (ex: 'Tarifs et paiement', 'Prise de rendez-vous', 'Nos services')",
      "questions": [
        {
          "question": "string — question réelle, inclure ville si pertinent",
          "answer": "string — réponse complète et autonome, 40-80 mots"
        }
      ]
    }
  ]
}

Génère 3 catégories avec 4-5 questions chacune (12-15 questions au total).
Les questions doivent couvrir : tarifs, localisation, prise de contact, services spécifiques, praticités.
Toutes les réponses doivent être autonomes (compréhensibles sans le contexte de la page).`
}
