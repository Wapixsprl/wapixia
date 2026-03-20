/**
 * Bridge — Visibility Score calculation for worker usage.
 * Sprint 4: stub implementation matching the API service contract.
 * Sprint 7+: import directly from shared package.
 */

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

/**
 * Calculate visibility score for a site.
 * Sprint 4: stub that returns a mock score.
 * Sprint 7+: will call the real service from shared package.
 */
export async function calculateVisibilityScore(
  siteId: string,
): Promise<VisibilityScoreResult> {
  console.log(`[ScoreBridge] STUB: calculateVisibilityScore("${siteId}")`)

  // Return a reasonable mock score
  return {
    score: 47,
    breakdown: {
      seo: { raw: 14, weighted: 14, maxPoints: 30, label: 'SEO' },
      reputation: { raw: 12, weighted: 12, maxPoints: 25, label: 'Reputation' },
      activity: { raw: 10, weighted: 10, maxPoints: 25, label: 'Activity' },
      traffic: { raw: 7, weighted: 7, maxPoints: 15, label: 'Traffic' },
      local: { raw: 4, weighted: 4, maxPoints: 5, label: 'Local' },
    },
    calculatedAt: new Date().toISOString(),
  }
}
