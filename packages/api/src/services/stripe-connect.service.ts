/**
 * Service Stripe Connect — Transferts de commissions aux revendeurs
 * Sprint 5 : stub quand STRIPE_SECRET_KEY est absent
 */

import { createHmac } from 'node:crypto'

// ── Types ──

interface StripeConnectConfig {
  secretKey: string
  webhookSecret: string
}

interface TransferCommissionParams {
  connectedAccountId: string
  amount: number // montant en centimes EUR
  currency: string
  description: string
  metadata: Record<string, string>
}

interface TransferCommissionResult {
  transferId: string
  amount: number
  currency: string
  status: string
}

interface WebhookVerifyResult {
  valid: boolean
  eventType: string | null
  payload: Record<string, unknown> | null
}

// ── Stripe API response shapes ──

interface StripeTransferResponse {
  id: string
  amount: number
  currency: string
  destination: string
  description: string | null
  metadata: Record<string, string>
}

interface StripeEvent {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
}

// ── Service ──

export class StripeConnectService {
  private config: StripeConnectConfig
  private isStub: boolean

  constructor(config: StripeConnectConfig) {
    this.config = config
    this.isStub = !config.secretKey || config.secretKey === 'stub'
  }

  /**
   * Transfère une commission vers un compte Stripe Connect du revendeur
   */
  async transferCommission(
    params: TransferCommissionParams,
  ): Promise<TransferCommissionResult> {
    if (this.isStub) {
      const stubId = `tr_stub_${Date.now()}`
      console.log(
        `[StripeConnectService] STUB: transferCommission(account="${params.connectedAccountId}", amount=${params.amount} ${params.currency})`,
      )
      return {
        transferId: stubId,
        amount: params.amount,
        currency: params.currency,
        status: 'pending',
      }
    }

    const formData = new URLSearchParams()
    formData.append('amount', String(params.amount))
    formData.append('currency', params.currency)
    formData.append('destination', params.connectedAccountId)
    formData.append('description', params.description)

    for (const [key, value] of Object.entries(params.metadata)) {
      formData.append(`metadata[${key}]`, value)
    }

    const response = await fetch('https://api.stripe.com/v1/transfers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as {
        error?: { message?: string }
      }
      throw new Error(
        `Erreur Stripe (${response.status}): ${errorBody.error?.message ?? 'Erreur inconnue'}`,
      )
    }

    const data = (await response.json()) as StripeTransferResponse

    return {
      transferId: data.id,
      amount: data.amount,
      currency: data.currency,
      status: 'pending',
    }
  }

  /**
   * Vérifie la signature HMAC d'un webhook Stripe
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
  ): WebhookVerifyResult {
    if (this.isStub) {
      console.log('[StripeConnectService] STUB: verifyWebhookSignature()')
      try {
        const parsed = JSON.parse(payload) as StripeEvent
        return {
          valid: true,
          eventType: parsed.type ?? null,
          payload: parsed as unknown as Record<string, unknown>,
        }
      } catch {
        return { valid: false, eventType: null, payload: null }
      }
    }

    if (!this.config.webhookSecret) {
      return { valid: false, eventType: null, payload: null }
    }

    try {
      // Stripe utilise le format : t=timestamp,v1=signature
      const elements = signature.split(',')
      const timestampStr = elements.find((e) => e.startsWith('t='))?.slice(2)
      const sigHash = elements.find((e) => e.startsWith('v1='))?.slice(3)

      if (!timestampStr || !sigHash) {
        return { valid: false, eventType: null, payload: null }
      }

      const signedPayload = `${timestampStr}.${payload}`
      const expectedSig = createHmac('sha256', this.config.webhookSecret)
        .update(signedPayload)
        .digest('hex')

      const isValid = timingSafeEqual(sigHash, expectedSig)

      if (!isValid) {
        return { valid: false, eventType: null, payload: null }
      }

      const parsed = JSON.parse(payload) as StripeEvent
      return {
        valid: true,
        eventType: parsed.type,
        payload: parsed as unknown as Record<string, unknown>,
      }
    } catch {
      return { valid: false, eventType: null, payload: null }
    }
  }
}

/**
 * Comparaison en temps constant pour prévenir les attaques timing
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0)
  }
  return result === 0
}

/**
 * Factory -- crée une instance depuis les variables d'environnement
 */
export function createStripeConnectService(): StripeConnectService {
  return new StripeConnectService({
    secretKey: process.env.STRIPE_SECRET_KEY ?? 'stub',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  })
}
