# SPRINT 2 — SPEC.md
# Socle Site & CMS
> Durée : 2 semaines | Début : Semaine 3
> Objectif : un site généré depuis l'onboarding, accessible sur sous-domaine en 48h

---

## Contexte pour Claude Code

Lire en premier (ordre obligatoire) :
1. `docs/ARCHITECTURE.md`
2. `docs/DATABASE.md` — sections 2.3 (sites), 2.10 (onboarding_data)
3. `docs/CONVENTIONS.md`
4. `docs/ENV.md` — sections Google, Cloudflare, Claude API
5. `docs/sprints/sprint-1/SPEC.md` — auth déjà en place, réutiliser
6. `docs/sprints/sprint-2/SPEC.md` — ce fichier
7. `docs/sprints/sprint-2/ONBOARDING_FLOW.md`
8. `docs/sprints/sprint-2/SEO_CHECKLIST.md`

Le Sprint 1 est terminé. Les tables `organizations`, `users`, `sites` existent. L'auth fonctionne. Ce sprint construit le cœur du produit : le site client généré par IA.

---

## 1. Périmètre du sprint

### Dans ce sprint ✅
- Questionnaire onboarding 20 questions (UI + validation + sauvegarde)
- Générateur de contenu IA (Claude API → pages complètes)
- 8 templates Next.js sectoriels (layouts + thèmes visuels)
- Payload CMS configuré multi-tenant
- Pipeline de déploiement automatique via Coolify API
- Sous-domaine temporaire via Cloudflare API
- SEO technique complet (sitemap, robots.txt, meta, Schema.org)
- Optimisation GEO/AEO (robots.txt crawlers IA, structure TLDR-first)
- Connexions Google OAuth (Analytics, Search Console, GMB, Tag Manager)
- Connexion Pixel Facebook
- Google Maps widget (page contact)
- Connexion domaine personnalisé (CNAME + SSL)
- Migration de schéma BDD : table `sites` complète + `onboarding_sessions`

### Hors sprint ❌
- Modules IA (posts RS, avis, blog) → Sprint 3
- Paiements → Sprint 5
- Dashboard métriques → Sprint 4
- E-commerce, PWA, WhatsApp → V2

---

## 2. Migrations BDD Sprint 2

### Migration 006 — Sites complet

```sql
-- packages/db/migrations/20260324_006_sites_complete.sql
-- Remplace le stub du Sprint 1 par la table complète

ALTER TABLE sites
  ADD COLUMN sector TEXT CHECK (sector IN (
    'btp', 'beaute', 'horeca', 'immobilier',
    'medical', 'automobile', 'commerce', 'b2b',
    'fitness', 'asbl', 'autre'
  )),
  ADD COLUMN temp_domain TEXT UNIQUE,
  ADD COLUMN custom_domain TEXT UNIQUE,
  ADD COLUMN domain_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN ssl_status TEXT DEFAULT 'pending' CHECK (
    ssl_status IN ('pending', 'active', 'error')
  ),
  ADD COLUMN hosting_type TEXT CHECK (
    hosting_type IN ('wapixia', 'client_ftp', 'client_vps')
  ) DEFAULT 'wapixia',
  ADD COLUMN hosting_config JSONB,
  ADD COLUMN plan TEXT CHECK (plan IN ('purchase', 'subscription')),
  ADD COLUMN plan_price DECIMAL(10,2),
  ADD COLUMN onboarding_data JSONB,
  ADD COLUMN onboarding_done BOOLEAN DEFAULT FALSE,
  ADD COLUMN launched_at TIMESTAMPTZ,
  ADD COLUMN google_analytics_id TEXT,
  ADD COLUMN google_tag_manager_id TEXT,
  ADD COLUMN google_search_console TEXT,
  ADD COLUMN facebook_pixel_id TEXT,
  ADD COLUMN gmb_location_id TEXT,
  ADD COLUMN google_oauth_token JSONB,  -- chiffré en application layer
  ADD COLUMN visibility_score INTEGER DEFAULT 0 CHECK (
    visibility_score BETWEEN 0 AND 100
  ),
  ADD COLUMN seo_score INTEGER DEFAULT 0,
  ADD COLUMN ai_presence_score INTEGER DEFAULT 0,
  ADD COLUMN theme TEXT DEFAULT 'default' CHECK (theme IN (
    'artisan', 'beaute', 'horeca', 'immobilier',
    'medical', 'automobile', 'commerce', 'b2b', 'default'
  )),
  ADD COLUMN primary_color TEXT DEFAULT '#00D4B1',
  ADD COLUMN secondary_color TEXT DEFAULT '#050D1A',
  ADD COLUMN coolify_app_id TEXT,        -- ID app dans Coolify
  ADD COLUMN cloudflare_record_id TEXT;  -- ID enregistrement DNS Cloudflare

-- Index supplémentaires
CREATE INDEX idx_sites_temp_domain ON sites(temp_domain) WHERE temp_domain IS NOT NULL;
CREATE INDEX idx_sites_custom_domain ON sites(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX idx_sites_sector ON sites(sector);
```

### Migration 007 — Sessions onboarding

```sql
-- packages/db/migrations/20260324_007_onboarding_sessions.sql

CREATE TABLE onboarding_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),

  -- Progression
  current_step    INTEGER DEFAULT 1,
  total_steps     INTEGER DEFAULT 20,
  answers         JSONB DEFAULT '{}',    -- réponses accumulées

  -- Génération IA
  generation_status TEXT DEFAULT 'pending' CHECK (generation_status IN (
    'pending', 'generating', 'done', 'failed'
  )),
  generated_content JSONB,               -- contenu généré avant injection CMS
  generation_started_at TIMESTAMPTZ,
  generation_done_at    TIMESTAMPTZ,
  error_message   TEXT,

  -- Tokens Claude utilisés
  tokens_used     INTEGER DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_onboarding_site ON onboarding_sessions(site_id);
CREATE INDEX idx_onboarding_status ON onboarding_sessions(generation_status);

ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_rls" ON onboarding_sessions FOR ALL USING (
  site_id IN (
    SELECT id FROM sites WHERE organization_id = auth.organization_id()
  )
  OR auth.is_superadmin()
);
```

---

## 3. Architecture du générateur de sites

### Pipeline complet

```
Client remplit questionnaire (20 questions)
    ↓
POST /api/v1/sites/:id/onboarding/complete
    ↓
BullMQ job créé : queue "sites:generate"
    ↓
Worker: assemblage du contexte (secteur + réponses + templates prompts)
    ↓
Claude API : génération du contenu (6 pages)
    ↓
Contenu stocké dans onboarding_sessions.generated_content
    ↓
Payload CMS : injection du contenu dans les collections
    ↓
Cloudflare API : création sous-domaine client.wapixia.com
    ↓
Coolify API : déploiement du site Next.js
    ↓
SSL Let's Encrypt : provisioning automatique
    ↓
sites.status = 'staging' | sites.temp_domain = 'client.wapixia.com'
    ↓
Email Brevo : "Votre site est prêt — [lien]"
```

### Structure du contenu généré

```typescript
// packages/ai/src/types/generated-content.ts

interface GeneratedSiteContent {
  // Pages principales
  pages: {
    home: HomePage
    services: ServicesPage
    about: AboutPage
    contact: ContactPage
    faq: FAQPage
    legal: LegalPage
  }

  // SEO global
  seo: {
    metaTitle: string          // 55-60 chars
    metaDescription: string    // 150-160 chars
    h1: string
    keywords: string[]
    schemaOrg: LocalBusinessSchema
  }

  // Données structurées réutilisables
  business: {
    name: string
    description: string        // 150 mots
    shortDescription: string   // 50 mots
    services: Service[]
    uniqueSellingPoint: string
    targetAudience: string
  }
}

interface HomePage {
  hero: {
    headline: string           // H1 — 60-80 chars
    subheadline: string        // 120-150 chars
    ctaPrimary: string         // "Prendre rendez-vous"
    ctaSecondary: string       // "Découvrir nos services"
  }
  features: Feature[]          // 3-4 arguments clés
  testimonials: Testimonial[]  // 3 témoignages fictifs sectoriels
  faq: FAQItem[]               // 5 questions AEO-optimisées
}

interface ServicesPage {
  title: string                // H1 en format réponse directe
  intro: string                // TLDR-first — réponse directe 100 premiers mots
  services: {
    name: string
    description: string        // 100-150 mots
    price?: string
    duration?: string
    h2: string                 // H2 en format question
    faq: FAQItem[]             // 2-3 questions par service
  }[]
}
```

---

## 4. Payload CMS — Configuration

### Collections à créer

```typescript
// packages/cms/src/collections/index.ts

export const collections = [
  Pages,        // Pages principales (home, about, contact, legal)
  Services,     // Prestations du client
  BlogPosts,    // Articles SEO (utilisé Sprint 3)
  Testimonials, // Avis et témoignages
  FAQItems,     // Questions/Réponses
  Media,        // Images et vidéos
  SiteSettings, // Config globale (couleurs, logo, infos entreprise)
  Navigation,   // Menus de navigation
]
```

### Collection Pages

```typescript
// packages/cms/src/collections/Pages.ts

import { CollectionConfig } from 'payload'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status', 'updatedAt'],
  },
  access: {
    // Isolation tenant via hook beforeOperation
    read: ({ req }) => ({
      siteId: { equals: req.headers['x-site-id'] }
    }),
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'siteId', type: 'text', required: true },  // tenant isolation
    {
      name: 'hero',
      type: 'group',
      fields: [
        { name: 'headline', type: 'text' },
        { name: 'subheadline', type: 'textarea' },
        { name: 'ctaPrimary', type: 'text' },
        { name: 'ctaSecondary', type: 'text' },
        { name: 'backgroundImage', type: 'upload', relationTo: 'media' },
      ]
    },
    {
      name: 'content',
      type: 'richText',  // Lexical editor
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text', maxLength: 60 },
        { name: 'metaDescription', type: 'textarea', maxLength: 160 },
        { name: 'canonical', type: 'text' },
        { name: 'noIndex', type: 'checkbox', defaultValue: false },
      ]
    },
    {
      name: 'status',
      type: 'select',
      options: ['draft', 'published'],
      defaultValue: 'draft',
    },
    { name: 'publishedAt', type: 'date' },
  ],
  hooks: {
    beforeChange: [injectSiteId],
    afterChange: [invalidateCache, triggerSitemapRegeneration],
  },
}
```

### Collection SiteSettings

```typescript
export const SiteSettings: CollectionConfig = {
  slug: 'site-settings',
  admin: { useAsTitle: 'siteName' },
  fields: [
    { name: 'siteId', type: 'text', required: true, unique: true },
    { name: 'siteName', type: 'text', required: true },
    { name: 'tagline', type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'favicon', type: 'upload', relationTo: 'media' },
    { name: 'primaryColor', type: 'text', defaultValue: '#00D4B1' },
    { name: 'secondaryColor', type: 'text', defaultValue: '#050D1A' },
    { name: 'phone', type: 'text' },
    { name: 'email', type: 'email' },
    { name: 'address', type: 'group', fields: [
      { name: 'street', type: 'text' },
      { name: 'city', type: 'text' },
      { name: 'zip', type: 'text' },
      { name: 'country', type: 'text', defaultValue: 'BE' },
    ]},
    { name: 'coordinates', type: 'group', fields: [
      { name: 'lat', type: 'number' },
      { name: 'lng', type: 'number' },
    ]},
    { name: 'socialLinks', type: 'group', fields: [
      { name: 'facebook', type: 'text' },
      { name: 'instagram', type: 'text' },
      { name: 'linkedin', type: 'text' },
      { name: 'youtube', type: 'text' },
    ]},
    { name: 'googleAnalyticsId', type: 'text' },
    { name: 'googleTagManagerId', type: 'text' },
    { name: 'facebookPixelId', type: 'text' },
    { name: 'gmbLocationId', type: 'text' },
  ],
}
```

---

## 5. Templates Next.js — 8 thèmes sectoriels

### Structure d'un template

```
apps/web/src/themes/
├── artisan/
│   ├── layout.tsx          # Layout principal (header, footer)
│   ├── home.tsx            # Page accueil
│   ├── services.tsx        # Page services
│   ├── about.tsx           # Page à propos
│   ├── contact.tsx         # Page contact avec Google Maps
│   ├── theme.ts            # Variables CSS (couleurs, fonts)
│   └── components/         # Composants spécifiques au thème
├── beaute/
├── horeca/
├── immobilier/
├── medical/
├── automobile/
├── commerce/
└── b2b/
```

### Mapping secteur → thème → bibliothèques UI

```typescript
// apps/web/src/themes/config.ts

export const THEME_CONFIG = {
  artisan: {
    sector: ['btp'],
    primaryColor: '#1A1A1A',
    accentColor: '#F39C12',
    font: { heading: 'Syne', body: 'DM Sans' },
    aceternityComponents: ['BackgroundBeams', 'CardHoverEffect', 'Spotlight'],
    magicComponents: ['AnimatedBeam', 'Marquee'],
    ambiance: 'robuste, texture, matières, confiance',
  },
  beaute: {
    sector: ['beaute', 'fitness'],
    primaryColor: '#2C2C2C',
    accentColor: '#FF6B9D',
    font: { heading: 'Playfair Display', body: 'Inter' },
    aceternityComponents: ['WavyBackground', 'AuroraBackground', 'InfiniteMovingCards'],
    magicComponents: ['Shimmer', 'AnimatedGradient'],
    ambiance: 'élégant, féminin, luxe accessible, bien-être',
  },
  horeca: {
    sector: ['horeca'],
    primaryColor: '#1A0A00',
    accentColor: '#E8A020',
    font: { heading: 'Cormorant Garamond', body: 'Source Sans 3' },
    aceternityComponents: ['LensEffect', '3DCard', 'GlowingStars'],
    magicComponents: ['Marquee', 'HeroVideoDialog'],
    ambiance: 'chaleureux, appétissant, convivial, vivant',
  },
  immobilier: {
    sector: ['immobilier'],
    primaryColor: '#0D1B2A',
    accentColor: '#C9A84C',
    font: { heading: 'Libre Baskerville', body: 'Lato' },
    aceternityComponents: ['Spotlight', 'GlowingStars', 'HeroHighlight'],
    magicComponents: ['HeroVideoDialog', 'AnimatedBeam'],
    ambiance: 'premium, luxe, confiance, sérieux',
  },
  medical: {
    sector: ['medical'],
    primaryColor: '#0A2A4A',
    accentColor: '#00B4D8',
    font: { heading: 'Nunito', body: 'Open Sans' },
    aceternityComponents: ['BackgroundGradient', 'CardHoverEffect'],
    magicComponents: ['AnimatedList', 'Marquee'],
    ambiance: 'rassurant, propre, professionnel, accessible',
  },
  automobile: {
    sector: ['automobile'],
    primaryColor: '#0A0A0A',
    accentColor: '#E74C3C',
    font: { heading: 'Rajdhani', body: 'Roboto' },
    aceternityComponents: ['BackgroundBeams', 'MovingBorder', 'Spotlight'],
    magicComponents: ['AnimatedBeam', 'Globe'],
    ambiance: 'dynamique, technologique, puissance, fiabilité',
  },
  commerce: {
    sector: ['commerce'],
    primaryColor: '#1A1A2E',
    accentColor: '#FF6B35',
    font: { heading: 'Poppins', body: 'Nunito' },
    aceternityComponents: ['BentoGrid', 'CardHoverEffect'],
    magicComponents: ['Marquee', 'AnimatedList', 'ShimmerButton'],
    ambiance: 'coloré, énergie, promo, accessible',
  },
  b2b: {
    sector: ['b2b', 'asbl', 'autre'],
    primaryColor: '#1E293B',
    accentColor: '#3B82F6',
    font: { heading: 'Plus Jakarta Sans', body: 'Inter' },
    aceternityComponents: ['TracingBeam', 'BackgroundGradient'],
    magicComponents: ['AnimatedBeam', 'WordRotate'],
    ambiance: 'professionnel, sobre, confiance, expertise',
  },
} as const
```

### Page d'accueil type (structure commune)

```typescript
// apps/web/src/themes/[theme]/home.tsx — structure identique pour tous les thèmes

export default function HomePage({ content, settings }: HomePageProps) {
  return (
    <>
      {/* 1. Hero — Aceternity Spotlight ou AuroraBackground selon thème */}
      <HeroSection
        headline={content.hero.headline}      // H1
        subheadline={content.hero.subheadline}
        ctaPrimary={content.hero.ctaPrimary}
        ctaSecondary={content.hero.ctaSecondary}
      />

      {/* 2. Proof bar — stats ou logos partenaires */}
      <ProofBar items={content.proofItems} />

      {/* 3. Services — BentoGrid ou cards sectorielles */}
      <ServicesGrid services={content.services.slice(0, 3)} />

      {/* 4. Argument fort — section Features */}
      <FeaturesSection features={content.features} />

      {/* 5. Témoignages — Magic UI Marquee (défilement infini) */}
      <TestimonialsMarquee testimonials={content.testimonials} />

      {/* 6. FAQ — Schema FAQPage + AEO */}
      <FAQSection items={content.faq} />

      {/* 7. CTA Final */}
      <CTASection cta={content.ctaFinal} />
    </>
  )
}
```

---

## 6. SEO Technique — Implémentation

### Fichiers générés automatiquement

```typescript
// apps/web/src/app/sitemap.ts
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await getPublishedPages(siteId)
  const posts = await getPublishedPosts(siteId)

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/services`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/a-propos`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/contact`, changeFrequency: 'yearly', priority: 0.6 },
    ...posts.map(post => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ]
}

// apps/web/src/app/robots.ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'Claude-SearchBot', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'Applebot-Extended', allow: '/' },
      // Bloquer uniquement les scrapers malveillants
      { userAgent: 'AhrefsBot', disallow: '/' },
      { userAgent: 'SemrushBot', disallow: '/' },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
```

### Schema.org LocalBusiness

```typescript
// apps/web/src/components/seo/LocalBusinessSchema.tsx

export function LocalBusinessSchema({ settings }: Props) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': getSectorSchemaType(settings.sector), // Restaurant, MedicalClinic, etc.
    name: settings.siteName,
    description: settings.description,
    url: settings.url,
    telephone: settings.phone,
    email: settings.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: settings.address.street,
      addressLocality: settings.address.city,
      postalCode: settings.address.zip,
      addressCountry: settings.address.country,
    },
    geo: settings.coordinates ? {
      '@type': 'GeoCoordinates',
      latitude: settings.coordinates.lat,
      longitude: settings.coordinates.lng,
    } : undefined,
    openingHoursSpecification: formatOpeningHours(settings.openingHours),
    aggregateRating: settings.rating ? {
      '@type': 'AggregateRating',
      ratingValue: settings.rating.value,
      reviewCount: settings.rating.count,
    } : undefined,
    sameAs: Object.values(settings.socialLinks).filter(Boolean),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

// Mapping secteur → type Schema.org
function getSectorSchemaType(sector: string): string {
  const map: Record<string, string> = {
    btp: 'HomeAndConstructionBusiness',
    beaute: 'BeautySalon',
    horeca: 'Restaurant',
    immobilier: 'RealEstateAgent',
    medical: 'MedicalClinic',
    automobile: 'AutoDealer',
    commerce: 'Store',
    b2b: 'ProfessionalService',
    fitness: 'SportsClub',
    asbl: 'NGO',
  }
  return map[sector] || 'LocalBusiness'
}
```

### Meta tags dynamiques

```typescript
// apps/web/src/app/layout.tsx

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings(siteId)
  const page = await getCurrentPage()

  return {
    title: {
      template: `%s | ${settings.siteName}`,
      default: settings.seo.metaTitle,
    },
    description: settings.seo.metaDescription,
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      locale: 'fr_BE',
      url: settings.url,
      siteName: settings.siteName,
      images: [{ url: settings.ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: settings.seo.metaTitle,
      description: settings.seo.metaDescription,
    },
    verification: {
      google: settings.googleSearchConsole,
    },
    alternates: {
      canonical: settings.url,
    },
  }
}
```

---

## 7. Routes API Sprint 2

### Onboarding

```
POST /api/v1/sites                          Créer un nouveau site (init)
GET  /api/v1/sites/:id/onboarding           Récupérer session onboarding
PUT  /api/v1/sites/:id/onboarding/step      Sauvegarder une étape
POST /api/v1/sites/:id/onboarding/complete  Déclencher la génération IA
GET  /api/v1/sites/:id/onboarding/status    Statut de la génération (polling)
```

### Site management

```
GET    /api/v1/sites                         Liste des sites (avec RLS)
GET    /api/v1/sites/:id                     Détail d'un site
PATCH  /api/v1/sites/:id                     Mise à jour (domaine, config)
POST   /api/v1/sites/:id/launch              Mise en production
POST   /api/v1/sites/:id/connect-domain      Connecter domaine personnalisé
GET    /api/v1/sites/:id/domain-status       Statut propagation DNS
```

### Connexions Google

```
GET  /api/v1/sites/:id/google/auth-url       Générer URL OAuth Google
POST /api/v1/sites/:id/google/callback       Recevoir token OAuth
GET  /api/v1/sites/:id/google/status         Statut des connexions
```

### Détail — POST /api/v1/sites/:id/onboarding/complete

```typescript
// Déclenche le pipeline de génération

// Validation
// 1. Vérifier que toutes les étapes obligatoires sont remplies
// 2. Vérifier que le site appartient à l'org du caller

// Action
// 1. Créer un job BullMQ dans la queue "sites:generate"
// 2. Mettre onboarding_sessions.generation_status = 'generating'
// 3. Retourner immédiatement { data: { jobId, estimatedMinutes: 5 } }

// Le worker fait le vrai travail :
// 1. Assembler le contexte depuis onboarding_data
// 2. Appeler Claude API (voir ONBOARDING_FLOW.md pour les prompts)
// 3. Injecter dans Payload CMS
// 4. Créer sous-domaine Cloudflare
// 5. Déployer via Coolify
// 6. Envoyer email Brevo "Votre site est prêt"
// 7. Update sites.status = 'staging', sites.temp_domain = '...'
```

### Détail — POST /api/v1/sites/:id/connect-domain

```typescript
// Body
{
  customDomain: string   // ex: "salonleonie.be"
}

// Actions
// 1. Vérifier que le domaine n'est pas déjà utilisé (unique)
// 2. Retourner les instructions DNS : { cname: { name: '@', value: 'proxy.wapixia.com' } }
// 3. Démarrer le polling de vérification (job BullMQ "domains:verify", toutes les 5min)

// GET /api/v1/sites/:id/domain-status
// Retourne: { verified: bool, sslStatus: 'pending'|'active'|'error', cnameFound: bool }
```

---

## 8. Service Cloudflare — Sous-domaines

```typescript
// packages/api/src/services/cloudflare.service.ts

export class CloudflareService {
  private api: CloudflareAPI

  async createSubdomain(slug: string): Promise<string> {
    // Crée client.wapixia.com → pointe vers le VPS WapixIA
    const record = await this.api.dns.records.create(ZONE_ID, {
      type: 'CNAME',
      name: slug,           // ex: "salon-leonie"
      content: 'vps.wapixia.com',
      proxied: true,        // passe par Cloudflare Proxy (SSL + DDoS)
    })

    return `${slug}.wapixia.com`
  }

  async createCustomDomainProxy(customDomain: string): Promise<void> {
    // Configure le proxy pour le domaine personnalisé du client
    // Le client doit pointer son CNAME vers proxy.wapixia.com
    // Cloudflare gère le SSL automatiquement
  }

  async verifyDNSPropagation(domain: string): Promise<boolean> {
    // Vérifie que le CNAME du client pointe vers proxy.wapixia.com
    const dnsLookup = await resolve(domain, 'CNAME')
    return dnsLookup.includes('proxy.wapixia.com')
  }

  async deleteSubdomain(recordId: string): Promise<void> {
    await this.api.dns.records.delete(ZONE_ID, recordId)
  }
}
```

---

## 9. Service Coolify — Déploiement

```typescript
// packages/api/src/services/coolify.service.ts

export class CoolifyService {
  private baseUrl = process.env.COOLIFY_BASE_URL
  private token = process.env.COOLIFY_API_TOKEN

  async createApplication(params: {
    name: string           // slug du site
    gitRepo: string        // repo GitHub du template Next.js
    branch: string         // 'main'
    domain: string         // sous-domaine temporaire
    envVars: Record<string, string>
  }): Promise<{ appId: string }> {
    // POST /api/v1/applications
    // Crée une nouvelle app Coolify liée au repo du template
    // Définit les variables d'environnement spécifiques au tenant
  }

  async triggerDeploy(appId: string): Promise<{ deploymentId: string }> {
    // POST /api/v1/deploy
    // Lance le déploiement — retour immédiat, on poll le statut
  }

  async getDeploymentStatus(deploymentId: string): Promise<{
    status: 'running' | 'finished' | 'failed'
    logs: string
  }> {
    // GET /api/v1/deployments/:id
  }

  async updateDomain(appId: string, newDomain: string): Promise<void> {
    // PATCH /api/v1/applications/:id
    // Met à jour le domaine quand le client connecte son propre domaine
  }
}
```

---

## 10. Pages frontend à implémenter

### apps/dashboard — Onboarding

```
/onboarding
  Step 1 à 20 : questionnaire progressif
    - Progress bar en haut (étape N/20)
    - Chaque étape : 1 question principale + aide contextuelle
    - Sauvegarde automatique à chaque étape (PUT /onboarding/step)
    - Boutons Précédent / Suivant
    - Étape 20 : récapitulatif + bouton "Générer mon site"

/onboarding/generating
  Page d'attente (polling GET /onboarding/status toutes les 5s)
    - Animation de génération (progress steps)
    - "Analyse de votre activité..." → "Génération du contenu..." → "Déploiement..."
    - Redirect automatique vers /overview quand done

/overview
  (déjà créé Sprint 1 — ajouter maintenant)
    - URL du site (sous-domaine temporaire) avec bouton "Voir mon site"
    - Statut des connexions Google (Analytics, GMB, GSC)
    - Bouton "Connecter mon domaine"
    - Section "Modules disponibles" (visuels sans prix encore — Sprint 5)

/settings/domain
  - Affichage du sous-domaine temporaire actuel
  - Formulaire de connexion domaine personnalisé
  - Instructions DNS étape par étape
  - Statut de vérification (polling)
  - Statut SSL

/settings/integrations
  - Bouton OAuth Google (Analytics, GSC, GMB, GTM)
  - Champ Pixel Facebook ID
  - Statut de chaque connexion (connecté / déconnecté)
```

### apps/dashboard — Éditeur de contenu CMS

```
/content
  Liste des pages avec statut (publié / brouillon)
  Bouton "Modifier" sur chaque page

/content/:pageSlug
  Éditeur de page :
    - Champs SEO (meta title, meta description)
    - Éditeur de contenu Lexical (texte riche)
    - Hero section (headline, subheadline, CTA)
    - Prévisualisation en temps réel (iframe du site)
    - Bouton "Publier les modifications"
```

---

## 11. Variables d'environnement Sprint 2

Ajouter dans ENV.md et dans Coolify staging :

```env
# Coolify
COOLIFY_BASE_URL=http://localhost:8000        # URL interne Coolify sur le VPS
COOLIFY_API_TOKEN=...
COOLIFY_TEAM_ID=...
COOLIFY_SERVER_ID=...                         # ID du serveur Hetzner dans Coolify

# Templates
SITE_TEMPLATE_REPO=https://github.com/wapixia/site-template
SITE_TEMPLATE_BRANCH=main

# Sous-domaines
WAPIXIA_BASE_DOMAIN=wapixia.com
WAPIXIA_PROXY_HOST=proxy.wapixia.com

# Payload CMS
PAYLOAD_SECRET=...                            # Min 32 chars random
PAYLOAD_URL=https://cms-staging.wapixia.com
CMS_PORT=3002

# Next.js sites
NEXT_REVALIDATE_TOKEN=...                     # Pour ISR on-demand revalidation
```

---

## 12. Instructions pour Claude Code

```
Tu travailles sur le Sprint 2 de WapixIA — Socle Site & CMS.

Contexte obligatoire à lire AVANT de coder (dans l'ordre) :
1. docs/ARCHITECTURE.md
2. docs/DATABASE.md
3. docs/CONVENTIONS.md
4. docs/ENV.md
5. docs/sprints/sprint-1/SPEC.md (auth existante)
6. docs/sprints/sprint-2/SPEC.md (ce fichier)
7. docs/sprints/sprint-2/ONBOARDING_FLOW.md (les 20 questions + prompts IA)
8. docs/sprints/sprint-2/SEO_CHECKLIST.md (tout le SEO/GEO/AEO)

Ordre de livraison (une branche par item) :
1. feat/sprint2-db-migrations — migrations 006 et 007
2. feat/sprint2-cms-setup — Payload CMS config + collections
3. feat/sprint2-ai-generator — service générateur de contenu Claude API
4. feat/sprint2-cloudflare — service sous-domaines
5. feat/sprint2-coolify — service déploiement
6. feat/sprint2-api-routes — routes onboarding + sites + google-oauth
7. feat/sprint2-themes — 8 templates Next.js sectoriels (structure + thème)
8. feat/sprint2-seo — sitemap, robots.txt, Schema.org, meta tags
9. feat/sprint2-frontend-onboarding — questionnaire 20 étapes + page generating
10. feat/sprint2-frontend-cms-editor — éditeur de contenu pages

Règles absolues rappel :
- TypeScript strict, zéro any
- SSR obligatoire sur toutes les pages publiques des sites clients
- Les animations (Aceternity, Magic UI) chargées en lazy-load après LCP
- images via next/image obligatoire
- Zod sur tous les inputs API
- Tester avec les comptes seed du Sprint 1
```
