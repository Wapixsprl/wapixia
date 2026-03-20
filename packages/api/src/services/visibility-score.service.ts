/**
 * Service Visibility Score — Algorithme de score de visibilite (0-100)
 * Sprint 4 : calcul basé sur 5 piliers pondérés
 *
 * Piliers :
 *   SEO         30 pts — position GSC, clicks, impressions
 *   Reputation  25 pts — avis, note moyenne, taux de réponse
 *   Activity    25 pts — publications sociales, GMB, blog, modules actifs
 *   Traffic     15 pts — taux organique, croissance vs mois précédent
 *   Local        5 pts — présence GMB, domaine, téléphone, réseaux sociaux
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---------- Interfaces ----------

export interface SEOData {
  avgPosition: number
  totalClicks: number
  totalImpressions: number
  isDeployed: boolean
}

export interface ReputationData {
  avgRating: number
  reviewCount: number
  reviewsWithReply: number
  totalReviews: number
  replyRate: number
}

export interface ActivityData {
  socialPostsCount: number
  gmbPostsCount: number
  blogArticlesCount: number
  activeModulesCount: number
}

export interface TrafficData {
  organicSessions: number
  totalSessions: number
  organicRate: number
  prevMonthSessions: number
  currentMonthSessions: number
  growthRate: number
  hasGA4: boolean
}

export interface LocalData {
  hasGMB: boolean
  hasCustomDomain: boolean
  hasPhone: boolean
  hasSocialAccounts: boolean
}

export interface PillarScore {
  raw: number
  weighted: number
  maxPoints: number
  label: string
}

export interface VisibilityScoreBreakdown {
  seo: PillarScore
  reputation: PillarScore
  activity: PillarScore
  traffic: PillarScore
  local: PillarScore
}

export interface VisibilityScoreResult {
  score: number
  breakdown: VisibilityScoreBreakdown
  calculatedAt: string
}

// ---------- Pillar weights ----------

const PILLAR_WEIGHTS = {
  seo: 30,
  reputation: 25,
  activity: 25,
  traffic: 15,
  local: 5,
} as const

// ---------- Scoring functions ----------

/**
 * SEO pillar (max 30 pts)
 * - Base 10 if site is deployed
 * - Up to 8 pts for avg position (< 10 = full, < 30 = partial)
 * - Up to 6 pts for clicks (> 500 = full, proportional otherwise)
 * - Up to 6 pts for impressions (> 5000 = full, proportional otherwise)
 */
function computeSEOScore(data: SEOData): PillarScore {
  let raw = 0

  // Base score for deployed sites
  if (data.isDeployed) {
    raw += 10
  }

  // Position score (lower = better)
  if (data.avgPosition > 0 && data.avgPosition <= 10) {
    raw += 8
  } else if (data.avgPosition > 10 && data.avgPosition <= 30) {
    raw += Math.round(8 * ((30 - data.avgPosition) / 20))
  }

  // Clicks score
  const clickScore = Math.min(data.totalClicks / 500, 1) * 6
  raw += Math.round(clickScore)

  // Impressions score
  const impressionScore = Math.min(data.totalImpressions / 5000, 1) * 6
  raw += Math.round(impressionScore)

  raw = Math.min(raw, PILLAR_WEIGHTS.seo)

  return {
    raw,
    weighted: raw,
    maxPoints: PILLAR_WEIGHTS.seo,
    label: 'SEO',
  }
}

/**
 * Reputation pillar (max 25 pts)
 * - Up to 10 pts for avg rating (5.0 = 10, 4.0 = 7, 3.0 = 4)
 * - Up to 8 pts for review count (> 50 = full, proportional otherwise)
 * - Up to 7 pts for reply rate (100% = full)
 */
function computeReputationScore(data: ReputationData): PillarScore {
  let raw = 0

  // Rating score (0-10)
  if (data.avgRating >= 4.5) {
    raw += 10
  } else if (data.avgRating >= 4.0) {
    raw += 7 + Math.round((data.avgRating - 4.0) * 6)
  } else if (data.avgRating >= 3.0) {
    raw += 4 + Math.round((data.avgRating - 3.0) * 3)
  } else if (data.avgRating > 0) {
    raw += Math.round(data.avgRating * 1.3)
  }

  // Review count score (0-8)
  const countScore = Math.min(data.reviewCount / 50, 1) * 8
  raw += Math.round(countScore)

  // Reply rate score (0-7)
  raw += Math.round(data.replyRate * 7)

  raw = Math.min(raw, PILLAR_WEIGHTS.reputation)

  return {
    raw,
    weighted: raw,
    maxPoints: PILLAR_WEIGHTS.reputation,
    label: 'Reputation',
  }
}

/**
 * Activity pillar (max 25 pts)
 * - Up to 7 pts for social posts (last 30 days, > 12 = full)
 * - Up to 6 pts for GMB posts (last 30 days, > 4 = full)
 * - Up to 7 pts for blog articles (last 30 days, > 4 = full)
 * - Up to 5 pts for active modules count (> 5 = full)
 */
function computeActivityScore(data: ActivityData): PillarScore {
  let raw = 0

  raw += Math.round(Math.min(data.socialPostsCount / 12, 1) * 7)
  raw += Math.round(Math.min(data.gmbPostsCount / 4, 1) * 6)
  raw += Math.round(Math.min(data.blogArticlesCount / 4, 1) * 7)
  raw += Math.round(Math.min(data.activeModulesCount / 5, 1) * 5)

  raw = Math.min(raw, PILLAR_WEIGHTS.activity)

  return {
    raw,
    weighted: raw,
    maxPoints: PILLAR_WEIGHTS.activity,
    label: 'Activity',
  }
}

/**
 * Traffic pillar (max 15 pts)
 * - Base 2 if no GA4 connected
 * - Up to 8 pts for organic rate (> 60% = full)
 * - Up to 7 pts for growth vs previous month (> 20% growth = full)
 */
function computeTrafficScore(data: TrafficData): PillarScore {
  let raw = 0

  if (!data.hasGA4) {
    // Base score without GA4 — can't measure, give minimal credit
    raw = 2
  } else {
    // Organic rate score
    raw += Math.round(Math.min(data.organicRate / 0.6, 1) * 8)

    // Growth score
    if (data.growthRate >= 0.2) {
      raw += 7
    } else if (data.growthRate > 0) {
      raw += Math.round((data.growthRate / 0.2) * 7)
    }
    // Negative growth = 0 growth points
  }

  raw = Math.min(raw, PILLAR_WEIGHTS.traffic)

  return {
    raw,
    weighted: raw,
    maxPoints: PILLAR_WEIGHTS.traffic,
    label: 'Traffic',
  }
}

/**
 * Local pillar (max 5 pts)
 * - 2 pts for GMB presence
 * - 1 pt for custom domain
 * - 1 pt for phone number
 * - 1 pt for at least one social account
 */
function computeLocalScore(data: LocalData): PillarScore {
  let raw = 0

  if (data.hasGMB) raw += 2
  if (data.hasCustomDomain) raw += 1
  if (data.hasPhone) raw += 1
  if (data.hasSocialAccounts) raw += 1

  return {
    raw,
    weighted: raw,
    maxPoints: PILLAR_WEIGHTS.local,
    label: 'Local',
  }
}

// ---------- Data fetching ----------

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

async function fetchSEOData(supabase: SupabaseClient, siteId: string): Promise<SEOData> {
  // Check if site is deployed
  const { data: site } = await supabase
    .from('sites')
    .select('status, custom_domain')
    .eq('id', siteId)
    .single()

  const isDeployed = site?.status === 'deployed' || site?.status === 'live'

  // Fetch GSC data from analytics_snapshots (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const { data: gscData } = await supabase
    .from('analytics_snapshots')
    .select('data')
    .eq('site_id', siteId)
    .eq('source', 'gsc')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(1)

  const snapshot = gscData?.[0]?.data as Record<string, number> | null

  return {
    avgPosition: snapshot?.['avg_position'] ?? 0,
    totalClicks: snapshot?.['total_clicks'] ?? 0,
    totalImpressions: snapshot?.['total_impressions'] ?? 0,
    isDeployed,
  }
}

async function fetchReputationData(
  supabase: SupabaseClient,
  siteId: string,
): Promise<ReputationData> {
  const { data: reviews } = await supabase
    .from('google_reviews')
    .select('rating, reply_text')
    .eq('site_id', siteId)

  if (!reviews || reviews.length === 0) {
    return {
      avgRating: 0,
      reviewCount: 0,
      reviewsWithReply: 0,
      totalReviews: 0,
      replyRate: 0,
    }
  }

  const totalReviews = reviews.length
  const avgRating =
    reviews.reduce((sum, r) => sum + (r.rating as number), 0) / totalReviews
  const reviewsWithReply = reviews.filter(
    (r) => r.reply_text !== null && r.reply_text !== '',
  ).length
  const replyRate = totalReviews > 0 ? reviewsWithReply / totalReviews : 0

  return {
    avgRating: Math.round(avgRating * 10) / 10,
    reviewCount: totalReviews,
    reviewsWithReply,
    totalReviews,
    replyRate: Math.round(replyRate * 100) / 100,
  }
}

async function fetchActivityData(
  supabase: SupabaseClient,
  siteId: string,
): Promise<ActivityData> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  // Social posts last 30 days
  const { count: socialPostsCount } = await supabase
    .from('ai_contents')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('type', 'social_post')
    .eq('status', 'published')
    .gte('created_at', thirtyDaysAgo)

  // GMB posts last 30 days
  const { count: gmbPostsCount } = await supabase
    .from('ai_contents')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('type', 'gmb_post')
    .eq('status', 'published')
    .gte('created_at', thirtyDaysAgo)

  // Blog articles last 30 days
  const { count: blogArticlesCount } = await supabase
    .from('ai_contents')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('type', 'blog_article')
    .eq('status', 'published')
    .gte('created_at', thirtyDaysAgo)

  // Active modules
  const { count: activeModulesCount } = await supabase
    .from('site_modules')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('enabled', true)

  return {
    socialPostsCount: socialPostsCount ?? 0,
    gmbPostsCount: gmbPostsCount ?? 0,
    blogArticlesCount: blogArticlesCount ?? 0,
    activeModulesCount: activeModulesCount ?? 0,
  }
}

async function fetchTrafficData(
  supabase: SupabaseClient,
  siteId: string,
): Promise<TrafficData> {
  // Check for GA4 connection
  const { data: site } = await supabase
    .from('sites')
    .select('google_tokens')
    .eq('id', siteId)
    .single()

  const googleTokens = site?.google_tokens as Record<string, unknown> | null
  const hasGA4 = Boolean(googleTokens?.['ga4_property_id'])

  if (!hasGA4) {
    return {
      organicSessions: 0,
      totalSessions: 0,
      organicRate: 0,
      prevMonthSessions: 0,
      currentMonthSessions: 0,
      growthRate: 0,
      hasGA4: false,
    }
  }

  // Fetch latest GA4 snapshot
  const { data: ga4Data } = await supabase
    .from('analytics_snapshots')
    .select('data')
    .eq('site_id', siteId)
    .eq('source', 'ga4')
    .order('created_at', { ascending: false })
    .limit(1)

  const snapshot = ga4Data?.[0]?.data as Record<string, number> | null

  const organicSessions = snapshot?.['organic_sessions'] ?? 0
  const totalSessions = snapshot?.['total_sessions'] ?? 0
  const prevMonthSessions = snapshot?.['prev_month_sessions'] ?? 0
  const currentMonthSessions = snapshot?.['current_month_sessions'] ?? 0

  const organicRate = totalSessions > 0 ? organicSessions / totalSessions : 0
  const growthRate =
    prevMonthSessions > 0
      ? (currentMonthSessions - prevMonthSessions) / prevMonthSessions
      : 0

  return {
    organicSessions,
    totalSessions,
    organicRate: Math.round(organicRate * 100) / 100,
    prevMonthSessions,
    currentMonthSessions,
    growthRate: Math.round(growthRate * 100) / 100,
    hasGA4: true,
  }
}

async function fetchLocalData(
  supabase: SupabaseClient,
  siteId: string,
): Promise<LocalData> {
  const { data: site } = await supabase
    .from('sites')
    .select('custom_domain, onboarding_data, google_tokens')
    .eq('id', siteId)
    .single()

  if (!site) {
    return {
      hasGMB: false,
      hasCustomDomain: false,
      hasPhone: false,
      hasSocialAccounts: false,
    }
  }

  const googleTokens = site.google_tokens as Record<string, unknown> | null
  const onboardingData = (site.onboarding_data ?? {}) as Record<string, unknown>
  const contactData = (onboardingData['contact'] ?? {}) as Record<string, unknown>

  const hasGMB = Boolean(googleTokens?.['gmb_location_id'])
  const hasCustomDomain = Boolean(site.custom_domain)
  const hasPhone = Boolean(contactData['phone'])

  // Check for social accounts
  const { count: socialCount } = await supabase
    .from('social_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)

  const hasSocialAccounts = (socialCount ?? 0) > 0

  return {
    hasGMB,
    hasCustomDomain,
    hasPhone,
    hasSocialAccounts,
  }
}

// ---------- Main export ----------

/**
 * Calculate the Visibility Score (0-100) for a site.
 * Aggregates 5 pillars: SEO, Reputation, Activity, Traffic, Local.
 */
export async function calculateVisibilityScore(
  siteId: string,
): Promise<VisibilityScoreResult> {
  const supabase = createServiceClient()

  // Fetch all pillar data in parallel
  const [seoData, reputationData, activityData, trafficData, localData] =
    await Promise.all([
      fetchSEOData(supabase, siteId),
      fetchReputationData(supabase, siteId),
      fetchActivityData(supabase, siteId),
      fetchTrafficData(supabase, siteId),
      fetchLocalData(supabase, siteId),
    ])

  // Compute each pillar
  const seo = computeSEOScore(seoData)
  const reputation = computeReputationScore(reputationData)
  const activity = computeActivityScore(activityData)
  const traffic = computeTrafficScore(trafficData)
  const local = computeLocalScore(localData)

  // Total score
  const score = Math.min(
    seo.weighted + reputation.weighted + activity.weighted + traffic.weighted + local.weighted,
    100,
  )

  return {
    score,
    breakdown: { seo, reputation, activity, traffic, local },
    calculatedAt: new Date().toISOString(),
  }
}

/**
 * Factory function for dependency injection / testing
 */
export function createVisibilityScoreService() {
  return { calculateVisibilityScore }
}
