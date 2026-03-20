/**
 * Bridge — Report generation for worker usage.
 * Sprint 4: stub implementation matching the API service contract.
 * Sprint 7+: import directly from shared package.
 */

export interface ReportGenerationResult {
  pdfUrl: string
  pdfSizeBytes: number
  reportId: string
}

/**
 * Generate monthly report for a site.
 * Sprint 4: stub that returns a mock result.
 * Sprint 7+: will call the real service from shared package.
 */
export async function generateMonthlyReport(
  siteId: string,
): Promise<ReportGenerationResult> {
  console.log(`[ReportBridge] STUB: generateMonthlyReport("${siteId}")`)

  const now = new Date()
  const monthNames = [
    'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
  ]
  const period = `${monthNames[now.getMonth()]}-${now.getFullYear()}`

  return {
    pdfUrl: `https://cdn.wapixia.com/reports/${siteId}/${period}.pdf`,
    pdfSizeBytes: 245_760,
    reportId: `report-stub-${Date.now()}`,
  }
}
