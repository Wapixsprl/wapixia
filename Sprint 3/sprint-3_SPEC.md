# SPRINT 3 — SPEC.md
# Modules IA Core — Posts RS, GMB & Avis, Blog SEO
> Durée : 2 semaines | Début : Semaine 5
> Objectif : les 3 premiers modules à 10€/mois opérationnels en production

---

## Contexte pour Claude Code

Lire en premier (ordre obligatoire) :
1. `docs/ARCHITECTURE.md`
2. `docs/DATABASE.md` — sections 2.4, 2.5, 2.6
3. `docs/CONVENTIONS.md`
4. `docs/ENV.md` — sections Google, Meta, Claude API, Redis/BullMQ
5. `docs/sprints/sprint-1/SPEC.md` — auth en place
6. `docs/sprints/sprint-2/SPEC.md` — sites et CMS en place
7. `docs/sprints/sprint-3/SPEC.md` — ce fichier
8. `docs/sprints/sprint-3/CLAUDE_PROMPTS.md` — tous les prompts IA
9. `docs/sprints/sprint-3/BULLMQ_JOBS.md` — architecture des jobs

Sprint 1 et 2 terminés. Les sites sont générés et déployés. Ce sprint ajoute la couche IA active — celle qui tourne chaque jour sans intervention du client.

---

## 1. Périmètre du sprint

### Dans ce sprint ✅
- Module **Posts GMB + Gestion Avis Google** (10€/mois)
- Module **Posts Réseaux Sociaux IA** (10€/mois)
- Module **Articles Blog SEO** (10€/mois)
- Interface backoffice : liste des contenus en attente de validation
- Interface backoffice : aperçu, approbation, rejet des contenus
- Mode auto-publication (sans validation)
- Alertes email avis négatifs (≤ 2 étoiles)
- Sync des avis Google depuis GMB API (polling toutes les 4h)
- Connexion Meta Graph API (Facebook + Instagram)
- Tracking des tokens Claude utilisés par site/mois
- Scheduler cron — planification des publications

### Hors sprint ❌
- Visuels IA (Stable Diffusion) → V2, Unsplash en V1
- LinkedIn, YouTube, TikTok, Pinterest → V2 (Facebook + Instagram uniquement en V1)
- Paiement des modules → Sprint 5
- Dashboard métriques → Sprint 4
- WhatsApp, eIDAS, PWA → V2

---

## 2. Migrations BDD Sprint 3

### Migration 008 — Tables modules complètes

```sql
-- packages/db/migrations/20260331_008_modules_complete.sql

-- Catalogue des modules (données seed)
CREATE TABLE IF NOT EXISTS module_catalog (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  price_monthly   DECIMAL(10,2) NOT NULL,
  category        TEXT NOT NULL CHECK (category IN (
    'content', 'reputation', 'acquisition', 'conversion', 'analytics', 'technical'
  )),
  is_active       BOOLEAN DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0
);

INSERT INTO module_catalog VALUES
  ('gmb_reviews',  'Posts GMB + Gestion Avis Google', 'Posts GMB hebdo + réponses IA aux avis', 10.00, 'reputation', 1),
  ('social_posts', 'Posts Réseaux Sociaux IA',        '12-20 posts/mois sur Facebook et Instagram', 10.00, 'content', 2),
  ('blog_seo',     'Articles Blog SEO',               '8 articles/mois, SEO+GEO+AEO optimisés', 10.00, 'content', 3)
ON CONFLICT (id) DO NOTHING;

-- Modules activés par site
CREATE TABLE IF NOT EXISTS site_modules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  module_id       TEXT NOT NULL REFERENCES module_catalog(id),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'paused', 'cancelled'
  )),
  config          JSONB DEFAULT '{}',
  activated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(site_id, module_id)
);

CREATE INDEX idx_site_modules_site   ON site_modules(site_id);
CREATE INDEX idx_site_modules_module ON site_modules(module_id);
CREATE INDEX idx_site_modules_status ON site_modules(status);

ALTER TABLE site_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_modules_rls" ON site_modules FOR ALL USING (
  site_id IN (
    SELECT id FROM sites WHERE organization_id = auth.organization_id()
    OR organization_id IN (
      SELECT id FROM organizations WHERE parent_id = auth.organization_id()
    )
  )
  OR auth.is_superadmin()
);
```

### Migration 009 — Contenus IA

```sql
-- packages/db/migrations/20260331_009_ai_contents.sql

CREATE TABLE ai_contents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  module_id       TEXT NOT NULL REFERENCES module_catalog(id),

  type            TEXT NOT NULL CHECK (type IN (
    'blog_article', 'social_post', 'gmb_post',
    'review_reply', 'seo_meta', 'faq'
  )),
  platform        TEXT CHECK (platform IN (
    'facebook', 'instagram', 'gmb', 'blog', 'linkedin', 'tiktok'
  )),

  -- Contenu
  title           TEXT,
  content         TEXT NOT NULL,
  excerpt         TEXT,                    -- résumé pour les articles blog
  visual_url      TEXT,                    -- URL Unsplash ou R2 (V2)
  visual_alt      TEXT,
  hashtags        TEXT[],                  -- pour les posts sociaux
  metadata        JSONB DEFAULT '{}',      -- données SEO, tags, données additionnelles

  -- Traçabilité IA
  prompt_version  TEXT NOT NULL DEFAULT '1.0',
  model_used      TEXT NOT NULL,
  tokens_input    INTEGER DEFAULT 0,
  tokens_output   INTEGER DEFAULT 0,
  generation_cost DECIMAL(8,4) DEFAULT 0, -- coût en € calculé

  -- Workflow validation
  status          TEXT NOT NULL DEFAULT 'pending_validation' CHECK (status IN (
    'pending_validation',
    'approved',
    'auto_approved',
    'rejected',
    'published',
    'publish_failed',
    'archived'
  )),
  auto_publish    BOOLEAN DEFAULT FALSE,   -- si true, pas de validation requise
  rejection_note  TEXT,
  validated_by    UUID REFERENCES users(id),
  validated_at    TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  scheduled_for   TIMESTAMPTZ,            -- publication planifiée
  publish_error   TEXT,                   -- message d'erreur si publish_failed

  -- Référence externe post-publication
  external_id     TEXT,                   -- ID du post sur la plateforme (ex: Facebook post ID)
  external_url    TEXT,                   -- URL du post publié

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_contents_site      ON ai_contents(site_id);
CREATE INDEX idx_ai_contents_module    ON ai_contents(module_id);
CREATE INDEX idx_ai_contents_status    ON ai_contents(status);
CREATE INDEX idx_ai_contents_type      ON ai_contents(type);
CREATE INDEX idx_ai_contents_scheduled ON ai_contents(scheduled_for)
  WHERE scheduled_for IS NOT NULL AND status IN ('approved', 'auto_approved');
CREATE INDEX idx_ai_contents_platform  ON ai_contents(platform);

ALTER TABLE ai_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_contents_rls" ON ai_contents FOR ALL USING (
  site_id IN (
    SELECT id FROM sites WHERE organization_id = auth.organization_id()
    OR organization_id IN (
      SELECT id FROM organizations WHERE parent_id = auth.organization_id()
    )
  )
  OR auth.is_superadmin()
);
```

### Migration 010 — Avis Google

```sql
-- packages/db/migrations/20260331_010_google_reviews.sql

CREATE TABLE google_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

  gmb_review_id   TEXT UNIQUE NOT NULL,
  author_name     TEXT NOT NULL,
  author_photo    TEXT,
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  review_date     TIMESTAMPTZ NOT NULL,

  -- Réponse
  reply_content   TEXT,
  reply_status    TEXT DEFAULT 'pending' CHECK (reply_status IN (
    'no_comment',    -- avis sans texte — pas de réponse nécessaire
    'pending',       -- en attente de génération
    'generated',     -- réponse générée, en attente validation
    'validated',     -- validée, prête à publier
    'published',     -- publiée sur GMB
    'skipped'        -- ignorée manuellement
  )),
  ai_content_id   UUID REFERENCES ai_contents(id),
  published_at    TIMESTAMPTZ,

  -- Alertes
  is_negative     BOOLEAN GENERATED ALWAYS AS (rating <= 2) STORED,
  alert_sent      BOOLEAN DEFAULT FALSE,
  alert_sent_at   TIMESTAMPTZ,

  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_site     ON google_reviews(site_id);
CREATE INDEX idx_reviews_rating   ON google_reviews(rating);
CREATE INDEX idx_reviews_status   ON google_reviews(reply_status);
CREATE INDEX idx_reviews_negative ON google_reviews(is_negative)
  WHERE is_negative = TRUE;
CREATE INDEX idx_reviews_alert    ON google_reviews(alert_sent)
  WHERE alert_sent = FALSE AND is_negative = TRUE;

ALTER TABLE google_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_rls" ON google_reviews FOR ALL USING (
  site_id IN (
    SELECT id FROM sites WHERE organization_id = auth.organization_id()
    OR organization_id IN (
      SELECT id FROM organizations WHERE parent_id = auth.organization_id()
    )
  )
  OR auth.is_superadmin()
);
```

### Migration 011 — Config réseaux sociaux par site

```sql
-- packages/db/migrations/20260331_011_social_accounts.sql

CREATE TABLE social_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL CHECK (platform IN (
    'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'gmb'
  )),

  -- Auth tokens (chiffrés au niveau application)
  access_token    TEXT,
  refresh_token   TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Identifiants plateforme
  platform_user_id   TEXT,
  platform_page_id   TEXT,               -- pour Facebook Pages
  platform_username  TEXT,
  platform_name      TEXT,

  status          TEXT DEFAULT 'active' CHECK (status IN (
    'active', 'expired', 'revoked', 'error'
  )),
  last_error      TEXT,
  last_used_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(site_id, platform)
);

CREATE INDEX idx_social_accounts_site ON social_accounts(site_id);

ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_accounts_rls" ON social_accounts FOR ALL USING (
  site_id IN (
    SELECT id FROM sites WHERE organization_id = auth.organization_id()
  )
  OR auth.is_superadmin()
);
```

### Migration 012 — Tracking tokens Claude

```sql
-- packages/db/migrations/20260331_012_token_usage.sql

CREATE TABLE token_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id),
  module_id       TEXT NOT NULL REFERENCES module_catalog(id),

  period_year     INTEGER NOT NULL,
  period_month    INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),

  tokens_input    BIGINT DEFAULT 0,
  tokens_output   BIGINT DEFAULT 0,
  api_calls       INTEGER DEFAULT 0,
  total_cost_eur  DECIMAL(8,4) DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(site_id, module_id, period_year, period_month)
);

CREATE INDEX idx_token_usage_site   ON token_usage(site_id);
CREATE INDEX idx_token_usage_period ON token_usage(period_year, period_month);
```

---

## 3. Architecture des services

### 3.1 Service Google My Business

```typescript
// packages/api/src/services/gmb.service.ts

export class GMBService {
  private oauth2Client: OAuth2Client

  /**
   * Synchronise les avis depuis l'API GMB
   * Appelé toutes les 4h par le cron
   */
  async syncReviews(siteId: string): Promise<void> {
    const site = await getSiteWithGoogleToken(siteId)
    const reviews = await this.fetchReviewsFromGMB(site.gmbLocationId)

    for (const review of reviews) {
      await db.insert(googleReviews)
        .values({
          siteId,
          gmbReviewId: review.reviewId,
          authorName: review.reviewer.displayName,
          rating: review.starRating,
          comment: review.comment,
          reviewDate: new Date(review.createTime),
        })
        .onConflictDoUpdate({
          target: googleReviews.gmbReviewId,
          set: { comment: review.comment, synced_at: new Date() }
        })
    }

    // Déclencher génération de réponses pour les nouveaux avis
    const unanswered = await getUnansweredReviews(siteId)
    for (const review of unanswered) {
      await reviewReplyQueue.add('generate-reply', { siteId, reviewId: review.id })
    }
  }

  /**
   * Publie une réponse à un avis sur GMB
   */
  async publishReply(siteId: string, gmbReviewId: string, reply: string): Promise<void> {
    const token = await getGoogleToken(siteId)
    await this.oauth2Client.setCredentials(token)

    await this.gmb.accounts.locations.reviews.updateReply({
      name: `accounts/-/locations/-/reviews/${gmbReviewId}`,
      requestBody: { comment: reply }
    })
  }

  /**
   * Publie un post GMB
   */
  async publishGMBPost(siteId: string, content: {
    summary: string
    callToAction?: { actionType: string; url: string }
    mediaUrl?: string
  }): Promise<string> {
    // Retourne l'ID du post créé
  }
}
```

### 3.2 Service Meta (Facebook + Instagram)

```typescript
// packages/api/src/services/meta.service.ts

export class MetaService {
  private readonly API_VERSION = 'v21.0'
  private readonly BASE_URL = `https://graph.facebook.com/${this.API_VERSION}`

  /**
   * Publie sur une Page Facebook
   */
  async publishFacebookPost(params: {
    pageId: string
    accessToken: string
    message: string
    imageUrl?: string
    scheduledPublishTime?: Date
  }): Promise<{ postId: string; postUrl: string }> {
    const endpoint = `${this.BASE_URL}/${params.pageId}/feed`

    const body: Record<string, unknown> = {
      message: params.message,
      access_token: params.accessToken,
    }

    if (params.imageUrl) {
      // Upload photo puis créer le post avec la photo
      const photoId = await this.uploadPhoto(params.pageId, params.imageUrl, params.accessToken)
      body.attached_media = [{ media_fbid: photoId }]
    }

    if (params.scheduledPublishTime) {
      body.published = false
      body.scheduled_publish_time = Math.floor(params.scheduledPublishTime.getTime() / 1000)
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    if (data.error) throw new MetaAPIError(data.error)

    return {
      postId: data.id,
      postUrl: `https://www.facebook.com/${data.id}`
    }
  }

  /**
   * Publie sur Instagram via l'API Instagram Graph
   */
  async publishInstagramPost(params: {
    igUserId: string
    accessToken: string
    imageUrl: string
    caption: string
  }): Promise<{ postId: string }> {
    // Étape 1 : Créer un container média
    const containerRes = await fetch(
      `${this.BASE_URL}/${params.igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: params.imageUrl,
          caption: params.caption,
          access_token: params.accessToken,
        })
      }
    )
    const container = await containerRes.json()

    // Étape 2 : Publier le container
    const publishRes = await fetch(
      `${this.BASE_URL}/${params.igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: container.id,
          access_token: params.accessToken,
        })
      }
    )
    const published = await publishRes.json()
    return { postId: published.id }
  }

  /**
   * Valide qu'un token est valide et retourne les infos de la page
   */
  async validatePageToken(pageAccessToken: string): Promise<{
    pageId: string
    pageName: string
    igUserId: string | null
  }> {
    const res = await fetch(
      `${this.BASE_URL}/me?fields=id,name,instagram_business_account&access_token=${pageAccessToken}`
    )
    const data = await res.json()
    return {
      pageId: data.id,
      pageName: data.name,
      igUserId: data.instagram_business_account?.id ?? null,
    }
  }
}
```

### 3.3 Service Unsplash (images V1)

```typescript
// packages/api/src/services/unsplash.service.ts

export class UnsplashService {
  private readonly BASE_URL = 'https://api.unsplash.com'

  /**
   * Retourne une image appropriée au secteur et au contenu du post
   */
  async getImageForPost(params: {
    sector: string
    keywords: string[]
    orientation?: 'landscape' | 'portrait' | 'squarish'
  }): Promise<{
    url: string        // URL optimisée (1080px)
    thumbUrl: string   // Miniature
    altText: string
    attribution: string // "Photo by X on Unsplash" (obligation légale)
    photographerUrl: string
  }> {
    const query = this.buildUnsplashQuery(params.sector, params.keywords)

    const response = await fetch(
      `${this.BASE_URL}/search/photos?query=${encodeURIComponent(query)}&orientation=${params.orientation || 'landscape'}&per_page=10&content_filter=high`,
      { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
    )

    const data = await response.json()
    const photo = data.results[Math.floor(Math.random() * Math.min(5, data.results.length))]

    // Trigger download (obligation Unsplash API)
    await this.triggerDownload(photo.links.download_location)

    return {
      url: `${photo.urls.raw}&w=1080&q=80&fm=webp`,
      thumbUrl: photo.urls.thumb,
      altText: photo.alt_description || query,
      attribution: `Photo by ${photo.user.name} on Unsplash`,
      photographerUrl: photo.user.links.html,
    }
  }

  private buildUnsplashQuery(sector: string, keywords: string[]): string {
    const sectorMap: Record<string, string> = {
      beaute: 'beauty salon hair',
      btp: 'construction renovation',
      horeca: 'restaurant food',
      medical: 'healthcare medical',
      automobile: 'car garage',
      commerce: 'retail shop',
      b2b: 'office business professional',
      fitness: 'fitness gym workout',
    }
    const base = sectorMap[sector] || 'professional business'
    return `${base} ${keywords.slice(0, 2).join(' ')}`
  }
}
```

---

## 4. Routes API Sprint 3

### Modules

```
GET  /api/v1/sites/:id/modules           Liste des modules et leur statut
POST /api/v1/sites/:id/modules/:moduleId Activer un module
DELETE /api/v1/sites/:id/modules/:moduleId Désactiver un module
PATCH /api/v1/sites/:id/modules/:moduleId Modifier la config d'un module
```

### Contenus IA

```
GET  /api/v1/sites/:id/contents                Liste des contenus (filtrable)
GET  /api/v1/sites/:id/contents/:contentId     Détail d'un contenu
POST /api/v1/sites/:id/contents/:contentId/approve  Approuver
POST /api/v1/sites/:id/contents/:contentId/reject   Rejeter (+ note optionnelle)
POST /api/v1/sites/:id/contents/generate       Déclencher génération manuelle
```

### Avis Google

```
GET  /api/v1/sites/:id/reviews                 Liste des avis (filtrable par rating)
POST /api/v1/sites/:id/reviews/:reviewId/approve-reply  Approuver la réponse générée
POST /api/v1/sites/:id/reviews/:reviewId/skip  Ignorer cet avis
POST /api/v1/sites/:id/reviews/sync            Forcer sync GMB
```

### Réseaux sociaux

```
GET  /api/v1/sites/:id/social-accounts         Statut des connexions RS
POST /api/v1/sites/:id/social-accounts/facebook/connect   Initier OAuth Facebook
POST /api/v1/sites/:id/social-accounts/facebook/callback  Recevoir token Facebook
DELETE /api/v1/sites/:id/social-accounts/:platform        Déconnecter
```

### Détail — POST /api/v1/sites/:id/modules/:moduleId (Activation)

```typescript
// Validation
// 1. Le module existe dans module_catalog
// 2. Le site est en statut 'staging' ou 'live'
// 3. L'utilisateur a le droit d'activer des modules sur ce site
// 4. Le module n'est pas déjà actif

// Actions
// 1. INSERT dans site_modules
// 2. Valider les prérequis du module :
//    - gmb_reviews → vérifier gmb_location_id sur le site
//    - social_posts → vérifier qu'au moins 1 réseau social est connecté
//    - blog_seo → aucun prérequis (le blog est déjà dans le CMS)
// 3. Créer les premiers jobs BullMQ pour démarrer le module
// 4. Retourner { data: { moduleId, status: 'active', firstJobAt: Date } }

// Config par défaut selon le module
const DEFAULT_CONFIGS = {
  gmb_reviews: {
    autoPublishReviews: false,   // validation manuelle par défaut
    autoPublishGMBPosts: false,
    gmbPostsPerWeek: 1,
    negativeAlertEmail: true,
    negativeAlertSms: false,
  },
  social_posts: {
    autoPublish: false,          // validation manuelle par défaut
    postsPerMonth: 12,
    platforms: ['facebook'],     // Instagram si connecté
    postingDays: [1, 3, 5],      // lundi, mercredi, vendredi
    postingHour: 10,
  },
  blog_seo: {
    autoPublish: false,
    articlesPerMonth: 8,
    minWordCount: 1200,
    maxWordCount: 2500,
    publishDay: 1,               // lundi
  },
}
```

### Détail — GET /api/v1/sites/:id/contents

```typescript
// Query params
?status=pending_validation   // ou approved, published, rejected, all
&type=blog_article            // ou social_post, gmb_post, review_reply
&platform=facebook
&page=1
&limit=20

// Réponse
{
  data: AIContent[],
  meta: {
    page: number,
    total: number,
    pending: number,      // compteur badge pour le backoffice
    published: number,
  }
}
```

---

## 5. Configuration des modules

### Module gmb_reviews — Options configurables

```typescript
interface GMBReviewsConfig {
  // Posts GMB
  autoPublishGMBPosts: boolean   // publier sans validation
  gmbPostsPerWeek: 1 | 2         // fréquence
  gmbPostTypes: ('update' | 'offer' | 'event')[]

  // Gestion avis
  autoPublishReplies: boolean    // répondre automatiquement sans validation
  replyLanguage: 'fr' | 'nl' | 'en' | 'auto'
  replyTone: 'formal' | 'friendly' | 'professional'
  replyMaxDelay: 24 | 48         // heures max avant réponse

  // Alertes avis négatifs
  negativeAlertEmail: boolean
  negativeAlertSms: boolean
  negativeThreshold: 1 | 2       // étoiles max pour déclencher alerte
}
```

### Module social_posts — Options configurables

```typescript
interface SocialPostsConfig {
  autoPublish: boolean
  postsPerMonth: 8 | 12 | 16 | 20
  platforms: ('facebook' | 'instagram')[]
  postingDays: number[]           // 0=dimanche, 1=lundi... 6=samedi
  postingHour: number             // 0-23
  postTypes: ('educational' | 'promotional' | 'engagement' | 'seasonal')[]
  includeHashtags: boolean
  maxHashtags: number             // 3-15
  includeEmojis: boolean
  language: 'fr' | 'nl' | 'en' | 'auto'
}
```

### Module blog_seo — Options configurables

```typescript
interface BlogSEOConfig {
  autoPublish: boolean
  articlesPerMonth: 4 | 8
  minWordCount: 800 | 1200 | 1500 | 2000
  topics: string[]               // sujets prioritaires définis par le client
  includeInternalLinks: boolean
  includeFAQ: boolean            // FAQ Schema.org sur chaque article
  includeTableOfContents: boolean
  language: 'fr' | 'nl' | 'en'
}
```

---

## 6. Pages frontend à implémenter

### apps/dashboard — Section Contenus (/content)

```
/content
  Onglets : En attente (N) | Planifiés | Publiés | Rejetés

  Vue "En attente" :
    Liste des contenus avec :
    - Badge type (Blog, Post FB, Post IG, GMB, Réponse avis)
    - Badge plateforme avec couleur
    - Extrait du contenu (3 premières lignes)
    - Miniature de l'image Unsplash si applicable
    - Date de planification prévue
    - Boutons : "Aperçu" | "Approuver" | "Rejeter"

  Aperçu modal :
    - Rendu du contenu tel qu'il apparaîtra sur la plateforme
    - Prévisualisation Facebook/Instagram/GMB stylisée
    - Champs modifiables en ligne (titre, contenu, hashtags)
    - Bouton "Approuver tel quel" | "Approuver avec modifications" | "Rejeter"

  Rejection :
    - Champ texte optionnel : motif de rejet
    - Le motif est stocké et envoyé au prochain cycle de génération

/content/reviews
  Liste des avis Google avec :
    - Note étoiles + nom auteur + date + extrait commentaire
    - Badge état réponse : En attente | Générée | Publiée | Ignorée
    - Pour les avis négatifs : badge rouge + indicateur d'alerte
    - Bouton : "Voir la réponse générée" | "Publier" | "Ignorer"

  Modal aperçu réponse :
    - L'avis client affiché
    - La réponse générée
    - Bouton modifier inline
    - Bouton "Publier sur Google"
```

### apps/dashboard — Section Modules (/modules)

```
/modules
  Catalogue de tous les modules disponibles (18 modules)
  Pour chaque module :
    - Icône + Nom + Description courte
    - Prix : 10€/mois ou 249€/mois
    - Statut : Actif (toggle vert) | Inactif (toggle gris)
    - Bouton "Configurer" (si actif)
    - Badge "Prérequis manquants" si applicable

/modules/:moduleId/settings
  Formulaire de configuration du module
  Exemple pour social_posts :
    - Toggle Auto-publication
    - Slider posts/mois (8 / 12 / 16 / 20)
    - Checkboxes plateformes (Facebook ✅ Instagram ✅)
    - Sélecteur jours de publication
    - Sélecteur heure de publication
    - Bouton "Sauvegarder"
    - Bouton "Générer un post maintenant" (test immédiat)

/modules/:moduleId/settings (social accounts)
  Si la plateforme n'est pas connectée → section "Connecter votre compte"
  Bouton "Connecter Facebook" → OAuth Flow
  Bouton "Connecter Instagram" → OAuth Flow (via Facebook)
```

---

## 7. Scheduler — Planification des publications

```typescript
// packages/queue/src/schedulers/content.scheduler.ts

// Exécuté via node-cron sur le serveur

export function startContentScheduler() {

  // Sync avis Google — toutes les 4h
  cron.schedule('0 */4 * * *', async () => {
    const activeSites = await getSitesWithModule('gmb_reviews')
    for (const site of activeSites) {
      await reviewSyncQueue.add('sync-reviews', { siteId: site.id }, {
        jobId: `sync-${site.id}-${Date.now()}`,
        removeOnComplete: true,
      })
    }
  })

  // Posts GMB — chaque lundi matin 8h
  cron.schedule('0 8 * * 1', async () => {
    const activeSites = await getSitesWithModule('gmb_reviews')
    for (const site of activeSites) {
      await gmbPostQueue.add('generate-gmb-post', { siteId: site.id })
    }
  })

  // Posts sociaux — selon config par site
  cron.schedule('0 * * * *', async () => {
    // Toutes les heures, vérifier si un site doit publier maintenant
    const now = new Date()
    const hour = now.getHours()
    const dayOfWeek = now.getDay()

    const sitesToPost = await getSitesDueForSocialPost(hour, dayOfWeek)
    for (const site of sitesToPost) {
      await socialPostQueue.add('generate-social-post', { siteId: site.id })
    }
  })

  // Articles blog — chaque lundi matin 7h (avant les posts GMB)
  cron.schedule('0 7 * * 1', async () => {
    const activeSites = await getSitesWithModule('blog_seo')
    for (const site of activeSites) {
      const articlesThisMonth = await countArticlesPublishedThisMonth(site.id)
      const config = await getModuleConfig(site.id, 'blog_seo')
      if (articlesThisMonth < config.articlesPerMonth) {
        await blogQueue.add('generate-blog-article', { siteId: site.id })
      }
    }
  })

  // Publication des contenus approuvés — toutes les 15 min
  cron.schedule('*/15 * * * *', async () => {
    const contents = await db
      .select()
      .from(aiContents)
      .where(
        and(
          inArray(aiContents.status, ['approved', 'auto_approved']),
          lte(aiContents.scheduledFor, new Date()),
        )
      )
      .limit(50)

    for (const content of contents) {
      await publishQueue.add('publish-content', { contentId: content.id })
    }
  })

  // Alertes avis négatifs non traités — toutes les heures
  cron.schedule('0 * * * *', async () => {
    const unreportedNegatives = await db
      .select()
      .from(googleReviews)
      .where(
        and(
          eq(googleReviews.isNegative, true),
          eq(googleReviews.alertSent, false),
        )
      )

    for (const review of unreportedNegatives) {
      await alertQueue.add('send-negative-review-alert', { reviewId: review.id })
    }
  })
}
```

---

## 8. Tracking des coûts Claude

```typescript
// packages/ai/src/tracking.ts

// Tarifs Claude API (mars 2026)
const CLAUDE_PRICING = {
  'claude-sonnet-4-6': {
    input: 3.00 / 1_000_000,   // $3 per 1M tokens input
    output: 15.00 / 1_000_000, // $15 per 1M tokens output
  },
  'claude-haiku-4-5-20251001': {
    input: 0.25 / 1_000_000,
    output: 1.25 / 1_000_000,
  },
}
const EUR_RATE = 0.92 // USD → EUR

export async function trackTokenUsage(params: {
  siteId: string
  moduleId: string
  model: string
  tokensInput: number
  tokensOutput: number
}): Promise<void> {
  const pricing = CLAUDE_PRICING[params.model]
  const costUSD = (params.tokensInput * pricing.input) + (params.tokensOutput * pricing.output)
  const costEUR = costUSD * EUR_RATE

  const now = new Date()
  await db.insert(tokenUsage)
    .values({
      siteId: params.siteId,
      moduleId: params.moduleId,
      periodYear: now.getFullYear(),
      periodMonth: now.getMonth() + 1,
      tokensInput: params.tokensInput,
      tokensOutput: params.tokensOutput,
      apiCalls: 1,
      totalCostEur: costEUR,
    })
    .onConflictDoUpdate({
      target: [tokenUsage.siteId, tokenUsage.moduleId, tokenUsage.periodYear, tokenUsage.periodMonth],
      set: {
        tokensInput: sql`token_usage.tokens_input + ${params.tokensInput}`,
        tokensOutput: sql`token_usage.tokens_output + ${params.tokensOutput}`,
        apiCalls: sql`token_usage.api_calls + 1`,
        totalCostEur: sql`token_usage.total_cost_eur + ${costEUR}`,
      }
    })
}

// Alerte si coût > 4€/mois pour un site
export async function checkCostThreshold(siteId: string): Promise<void> {
  const now = new Date()
  const usage = await db
    .select({ totalCost: sum(tokenUsage.totalCostEur) })
    .from(tokenUsage)
    .where(
      and(
        eq(tokenUsage.siteId, siteId),
        eq(tokenUsage.periodYear, now.getFullYear()),
        eq(tokenUsage.periodMonth, now.getMonth() + 1),
      )
    )

  if (Number(usage[0].totalCost) > 4.0) {
    await alertSuperAdmin({
      type: 'cost_threshold_exceeded',
      siteId,
      cost: usage[0].totalCost,
      message: `Site ${siteId} a dépassé 4€ de tokens Claude ce mois`,
    })
  }
}
```

---

## 9. Variables d'environnement Sprint 3

Ajouter dans ENV.md et Coolify staging :

```env
# Unsplash API
UNSPLASH_ACCESS_KEY=...
UNSPLASH_SECRET_KEY=...

# Meta / Facebook Graph API
META_APP_ID=...
META_APP_SECRET=...
META_WEBHOOK_VERIFY_TOKEN=...   # string random pour vérifier les webhooks
META_API_VERSION=v21.0

# Cron
CRON_ENABLED=true               # false sur staging si on veut contrôle manuel

# Alertes internes
WAPIX_ALERT_EMAIL=salim@wapix.be
WAPIX_ALERT_PHONE=+32...

# Cost monitoring
CLAUDE_COST_ALERT_THRESHOLD_EUR=4.00
```

---

## 10. Instructions pour Claude Code

```
Tu travailles sur le Sprint 3 de WapixIA — Modules IA Core.

Contexte obligatoire à lire AVANT de coder (dans l'ordre) :
1. docs/ARCHITECTURE.md
2. docs/DATABASE.md
3. docs/CONVENTIONS.md
4. docs/ENV.md
5. docs/sprints/sprint-2/SPEC.md (sites et modules en BDD)
6. docs/sprints/sprint-3/SPEC.md (ce fichier)
7. docs/sprints/sprint-3/CLAUDE_PROMPTS.md (prompts par secteur)
8. docs/sprints/sprint-3/BULLMQ_JOBS.md (architecture des workers)

Ordre de livraison (une branche par item) :
1. feat/sprint3-db-migrations     — migrations 008 à 012
2. feat/sprint3-gmb-service       — GMBService + sync avis + publication
3. feat/sprint3-meta-service      — MetaService Facebook + Instagram
4. feat/sprint3-unsplash-service  — UnsplashService + query builder
5. feat/sprint3-content-generator — workers génération par module
6. feat/sprint3-scheduler         — node-cron scheduler
7. feat/sprint3-publisher         — worker publication multi-plateforme
8. feat/sprint3-alert-service     — alertes avis négatifs + coûts
9. feat/sprint3-api-modules       — routes /modules et /contents
10. feat/sprint3-api-reviews      — routes /reviews et /social-accounts
11. feat/sprint3-frontend-content — pages /content et /content/reviews
12. feat/sprint3-frontend-modules — pages /modules et /modules/:id/settings

Règles spécifiques Sprint 3 :
- Jamais stocker un access_token en clair dans la BDD — toujours chiffrer avec ENCRYPTION_KEY
- Retry policy sur TOUS les appels aux APIs externes (Meta, GMB, Unsplash)
- Si une API externe échoue 3 fois → statut 'publish_failed' sur le content + alerte
- Tracker les tokens Claude après CHAQUE appel API (fonction trackTokenUsage)
- Les jobs BullMQ ont un timeout de 5 minutes max (evitez les jobs pendants)
```
