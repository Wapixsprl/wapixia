/**
 * Bridge — re-exports AnalyticsService for worker usage.
 * The worker imports from @wapixia/api services via relative path.
 * In production, this would use a shared package or direct import.
 *
 * Sprint 4: inline stub implementation matching the API service contract.
 */

// ---------- Types ----------

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
  period: { start: string; end: string }
}

export interface SearchConsoleQuery {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface SearchConsoleImportResult {
  queries: SearchConsoleQuery[]
  pages: { page: string; clicks: number; impressions: number; ctr: number; position: number }[]
  totalClicks: number
  totalImpressions: number
  avgPosition: number
  avgCTR: number
  period: { start: string; end: string }
}

// ---------- Stub service ----------

interface AnalyticsBridge {
  importGA4Data(siteId: string): Promise<GA4ImportResult>
  importSearchConsoleData(siteId: string): Promise<SearchConsoleImportResult>
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

/**
 * Factory — creates an analytics bridge for the worker.
 * Sprint 4: returns stub data.
 */
export function createAnalyticsService(): AnalyticsBridge {
  return {
    async importGA4Data(siteId: string): Promise<GA4ImportResult> {
      console.log(`[AnalyticsBridge] STUB: importGA4Data("${siteId}")`)
      const { start, end } = getDateRange()
      return {
        rows: [],
        totalSessions: 1250,
        totalUsers: 980,
        totalPageViews: 3200,
        organicRate: 0.42,
        period: { start, end },
      }
    },

    async importSearchConsoleData(siteId: string): Promise<SearchConsoleImportResult> {
      console.log(`[AnalyticsBridge] STUB: importSearchConsoleData("${siteId}")`)
      const { start, end } = getDateRange()
      return {
        queries: [],
        pages: [],
        totalClicks: 176,
        totalImpressions: 3330,
        avgPosition: 14.2,
        avgCTR: 0.053,
        period: { start, end },
      }
    },
  }
}
