/**
 * Token usage tracking — Suivi de la consommation Claude
 * Sprint 3 : tracking des tokens et alertes de cout
 *
 * Note : ce module tourne dans le package @wapixia/ai
 * et communique avec l'API via fetch (pas d'acces DB direct).
 */

// ---------- Pricing ----------

type ClaudeModel = 'sonnet' | 'haiku'

interface ModelPricing {
  inputPerMToken: number
  outputPerMToken: number
}

/**
 * Tarifs Claude en EUR/million de tokens (approximation)
 * Sonnet : $3/$15 input/output → ~2.75/13.80 EUR
 * Haiku  : $0.25/$1.25 input/output → ~0.23/1.15 EUR
 */
export const CLAUDE_PRICING: Record<ClaudeModel, ModelPricing> = {
  sonnet: {
    inputPerMToken: 2.75,
    outputPerMToken: 13.80,
  },
  haiku: {
    inputPerMToken: 0.23,
    outputPerMToken: 1.15,
  },
}

// ---------- Types ----------

interface TrackTokenUsageParams {
  siteId: string
  moduleId: string
  model: ClaudeModel
  tokensInput: number
  tokensOutput: number
}

interface TrackTokenUsageResult {
  recorded: boolean
  costEur: number
}

interface CostThresholdResult {
  totalCostEur: number
  thresholdEur: number
  exceeded: boolean
  usagePercent: number
}

// ---------- Helpers ----------

const DEFAULT_MONTHLY_THRESHOLD_EUR = 4

/**
 * Calcule le cout en EUR d'un appel Claude
 */
export function calculateCost(
  model: ClaudeModel,
  tokensInput: number,
  tokensOutput: number,
): number {
  const pricing = CLAUDE_PRICING[model]
  const inputCost = (tokensInput / 1_000_000) * pricing.inputPerMToken
  const outputCost = (tokensOutput / 1_000_000) * pricing.outputPerMToken
  return Math.round((inputCost + outputCost) * 10_000) / 10_000 // 4 decimals
}

// ---------- API communication ----------

/**
 * Enregistre la consommation de tokens via l'API WapixIA
 * Upsert dans la table token_usage
 */
export async function trackTokenUsage(
  params: TrackTokenUsageParams,
  apiBaseUrl?: string,
): Promise<TrackTokenUsageResult> {
  const { siteId, moduleId, model, tokensInput, tokensOutput } = params
  const costEur = calculateCost(model, tokensInput, tokensOutput)

  const baseUrl = apiBaseUrl ?? process.env.WAPIXIA_API_URL ?? 'http://localhost:3010'

  try {
    const response = await fetch(`${baseUrl}/api/v1/internal/token-usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId,
        moduleId,
        model,
        tokensInput,
        tokensOutput,
        costEur,
        recordedAt: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      console.warn(
        `[tracking] Failed to record token usage (${response.status}): ${await response.text()}`,
      )
      return { recorded: false, costEur }
    }

    return { recorded: true, costEur }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.warn(`[tracking] Failed to record token usage: ${message}`)
    return { recorded: false, costEur }
  }
}

/**
 * Verifie si le cout mensuel d'un site depasse le seuil (defaut: 4 EUR/mois)
 * Retourne l'etat du budget avec pourcentage d'utilisation
 */
export async function checkCostThreshold(
  siteId: string,
  apiBaseUrl?: string,
): Promise<CostThresholdResult> {
  const baseUrl = apiBaseUrl ?? process.env.WAPIXIA_API_URL ?? 'http://localhost:3010'

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/internal/token-usage/${siteId}/monthly-cost`,
    )

    if (!response.ok) {
      console.warn(
        `[tracking] Failed to check cost threshold (${response.status})`,
      )
      return {
        totalCostEur: 0,
        thresholdEur: DEFAULT_MONTHLY_THRESHOLD_EUR,
        exceeded: false,
        usagePercent: 0,
      }
    }

    const data = (await response.json()) as { totalCostEur: number }
    const totalCostEur = data.totalCostEur
    const thresholdEur = DEFAULT_MONTHLY_THRESHOLD_EUR
    const exceeded = totalCostEur > thresholdEur
    const usagePercent = Math.round((totalCostEur / thresholdEur) * 100)

    if (exceeded) {
      console.warn(
        `[tracking] ALERT: Site ${siteId} cost (${totalCostEur.toFixed(2)} EUR) exceeds threshold (${thresholdEur} EUR) — ${usagePercent}%`,
      )
    }

    return {
      totalCostEur,
      thresholdEur,
      exceeded,
      usagePercent,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.warn(`[tracking] Failed to check cost threshold: ${message}`)
    return {
      totalCostEur: 0,
      thresholdEur: DEFAULT_MONTHLY_THRESHOLD_EUR,
      exceeded: false,
      usagePercent: 0,
    }
  }
}
