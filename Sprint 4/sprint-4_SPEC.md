# SPRINT 4 — SPEC.md
# Dashboard Client & Rapport ROI Mensuel
> Durée : 1 semaine | Début : Semaine 7
> Objectif : le client voit la valeur de son abonnement chaque jour — et la reçoit par email chaque mois

---

## Contexte pour Claude Code

Lire en premier (ordre obligatoire) :
1. `docs/ARCHITECTURE.md`
2. `docs/DATABASE.md` — sections 2.8 (leads), 2.9 (competitors), monthly_stats
3. `docs/CONVENTIONS.md`
4. `docs/ENV.md` — sections Google APIs, Brevo
5. `docs/sprints/sprint-1/SPEC.md` — auth en place
6. `docs/sprints/sprint-2/SPEC.md` — sites et CMS
7. `docs/sprints/sprint-3/SPEC.md` — modules IA et contenus
8. `docs/sprints/sprint-4/SPEC.md` — ce fichier

Sprints 1, 2, 3 terminés. Les sites tournent, les modules IA génèrent du contenu. Ce sprint construit la couche de visibilité : le client doit voir ce que ça lui rapporte, chaque mois, sans avoir à chercher.

---

## 1. Périmètre du sprint

### Dans ce sprint ✅
- Migration : tables `leads`, `monthly_stats`, `competitors` (stub)
- Calcul du Visibility Score (algorithme)
- Import données Google Analytics 4 API
- Import données Google Search Console API
- Dashboard UI : Visibility Score, trafic, leads, contenus publiés
- Graphiques tendances (30j, 90j)
- Comparatif concurrents (top 3 GMB dans la zone)
- Génération rapport PDF mensuel automatique
- Envoi email Brevo le 1er du mois
- Job BullMQ `reports:monthly`
- Historique des rapports dans le backoffice

### Hors sprint ❌
- Heatmaps & sessions → V2
- A/B testing → V2
- Score de présence IA (ChatGPT/Perplexity) → V2
- Alertes concurrents avancées → V2
- Paiements → Sprint 5

---

## 2. Migrations BDD Sprint 4

### Migration 013 — Leads

```sql
-- packages/db/migrations/20260407_013_leads.sql

CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

  type            TEXT NOT NULL CHECK (type IN (
    'contact_form', 'quote_request', 'appointment',
    'phone_call', 'whatsapp', 'chatbot', 'email_click'
  )),

  first_name      TEXT,
  last_name       TEXT,
  email           TEXT,
  phone           TEXT,
  message         TEXT,
  files_urls      TEXT[],

  source_page     TEXT,
  source_module   TEXT,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  referrer        TEXT,

  estimated_value DECIMAL(10,2),

  status          TEXT DEFAULT 'new' CHECK (status IN (
    'new', 'contacted', 'qualified', 'won', 'lost'
  )),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_site   ON leads(site_id);
CREATE INDEX idx_leads_type   ON leads(type);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_date   ON leads(created_at DESC);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_rls" ON leads FOR ALL USING (
  site_id IN (
    SELECT id FROM sites WHERE organization_id = auth.organization_id()
    OR organization_id IN (
      SELECT id FROM organizations WHERE parent_id = auth.organization_id()
    )
  )
  OR auth.is_superadmin()
);
```

### Migration 014 — Stats mensuelles

```sql
-- packages/db/migrations/20260407_014_monthly_stats.sql

CREATE TABLE monthly_stats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

  period_year     INTEGER NOT NULL,
  period_month    INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),

  -- Trafic (depuis GA4)
  total_visits          INTEGER DEFAULT 0,
  unique_visitors       INTEGER DEFAULT 0,
  organic_visits        INTEGER DEFAULT 0,
  direct_visits         INTEGER DEFAULT 0,
  referral_visits       INTEGER DEFAULT 0,
  social_visits         INTEGER DEFAULT 0,
  avg_session_duration  INTEGER DEFAULT 0,   -- secondes
  bounce_rate           DECIMAL(5,2) DEFAULT 0,

  -- SEO (depuis Search Console)
  google_impressions    INTEGER DEFAULT 0,
  google_clicks         INTEGER DEFAULT 0,
  average_position      DECIMAL(5,2),
  top_queries           JSONB DEFAULT '[]',  -- [{ query, clicks, impressions, position }]

  -- Leads
  total_leads           INTEGER DEFAULT 0,
  leads_by_type         JSONB DEFAULT '{}',  -- { contact_form: N, quote: N, ... }
  estimated_revenue     DECIMAL(10,2) DEFAULT 0,

  -- Contenu publié
  blog_articles_published   INTEGER DEFAULT 0,
  social_posts_published    INTEGER DEFAULT 0,
  gmb_posts_published       INTEGER DEFAULT 0,
  reviews_replied           INTEGER DEFAULT 0,
  reviews_received          INTEGER DEFAULT 0,
  average_rating            DECIMAL(3,2),

  -- Scores
  visibility_score      INTEGER CHECK (visibility_score BETWEEN 0 AND 100),
  seo_score             INTEGER CHECK (seo_score BETWEEN 0 AND 100),
  reputation_score      INTEGER CHECK (reputation_score BETWEEN 0 AND 100),

  -- Mois précédent (pour les delta)
  prev_visits           INTEGER DEFAULT 0,
  prev_leads            INTEGER DEFAULT 0,
  prev_visibility_score INTEGER DEFAULT 0,

  -- Rapport PDF
  report_pdf_url        TEXT,
  report_sent_at        TIMESTAMPTZ,

  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(site_id, period_year, period_month)
);

CREATE INDEX idx_monthly_stats_site   ON monthly_stats(site_id);
CREATE INDEX idx_monthly_stats_period ON monthly_stats(period_year, period_month);

ALTER TABLE monthly_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_stats_rls" ON monthly_stats FOR ALL USING (
  site_id IN (
    SELECT id FROM sites WHERE organization_id = auth.organization_id()
    OR organization_id IN (
      SELECT id FROM organizations WHERE parent_id = auth.organization_id()
    )
  )
  OR auth.is_superadmin()
);
```

### Migration 015 — Concurrents (stub)

```sql
-- packages/db/migrations/20260407_015_competitors.sql

CREATE TABLE competitors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  website_url     TEXT,
  gmb_place_id    TEXT,
  distance_km     DECIMAL(5,2),

  gmb_rating      DECIMAL(3,2),
  gmb_review_count INTEGER DEFAULT 0,
  last_gmb_post   TIMESTAMPTZ,

  is_new          BOOLEAN DEFAULT TRUE,

  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_competitors_site ON competitors(site_id);

ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "competitors_rls" ON competitors FOR ALL USING (
  site_id IN (
    SELECT id FROM sites WHERE organization_id = auth.organization_id()
  )
  OR auth.is_superadmin()
);
```

### Migration 016 — Reports générés

```sql
-- packages/db/migrations/20260407_016_reports.sql

CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

  period_year     INTEGER NOT NULL,
  period_month    INTEGER NOT NULL,

  pdf_url         TEXT,                     -- URL Cloudflare R2
  pdf_size_bytes  INTEGER,
  email_sent      BOOLEAN DEFAULT FALSE,
  email_sent_at   TIMESTAMPTZ,
  email_opened    BOOLEAN DEFAULT FALSE,

  -- Snapshot des stats au moment du rapport
  stats_snapshot  JSONB NOT NULL,           -- copie de monthly_stats

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(site_id, period_year, period_month)
);

CREATE INDEX idx_reports_site ON reports(site_id);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_rls" ON reports FOR ALL USING (
  site_id IN (
    SELECT id FROM sites WHERE organization_id = auth.organization_id()
    OR organization_id IN (
      SELECT id FROM organizations WHERE parent_id = auth.organization_id()
    )
  )
  OR auth.is_superadmin()
);
```

---

## 3. Algorithme Visibility Score

```typescript
// packages/api/src/services/visibility-score.service.ts

/**
 * Calcule le Visibility Score (0-100) d'un site
 * Composé de 5 piliers pondérés
 */
export async function calculateVisibilityScore(siteId: string): Promise<{
  score: number
  breakdown: VisibilityBreakdown
}> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [site, stats, reviews, contents, modules] = await Promise.all([
    getSiteWithSettings(siteId),
    getMonthlyStats(siteId, year, month),
    getReviewStats(siteId),
    getContentStats(siteId, year, month),
    getActiveModules(siteId),
  ])

  // ── PILIER 1 : SEO (30 points max) ──────────────────────────────
  // Basé sur les données Google Search Console
  const seoScore = calculateSEOPillar({
    avgPosition: stats?.averagePosition,        // < 10 = max points
    clicks: stats?.googleClicks,                // relatif au mois précédent
    impressions: stats?.googleImpressions,
    hasGSCConnected: !!site.googleSearchConsole,
    hasSitemap: true,                           // toujours true si déployé
    hasSchemaOrg: true,                         // toujours true si généré par WapixIA
  })

  // ── PILIER 2 : Réputation (25 points max) ───────────────────────
  // Basé sur les avis Google
  const reputationScore = calculateReputationPillar({
    avgRating: reviews.avgRating,               // 5 étoiles = max
    reviewCount: reviews.total,                 // > 20 avis = max
    replyRate: reviews.replyRate,               // % d'avis avec réponse
    recentReviews: reviews.lastMonthCount,      // avis du mois
  })

  // ── PILIER 3 : Activité Digitale (25 points max) ────────────────
  // Basé sur les contenus publiés
  const activityScore = calculateActivityPillar({
    socialPostsThisMonth: contents.socialPosts,
    gmbPostsThisMonth: contents.gmbPosts,
    blogArticlesThisMonth: contents.blogArticles,
    activeModules: modules.length,
    lastPublishedAt: contents.lastPublishedAt,
  })

  // ── PILIER 4 : Trafic (15 points max) ───────────────────────────
  // Basé sur Google Analytics 4
  const trafficScore = calculateTrafficPillar({
    organicVisits: stats?.organicVisits,
    totalVisits: stats?.totalVisits,
    growthVsPrevMonth: stats
      ? ((stats.totalVisits - stats.prevVisits) / Math.max(stats.prevVisits, 1)) * 100
      : 0,
    hasGA4Connected: !!site.googleAnalyticsId,
  })

  // ── PILIER 5 : Présence Locale (5 points max) ───────────────────
  // Basé sur la complétude du profil
  const localScore = calculateLocalPillar({
    hasGMB: !!site.gmbLocationId,
    hasCustomDomain: !!site.customDomain && site.domainVerified,
    hasLogo: true,                              // généré au Sprint 2
    hasPhone: !!site.phone,
    hasAddress: true,                           // onboarding obligatoire
    hasSocialAccounts: modules.includes('social_posts'),
  })

  const total = Math.round(seoScore + reputationScore + activityScore + trafficScore + localScore)

  return {
    score: Math.min(100, total),
    breakdown: {
      seo: { score: Math.round(seoScore), max: 30, label: 'Référencement' },
      reputation: { score: Math.round(reputationScore), max: 25, label: 'Réputation' },
      activity: { score: Math.round(activityScore), max: 25, label: 'Activité digitale' },
      traffic: { score: Math.round(trafficScore), max: 15, label: 'Trafic' },
      local: { score: Math.round(localScore), max: 5, label: 'Présence locale' },
    }
  }
}

function calculateSEOPillar(data: SEOPillarData): number {
  if (!data.hasGSCConnected) return 10  // points de base même sans connexion

  let score = 10  // base (site déployé + sitemap + Schema)

  // Position moyenne Google
  if (data.avgPosition) {
    if (data.avgPosition <= 3) score += 12
    else if (data.avgPosition <= 10) score += 9
    else if (data.avgPosition <= 20) score += 6
    else if (data.avgPosition <= 50) score += 3
  }

  // Clics organiques
  if (data.clicks) {
    if (data.clicks >= 100) score += 8
    else if (data.clicks >= 50) score += 5
    else if (data.clicks >= 10) score += 2
  }

  return Math.min(30, score)
}

function calculateReputationPillar(data: ReputationPillarData): number {
  let score = 0

  // Note moyenne
  if (data.avgRating >= 4.5) score += 12
  else if (data.avgRating >= 4.0) score += 9
  else if (data.avgRating >= 3.5) score += 6
  else if (data.avgRating >= 3.0) score += 3

  // Nombre d'avis
  if (data.reviewCount >= 50) score += 8
  else if (data.reviewCount >= 20) score += 6
  else if (data.reviewCount >= 10) score += 4
  else if (data.reviewCount >= 5) score += 2

  // Taux de réponse
  if (data.replyRate >= 0.8) score += 5
  else if (data.replyRate >= 0.5) score += 3
  else if (data.replyRate >= 0.2) score += 1

  return Math.min(25, score)
}

function calculateActivityPillar(data: ActivityPillarData): number {
  let score = 0

  // Posts sociaux
  if (data.socialPostsThisMonth >= 12) score += 8
  else if (data.socialPostsThisMonth >= 8) score += 6
  else if (data.socialPostsThisMonth >= 4) score += 3
  else if (data.socialPostsThisMonth >= 1) score += 1

  // Posts GMB
  if (data.gmbPostsThisMonth >= 4) score += 7
  else if (data.gmbPostsThisMonth >= 2) score += 5
  else if (data.gmbPostsThisMonth >= 1) score += 2

  // Articles blog
  if (data.blogArticlesThisMonth >= 4) score += 7
  else if (data.blogArticlesThisMonth >= 2) score += 5
  else if (data.blogArticlesThisMonth >= 1) score += 2

  // Modules actifs
  if (data.activeModules >= 3) score += 3
  else if (data.activeModules >= 1) score += 1

  return Math.min(25, score)
}

function calculateTrafficPillar(data: TrafficPillarData): number {
  if (!data.hasGA4Connected) return 2  // minimum sans connexion

  let score = 3  // base si GA4 connecté

  // Visites organiques sur total
  const organicRate = data.totalVisits > 0
    ? data.organicVisits / data.totalVisits
    : 0

  if (organicRate >= 0.5) score += 6
  else if (organicRate >= 0.3) score += 4
  else if (organicRate >= 0.1) score += 2

  // Croissance mois sur mois
  if (data.growthVsPrevMonth >= 20) score += 6
  else if (data.growthVsPrevMonth >= 10) score += 4
  else if (data.growthVsPrevMonth >= 0) score += 2

  return Math.min(15, score)
}

function calculateLocalPillar(data: LocalPillarData): number {
  let score = 0
  if (data.hasGMB) score += 2
  if (data.hasCustomDomain) score += 1
  if (data.hasPhone) score += 1
  if (data.hasSocialAccounts) score += 1
  return Math.min(5, score)
}
```

---

## 4. Service Analytics — Import GA4 et GSC

```typescript
// packages/api/src/services/analytics.service.ts

export class AnalyticsService {

  /**
   * Importe les données GA4 du mois courant
   */
  async importGA4Data(siteId: string): Promise<GA4Data> {
    const site = await getSiteWithGoogleToken(siteId)
    if (!site.googleAnalyticsId || !site.googleOauthToken) {
      throw new Error('Google Analytics non connecté')
    }

    const token = decrypt(site.googleOauthToken, process.env.ENCRYPTION_KEY)
    const analytics = google.analyticsdata({ version: 'v1beta', auth: createOAuth2(token) })

    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const response = await analytics.properties.runReport({
      property: `properties/${site.googleAnalyticsId}`,
      requestBody: {
        dateRanges: [{
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        }],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'newUsers' },
        ],
        dimensions: [
          { name: 'sessionDefaultChannelGroup' },
        ],
      }
    })

    return parseGA4Response(response.data)
  }

  /**
   * Importe les données Search Console du mois courant
   */
  async importSearchConsoleData(siteId: string): Promise<GSCData> {
    const site = await getSiteWithGoogleToken(siteId)
    if (!site.googleSearchConsole || !site.googleOauthToken) {
      throw new Error('Google Search Console non connecté')
    }

    const token = decrypt(site.googleOauthToken, process.env.ENCRYPTION_KEY)
    const searchconsole = google.searchconsole({ version: 'v1', auth: createOAuth2(token) })

    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const siteUrl = site.customDomain
      ? `https://${site.customDomain}/`
      : `https://${site.tempDomain}/`

    // Données agrégées
    const aggregated = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dimensions: [],
      }
    })

    // Top 10 requêtes
    const topQueries = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dimensions: ['query'],
        rowLimit: 10,
        dimensionFilterGroups: [],
      }
    })

    return {
      impressions: aggregated.data.rows?.[0]?.impressions || 0,
      clicks: aggregated.data.rows?.[0]?.clicks || 0,
      averagePosition: aggregated.data.rows?.[0]?.position || null,
      topQueries: topQueries.data.rows?.map(r => ({
        query: r.keys?.[0] || '',
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        position: r.position || 0,
      })) || [],
    }
  }
}
```

---

## 5. Générateur de rapport PDF

```typescript
// packages/api/src/services/report-generator.service.ts

import { renderToBuffer } from '@react-pdf/renderer'
import { MonthlyReport } from '../pdf-templates/MonthlyReport'

export async function generateMonthlyReport(siteId: string): Promise<{
  pdfUrl: string
  pdfSizeBytes: number
}> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()  // mois précédent (le rapport est pour le mois écoulé)
  const reportMonth = month === 0 ? 12 : month
  const reportYear = month === 0 ? year - 1 : year

  // 1. Récupérer toutes les données
  const [site, stats, recentLeads, topContent, scoreBreakdown, competitors] = await Promise.all([
    getSiteWithSettings(siteId),
    getMonthlyStats(siteId, reportYear, reportMonth),
    getRecentLeads(siteId, 5),
    getTopPerformingContent(siteId, reportYear, reportMonth),
    calculateVisibilityScore(siteId),
    getTopCompetitors(siteId, 3),
  ])

  // 2. Calculer les deltas vs mois précédent
  const prevStats = await getMonthlyStats(siteId, reportYear, reportMonth - 1 || 12)

  const deltas = {
    visits: calculateDelta(stats?.totalVisits, prevStats?.totalVisits),
    leads: calculateDelta(stats?.totalLeads, prevStats?.totalLeads),
    visibilityScore: calculateDelta(stats?.visibilityScore, prevStats?.visibilityScore),
    googleClicks: calculateDelta(stats?.googleClicks, prevStats?.googleClicks),
  }

  // 3. Générer les recommandations IA pour le mois suivant
  const recommendations = await generateRecommendations(site, stats, scoreBreakdown)

  // 4. Rendre le PDF
  const pdfBuffer = await renderToBuffer(
    MonthlyReport({
      site,
      stats,
      deltas,
      scoreBreakdown,
      recentLeads,
      topContent,
      competitors,
      recommendations,
      period: { year: reportYear, month: reportMonth },
    })
  )

  // 5. Uploader sur Cloudflare R2
  const fileName = `reports/${siteId}/${reportYear}-${String(reportMonth).padStart(2, '0')}.pdf`
  await r2Client.put(fileName, pdfBuffer, { contentType: 'application/pdf' })
  const pdfUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${fileName}`

  // 6. Sauvegarder en BDD
  await db.insert(reports).values({
    siteId,
    periodYear: reportYear,
    periodMonth: reportMonth,
    pdfUrl,
    pdfSizeBytes: pdfBuffer.byteLength,
    statsSnapshot: stats,
  }).onConflictDoUpdate({
    target: [reports.siteId, reports.periodYear, reports.periodMonth],
    set: { pdfUrl, pdfSizeBytes: pdfBuffer.byteLength },
  })

  return { pdfUrl, pdfSizeBytes: pdfBuffer.byteLength }
}

/**
 * Génère 3 recommandations IA personnalisées pour le mois suivant
 */
async function generateRecommendations(
  site: Site,
  stats: MonthlyStats | null,
  score: VisibilityBreakdown
): Promise<string[]> {
  const prompt = `
Tu es un expert en marketing digital pour les PME locales belges.
Analyse ces données pour ${site.name} (${site.sector} à ${site.city}) et génère
3 recommandations concrètes et actionnables pour améliorer leur présence digitale le mois prochain.

DONNÉES DU MOIS :
- Visibility Score : ${stats?.visibilityScore || 0}/100
- Pilier SEO : ${score.breakdown.seo.score}/${score.breakdown.seo.max}
- Pilier Réputation : ${score.breakdown.reputation.score}/${score.breakdown.reputation.max}
- Pilier Activité : ${score.breakdown.activity.score}/${score.breakdown.activity.max}
- Trafic total : ${stats?.totalVisits || 0} visites
- Leads générés : ${stats?.totalLeads || 0}
- Articles publiés : ${stats?.blogArticlesPublished || 0}
- Posts RS publiés : ${stats?.socialPostsPublished || 0}
- Avis reçus : ${stats?.reviewsReceived || 0} (répondus : ${stats?.reviewsReplied || 0})

RÉPONSE (JSON strict) :
{
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "action": "string — action concrète en 1 phrase (ex: 'Publier 2 posts Instagram par semaine')",
      "why": "string — pourquoi cette action est prioritaire maintenant (30-50 mots)",
      "impact": "string — impact attendu en termes business (30-50 mots)"
    }
  ]
}
`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const data = JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '{}')
  return data.recommendations || []
}
```

---

## 6. Template PDF — Structure

```typescript
// packages/api/src/pdf-templates/MonthlyReport.tsx
// Utilise @react-pdf/renderer

import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
    padding: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#00D4B1',
  },
  // ... voir StyleSheet complet dans le code
})

export function MonthlyReport(props: ReportProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Page 1 — Résumé exécutif */}
        <Header site={props.site} period={props.period} />
        <VisibilityScoreSection score={props.scoreBreakdown} />
        <KPISummary stats={props.stats} deltas={props.deltas} />

        {/* Page 2 — Détail SEO & Trafic */}
        <TrafficSection stats={props.stats} />
        <SEOSection stats={props.stats} />

        {/* Page 3 — Contenus & Réputation */}
        <ContentSection content={props.topContent} />
        <ReputationSection stats={props.stats} />

        {/* Page 4 — Concurrents & Recommandations */}
        <CompetitorsSection competitors={props.competitors} site={props.site} />
        <RecommendationsSection recommendations={props.recommendations} />

        {/* Footer */}
        <Footer site={props.site} generatedAt={new Date()} />
      </Page>
    </Document>
  )
}
```

### Sections du rapport PDF

```
PAGE 1 — RÉSUMÉ EXÉCUTIF
  ├── Header : logo WapixIA + nom du site + période
  ├── Visibility Score : gauge 0-100 + décomposition 5 piliers
  │   ├── Pilier SEO (30pts)
  │   ├── Pilier Réputation (25pts)
  │   ├── Pilier Activité (25pts)
  │   ├── Pilier Trafic (15pts)
  │   └── Pilier Local (5pts)
  └── 4 KPIs clés : Visites | Leads | Avis | Position Google
      └── Delta vs mois précédent (↑ +12% / ↓ -5%)

PAGE 2 — TRAFIC & SEO
  ├── Graphique trafic mensuel (barres)
  ├── Sources de trafic (organique, direct, réseaux sociaux, référencement)
  ├── Top 5 requêtes Google Search Console
  └── Position moyenne Google (avec évolution)

PAGE 3 — CONTENU & RÉPUTATION
  ├── Contenus publiés : N posts RS | N posts GMB | N articles blog
  ├── Top 3 contenus les plus performants
  ├── Avis Google : reçus | répondus | note moyenne
  └── Leads générés par type (formulaire, téléphone, RDV...)

PAGE 4 — CONCURRENTS & RECOMMANDATIONS
  ├── Top 3 concurrents locaux (distance, note GMB, nb avis)
  ├── Comparaison Visibility Score vs concurrents (si disponible)
  └── 3 recommandations IA personnalisées pour le mois prochain
      avec priorité (🔴 Haute / 🟡 Moyenne / 🟢 Faible)
```

---

## 7. Job BullMQ — Rapport mensuel

```typescript
// packages/queue/src/jobs/reports/monthly-report.job.ts

interface MonthlyReportJobData {
  siteId: string
  forceRegenerate?: boolean
}

export async function processMonthlyReport(job: Job<MonthlyReportJobData>): Promise<void> {
  const { siteId } = job.data

  await job.log(`[${siteId}] Début génération rapport mensuel`)
  await job.updateProgress(5)

  // 1. Importer les données Analytics
  try {
    const analyticsData = await analyticsService.importGA4Data(siteId)
    const gscData = await analyticsService.importSearchConsoleData(siteId)

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() // mois précédent

    await db.insert(monthlyStats)
      .values({
        siteId,
        periodYear: month === 0 ? year - 1 : year,
        periodMonth: month === 0 ? 12 : month,
        totalVisits: analyticsData.sessions,
        uniqueVisitors: analyticsData.activeUsers,
        organicVisits: analyticsData.organicSessions,
        avgSessionDuration: analyticsData.avgSessionDuration,
        bounceRate: analyticsData.bounceRate,
        googleImpressions: gscData.impressions,
        googleClicks: gscData.clicks,
        averagePosition: gscData.averagePosition,
        topQueries: gscData.topQueries,
      })
      .onConflictDoUpdate({ target: [monthlyStats.siteId, monthlyStats.periodYear, monthlyStats.periodMonth], set: {} })

  } catch (error) {
    await job.log(`Analytics non disponibles : ${error.message} — rapport sans trafic`)
  }

  await job.updateProgress(30)

  // 2. Calculer les stats leads du mois
  await computeLeadStats(siteId)
  await job.updateProgress(40)

  // 3. Calculer le Visibility Score
  const { score, breakdown } = await calculateVisibilityScore(siteId)
  await db.update(sites).set({ visibilityScore: score }).where(eq(sites.id, siteId))
  await job.updateProgress(55)

  // 4. Détecter les concurrents GMB (simple proximity search)
  await detectLocalCompetitors(siteId)
  await job.updateProgress(65)

  // 5. Générer le PDF
  const { pdfUrl } = await generateMonthlyReport(siteId)
  await job.updateProgress(85)

  // 6. Envoyer par email
  const site = await getSiteWithOwner(siteId)
  await brevoService.send({
    templateId: process.env.BREVO_TEMPLATE_MONTHLY_REPORT,
    to: site.ownerEmail,
    params: {
      siteName: site.name,
      month: getMonthName(),
      visibilityScore: score,
      pdfUrl,
      dashboardUrl: `https://app.wapixia.com/reports`,
    },
  })

  await db.update(reports)
    .set({ emailSent: true, emailSentAt: new Date() })
    .where(and(
      eq(reports.siteId, siteId),
      eq(reports.periodYear, now.getFullYear()),
    ))

  await job.updateProgress(100)
  await job.log(`[${siteId}] Rapport envoyé — Score: ${score}/100 — PDF: ${pdfUrl}`)
}

// Scheduler — le 1er de chaque mois à 6h du matin
cron.schedule('0 6 1 * *', async () => {
  const activeSites = await getActiveSites()
  for (const site of activeSites) {
    await reportQueue.add('monthly-report', { siteId: site.id }, {
      delay: Math.random() * 3600_000,  // étaler sur 1h pour ne pas surcharger
    })
  }
})
```

---

## 8. Routes API Sprint 4

```
GET  /api/v1/sites/:id/dashboard         Stats dashboard temps réel
GET  /api/v1/sites/:id/stats             Stats mensuelles (avec params year/month)
GET  /api/v1/sites/:id/reports           Historique des rapports
GET  /api/v1/sites/:id/reports/:year/:month  Rapport spécifique (URL PDF)
POST /api/v1/sites/:id/reports/generate  Forcer génération manuelle
GET  /api/v1/sites/:id/competitors       Liste des concurrents détectés
GET  /api/v1/sites/:id/leads             Leads reçus (filtrable)
GET  /api/v1/sites/:id/visibility-score  Score actuel + décomposition
```

### Détail — GET /api/v1/sites/:id/dashboard

```typescript
// Retourne toutes les données nécessaires au dashboard en 1 appel
// Données mises en cache Redis 1h

interface DashboardResponse {
  visibilityScore: {
    current: number
    breakdown: VisibilityBreakdown
    trend: number[]            // 12 derniers mois
  }
  currentMonth: {
    visits: number
    leads: number
    contentPublished: number
    reviewsReplied: number
    avgRating: number
  }
  deltas: {                    // vs mois précédent
    visits: number             // % change
    leads: number
    visibilityScore: number
  }
  pendingContent: number       // contenus en attente de validation
  recentLeads: Lead[]          // 5 derniers leads
  activeModules: string[]      // IDs des modules actifs
  googleConnections: {
    analytics: boolean
    searchConsole: boolean
    gmb: boolean
  }
}
```

---

## 9. Pages frontend à implémenter

### apps/dashboard — /overview (refonte Sprint 4)

```
/overview
  ┌── Score Card : Visibility Score (gauge animée 0-100)
  │   └── Décomposition des 5 piliers (barres colorées)
  │
  ├── Row KPIs : [Visites] [Leads] [Avis] [Position Google]
  │   └── Chaque KPI avec delta vs mois précédent (badge ↑↓)
  │
  ├── Graphique trafic 30 jours (LineChart recharts)
  │   └── Lignes : organique, total
  │
  ├── Section "Ce mois" :
  │   ├── Posts publiés : N posts FB | N posts IG | N posts GMB | N articles
  │   └── Leads : N formulaires | N appels | N RDV
  │
  ├── Section "Derniers leads" :
  │   └── Liste des 5 derniers leads avec type + date + statut
  │
  ├── Section "Contenus en attente" :
  │   └── Badge rouge si N > 0 → link vers /content
  │
  └── Section "Connexions" :
      └── Statut Google Analytics | Search Console | GMB (connecté / non connecté)
```

### apps/dashboard — /analytics

```
/analytics
  Filtres : [Ce mois] [3 derniers mois] [6 mois] [12 mois]

  ├── Graphique trafic mensuel (BarChart)
  │   └── Barres : organique, direct, social, référencement
  │
  ├── Graphique Visibility Score historique (LineChart)
  │   └── Évolution sur les 12 derniers mois
  │
  ├── Section SEO :
  │   ├── Impressions Google + Clics + Position moyenne
  │   └── Tableau top 10 requêtes (query | clics | impressions | position)
  │
  └── Section Leads :
      ├── Graphique leads par type (donut chart)
      └── Liste des leads avec export CSV
```

### apps/dashboard — /reports

```
/reports
  Liste de tous les rapports générés :
  ├── Chaque rapport : mois + Visibility Score + statut email
  ├── Bouton "Télécharger PDF"
  └── Bouton "Générer maintenant" (déclenche le job manuellement)
```

### apps/admin — Dashboard SuperAdmin (enrichi)

```
/dashboard (SuperAdmin)
  ├── KPIs globaux : sites actifs | MRR total | modules actifs | score moyen
  ├── Tableau sites récents avec Visibility Score
  ├── Graphique MRR mensuel
  └── Alertes : coûts Claude > seuil | sites down | avis négatifs non traités
```

---

## 10. Variables d'environnement Sprint 4

```env
# @react-pdf/renderer — aucune variable nécessaire (server-side)

# Cache Redis dashboard
DASHBOARD_CACHE_TTL_SECONDS=3600

# Rapport mensuel
REPORT_GENERATION_DELAY_MS=1800000  # 30 min entre chaque rapport (éviter surcharge)

# Brevo templates
BREVO_TEMPLATE_MONTHLY_REPORT=7     # ID du template rapport mensuel Brevo
```

---

## 11. Instructions pour Claude Code

```
Tu travailles sur le Sprint 4 de WapixIA — Dashboard Client & Rapport ROI.

Contexte obligatoire à lire AVANT de coder (dans l'ordre) :
1. docs/ARCHITECTURE.md
2. docs/DATABASE.md
3. docs/CONVENTIONS.md
4. docs/ENV.md
5. docs/sprints/sprint-3/SPEC.md (modules et contenus en BDD)
6. docs/sprints/sprint-4/SPEC.md (ce fichier)

Ordre de livraison (une branche par item) :
1. feat/sprint4-db-migrations         — migrations 013 à 016
2. feat/sprint4-visibility-score      — algorithme calcul score (5 piliers)
3. feat/sprint4-analytics-service     — import GA4 + Search Console
4. feat/sprint4-report-generator      — génération PDF @react-pdf/renderer
5. feat/sprint4-report-job            — worker BullMQ + scheduler 1er du mois
6. feat/sprint4-api-dashboard         — routes /dashboard, /stats, /reports
7. feat/sprint4-frontend-overview     — page /overview refonte complète
8. feat/sprint4-frontend-analytics    — page /analytics + graphiques
9. feat/sprint4-frontend-reports      — page /reports + téléchargement PDF

Règles spécifiques Sprint 4 :
- Dashboard mis en cache Redis 1h (invalider si nouvelle donnée reçue)
- Le rapport PDF doit faire max 4 pages A4 — ne pas dépasser
- Si GA4 ou GSC non connecté → afficher les données disponibles sans erreur
- Déltas calculés vs le mois précédent — si pas de données précédentes, afficher "–"
- Graphiques avec recharts (déjà dans les dépendances)
- Le PDF doit être généré server-side uniquement (@react-pdf/renderer, pas de browser PDF)
- Toujours afficher un état "chargement" pendant le fetch des stats
```
