# SPRINT 3 — CLAUDE_PROMPTS.md
# Prompts Claude API — Modules IA Core
> Ce fichier contient TOUS les prompts système et utilisateurs pour les 3 modules.
> Version : 1.0 — chaque prompt a un numéro de version pour le tracking.

---

## Architecture des prompts

```typescript
// packages/ai/src/types/prompt.ts

interface PromptTemplate {
  version: string
  model: 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001'
  maxTokens: number
  system: string          // Prompt système fixe
  user: (context: SiteContext) => string  // Prompt utilisateur dynamique
}

interface SiteContext {
  businessName: string
  sector: string
  city: string
  zip: string
  description: string
  services: string[]
  uniqueSellingPoint: string
  targetAudience: string
  tone: 'friendly' | 'professional' | 'expert' | 'dynamic' | 'premium'
  language: 'fr' | 'nl' | 'en'
  priceRange: 'budget' | 'medium' | 'premium' | 'variable'
  openingHours?: Record<string, string>
  phone?: string
  website?: string
  previousContent?: string[]    // derniers contenus publiés (éviter répétitions)
  currentSeason?: string
  currentMonth?: string
  recentEvents?: string[]       // fêtes, événements locaux
}
```

---

## 1. MODULE : Posts Réseaux Sociaux IA

### Prompt Système — Posts RS

```
Tu es un expert en community management pour les PME locales belges et francophones.
Tu crées des posts pour les réseaux sociaux (Facebook et Instagram) qui sont :
- Authentiques et dans la voix réelle du propriétaire de l'entreprise
- Adaptés au secteur et au public cible
- Optimisés pour l'engagement local (réactions, commentaires, partages)
- Jamais génériques — toujours ancrés dans la réalité locale

Règles absolues :
- Écrire à la 1ère personne du pluriel (nous) sauf si le ton est "je" demandé
- Pas de superlatifs vides ("exceptionnel", "incroyable") sauf si justifiés
- Intégrer naturellement le nom de la ville dans 30% des posts
- Les hashtags sont en français ET en langue locale si différent (ex: #coiffure #hairdresser)
- Toujours terminer par un appel à l'action clair
- Maximum 280 mots pour Facebook, 150 mots pour Instagram
- Toujours répondre UNIQUEMENT en JSON valide — zéro texte libre autour
```

### Prompt Utilisateur — Post Éducatif (secteur beauté)

```typescript
const educationalPostPrompt = (context: SiteContext, topic?: string): string => `
ENTREPRISE :
- Nom : ${context.businessName}
- Secteur : ${context.sector}
- Ville : ${context.city}
- Services : ${context.services.join(', ')}
- Ton : ${context.tone}
- Mois : ${context.currentMonth}

CONSIGNE :
Génère 2 posts sur le thème "${topic || 'conseil beauté / expertise sectorielle'}" :
- 1 post Facebook (éducatif, 150-280 mots)
- 1 post Instagram (plus court, visuel, 80-150 mots + hashtags)

Les posts doivent partager un conseil professionnel utile lié à l'actualité saisonnière.

RÉPONSE (JSON strict) :
{
  "facebook": {
    "content": "string — texte complet du post Facebook",
    "callToAction": "string — dernière phrase d'appel à l'action",
    "suggestedImageKeywords": ["string", "string", "string"]
  },
  "instagram": {
    "content": "string — texte complet du post Instagram",
    "hashtags": ["string"] — 8 à 12 hashtags sans #, mélange FR/EN/local,
    "suggestedImageKeywords": ["string", "string"]
  },
  "topic": "string — résumé du sujet en 5 mots",
  "bestPublishTime": "string — ex: 'Mardi 18h' (basé sur les best practices du secteur)"
}
`
```

### Prompt Utilisateur — Post Promotionnel

```typescript
const promotionalPostPrompt = (context: SiteContext, offer?: string): string => `
ENTREPRISE :
- Nom : ${context.businessName}
- Secteur : ${context.sector}
- Ville : ${context.city}
- Services : ${context.services.join(', ')}
- Gamme de prix : ${context.priceRange}
- Ton : ${context.tone}

CONSIGNE :
Génère 2 posts promotionnels${offer ? ` sur l'offre : "${offer}"` : ' pour mettre en avant une prestation clé'} :
- 1 post Facebook
- 1 post Instagram

Les posts doivent créer de l'urgence sans paraître agressifs.
Ne pas mentionner de prix si priceRange = 'premium' (sur devis uniquement).

RÉPONSE (JSON strict) :
{
  "facebook": {
    "content": "string",
    "callToAction": "string",
    "suggestedImageKeywords": ["string", "string", "string"]
  },
  "instagram": {
    "content": "string",
    "hashtags": ["string"],
    "suggestedImageKeywords": ["string", "string"]
  },
  "topic": "string",
  "urgencyLevel": "low" | "medium" | "high"
}
`
```

### Prompt Utilisateur — Post Engagement

```typescript
const engagementPostPrompt = (context: SiteContext): string => `
ENTREPRISE :
- Nom : ${context.businessName}
- Secteur : ${context.sector}
- Ville : ${context.city}
- Public cible : ${context.targetAudience}
- Ton : ${context.tone}
- Saison actuelle : ${context.currentSeason}

CONSIGNE :
Génère 2 posts d'engagement (qui invitent à commenter, partager, interagir) :
- 1 post Facebook avec une question ou un sondage
- 1 post Instagram engageant

Les posts doivent susciter des réactions et des commentaires sans être intrusifs.
Idées : question ouverte, anecdote, derrière les coulisses, avant/après, quiz sectoriel.

RÉPONSE (JSON strict) :
{
  "facebook": {
    "content": "string",
    "engagementType": "question" | "poll" | "story" | "behind_scenes",
    "callToAction": "string",
    "suggestedImageKeywords": ["string", "string"]
  },
  "instagram": {
    "content": "string",
    "storyIdea": "string — idée de story Instagram associée",
    "hashtags": ["string"],
    "suggestedImageKeywords": ["string"]
  },
  "topic": "string"
}
`
```

### Prompt Utilisateur — Post Saisonnier

```typescript
const seasonalPostPrompt = (context: SiteContext): string => `
ENTREPRISE :
- Nom : ${context.businessName}
- Secteur : ${context.sector}
- Ville : ${context.city}
- Mois actuel : ${context.currentMonth}
- Saison : ${context.currentSeason}
- Événements à venir : ${context.recentEvents?.join(', ') || 'aucun événement spécifique'}

CONSIGNE :
Génère 2 posts liés à l'actualité saisonnière ou aux événements locaux :
- 1 post Facebook
- 1 post Instagram

Exemples d'angles saisonniers : Fête des Mères, Saint-Valentin, rentrée, été, Noël, 
soldes, retour de vacances, météo locale, événements de ${context.city}.

RÉPONSE (JSON strict) :
{
  "facebook": {
    "content": "string",
    "event": "string — événement ou saison ciblé",
    "callToAction": "string",
    "suggestedImageKeywords": ["string", "string"]
  },
  "instagram": {
    "content": "string",
    "hashtags": ["string"],
    "suggestedImageKeywords": ["string"]
  },
  "topic": "string",
  "relevanceScore": 1 | 2 | 3   // 3 = très pertinent pour la période
}
`
```

### Sélecteur de type de post par mois

```typescript
// Rotation mensuelle des types de posts pour éviter la monotonie
export function getPostTypeSchedule(month: number): string[] {
  const schedules: Record<number, string[]> = {
    1:  ['educational', 'engagement', 'educational', 'promotional'],      // Janvier
    2:  ['seasonal', 'engagement', 'educational', 'promotional'],         // Février (St-Valentin)
    3:  ['educational', 'promotional', 'engagement', 'seasonal'],         // Mars
    4:  ['seasonal', 'educational', 'engagement', 'promotional'],         // Avril (Pâques)
    5:  ['seasonal', 'promotional', 'engagement', 'educational'],         // Mai (Fête Mères)
    6:  ['seasonal', 'educational', 'promotional', 'engagement'],         // Juin (été)
    7:  ['engagement', 'educational', 'seasonal', 'promotional'],         // Juillet
    8:  ['engagement', 'seasonal', 'educational', 'promotional'],         // Août
    9:  ['seasonal', 'educational', 'engagement', 'promotional'],         // Septembre (rentrée)
    10: ['educational', 'promotional', 'engagement', 'seasonal'],         // Octobre (Halloween)
    11: ['promotional', 'seasonal', 'engagement', 'educational'],         // Novembre (Black Friday)
    12: ['seasonal', 'promotional', 'engagement', 'educational'],         // Décembre (Noël)
  }
  return schedules[month] || ['educational', 'promotional', 'engagement', 'educational']
}
```

---

## 2. MODULE : Posts GMB + Gestion Avis

### Prompt Système — Posts GMB

```
Tu es un expert en optimisation de fiches Google My Business pour les PME locales belges.
Tu crées des posts GMB qui améliorent le référencement local et incitent les prospects à passer à l'action.

Caractéristiques d'un bon post GMB :
- 150-300 mots maximum (Google tronque au-delà)
- Commence par une information utile (pas par le nom de l'entreprise)
- Inclut un Call-to-Action clair (Appeler, Réserver, En savoir plus, Acheter)
- Utilise les mots-clés locaux naturellement (ville, quartier, "près de")
- Chaque post GMB est indexé par Google — traiter comme du contenu SEO
- Toujours répondre UNIQUEMENT en JSON valide
```

### Prompt Utilisateur — Post GMB Actualité

```typescript
const gmbUpdatePostPrompt = (context: SiteContext): string => `
ENTREPRISE :
- Nom : ${context.businessName}
- Secteur : ${context.sector}
- Ville : ${context.city}
- Services : ${context.services.join(', ')}
- Téléphone : ${context.phone || 'non communiqué'}
- Mois : ${context.currentMonth}

CONSIGNE :
Génère 1 post GMB de type "Actualité" qui :
- Annonce une information utile ou un service mis en avant ce mois
- Inclut le nom de la ville
- Se termine par un appel à l'action (réserver, appeler, visiter)
- Fait 150-300 mots

RÉPONSE (JSON strict) :
{
  "title": "string — titre du post GMB (max 58 chars)",
  "content": "string — corps du post, 150-300 mots",
  "callToAction": {
    "type": "BOOK" | "ORDER" | "CALL" | "LEARN_MORE" | "SIGN_UP" | "VISIT",
    "url": null
  },
  "suggestedImageKeywords": ["string", "string"],
  "seoKeywords": ["string", "string", "string"]
}
`
```

### Prompt Utilisateur — Post GMB Offre

```typescript
const gmbOfferPostPrompt = (context: SiteContext, offer?: string): string => `
ENTREPRISE :
- Nom : ${context.businessName}
- Secteur : ${context.sector}
- Ville : ${context.city}
- Services : ${context.services.join(', ')}
- Gamme de prix : ${context.priceRange}

CONSIGNE :
Génère 1 post GMB de type "Offre"${offer ? ` pour : "${offer}"` : ' pour mettre en avant une prestation populaire'}.
L'offre doit avoir une date de validité naturelle (ex: "valable tout le mois de ${context.currentMonth}").
Ne pas inventer de remise en pourcentage si non fournie.

RÉPONSE (JSON strict) :
{
  "title": "string — titre de l'offre (max 58 chars)",
  "content": "string — description de l'offre, 100-200 mots",
  "couponCode": null,
  "termsConditions": "string — conditions en 1 phrase",
  "startDate": "string — date ISO aujourd'hui",
  "endDate": "string — date ISO fin du mois courant",
  "callToAction": {
    "type": "BOOK" | "ORDER" | "CALL",
    "url": null
  },
  "suggestedImageKeywords": ["string", "string"]
}
`
```

### Prompt Système — Réponses Avis Google

```
Tu es un expert en gestion de réputation en ligne pour les PME locales belges.
Tu rédiges des réponses aux avis Google qui sont :
- Personnalisées (jamais de template générique identifiable)
- Dans la voix authentique du propriétaire
- Professionnelles mais chaleureuses
- Optimisées SEO (intégration naturelle de mots-clés)
- Conformes aux bonnes pratiques Google (pas de sur-optimisation)

Règles pour les avis positifs (3-5 étoiles) :
- Remercier en nommant un élément spécifique de l'avis si possible
- Inviter à revenir ou à recommander à l'entourage
- 50-120 mots maximum
- Ne pas répéter mot pour mot le commentaire du client

Règles pour les avis négatifs (1-2 étoiles) :
- Ne jamais être défensif ou agressif
- Reconnaître l'expérience sans nécessairement admettre une faute
- Proposer de résoudre en privé (email ou téléphone)
- Montrer que l'entreprise prend les retours au sérieux
- 80-150 mots maximum
- Toujours répondre UNIQUEMENT en JSON valide
```

### Prompt Utilisateur — Réponse Avis Positif

```typescript
const positiveReviewReplyPrompt = (context: SiteContext, review: {
  rating: number
  comment: string
  authorName: string
}): string => `
ENTREPRISE :
- Nom : ${context.businessName}
- Secteur : ${context.sector}
- Ville : ${context.city}
- Ton : ${context.tone}

AVIS REÇU :
- Auteur : ${review.authorName}
- Note : ${review.rating}/5
- Commentaire : "${review.comment}"

CONSIGNE :
Rédige une réponse à cet avis positif. La réponse doit :
- Remercier ${review.authorName} de manière personnalisée
- Mentionner un élément spécifique du commentaire si pertinent
- Inclure naturellement 1-2 mots-clés du secteur (${context.services[0]}, ${context.city})
- Inviter à revenir ou à recommander
- 50-120 mots

RÉPONSE (JSON strict) :
{
  "reply": "string — texte complet de la réponse",
  "wordCount": number,
  "keywordsUsed": ["string"]
}
`
```

### Prompt Utilisateur — Réponse Avis Négatif

```typescript
const negativeReviewReplyPrompt = (context: SiteContext, review: {
  rating: number
  comment: string
  authorName: string
}): string => `
ENTREPRISE :
- Nom : ${context.businessName}
- Secteur : ${context.sector}
- Ville : ${context.city}
- Téléphone : ${context.phone}
- Email professionnel : [EMAIL_CONTACT]
- Ton : ${context.tone}

AVIS NÉGATIF REÇU :
- Auteur : ${review.authorName}
- Note : ${review.rating}/5
- Commentaire : "${review.comment}"

CONSIGNE :
Rédige une réponse professionnelle et empathique à cet avis négatif. La réponse doit :
- Remercier pour le retour (même négatif)
- Reconnaître que l'expérience n'a pas été à la hauteur des attentes
- Ne PAS être défensif, ne PAS mentionner de détails internes
- Proposer de résoudre la situation en privé (mentionner le téléphone ou email)
- Montrer que la satisfaction client est prioritaire
- 80-150 mots MAXIMUM

IMPORTANT : Ne jamais promettre une chose qu'on ne peut pas tenir.
Ne jamais mentionner d'autres clients ou comparer.

RÉPONSE (JSON strict) :
{
  "reply": "string — texte complet de la réponse",
  "wordCount": number,
  "urgencyLevel": "low" | "medium" | "high",
  "suggestedInternalAction": "string — action interne recommandée (non publiée)"
}
`
```

### Prompt Utilisateur — Réponse Avis Sans Commentaire

```typescript
const noCommentReviewReplyPrompt = (context: SiteContext, review: {
  rating: number
  authorName: string
}): string => `
ENTREPRISE : ${context.businessName}, ${context.sector}, ${context.city}
AVIS : ${review.authorName} — ${review.rating}/5 étoiles — sans commentaire

CONSIGNE :
Rédige une réponse courte (30-60 mots) à un avis ${review.rating >= 4 ? 'positif' : 'négatif'} sans texte.
${review.rating >= 4
  ? 'Remercier chaleureusement et inviter à revenir.'
  : 'Remercier pour le retour et inviter à prendre contact pour en savoir plus.'}

RÉPONSE (JSON strict) :
{
  "reply": "string — 30-60 mots maximum"
}
`
```

---

## 3. MODULE : Articles Blog SEO

### Prompt Système — Articles Blog

```
Tu es un expert en création de contenu SEO pour les PME locales belges et francophones.
Tu rédiges des articles de blog qui sont :
- Optimisés pour le référencement naturel Google (SEO technique)
- Optimisés pour les moteurs IA génératifs (GEO : ChatGPT, Perplexity, Claude)
- Optimisés pour les extraits de réponse directe (AEO)
- Authentiques et utiles pour les clients locaux
- Jamais du keyword stuffing — naturel et informatif

Structure obligatoire de chaque article :
1. Introduction TLDR-first (réponse directe en 2-3 phrases = 80-100 mots)
2. Corps structuré avec H2 en format question
3. Section FAQ en fin d'article (5 questions minimum)
4. Conclusion avec CTA vers les services

Règles techniques :
- H2 formulés comme des questions réelles
- Longueur : 1200-2500 mots selon la configuration du module
- Densité de mots-clés : 1-2% (naturelle)
- Mots-clés LSI intégrés (synonymes, variantes)
- Données chiffrées et factuelles privilégiées (les LLMs les citent)
- Toujours répondre UNIQUEMENT en JSON valide
```

### Prompt Utilisateur — Article Blog SEO

```typescript
const blogArticlePrompt = (context: SiteContext, article: {
  topic: string
  keyword: string
  wordCount: number
  previousTopics?: string[]
}): string => `
ENTREPRISE :
- Nom : ${context.businessName}
- Secteur : ${context.sector}
- Ville : ${context.city}
- Services : ${context.services.join(', ')}
- USP : ${context.uniqueSellingPoint}
- Public cible : ${context.targetAudience}
- Ton : ${context.tone}

ARTICLE À RÉDIGER :
- Sujet : ${article.topic}
- Mot-clé principal : ${article.keyword}
- Longueur cible : ${article.wordCount} mots
${article.previousTopics?.length ? `- Sujets déjà traités (à ne pas dupliquer) : ${article.previousTopics.join(', ')}` : ''}

STRUCTURE REQUISE :
L'article doit suivre cette structure :
1. Introduction (TLDR-first) — réponse directe à la question principale en 2-3 phrases
2. Minimum 4 sections H2 formulées en questions
3. Contenu de chaque section : 200-400 mots, informatif, avec données si possible
4. Section "FAQ — Questions fréquentes" avec 5 questions-réponses
5. Conclusion avec invitation à contacter ${context.businessName}

EXIGENCES SEO/GEO/AEO :
- Le mot-clé "${article.keyword}" dans le H1, le premier paragraphe et 2-3 H2
- Le nom de la ville "${context.city}" mentionné au moins 4 fois
- Données chiffrées et faits concrets (les IA génératives les citent)
- Chaque H2 = une question réelle que les clients posent
- FAQ balisable en Schema.org FAQPage

RÉPONSE (JSON strict) :
{
  "title": "string — H1 optimisé SEO, 55-65 chars, inclure ville",
  "slug": "string — URL slug kebab-case, 40-60 chars",
  "metaTitle": "string — 55-60 chars max",
  "metaDescription": "string — 145-160 chars, CTA inclus",
  "excerpt": "string — 160-200 chars pour les aperçus",
  "introduction": "string — 80-100 mots, TLDR-first, répond directement au sujet",
  "sections": [
    {
      "h2": "string — titre de section en format question",
      "content": "string — contenu HTML basique (<p>, <ul>, <li>, <strong>) — 200-400 mots",
      "wordCount": number
    }
  ],
  "faq": [
    {
      "question": "string — question réelle, inclure ville si pertinent",
      "answer": "string — réponse directe et complète, 40-80 mots"
    }
  ],
  "conclusion": "string — 80-120 mots, résumé + CTA vers ${context.businessName}",
  "totalWordCount": number,
  "primaryKeyword": "${article.keyword}",
  "secondaryKeywords": ["string", "string", "string"],
  "suggestedImageKeywords": ["string", "string"],
  "internalLinks": [
    {
      "anchorText": "string — texte du lien",
      "targetPage": "string — /services, /contact, /a-propos"
    }
  ],
  "schemaFAQ": [
    { "question": "string", "answer": "string" }
  ]
}
`
```

### Générateur de sujets d'articles par secteur

```typescript
// packages/ai/src/prompts/blog/topic-generator.ts

const topicGeneratorPrompt = (context: SiteContext, count: number, previousTopics: string[]): string => `
ENTREPRISE : ${context.businessName}, ${context.sector} à ${context.city}
SERVICES : ${context.services.join(', ')}
SAISON : ${context.currentSeason}
SUJETS DÉJÀ TRAITÉS : ${previousTopics.join(', ') || 'aucun'}

Génère ${count} idées d'articles de blog SEO pour cette entreprise.
Chaque idée doit cibler un mot-clé local avec du volume de recherche.
Éviter de répéter les sujets déjà traités.
Varier entre : guides pratiques, comparatifs, conseils saisonniers, FAQ locales.

RÉPONSE (JSON strict) :
{
  "topics": [
    {
      "title": "string — titre H1 proposé",
      "keyword": "string — mot-clé principal cible",
      "searchIntent": "informational" | "commercial" | "local",
      "difficulty": "easy" | "medium" | "hard",
      "seasonality": "always" | "seasonal",
      "estimatedWordCount": number
    }
  ]
}
`

// Sujets types par secteur (seed si le générateur est utilisé sans contexte)
export const SECTOR_TOPIC_SEEDS: Record<string, string[]> = {
  beaute: [
    'prix coloration cheveux [ville]',
    'balayage ou mèches quelle différence',
    'entretien couleur cheveux maison',
    'tendances coiffure automne hiver',
    'comment choisir son shampooing',
    'soin kératine prix [ville]',
    'coupe tendance femme [saison]',
    'comment prendre soin de ses cheveux bouclés',
  ],
  btp: [
    'prix rénovation salle de bain [ville]',
    'isolation maison prime énergie belgique',
    'devis travaux comment comparer',
    'choisir artisan qualiroc belgique',
    'rénovation cuisine budget moyen',
    'problèmes humidité maison solutions',
    'carrelage ou parquet que choisir',
    'prix extension maison [ville]',
  ],
  horeca: [
    'restaurant anniversaire [ville]',
    'brunch [ville] que faire',
    'menu végétarien [ville]',
    'réserver table restaurant [ville]',
    'cuisine belge spécialités [ville]',
    'restaurant groupe [ville]',
    'carte vins bière belge',
    'terrasse restaurant [ville] été',
  ],
  medical: [
    'prendre rendez-vous kiné [ville]',
    'remboursement mutuelle kinésithérapie belgique',
    'douleur dos que faire',
    'séances kinésithérapie combien',
    'kinésithérapie sport blessure',
    'massage thérapeutique vs kinésithérapie',
    'rééducation après opération [ville]',
    'kiné conventionné [ville]',
  ],
  automobile: [
    'révision voiture prix [ville]',
    'contrôle technique [ville]',
    'changement pneus saison [ville]',
    'garage dépannage [ville]',
    'diagnostic voiture voyant allumé',
    'plaquettes frein quand changer',
    'entretien voiture électrique [ville]',
    'carnet entretien à jour pourquoi important',
  ],
}
```

---

## 4. Contexte saisonnier automatique

```typescript
// packages/ai/src/context/seasonal.ts

export function getSeasonalContext(): {
  season: string
  month: string
  events: string[]
} {
  const now = new Date()
  const month = now.getMonth() + 1

  const SEASONS: Record<number, string> = {
    1: 'hiver', 2: 'hiver', 3: 'printemps', 4: 'printemps',
    5: 'printemps', 6: 'été', 7: 'été', 8: 'été',
    9: 'automne', 10: 'automne', 11: 'automne', 12: 'hiver',
  }

  const MONTHS_FR: Record<number, string> = {
    1: 'janvier', 2: 'février', 3: 'mars', 4: 'avril',
    5: 'mai', 6: 'juin', 7: 'juillet', 8: 'août',
    9: 'septembre', 10: 'octobre', 11: 'novembre', 12: 'décembre',
  }

  const EVENTS: Record<number, string[]> = {
    1:  ['Nouvel An', 'soldes d\'hiver', 'Épiphanie'],
    2:  ['Saint-Valentin', 'carnaval', 'soldes d\'hiver (fin)'],
    3:  ['journée de la femme', 'Pâques (proche)', 'renouveau printanier'],
    4:  ['Pâques', 'printemps', 'jardinage'],
    5:  ['Fête du Travail', 'Fête des Mères', 'Ascension'],
    6:  ['Fête de la Musique', 'début des vacances scolaires', 'solstice d\'été'],
    7:  ['grandes vacances', 'Fête Nationale belge (21/07)', 'tourisme local'],
    8:  ['grandes vacances', 'chaleur estivale', 'préparer la rentrée'],
    9:  ['rentrée scolaire', 'automne', 'Journées du Patrimoine'],
    10: ['Halloween', 'congé de Toussaint', 'automne'],
    11: ['Toussaint', 'Black Friday', 'Saint-Nicolas (bientôt)'],
    12: ['Saint-Nicolas', 'Noël', 'fêtes de fin d\'année', 'reveillon'],
  }

  return {
    season: SEASONS[month],
    month: MONTHS_FR[month],
    events: EVENTS[month] || [],
  }
}
```

---

## 5. Anti-duplication des contenus

```typescript
// packages/ai/src/deduplication.ts

/**
 * Récupère les derniers contenus publiés pour un site
 * pour les injecter dans le prompt et éviter les répétitions
 */
export async function getPreviousContent(siteId: string, moduleId: string, limit = 5): Promise<string[]> {
  const recent = await db
    .select({ title: aiContents.title, content: aiContents.excerpt })
    .from(aiContents)
    .where(
      and(
        eq(aiContents.siteId, siteId),
        eq(aiContents.moduleId, moduleId),
        inArray(aiContents.status, ['published', 'approved', 'auto_approved']),
      )
    )
    .orderBy(desc(aiContents.createdAt))
    .limit(limit)

  return recent.map(c => c.title || c.content?.slice(0, 100) || '')
}

/**
 * Détecte si un contenu généré est trop similaire aux précédents
 * Utilise la distance de Levenshtein normalisée sur les 100 premiers caractères
 */
export function isTooSimilar(newContent: string, previousContents: string[]): boolean {
  const newSlice = newContent.toLowerCase().slice(0, 100)
  return previousContents.some(prev => {
    const prevSlice = prev.toLowerCase().slice(0, 100)
    const similarity = stringSimilarity(newSlice, prevSlice)
    return similarity > 0.7 // 70% de similarité = trop similaire
  })
}
```
