// @wapixia/ai — Social media post prompts for Belgian SMBs

import type { PromptTemplate, SiteContext } from '../../types/prompt.js'

/** Tone mapping for social media writing style */
const TONE_MAP: Record<SiteContext['tone'], string> = {
  friendly: 'chaleureux et accessible, comme un voisin de confiance',
  professional: 'professionnel et sobre, inspirant confiance',
  expert: 'expert et pédagogique, partageant son savoir',
  dynamic: 'dynamique et moderne, engageant et percutant',
  premium: 'élégant et raffiné, évoquant le luxe accessible',
}

/** System prompt for social media content generation */
export const socialPostSystemPrompt = `Tu es un community manager expert spécialisé dans les PME belges.
Tu crées du contenu pour les réseaux sociaux (Facebook, Instagram, LinkedIn) qui génère de l'engagement et du trafic local.

Règles absolues :
- Toujours écrire à la 1ère personne du pluriel ("nous", "notre équipe", "chez nous")
- Facebook : maximum 280 mots par post
- Instagram : maximum 150 mots par post
- LinkedIn : maximum 200 mots par post
- Mentionner la ville dans au moins 30% des posts
- Chaque post doit se terminer par un call-to-action clair
- Utiliser des émojis avec parcimonie (2-4 par post maximum)
- Les hashtags doivent être pertinents et locaux (#NomVille #Secteur)
- Français belge naturel, vouvoiement
- Éviter les superlatifs vides et les promesses exagérées
- Toujours répondre en JSON valide — jamais de texte libre autour du JSON
- Ne jamais inclure de commentaires dans le JSON`

/** Post type descriptions for prompt context */
const POST_TYPE_CONTEXT: Record<string, string> = {
  educational: `Post ÉDUCATIF : partager un conseil, une astuce ou une information utile liée au secteur.
Objectif : positionner l'entreprise comme experte et apporter de la valeur au lecteur.
Structure : accroche avec question ou fait marquant > conseil concret > CTA vers le site ou les services.`,

  promotional: `Post PROMOTIONNEL : mettre en avant un service, une offre ou un avantage concurrentiel.
Objectif : générer des contacts et des demandes de devis/rendez-vous.
Structure : problème client > solution proposée > preuve sociale ou chiffre > CTA direct.
Attention : ne pas être trop vendeur, rester dans le conseil.`,

  engagement: `Post d'ENGAGEMENT : poser une question, lancer un sondage ou partager une anecdote de terrain.
Objectif : générer des commentaires, des partages et renforcer la communauté locale.
Structure : question ouverte ou anecdote > contexte local > invitation à répondre.`,

  seasonal: `Post SAISONNIER : contenu lié à la saison, un événement local ou une période spécifique.
Objectif : surfer sur l'actualité saisonnière pour rester pertinent et visible.
Structure : référence saisonnière > lien avec le secteur > conseil adapté > CTA.`,
}

/**
 * Build a social media post prompt for a given post type.
 * Valid post types: educational, promotional, engagement, seasonal
 */
export function buildSocialPostPrompt(context: SiteContext, postType: string): string {
  const toneDirective = TONE_MAP[context.tone] ?? TONE_MAP.friendly
  const typeContext = POST_TYPE_CONTEXT[postType] ?? POST_TYPE_CONTEXT.educational
  const seasonInfo = context.currentSeason
    ? `\nSaison actuelle : ${context.currentSeason}`
    : ''
  const monthInfo = context.currentMonth
    ? `\nMois en cours : ${context.currentMonth}`
    : ''
  const previousInfo = context.previousContent?.length
    ? `\nContenu déjà publié récemment (éviter les répétitions) :\n${context.previousContent.map((c) => `- ${c}`).join('\n')}`
    : ''

  return `Génère des posts pour les réseaux sociaux de cette entreprise.

DONNÉES DE L'ENTREPRISE :
- Nom : ${context.businessName}
- Secteur : ${context.sector}
- Ville : ${context.city} (${context.zip})
- Description : ${context.description}
- Services : ${context.services.join(', ')}
- Avantage concurrentiel : ${context.uniqueSellingPoint}
- Public cible : ${context.targetAudience}
- Ton : ${toneDirective}
- Langue : ${context.language === 'fr' ? 'français belge' : context.language === 'nl' ? 'néerlandais belge' : 'anglais'}${seasonInfo}${monthInfo}${previousInfo}

TYPE DE POST :
${typeContext}

Génère un objet JSON avec exactement cette structure :
{
  "posts": [
    {
      "platform": "facebook",
      "content": "string — post Facebook, max 280 mots, accrocheur, avec émojis modérés",
      "hashtags": ["string — 3-5 hashtags pertinents dont au moins 1 local"],
      "imageKeywords": ["string — 2-3 mots-clés pour générer une image illustrative"],
      "ctaText": "string — call-to-action final clair et actionnable"
    },
    {
      "platform": "instagram",
      "content": "string — post Instagram, max 150 mots, visuel et engageant",
      "hashtags": ["string — 5-10 hashtags dont 2 locaux"],
      "imageKeywords": ["string — 2-3 mots-clés pour l'image"],
      "ctaText": "string — call-to-action adapté à Instagram"
    },
    {
      "platform": "linkedin",
      "content": "string — post LinkedIn, max 200 mots, professionnel et informatif",
      "hashtags": ["string — 3-5 hashtags professionnels"],
      "imageKeywords": ["string — 2-3 mots-clés pour l'image"],
      "ctaText": "string — call-to-action B2B ou professionnel"
    }
  ]
}

Génère exactement 3 posts (1 par plateforme).
Le post Facebook doit mentionner la ville.
Chaque post doit avoir un angle légèrement différent sur le même sujet.`
}

/** Full prompt template for social post generation */
export const socialPostTemplate: PromptTemplate = {
  version: '1.0.0',
  model: 'claude-sonnet-4-6',
  maxTokens: 2048,
  system: socialPostSystemPrompt,
  user: (context: SiteContext) => buildSocialPostPrompt(context, 'educational'),
}
