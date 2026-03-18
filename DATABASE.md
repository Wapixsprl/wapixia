# DATABASE.md — WapixIA
> Version : 1.0 | Date : Mars 2026
> Ce fichier est la source de vérité du schéma de base de données.
> Toute modification doit passer par une migration Drizzle — jamais directement en production.

---

## 1. Principes généraux

- **Un seul schéma** `public` — isolation par `organization_id` via RLS
- **UUID v4** pour tous les IDs primaires — `gen_random_uuid()` par défaut
- **Timestamps systématiques** — `created_at`, `updated_at` sur toutes les tables
- **Soft delete** — colonne `deleted_at` sur les tables à enjeu commercial (ne jamais supprimer physiquement)
- **Enum PostgreSQL** pour les statuts et types — jamais de string libre pour les valeurs contrôlées

---

## 2. Schéma complet

### 2.1 Organisations (tenants)

```sql
CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,                    -- utilisé pour le sous-domaine
  type            TEXT NOT NULL CHECK (type IN (
                    'wapixia',                             -- Wapix SPRL (SuperAdmin)
                    'reseller',                            -- Agence / Freelance
                    'direct'                               -- Client direct WapixIA
                  )),
  parent_id       UUID REFERENCES organizations(id),       -- NULL si top-level
  commission_rate DECIMAL(5,2) DEFAULT 20.00,             -- % commission WapixIA
  stripe_account_id TEXT,                                  -- Stripe Connect ID revendeur
  mollie_profile_id TEXT,                                  -- Mollie profile revendeur

  -- White-label
  white_label_domain    TEXT,                             -- ex: dashboard.monagence.be
  white_label_logo_url  TEXT,
  white_label_primary   TEXT DEFAULT '#00D4B1',           -- couleur primaire hex
  white_label_name      TEXT,                             -- nom affiché aux clients

  -- Affiliation
  affiliate_code  TEXT UNIQUE,                            -- code d'affiliation unique
  referred_by     UUID REFERENCES organizations(id),      -- qui a apporté ce revendeur

  -- Status
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
                    'active', 'suspended', 'cancelled', 'trial'
                  )),
  trial_ends_at   TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- Index
CREATE INDEX idx_organizations_parent ON organizations(parent_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_affiliate ON organizations(affiliate_code);
```

---

### 2.2 Utilisateurs

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  role            TEXT NOT NULL CHECK (role IN (
                    'superadmin',
                    'reseller_admin',
                    'reseller_user',
                    'client_admin',
                    'client_user'
                  )),
  first_name      TEXT,
  last_name       TEXT,
  email           TEXT NOT NULL,
  phone           TEXT,
  avatar_url      TEXT,
  language        TEXT DEFAULT 'fr',
  timezone        TEXT DEFAULT 'Europe/Brussels',

  -- Préférences notifications
  notif_email     BOOLEAN DEFAULT TRUE,
  notif_sms       BOOLEAN DEFAULT FALSE,
  notif_push      BOOLEAN DEFAULT TRUE,

  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
```

---

### 2.3 Sites clients

```sql
CREATE TABLE sites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  owner_user_id   UUID NOT NULL REFERENCES users(id),

  -- Identification
  name            TEXT NOT NULL,                          -- nom commercial
  slug            TEXT NOT NULL,                          -- slug unique
  sector          TEXT NOT NULL CHECK (sector IN (
                    'btp', 'beaute', 'horeca', 'immobilier',
                    'medical', 'automobile', 'commerce', 'b2b',
                    'fitness', 'asbl', 'autre'
                  )),

  -- Domaines
  temp_domain     TEXT UNIQUE,                            -- client.wapixia.com
  custom_domain   TEXT UNIQUE,                            -- domaine client final
  domain_verified BOOLEAN DEFAULT FALSE,
  ssl_status      TEXT DEFAULT 'pending' CHECK (ssl_status IN (
                    'pending', 'active', 'error'
                  )),

  -- Hébergement
  hosting_type    TEXT NOT NULL CHECK (hosting_type IN (
                    'wapixia',                            -- hébergé par WapixIA
                    'client_ftp',                         -- FTP/SFTP client
                    'client_vps'                          -- VPS propre client
                  )),
  hosting_config  JSONB,                                  -- credentials chiffrés si client hosting

  -- Offre
  plan            TEXT NOT NULL CHECK (plan IN (
                    'purchase',                           -- achat 1900€
                    'subscription'                        -- abonnement 89€/mois
                  )),
  plan_price      DECIMAL(10,2) NOT NULL,

  -- Onboarding
  onboarding_data JSONB,                                  -- réponses questionnaire 20 min
  onboarding_done BOOLEAN DEFAULT FALSE,
  launched_at     TIMESTAMPTZ,

  -- SEO & Analytics
  google_analytics_id   TEXT,
  google_tag_manager_id TEXT,
  google_search_console TEXT,
  facebook_pixel_id     TEXT,
  gmb_location_id       TEXT,

  -- Status
  status          TEXT NOT NULL DEFAULT 'setup' CHECK (status IN (
                    'setup', 'staging', 'live', 'suspended', 'cancelled'
                  )),

  -- Scores
  visibility_score      INTEGER DEFAULT 0 CHECK (visibility_score BETWEEN 0 AND 100),
  seo_score             INTEGER DEFAULT 0,
  ai_presence_score     INTEGER DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- Index
CREATE INDEX idx_sites_org ON sites(organization_id);
CREATE INDEX idx_sites_sector ON sites(sector);
CREATE INDEX idx_sites_status ON sites(status);
CREATE UNIQUE INDEX idx_sites_slug ON sites(slug) WHERE deleted_at IS NULL;
```

---

### 2.4 Modules IA

```sql
-- Catalogue des modules disponibles (table de référence)
CREATE TABLE module_catalog (
  id              TEXT PRIMARY KEY,                       -- ex: 'social_posts'
  name            TEXT NOT NULL,
  description     TEXT,
  price_monthly   DECIMAL(10,2) NOT NULL,                 -- 10.00 ou 249.00
  category        TEXT NOT NULL CHECK (category IN (
                    'content', 'reputation', 'acquisition',
                    'conversion', 'analytics', 'technical'
                  )),
  is_active       BOOLEAN DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0
);

-- Modules activés par site
CREATE TABLE site_modules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  module_id       TEXT NOT NULL REFERENCES module_catalog(id),

  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
                    'active', 'paused', 'cancelled'
                  )),
  config          JSONB DEFAULT '{}',                     -- config spécifique au module

  activated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(site_id, module_id)
);

-- Index
CREATE INDEX idx_site_modules_site ON site_modules(site_id);
CREATE INDEX idx_site_modules_module ON site_modules(module_id);
CREATE INDEX idx_site_modules_status ON site_modules(status);
```

---

### 2.5 Contenus générés par IA

```sql
CREATE TABLE ai_contents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  module_id       TEXT NOT NULL REFERENCES module_catalog(id),

  type            TEXT NOT NULL CHECK (type IN (
                    'blog_article', 'social_post', 'gmb_post',
                    'review_reply', 'email', 'visual_prompt',
                    'seo_meta', 'faq'
                  )),
  platform        TEXT,                                   -- 'facebook', 'instagram', 'gmb', etc.

  -- Contenu
  title           TEXT,
  content         TEXT NOT NULL,
  visual_url      TEXT,                                   -- URL Cloudflare R2 si visuel généré
  metadata        JSONB DEFAULT '{}',                     -- hashtags, tags, données SEO, etc.

  -- Prompt utilisé (pour debug et amélioration)
  prompt_version  TEXT,
  model_used      TEXT,                                   -- 'claude-sonnet-4-6', etc.
  tokens_used     INTEGER,

  -- Workflow de validation
  status          TEXT NOT NULL DEFAULT 'pending_validation' CHECK (status IN (
                    'pending_validation',                 -- en attente d'approbation client
                    'approved',                           -- validé, prêt à publier
                    'auto_approved',                      -- publié sans validation (mode auto)
                    'rejected',                           -- rejeté par le client
                    'published',                          -- publié sur la plateforme cible
                    'publish_failed'                      -- erreur lors de la publication
                  )),
  rejection_note  TEXT,
  validated_by    UUID REFERENCES users(id),
  validated_at    TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  scheduled_for   TIMESTAMPTZ,                            -- publication planifiée

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_ai_contents_site ON ai_contents(site_id);
CREATE INDEX idx_ai_contents_status ON ai_contents(status);
CREATE INDEX idx_ai_contents_type ON ai_contents(type);
CREATE INDEX idx_ai_contents_scheduled ON ai_contents(scheduled_for) WHERE scheduled_for IS NOT NULL;
```

---

### 2.6 Avis Google

```sql
CREATE TABLE google_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

  -- Données Google
  gmb_review_id   TEXT UNIQUE NOT NULL,
  author_name     TEXT NOT NULL,
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  review_date     TIMESTAMPTZ NOT NULL,

  -- Réponse
  reply_content   TEXT,
  reply_status    TEXT DEFAULT 'pending' CHECK (reply_status IN (
                    'pending', 'generated', 'validated', 'published', 'skipped'
                  )),
  ai_content_id   UUID REFERENCES ai_contents(id),
  published_at    TIMESTAMPTZ,

  -- Alerte
  is_negative     BOOLEAN DEFAULT FALSE,                  -- rating <= 2
  alert_sent      BOOLEAN DEFAULT FALSE,

  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_reviews_site ON google_reviews(site_id);
CREATE INDEX idx_reviews_rating ON google_reviews(rating);
CREATE INDEX idx_reviews_negative ON google_reviews(is_negative) WHERE is_negative = TRUE;
```

---

### 2.7 Abonnements & Facturation

```sql
CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  type            TEXT NOT NULL CHECK (type IN (
                    'site_subscription',                  -- 89€/mois
                    'hosting',                            -- 19€/mois
                    'module'                              -- 10€/mois par module
                  )),
  module_id       TEXT REFERENCES module_catalog(id),     -- si type = 'module'

  -- Tarification
  amount          DECIMAL(10,2) NOT NULL,
  currency        TEXT DEFAULT 'EUR',
  billing_cycle   TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN (
                    'monthly', 'yearly'
                  )),

  -- Payment provider
  payment_provider TEXT CHECK (payment_provider IN ('mollie', 'stripe')),
  external_sub_id TEXT,                                   -- ID chez Mollie ou Stripe

  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
                    'trialing', 'active', 'past_due', 'cancelled', 'paused'
                  )),

  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancel_reason         TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historique des paiements
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  amount          DECIMAL(10,2) NOT NULL,
  currency        TEXT DEFAULT 'EUR',
  status          TEXT NOT NULL CHECK (status IN (
                    'pending', 'paid', 'failed', 'refunded', 'chargeback'
                  )),

  payment_provider TEXT,
  external_payment_id TEXT,
  payment_method  TEXT,                                   -- 'bancontact', 'card', 'sepa', etc.

  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Commissions revendeurs
CREATE TABLE commissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id     UUID NOT NULL REFERENCES organizations(id),
  payment_id      UUID NOT NULL REFERENCES payments(id),

  base_amount     DECIMAL(10,2) NOT NULL,                 -- montant du paiement client
  commission_rate DECIMAL(5,2) NOT NULL,                  -- taux appliqué
  commission_amount DECIMAL(10,2) NOT NULL,               -- montant commission

  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                    'pending',                            -- calculée, pas encore versée
                    'paid',                               -- versée au revendeur
                    'cancelled'                           -- annulée (remboursement client)
                  )),

  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  paid_at         TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_subscriptions_site ON subscriptions(site_id);
CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_payments_subscription ON payments(subscription_id);
CREATE INDEX idx_commissions_reseller ON commissions(reseller_id);
CREATE INDEX idx_commissions_status ON commissions(status);
```

---

### 2.8 Leads & Analytics

```sql
CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id),

  type            TEXT NOT NULL CHECK (type IN (
                    'contact_form', 'quote_request', 'appointment',
                    'phone_call', 'whatsapp', 'chatbot'
                  )),

  -- Données du lead
  first_name      TEXT,
  last_name       TEXT,
  email           TEXT,
  phone           TEXT,
  message         TEXT,
  files_urls      TEXT[],                                 -- URLs Cloudflare R2

  -- Contexte
  source_page     TEXT,                                   -- URL de la page
  source_module   TEXT,                                   -- quel module a capturé le lead
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,

  -- Valeur estimée
  estimated_value DECIMAL(10,2),

  -- Status
  status          TEXT DEFAULT 'new' CHECK (status IN (
                    'new', 'contacted', 'qualified', 'won', 'lost'
                  )),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stats mensuelles agrégées (rapport ROI)
CREATE TABLE monthly_stats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id),

  period_year     INTEGER NOT NULL,
  period_month    INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),

  -- Trafic
  total_visits        INTEGER DEFAULT 0,
  unique_visitors     INTEGER DEFAULT 0,
  organic_visits      INTEGER DEFAULT 0,
  ai_referral_visits  INTEGER DEFAULT 0,               -- trafic depuis LLMs

  -- Leads
  total_leads         INTEGER DEFAULT 0,
  leads_by_type       JSONB DEFAULT '{}',
  estimated_value     DECIMAL(10,2) DEFAULT 0,

  -- SEO
  google_impressions  INTEGER DEFAULT 0,
  google_clicks       INTEGER DEFAULT 0,
  average_position    DECIMAL(5,2),
  ai_overview_impressions INTEGER DEFAULT 0,

  -- Scores
  visibility_score    INTEGER,
  seo_score           INTEGER,
  ai_presence_score   INTEGER,

  -- Contenu publié
  blog_articles_published   INTEGER DEFAULT 0,
  social_posts_published    INTEGER DEFAULT 0,
  gmb_posts_published       INTEGER DEFAULT 0,
  reviews_replied           INTEGER DEFAULT 0,

  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(site_id, period_year, period_month)
);

-- Index
CREATE INDEX idx_leads_site ON leads(site_id);
CREATE INDEX idx_leads_type ON leads(type);
CREATE INDEX idx_monthly_stats_site ON monthly_stats(site_id);
```

---

### 2.9 Concurrents surveillés

```sql
CREATE TABLE competitors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  website_url     TEXT,
  gmb_place_id    TEXT,
  distance_km     DECIMAL(5,2),

  -- Données surveillées
  gmb_rating      DECIMAL(3,2),
  gmb_review_count INTEGER DEFAULT 0,
  last_gmb_post   TIMESTAMPTZ,
  seo_score       INTEGER,

  -- Alertes
  is_new          BOOLEAN DEFAULT TRUE,                   -- détecté récemment
  alert_sent      BOOLEAN DEFAULT FALSE,

  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_competitors_site ON competitors(site_id);
```

---

### 2.10 Données onboarding questionnaire

```sql
-- Stocké en JSONB dans sites.onboarding_data, structure attendue :
-- {
--   "business_name": "Sonia Espace Coiffure",
--   "sector": "beaute",
--   "city": "Mouscron",
--   "zip": "7700",
--   "phone": "+32 56 ...",
--   "email": "contact@sonia.be",
--   "description": "Salon de coiffure mixte ouvert depuis 2010...",
--   "services": ["coupe", "couleur", "balayage", "lissage"],
--   "price_range": "medium",
--   "opening_hours": { "mon": "9h-18h", ... },
--   "unique_selling_point": "Spécialiste balayage et colorations naturelles",
--   "target_audience": "Femmes 25-55 ans",
--   "competitors_known": ["salon dupont", "coiffure martin"],
--   "existing_site_url": null,
--   "existing_gmb": true,
--   "brand_colors": ["#FF6B9D", "#2C2C2C"],
--   "logo_url": null,
--   "photos": ["url1", "url2"],
--   "languages": ["fr"],
--   "payment_methods": ["cash", "bancontact"],
--   "has_parking": true,
--   "accessibility": false
-- }
```

---

## 3. Row Level Security (RLS) — Policies complètes

```sql
-- Activer RLS sur toutes les tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

-- Fonction helper pour récupérer l'organization_id depuis le JWT
CREATE OR REPLACE FUNCTION auth.organization_id()
RETURNS UUID AS $$
  SELECT (auth.jwt() ->> 'organization_id')::UUID;
$$ LANGUAGE SQL STABLE;

-- Fonction helper pour récupérer le rôle
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT AS $$
  SELECT auth.jwt() ->> 'role';
$$ LANGUAGE SQL STABLE;

-- Policy sites : un user voit les sites de son organisation
-- et les revendeurs voient les sites de leurs sous-organisations
CREATE POLICY "sites_select" ON sites FOR SELECT
  USING (
    organization_id = auth.organization_id()
    OR organization_id IN (
      SELECT id FROM organizations
      WHERE parent_id = auth.organization_id()
    )
    OR auth.user_role() = 'superadmin'
  );

CREATE POLICY "sites_insert" ON sites FOR INSERT
  WITH CHECK (organization_id = auth.organization_id());

CREATE POLICY "sites_update" ON sites FOR UPDATE
  USING (
    organization_id = auth.organization_id()
    OR auth.user_role() = 'superadmin'
  );

-- Policy ai_contents : via le site_id
CREATE POLICY "ai_contents_select" ON ai_contents FOR SELECT
  USING (
    site_id IN (
      SELECT id FROM sites WHERE organization_id = auth.organization_id()
    )
    OR auth.user_role() = 'superadmin'
  );
```

---

## 4. Données de référence — Module catalog

```sql
INSERT INTO module_catalog (id, name, description, price_monthly, category, sort_order) VALUES
  ('gmb_reviews',       'Posts GMB + Gestion Avis Google',       'Posts GMB hebdo + réponses IA aux avis',         10.00, 'reputation',   1),
  ('social_posts',      'Posts Réseaux Sociaux IA',               '12-20 posts/mois sur 8 plateformes',             10.00, 'content',      2),
  ('blog_seo',          'Articles Blog SEO',                      '8 articles/mois, SEO+GEO+AEO optimisés',         10.00, 'content',      3),
  ('visual_ai',         'Génération de Visuels IA',               'Images IA pour posts et articles',               10.00, 'content',      4),
  ('rdv_devis',         'RDV & Devis Intelligents',               'Calendrier + formulaires + SMS',                 10.00, 'conversion',   5),
  ('ecommerce',         'E-commerce Léger',                       'Boutique, panier, gestion stock',                10.00, 'conversion',   6),
  ('push_notif',        'Notifications Push Navigateur',          'Promos directement dans le navigateur',          10.00, 'acquisition',  7),
  ('call_tracking',     'Tracking Appels Téléphoniques',          'Mesure les appels générés par le site',          10.00, 'analytics',    8),
  ('qr_codes',          'QR Codes Dynamiques',                    'QR codes modifiables par prestation',            10.00, 'technical',    9),
  ('bio_link',          'Liens Bio (Linktree killer)',             'Page liens hébergée sur le domaine client',      10.00, 'technical',   10),
  ('whatsapp',          'WhatsApp Business',                      'Bouton + automatisation premières réponses',     10.00, 'conversion',  11),
  ('esignature',        'Signature Électronique eIDAS',           'Signature devis depuis l email',                 10.00, 'conversion',  12),
  ('pwa',               'Progressive Web App (PWA)',              'Site installable comme une app',                 10.00, 'technical',   13),
  ('heatmaps',          'Heatmaps & Sessions',                    'Enregistrements comportement visiteurs',         10.00, 'analytics',   14),
  ('ab_testing',        'A/B Testing Automatique',                'Test et adoption automatique du meilleur CTA',   10.00, 'analytics',   15),
  ('ai_presence',       'Score Présence IA',                      'Visibilité dans ChatGPT, Perplexity, Gemini',    10.00, 'analytics',   16),
  ('competitor_alerts', 'Alertes Concurrents Avancées',           'Surveillance temps réel des concurrents',        10.00, 'analytics',   17),
  ('prospection',       'Prospection Automatisée',                'Relances devis, séquences email, CRM',          249.00, 'acquisition', 18);
```

---

## 5. Migrations

Toutes les migrations sont gérées via **Drizzle ORM**.

```bash
# Créer une nouvelle migration
npx drizzle-kit generate

# Appliquer les migrations
npx drizzle-kit migrate

# Vérifier le statut
npx drizzle-kit status
```

**Convention de nommage des migrations :**
`YYYYMMDD_HHMMSS_description_courte.sql`

Exemple : `20260317_143000_create_organizations_table.sql`

**Règle absolue :** Jamais de `ALTER TABLE` ou `DROP TABLE` directement en production sans migration testée en staging d'abord.
