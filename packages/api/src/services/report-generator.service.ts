/**
 * Service Report Generator — Generation de rapports mensuels PDF
 * Sprint 4 : orchestration complète, upload R2 en stub
 *
 * Workflow :
 *   1. Fetch site + analytics stats
 *   2. Calculer visibility score + deltas vs mois précédent
 *   3. Générer 3 recommandations via Claude Haiku
 *   4. Render PDF avec @react-pdf/renderer
 *   5. Upload vers R2 (stub)
 *   6. Sauvegarder dans la table reports
 */

import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  calculateVisibilityScore,
  type VisibilityScoreResult,
} from './visibility-score.service.js'
import { createAnalyticsService } from './analytics.service.js'
import {
  MonthlyReport,
  type MonthlyReportData,
  type RecommendationData,
  type KPIData,
  type TrafficBreakdownItem,
  type QueryRow,
  type ContentStat,
  type ReputationStat,
  type LeadStat,
  type CompetitorData,
  type PillarBreakdown,
} from '../pdf-templates/MonthlyReport.js'

// ---------- Types ----------

export interface ReportGenerationResult {
  pdfUrl: string
  pdfSizeBytes: number
  reportId: string
}

interface SiteRecord {
  id: string
  name: string
  sector: string
  custom_domain: string | null
  status: string
  organization_id: string
  onboarding_data: Record<string, unknown> | null
}

interface ReportStats {
  totalSessions: number
  totalUsers: number
  totalPageViews: number
  organicRate: number
  totalClicks: number
  totalImpressions: number
  avgPosition: number
  avgCTR: number
}

// ---------- Constants ----------

const HAIKU_MODEL = 'claude-haiku-4-5-20250414'
const HAIKU_MAX_TOKENS = 2048

// ---------- Helpers ----------

function createServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function formatPeriod(): string {
  const now = new Date()
  const monthNames = [
    'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
  ]
  return `${monthNames[now.getMonth()]} ${now.getFullYear()}`
}

function formatDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

// ---------- Recommendation generation ----------

/**
 * Generate 3 AI recommendations using Claude Haiku.
 * Based on site context, analytics stats, and visibility score.
 */
export async function generateRecommendations(
  site: SiteRecord,
  stats: ReportStats,
  score: VisibilityScoreResult,
): Promise<RecommendationData[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    console.log('[ReportGenerator] STUB: generateRecommendations — no ANTHROPIC_API_KEY')
    return [
      {
        title: 'Optimiser le SEO local',
        body: 'Ajoutez des mots-cles locaux dans vos titres et descriptions pour ameliorer votre positionnement dans les recherches locales. Ciblez des requetes incluant votre ville et votre secteur.',
      },
      {
        title: 'Augmenter la frequence de publication',
        body: 'Publiez au moins 3 articles de blog et 8 posts sociaux par mois pour maintenir une activite reguliere. Les moteurs de recherche favorisent les sites avec du contenu frais.',
      },
      {
        title: 'Repondre a tous les avis Google',
        body: 'Votre taux de reponse aux avis peut etre ameliore. Repondez a chaque avis dans les 24h pour montrer votre engagement envers vos clients et ameliorer votre e-reputation.',
      },
    ]
  }

  const anthropic = new Anthropic({ apiKey })

  const breakdown = score.breakdown
  const prompt = `Tu es un consultant en visibilite digitale pour les PME locales belges.

Contexte entreprise :
- Nom : ${site.name}
- Secteur : ${site.sector}
- Score de visibilite : ${score.score}/100
- SEO : ${breakdown.seo.weighted}/${breakdown.seo.maxPoints}
- Reputation : ${breakdown.reputation.weighted}/${breakdown.reputation.maxPoints}
- Activite : ${breakdown.activity.weighted}/${breakdown.activity.maxPoints}
- Traffic : ${breakdown.traffic.weighted}/${breakdown.traffic.maxPoints}
- Local : ${breakdown.local.weighted}/${breakdown.local.maxPoints}

Statistiques du mois :
- Sessions totales : ${stats.totalSessions}
- Taux organique : ${Math.round(stats.organicRate * 100)}%
- Clics GSC : ${stats.totalClicks}
- Position moyenne : ${stats.avgPosition}

Genere exactement 3 recommandations concretes et actionnables pour ameliorer la visibilite de cette entreprise. Concentre-toi sur les piliers les plus faibles.

Reponds en JSON strict :
[
  { "title": "Titre court de la recommandation", "body": "Description detaillee en 2-3 phrases avec des actions concretes." }
]`

  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: HAIKU_MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude response did not contain a text block')
  }

  let parsed: RecommendationData[]
  try {
    let cleaned = textBlock.text.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(cleaned.indexOf('\n') + 1)
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3).trim()
      }
    }
    parsed = JSON.parse(cleaned) as RecommendationData[]
  } catch {
    throw new Error('Failed to parse recommendations JSON from Claude')
  }

  return parsed.slice(0, 3)
}

// ---------- Data assembly ----------

async function fetchSiteRecord(
  supabase: SupabaseClient,
  siteId: string,
): Promise<SiteRecord> {
  const { data: site, error } = await supabase
    .from('sites')
    .select('id, name, sector, custom_domain, status, organization_id, onboarding_data')
    .eq('id', siteId)
    .single()

  if (error || !site) {
    throw new Error(`Site not found: ${siteId}`)
  }

  return site as SiteRecord
}

async function fetchPreviousMonthStats(
  supabase: SupabaseClient,
  siteId: string,
): Promise<ReportStats | null> {
  const { data: prevReport } = await supabase
    .from('reports')
    .select('stats')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!prevReport || prevReport.length === 0) return null

  return (prevReport[0].stats ?? null) as ReportStats | null
}

async function fetchContentStats(
  supabase: SupabaseClient,
  siteId: string,
): Promise<ContentStat[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const types = ['blog_article', 'social_post', 'gmb_post'] as const
  const labels: Record<string, string> = {
    blog_article: 'Articles de blog',
    social_post: 'Posts sociaux',
    gmb_post: 'Posts GMB',
  }

  const stats: ContentStat[] = []

  for (const type of types) {
    const { count } = await supabase
      .from('ai_contents')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('type', type)
      .eq('status', 'published')
      .gte('created_at', thirtyDaysAgo)

    stats.push({ label: labels[type], value: count ?? 0 })
  }

  return stats
}

async function fetchReputationStats(
  supabase: SupabaseClient,
  siteId: string,
): Promise<ReputationStat> {
  const { data: reviews } = await supabase
    .from('google_reviews')
    .select('rating, reply_text, created_at')
    .eq('site_id', siteId)

  if (!reviews || reviews.length === 0) {
    return { avgRating: 0, totalReviews: 0, replyRate: 0, newReviewsThisMonth: 0 }
  }

  const total = reviews.length
  const avgRating =
    Math.round((reviews.reduce((s, r) => s + (r.rating as number), 0) / total) * 10) / 10
  const withReply = reviews.filter((r) => r.reply_text !== null && r.reply_text !== '').length
  const replyRate = total > 0 ? Math.round((withReply / total) * 100) / 100 : 0

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const newReviewsThisMonth = reviews.filter(
    (r) => (r.created_at as string) >= thirtyDaysAgo,
  ).length

  return { avgRating, totalReviews: total, replyRate, newReviewsThisMonth }
}

async function fetchLeadStats(
  supabase: SupabaseClient,
  siteId: string,
): Promise<LeadStat[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const leadTypes = ['form', 'phone', 'email', 'chat'] as const
  const labels: Record<string, string> = {
    form: 'Formulaire',
    phone: 'Telephone',
    email: 'Email',
    chat: 'Chat',
  }

  const leads: LeadStat[] = []

  for (const type of leadTypes) {
    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('type', type)
      .gte('created_at', thirtyDaysAgo)

    leads.push({ type: labels[type], count: count ?? 0 })
  }

  return leads
}

async function fetchCompetitors(
  supabase: SupabaseClient,
  siteId: string,
): Promise<CompetitorData[]> {
  const { data: competitors } = await supabase
    .from('competitors')
    .select('name, visibility_score')
    .eq('site_id', siteId)
    .order('visibility_score', { ascending: false })
    .limit(5)

  if (!competitors || competitors.length === 0) return []

  return competitors.map((c) => ({
    name: c.name as string,
    score: (c.visibility_score as number) ?? 0,
  }))
}

// ---------- PDF upload (stub) ----------

async function uploadPdfToR2(
  buffer: Buffer,
  siteId: string,
  period: string,
): Promise<{ url: string; sizeBytes: number }> {
  // TODO Sprint 6: Real R2/S3 upload
  const filename = `reports/${siteId}/${period.replace(/\s/g, '-').toLowerCase()}.pdf`
  const fakeUrl = `https://cdn.wapixia.com/${filename}`
  console.log(
    `[ReportGenerator] STUB: uploadPdfToR2 — ${fakeUrl} (${buffer.length} bytes)`,
  )
  return { url: fakeUrl, sizeBytes: buffer.length }
}

// ---------- Main export ----------

/**
 * Generate the full monthly report PDF for a site.
 * Orchestrates: analytics import, score calculation, AI recommendations,
 * PDF rendering, upload, and database save.
 */
export async function generateMonthlyReport(
  siteId: string,
): Promise<ReportGenerationResult> {
  const supabase = createServiceClient()
  const analytics = createAnalyticsService()

  // 1. Fetch site data
  const site = await fetchSiteRecord(supabase, siteId)

  // 2. Import analytics (stubs in Sprint 4)
  const [ga4Data, gscData] = await Promise.all([
    analytics.importGA4Data(siteId),
    analytics.importSearchConsoleData(siteId),
  ])

  // 3. Calculate visibility score
  const scoreResult = await calculateVisibilityScore(siteId)

  // 4. Fetch previous month stats for deltas
  const prevStats = await fetchPreviousMonthStats(supabase, siteId)

  // 5. Current stats
  const currentStats: ReportStats = {
    totalSessions: ga4Data.totalSessions,
    totalUsers: ga4Data.totalUsers,
    totalPageViews: ga4Data.totalPageViews,
    organicRate: ga4Data.organicRate,
    totalClicks: gscData.totalClicks,
    totalImpressions: gscData.totalImpressions,
    avgPosition: gscData.avgPosition,
    avgCTR: gscData.avgCTR,
  }

  // 6. Generate AI recommendations
  const recommendations = await generateRecommendations(site, currentStats, scoreResult)

  // 7. Fetch additional data in parallel
  const [contentStats, reputation, leads, competitors] = await Promise.all([
    fetchContentStats(supabase, siteId),
    fetchReputationStats(supabase, siteId),
    fetchLeadStats(supabase, siteId),
    fetchCompetitors(supabase, siteId),
  ])

  // 8. Assemble KPIs with deltas
  const kpis: KPIData[] = [
    {
      label: 'Sessions',
      value: String(currentStats.totalSessions),
      delta: prevStats ? formatDelta(currentStats.totalSessions, prevStats.totalSessions) : null,
    },
    {
      label: 'Visiteurs',
      value: String(currentStats.totalUsers),
      delta: prevStats ? formatDelta(currentStats.totalUsers, prevStats.totalUsers) : null,
    },
    {
      label: 'Clics SEO',
      value: String(currentStats.totalClicks),
      delta: prevStats ? formatDelta(currentStats.totalClicks, prevStats.totalClicks) : null,
    },
    {
      label: 'Score',
      value: String(scoreResult.score),
      delta: null,
      unit: '/100',
    },
  ]

  // 9. Traffic breakdown
  const totalSessionsForBreakdown = ga4Data.totalSessions || 1
  const organicSessions = Math.round(ga4Data.totalSessions * ga4Data.organicRate)
  const directSessions = Math.round(
    ga4Data.rows.reduce((s, r) => s + r.directSessions, 0),
  )
  const socialSessions = Math.round(
    ga4Data.rows.reduce((s, r) => s + r.socialSessions, 0),
  )
  const referralSessions = Math.round(
    ga4Data.rows.reduce((s, r) => s + r.referralSessions, 0),
  )

  const trafficBreakdown: TrafficBreakdownItem[] = [
    {
      source: 'Organique',
      sessions: organicSessions,
      percentage: Math.round((organicSessions / totalSessionsForBreakdown) * 100),
    },
    {
      source: 'Direct',
      sessions: directSessions,
      percentage: Math.round((directSessions / totalSessionsForBreakdown) * 100),
    },
    {
      source: 'Social',
      sessions: socialSessions,
      percentage: Math.round((socialSessions / totalSessionsForBreakdown) * 100),
    },
    {
      source: 'Referral',
      sessions: referralSessions,
      percentage: Math.round((referralSessions / totalSessionsForBreakdown) * 100),
    },
  ]

  // 10. Top queries for PDF
  const topQueries: QueryRow[] = gscData.queries.slice(0, 10).map((q) => ({
    query: q.query,
    clicks: q.clicks,
    impressions: q.impressions,
    ctr: `${(q.ctr * 100).toFixed(1)}%`,
    position: q.position.toFixed(1),
  }))

  // 11. Pillars for PDF
  const breakdown = scoreResult.breakdown
  const pillars: PillarBreakdown[] = [
    { label: 'SEO', score: breakdown.seo.weighted, maxPoints: breakdown.seo.maxPoints },
    { label: 'Reputation', score: breakdown.reputation.weighted, maxPoints: breakdown.reputation.maxPoints },
    { label: 'Activite', score: breakdown.activity.weighted, maxPoints: breakdown.activity.maxPoints },
    { label: 'Trafic', score: breakdown.traffic.weighted, maxPoints: breakdown.traffic.maxPoints },
    { label: 'Local', score: breakdown.local.weighted, maxPoints: breakdown.local.maxPoints },
  ]

  // 12. Assemble full report data
  const period = formatPeriod()
  const reportData: MonthlyReportData = {
    siteName: site.name,
    siteUrl: site.custom_domain ?? `${site.id}.wapixia.com`,
    period,
    generatedAt: new Date().toISOString().slice(0, 10),
    visibilityScore: scoreResult.score,
    pillars,
    kpis,
    trafficBreakdown,
    seoStats: {
      avgPosition: currentStats.avgPosition.toFixed(1),
      totalClicks: currentStats.totalClicks,
      totalImpressions: currentStats.totalImpressions,
      avgCTR: `${(currentStats.avgCTR * 100).toFixed(1)}%`,
    },
    topQueries,
    contentStats,
    reputation,
    leads,
    competitors,
    recommendations,
  }

  // 13. Render PDF
  const pdfBuffer = await renderToBuffer(
    React.createElement(MonthlyReport, { data: reportData }),
  )

  // 14. Upload to R2 (stub)
  const { url: pdfUrl, sizeBytes: pdfSizeBytes } = await uploadPdfToR2(
    Buffer.from(pdfBuffer),
    siteId,
    period,
  )

  // 15. Save report record
  const { data: report, error: insertError } = await supabase
    .from('reports')
    .insert({
      site_id: siteId,
      organization_id: site.organization_id,
      type: 'monthly',
      period,
      visibility_score: scoreResult.score,
      score_breakdown: scoreResult.breakdown,
      stats: currentStats,
      pdf_url: pdfUrl,
      pdf_size_bytes: pdfSizeBytes,
      recommendations,
    })
    .select('id')
    .single()

  if (insertError || !report) {
    throw new Error(`Failed to save report: ${insertError?.message ?? 'unknown'}`)
  }

  return {
    pdfUrl,
    pdfSizeBytes,
    reportId: report.id as string,
  }
}

/**
 * Factory function for dependency injection / testing
 */
export function createReportGeneratorService() {
  return { generateMonthlyReport, generateRecommendations }
}
