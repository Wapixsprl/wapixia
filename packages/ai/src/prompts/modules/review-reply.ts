// @wapixia/ai — Review reply prompts for customer service

import type { PromptTemplate, ReviewData, SiteContext } from '../../types/prompt.js'

/** System prompt for review reply generation */
export const reviewReplySystemPrompt = `Tu es un expert en service client pour les PME locales belges.
Tu rédiges des réponses professionnelles et empathiques aux avis Google (Google Reviews).

Règles absolues :
- La réponse ne doit jamais dépasser 500 caractères
- Toujours mentionner le nom de l'entreprise au moins une fois
- Toujours remercier le client pour son avis (positif ou négatif)
- Ne jamais s'excuser de manière excessive — rester digne et constructif
- Pour les avis négatifs : proposer une solution concrète ou un contact direct
- Pour les avis positifs : remercier chaleureusement et renforcer le lien
- Pour les avis mixtes : reconnaître le positif et adresser le négatif
- Français belge naturel, vouvoiement
- Ton humain et authentique — pas de réponse robot ou template
- Personnaliser en reprenant des éléments spécifiques de l'avis
- Toujours répondre en JSON valide — jamais de texte libre autour du JSON
- Ne jamais inclure de commentaires dans le JSON`

/**
 * Determine the reply strategy based on star rating.
 */
function getReplyStrategy(rating: number): string {
  if (rating >= 4) {
    return `STRATÉGIE AVIS POSITIF (${rating}/5 étoiles) :
- Remercier chaleureusement et sincèrement
- Reprendre un élément spécifique mentionné dans l'avis
- Renforcer le sentiment positif avec une touche personnelle
- Inviter subtilement à revenir ou à recommander
- Ton : reconnaissant et chaleureux`
  }

  if (rating <= 2) {
    return `STRATÉGIE AVIS NÉGATIF (${rating}/5 étoiles) :
- Remercier pour le retour malgré l'insatisfaction
- Reconnaître le problème sans s'excuser excessivement (1 excuse maximum)
- Proposer une solution concrète ou un moyen de contact direct
- Montrer que l'entreprise prend les retours au sérieux
- Ne JAMAIS être défensif ou accusateur
- Ton : empathique et constructif`
  }

  return `STRATÉGIE AVIS MIXTE (${rating}/5 étoiles) :
- Remercier pour le retour honnête
- Reconnaître les aspects positifs mentionnés
- Adresser les points d'amélioration avec humilité
- Montrer la volonté de s'améliorer
- Ton : équilibré et ouvert`
}

/**
 * Build a review reply prompt for a specific review.
 */
export function buildReviewReplyPrompt(context: SiteContext, review: ReviewData): string {
  const strategy = getReplyStrategy(review.rating)
  const phoneInfo = context.phone
    ? `\nTéléphone de contact : ${context.phone}`
    : ''

  return `Rédige une réponse à cet avis Google pour l'entreprise.

DONNÉES DE L'ENTREPRISE :
- Nom : ${context.businessName}
- Secteur : ${context.sector}
- Ville : ${context.city}${phoneInfo}

AVIS À RÉPONDRE :
- Auteur : ${review.authorName}
- Note : ${review.rating}/5 étoiles
- Date : ${review.date}
- Texte : "${review.text}"

${strategy}

Génère un objet JSON avec exactement cette structure :
{
  "reply": "string — réponse max 500 caractères, personnalisée, mentionner le nom de l'entreprise",
  "tone": "string — un parmi : grateful, empathetic, constructive, neutral",
  "sentiment": "string — un parmi : positive, negative, mixed"
}

La réponse doit :
- Commencer par le prénom du client si disponible (ex: "Bonjour ${review.authorName.split(' ')[0]}")
- Mentionner "${context.businessName}" au moins une fois
- Reprendre un élément concret de l'avis
- Ne pas dépasser 500 caractères au total`
}

/** Full prompt template for review reply generation */
export const reviewReplyTemplate: PromptTemplate = {
  version: '1.0.0',
  model: 'claude-haiku-4-5-20251001',
  maxTokens: 512,
  system: reviewReplySystemPrompt,
  user: (context: SiteContext) =>
    buildReviewReplyPrompt(context, {
      authorName: 'Client',
      rating: 5,
      text: '',
      date: new Date().toISOString(),
    }),
}
