/**
 * Service Analytics — Import Google Analytics 4 + Search Console
 * Sprint 4 : stubs avec données mock (intégration réelle Google API différée)
 * Sprint 7+ : connexion réelle à GA4 Data API + Search Console API
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---------- Types ----------

interface AnalyticsConfig {
  stubMode: boolean
}

export interface GA4DataRow {
  date: string
  sessions: number
  users: number
  pageViews: number
  bounceRate: number
  avgSessionDuration: number
  organicSessions: number
  directSessions: number
  socialSessions: number
  referralSessions: number
}

export interface GA4ImportResult {
  rows: GA4DataRow[]
  totalSessions: number
  totalUsers: number
  totalPageViews: number
  organicRate: number
  period: {
    start: string
    end: string
  }
}

export interface SearchConsoleQuery {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface SearchConsolePage {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface SearchConsoleImportResult {
  queries: SearchConsoleQuery[]
  pages: SearchConsolePage[]
  totalClicks: number
  totalImpressions: number
  avgPosition: number
  avgCTR: number
  period: {
    start: string
    end: string
  }
}

export interface GoogleTokens {
  access_token: string
  refresh_token: string
  ga4_property_id?: string
  gsc_site_url?: string
}

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

function getDateRange(): { start: string; end: string } {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(end.getTime() - 30 * 86_400_000)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

async function getGoogleTokens(
  supabase: SupabaseClient,
  siteId: string,
): Promise<GoogleTokens | null> {
  const { data: site } = await supabase
    .from('sites')
    .select('google_tokens')
    .eq('id', siteId)
    .single()

  if (!site?.google_tokens) return null

  const tokens = site.google_tokens as Record<string, unknown>
  if (!tokens['access_token'] || !tokens['refresh_token']) return null

  return {
    access_token: String(tokens['access_token']),
    refresh_token: String(tokens['refresh_token']),
    ga4_property_id: tokens['ga4_property_id']
      ? String(tokens['ga4_property_id'])
      : undefined,
    gsc_site_url: tokens['gsc_site_url']
      ? String(tokens['gsc_site_url'])
      : undefined,
  }
}

// ---------- Mock data generators ----------

function generateMockGA4Data(): GA4ImportResult {
  const { start, end } = getDateRange()
  const rows: GA4DataRow[] = []

  const startDate = new Date(start)
  const endDate = new Date(end)

  let totalSessions = 0
  let totalUsers = 0
  let totalPageViews = 0
  let totalOrganic = 0

  for (
    let d = new Date(startDate);
    d <= endDate;
    d.setDate(d.getDate() + 1)
  ) {
    const baseSessions = 30 + Math.floor(Math.random() * 40)
    const organicSessions = Math.floor(baseSessions * (0.35 + Math.random() * 0.2))
    const directSessions = Math.floor(baseSessions * (0.2 + Math.random() * 0.1))
    const socialSessions = Math.floor(baseSessions * (0.05 + Math.random() * 0.1))
    const referralSessions = baseSessions - organicSessions - directSessions - socialSessions

    const users = Math.floor(baseSessions * 0.85)
    const pageViews = Math.floor(baseSessions * 2.3)

    rows.push({
      date: d.toISOString().slice(0, 10),
      sessions: baseSessions,
      users,
      pageViews,
      bounceRate: 0.35 + Math.random() * 0.25,
      avgSessionDuration: 90 + Math.floor(Math.random() * 120),
      organicSessions,
      directSessions,
      socialSessions,
      referralSessions: Math.max(referralSessions, 0),
    })

    totalSessions += baseSessions
    totalUsers += users
    totalPageViews += pageViews
    totalOrganic += organicSessions
  }

  return {
    rows,
    totalSessions,
    totalUsers,
    totalPageViews,
    organicRate: totalSessions > 0
      ? Math.round((totalOrganic / totalSessions) * 100) / 100
      : 0,
    period: { start, end },
  }
}

function generateMockSearchConsoleData(): SearchConsoleImportResult {
  const { start, end } = getDateRange()

  const queries: SearchConsoleQuery[] = [
    { query: 'plombier bruxelles', clicks: 48, impressions: 820, ctr: 0.059, position: 8.2 },
    { query: 'depannage plomberie urgence', clicks: 31, impressions: 540, ctr: 0.057, position: 12.5 },
    { query: 'fuite eau maison', clicks: 22, impressions: 410, ctr: 0.054, position: 15.3 },
    { query: 'debouchage canalisation', clicks: 18, impressions: 380, ctr: 0.047, position: 18.7 },
    { query: 'reparation chaudiere', clicks: 15, impressions: 290, ctr: 0.052, position: 11.4 },
    { query: 'plombier pas cher bruxelles', clicks: 12, impressions: 260, ctr: 0.046, position: 22.1 },
    { query: 'installation sanitaire', clicks: 10, impressions: 195, ctr: 0.051, position: 19.8 },
    { query: 'entretien chaudiere bruxelles', clicks: 8, impressions: 175, ctr: 0.046, position: 14.6 },
    { query: 'plombier urgence nuit', clicks: 7, impressions: 140, ctr: 0.05, position: 25.3 },
    { query: 'devis plomberie gratuit', clicks: 5, impressions: 120, ctr: 0.042, position: 28.9 },
  ]

  const pages: SearchConsolePage[] = [
    { page: '/', clicks: 65, impressions: 1200, ctr: 0.054, position: 12.1 },
    { page: '/services', clicks: 38, impressions: 680, ctr: 0.056, position: 14.3 },
    { page: '/contact', clicks: 22, impressions: 450, ctr: 0.049, position: 18.7 },
    { page: '/blog/entretien-chaudiere', clicks: 18, impressions: 320, ctr: 0.056, position: 9.8 },
    { page: '/blog/fuite-eau-que-faire', clicks: 14, impressions: 280, ctr: 0.05, position: 11.2 },
  ]

  const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0)
  const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0)
  const avgPosition =
    queries.reduce((sum, q) => sum + q.position * q.impressions, 0) / totalImpressions
  const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0

  return {
    queries,
    pages,
    totalClicks,
    totalImpressions,
    avgPosition: Math.round(avgPosition * 10) / 10,
    avgCTR: Math.round(avgCTR * 1000) / 1000,
    period: { start, end },
  }
}

// ---------- Service ----------

export class AnalyticsService {
  private config: AnalyticsConfig

  constructor(config: AnalyticsConfig) {
    this.config = config
  }

  private get isStub(): boolean {
    return this.config.stubMode
  }

  /**
   * Import GA4 data for a site (last 30 days).
   * Returns structured traffic data.
   * Sprint 4: returns mock data. Sprint 7+: real Google Analytics Data API.
   */
  async importGA4Data(siteId: string): Promise<GA4ImportResult> {
    const supabase = createServiceClient()
    const tokens = await getGoogleTokens(supabase, siteId)

    if (!tokens?.ga4_property_id || this.isStub) {
      console.log(
        `[AnalyticsService] STUB: importGA4Data("${siteId}") — ${tokens?.ga4_property_id ? 'stub mode' : 'no GA4 property'}`,
      )
      const mockData = generateMockGA4Data()

      // Persist snapshot
      await supabase.from('analytics_snapshots').insert({
        site_id: siteId,
        source: 'ga4',
        data: {
          total_sessions: mockData.totalSessions,
          total_users: mockData.totalUsers,
          total_page_views: mockData.totalPageViews,
          organic_rate: mockData.organicRate,
          organic_sessions: Math.round(mockData.totalSessions * mockData.organicRate),
          prev_month_sessions: Math.round(mockData.totalSessions * 0.85),
          current_month_sessions: mockData.totalSessions,
        },
        period_start: mockData.period.start,
        period_end: mockData.period.end,
      })

      return mockData
    }

    // TODO Sprint 7: Real Google Analytics Data API integration
    // 1. Use tokens.access_token to call analyticsdata.googleapis.com
    // 2. Property: properties/{tokens.ga4_property_id}
    // 3. Dimensions: date, sessionDefaultChannelGroup
    // 4. Metrics: sessions, totalUsers, screenPageViews, bounceRate, averageSessionDuration
    throw new Error('Real GA4 import not yet implemented — use stub mode')
  }

  /**
   * Import Search Console data for a site (last 30 days).
   * Returns top queries and page performance.
   * Sprint 4: returns mock data. Sprint 7+: real Search Console API.
   */
  async importSearchConsoleData(
    siteId: string,
  ): Promise<SearchConsoleImportResult> {
    const supabase = createServiceClient()
    const tokens = await getGoogleTokens(supabase, siteId)

    if (!tokens?.gsc_site_url || this.isStub) {
      console.log(
        `[AnalyticsService] STUB: importSearchConsoleData("${siteId}") — ${tokens?.gsc_site_url ? 'stub mode' : 'no GSC site'}`,
      )
      const mockData = generateMockSearchConsoleData()

      // Persist snapshot
      await supabase.from('analytics_snapshots').insert({
        site_id: siteId,
        source: 'gsc',
        data: {
          total_clicks: mockData.totalClicks,
          total_impressions: mockData.totalImpressions,
          avg_position: mockData.avgPosition,
          avg_ctr: mockData.avgCTR,
          top_queries: mockData.queries.slice(0, 5),
        },
        period_start: mockData.period.start,
        period_end: mockData.period.end,
      })

      return mockData
    }

    // TODO Sprint 7: Real Search Console API integration
    // 1. Use tokens.access_token to call searchconsole.googleapis.com
    // 2. Site URL: tokens.gsc_site_url
    // 3. Query for search analytics (queries and pages dimensions)
    throw new Error('Real Search Console import not yet implemented — use stub mode')
  }
}

// ---------- Factory ----------

/**
 * Factory — creates an AnalyticsService instance.
 * Defaults to stub mode unless GOOGLE_API_LIVE=true.
 */
export function createAnalyticsService(): AnalyticsService {
  const isLive = process.env.GOOGLE_API_LIVE === 'true'
  return new AnalyticsService({ stubMode: !isLive })
}
