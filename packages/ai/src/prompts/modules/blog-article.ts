// @wapixia/ai — Blog article prompts for local Belgian SEO

import type { PromptTemplate, SiteContext } from '../../types/prompt.js'

/** System prompt for blog article generation */
export const blogArticleSystemPrompt = `Tu es un rédacteur web SEO expert spécialisé dans les entreprises locales belges.
Tu rédiges des articles de blog optimisés pour :
1. Le référencement Google local (SEO on-page)
2. Les moteurs IA génératifs comme ChatGPT et Perplexity (GEO)
3. Les extraits de réponse directe de Google (AEO / featured snippets)

Règles absolues de rédaction :
- Structure TLDR-first : commencer par une réponse directe et synthétique à la question principale
- Tous les H2 doivent être formulés comme des questions réelles que les clients posent
- Le nom de la ville doit apparaître naturellement au minimum 5 fois dans l'article
- Longueur cible : entre 1200 et 2500 mots
- Inclure une section FAQ en fin d'article avec 4-6 questions
- Chaque section doit avoir une valeur informative standalone (extractable par les IA)
- Français belge naturel, vouvoiement
- Éviter les superlatifs vides et les phrases de remplissage
- Proposer des suggestions de liens internes vers les pages services et contact
- Toujours répondre en JSON valide — jamais de texte libre autour du JSON
- Ne jamais inclure de commentaires dans le JSON
- Le contenu doit être en markdown valide (H2 = ##, H3 = ###, listes, gras, etc.)`

/** Tone directives for blog writing */
const TONE_MAP: Record<SiteContext['tone'], string> = {
  friendly: 'accessible et bienveillant, comme un conseiller de confiance',
  professional: 'sérieux et documenté, ton d\'autorité naturelle',
  expert: 'technique et pédagogique, partage d\'expertise approfondie',
  dynamic: 'vif et concret, orienté solutions pratiques',
  premium: 'soigné et raffiné, positionnement haut de gamme',
}

/**
 * Build a blog article prompt for a given topic.
 * If no topic is provided, the AI will suggest a topic based on the business context.
 */
export function buildBlogArticlePrompt(context: SiteContext, topic?: string): string {
  const toneDirective = TONE_MAP[context.tone] ?? TONE_MAP.friendly
  const seasonInfo = context.currentSeason
    ? `\nSaison actuelle : ${context.currentSeason}`
    : ''
  const monthInfo = context.currentMonth
    ? `\nMois en cours : ${context.currentMonth}`
    : ''
  const previousInfo = context.previousContent?.length
    ? `\nArticles déjà publiés (éviter les sujets similaires) :\n${context.previousContent.map((c) => `- ${c}`).join('\n')}`
    : ''
  const topicDirective = topic
    ? `\nSUJET IMPOSÉ : ${topic}`
    : `\nPas de sujet imposé : choisis un sujet pertinent et à fort potentiel SEO local pour ce secteur à ${context.city}.`
  const websiteInfo = context.website
    ? `\nSite web : ${context.website}`
    : ''

  return `Rédige un article de blog SEO complet pour cette entreprise locale belge.

DONNÉES DE L'ENTREPRISE :
- Nom : ${context.businessName}
- Secteur : ${context.sector}
- Ville : ${context.city} (${context.zip})
- Description : ${context.description}
- Services : ${context.services.join(', ')}
- Avantage concurrentiel : ${context.uniqueSellingPoint}
- Public cible : ${context.targetAudience}
- Ton : ${toneDirective}
- Gamme de prix : ${context.priceRange}${websiteInfo}${seasonInfo}${monthInfo}${previousInfo}${topicDirective}

STRUCTURE ATTENDUE DE L'ARTICLE :
1. Titre H1 accrocheur incluant la ville et le mot-clé principal
2. Introduction TLDR-first (réponse directe en 2-3 phrases)
3. 4-6 sections H2 formulées comme des questions
4. Chaque section : 150-300 mots, valeur informative autonome
5. Section FAQ finale avec 4-6 questions/réponses courtes
6. Conclusion avec CTA

SUGGESTIONS DE LIENS INTERNES à inclure dans le contenu markdown :
- [Nos services](/services) — à placer quand un service est mentionné
- [Contactez-nous](/contact) — à placer dans la conclusion ou le CTA
- [En savoir plus sur notre entreprise](/a-propos) — à placer si pertinent

Génère un objet JSON avec exactement cette structure :
{
  "title": "string — H1 optimisé SEO, 50-70 chars, inclure ville + mot-clé principal",
  "slug": "string — URL slug en kebab-case, sans accents, max 60 chars",
  "excerpt": "string — résumé pour la meta et les cards, 150-160 chars",
  "content": "string — article complet en markdown, 1200-2500 mots, H2 comme questions, liens internes inclus",
  "faq": [
    {
      "question": "string — question réelle d'un client, inclure la ville dans au moins 2 questions",
      "answer": "string — réponse directe et complète en 40-80 mots"
    }
  ],
  "seo": {
    "metaTitle": "string — max 60 chars, mot-clé + ville + marque",
    "metaDescription": "string — max 160 chars, accrocheur, inclure ville et mot-clé"
  },
  "keywords": ["string — 5-8 mots-clés longue traîne pertinents, incluant des variantes locales"],
  "wordCount": 0
}

Le champ wordCount doit refléter le nombre réel de mots dans le champ content.
Génère exactement 5 questions FAQ.
La ville "${context.city}" doit apparaître au minimum 5 fois dans le contenu.`
}

/** Full prompt template for blog article generation */
export const blogArticleTemplate: PromptTemplate = {
  version: '1.0.0',
  model: 'claude-sonnet-4-6',
  maxTokens: 4096,
  system: blogArticleSystemPrompt,
  user: (context: SiteContext) => buildBlogArticlePrompt(context),
}
