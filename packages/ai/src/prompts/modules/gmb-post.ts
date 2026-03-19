// @wapixia/ai — Google My Business post prompts

import type { PromptTemplate, SiteContext } from '../../types/prompt.js'

/** System prompt for GMB post generation */
export const gmbPostSystemPrompt = `Tu es un expert en Google My Business (Google Business Profile) pour les PME locales belges.
Tu crées des posts GMB optimisés pour la visibilité locale et le référencement Google Maps.

Règles absolues :
- Le résumé (summary) ne doit jamais dépasser 1500 caractères
- Toujours inclure la ville et le secteur naturellement
- Chaque post doit avoir un call-to-action clair et pertinent
- Français belge naturel, vouvoiement
- Ton direct et informatif — pas de blabla, pas de superlatifs vides
- Le contenu doit être immédiatement compréhensible dans le flux Google Maps
- Toujours répondre en JSON valide — jamais de texte libre autour du JSON
- Ne jamais inclure de commentaires dans le JSON`

/** Post type descriptions for GMB */
const GMB_POST_TYPE_CONTEXT: Record<string, string> = {
  update: `Post de MISE À JOUR (What's New) :
Partager une actualité, un nouveau service, ou une information utile.
Le call-to-action doit diriger vers le site web (LEARN_MORE) ou un formulaire de contact (BOOK).
Ton informatif et engageant.`,

  offer: `Post d'OFFRE (Offer) :
Mettre en avant une promotion, une offre spéciale ou un avantage temporaire.
Le call-to-action doit être orienté conversion (SHOP, BOOK, ou ORDER).
Créer un sentiment d'urgence sans être agressif.
Mentionner les conditions si pertinent.`,

  event: `Post d'ÉVÉNEMENT (Event) :
Annoncer un événement, une journée portes ouvertes, un atelier ou une participation à un événement local.
Le call-to-action doit être SIGN_UP ou LEARN_MORE.
Inclure les informations pratiques (quoi, quand, où).`,
}

/**
 * Build a GMB post prompt for a given post type.
 * Valid post types: update, offer, event
 */
export function buildGMBPostPrompt(context: SiteContext, postType: string): string {
  const typeContext = GMB_POST_TYPE_CONTEXT[postType] ?? GMB_POST_TYPE_CONTEXT.update
  const seasonInfo = context.currentSeason
    ? `\nSaison actuelle : ${context.currentSeason}`
    : ''
  const monthInfo = context.currentMonth
    ? `\nMois en cours : ${context.currentMonth}`
    : ''
  const phoneInfo = context.phone
    ? `\nTéléphone : ${context.phone}`
    : ''
  const websiteInfo = context.website
    ? `\nSite web : ${context.website}`
    : ''
  const hoursInfo = context.openingHours
    ? `\nHoraires : ${Object.entries(context.openingHours).map(([day, hours]) => `${day}: ${hours}`).join(', ')}`
    : ''

  return `Génère un post Google My Business pour cette entreprise locale belge.

DONNÉES DE L'ENTREPRISE :
- Nom : ${context.businessName}
- Secteur : ${context.sector}
- Ville : ${context.city} (${context.zip})
- Description : ${context.description}
- Services : ${context.services.join(', ')}
- Avantage concurrentiel : ${context.uniqueSellingPoint}
- Public cible : ${context.targetAudience}${phoneInfo}${websiteInfo}${hoursInfo}${seasonInfo}${monthInfo}

TYPE DE POST GMB :
${typeContext}

Génère un objet JSON avec exactement cette structure :
{
  "summary": "string — contenu du post, max 1500 caractères, accrocheur et informatif, inclure ville et secteur",
  "callToAction": {
    "type": "string — un parmi : LEARN_MORE, BOOK, ORDER, SHOP, SIGN_UP, CALL",
    "url": "string — URL cible du CTA (utiliser ${context.website ?? 'https://example.com'} comme base)"
  },
  "imageKeywords": ["string — 2-3 mots-clés pour générer ou sélectionner une image pertinente"]
}

Le summary doit :
- Commencer par une accroche forte (première phrase visible dans le flux)
- Mentionner "${context.city}" au moins une fois
- Être rédigé à la 1ère personne du pluriel
- Se terminer naturellement avant le CTA`
}

/** Full prompt template for GMB post generation */
export const gmbPostTemplate: PromptTemplate = {
  version: '1.0.0',
  model: 'claude-sonnet-4-6',
  maxTokens: 1024,
  system: gmbPostSystemPrompt,
  user: (context: SiteContext) => buildGMBPostPrompt(context, 'update'),
}
