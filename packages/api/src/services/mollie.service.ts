/**
 * Service Mollie — Paiements récurrents & mandats SEPA
 * Sprint 5 : stub quand MOLLIE_API_KEY est absent
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ──

interface MollieConfig {
  apiKey: string
}

interface CreateFirstPaymentParams {
  customerId?: string
  customerName: string
  customerEmail: string
  amount: string
  currency: string
  description: string
  redirectUrl: string
  webhookUrl: string
  metadata: Record<string, string>
}

interface CreateFirstPaymentResult {
  paymentId: string
  checkoutUrl: string
  customerId: string
}

interface ChargeRecurringParams {
  customerId: string
  mandateId: string
  amount: string
  currency: string
  description: string
  webhookUrl: string
  metadata: Record<string, string>
}

interface ChargeRecurringResult {
  paymentId: string
  status: string
}

interface PaymentStatus {
  id: string
  status: 'open' | 'pending' | 'authorized' | 'paid' | 'canceled' | 'expired' | 'failed'
  mandateId: string | null
  method: string | null
  paidAt: string | null
  amount: { value: string; currency: string }
}

interface MonthlyTotalResult {
  siteId: string
  totalEur: number
  activeModules: number
}

// ── Mollie API response shapes ──

interface MolliePaymentResponse {
  id: string
  status: string
  mandateId?: string
  method?: string
  paidAt?: string
  amount: { value: string; currency: string }
  _links: {
    checkout?: { href: string }
  }
}

interface MollieCustomerResponse {
  id: string
  name: string
  email: string
}

// ── Service ──

export class MollieService {
  private config: MollieConfig
  private isStub: boolean

  constructor(config: MollieConfig) {
    this.config = config
    this.isStub = !config.apiKey || config.apiKey === 'stub'
  }

  /**
   * Crée un client Mollie + premier paiement avec séquence 'first'
   * pour obtenir un mandat SEPA automatique.
   */
  async createFirstPaymentWithMandate(
    params: CreateFirstPaymentParams,
  ): Promise<CreateFirstPaymentResult> {
    if (this.isStub) {
      const stubId = `tr_stub_${Date.now()}`
      const stubCustomerId = params.customerId ?? `cst_stub_${Date.now()}`
      console.log(
        `[MollieService] STUB: createFirstPaymentWithMandate(customer="${params.customerName}", amount=${params.amount} ${params.currency})`,
      )
      return {
        paymentId: stubId,
        checkoutUrl: `https://mollie.stub/checkout/${stubId}`,
        customerId: stubCustomerId,
      }
    }

    // Étape 1 : créer ou réutiliser le client Mollie
    let customerId = params.customerId
    if (!customerId) {
      const customerRes = await this.request<MollieCustomerResponse>('/v2/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: params.customerName,
          email: params.customerEmail,
        }),
      })
      customerId = customerRes.id
    }

    // Étape 2 : créer le premier paiement (séquence 'first')
    const paymentRes = await this.request<MolliePaymentResponse>('/v2/payments', {
      method: 'POST',
      body: JSON.stringify({
        amount: { value: params.amount, currency: params.currency },
        description: params.description,
        sequenceType: 'first',
        customerId,
        redirectUrl: params.redirectUrl,
        webhookUrl: params.webhookUrl,
        metadata: params.metadata,
      }),
    })

    return {
      paymentId: paymentRes.id,
      checkoutUrl: paymentRes._links.checkout?.href ?? '',
      customerId,
    }
  }

  /**
   * Prélèvement récurrent via mandat existant (séquence 'recurring')
   */
  async chargeRecurring(params: ChargeRecurringParams): Promise<ChargeRecurringResult> {
    if (this.isStub) {
      const stubId = `tr_rec_stub_${Date.now()}`
      console.log(
        `[MollieService] STUB: chargeRecurring(customer="${params.customerId}", amount=${params.amount} ${params.currency})`,
      )
      return {
        paymentId: stubId,
        status: 'pending',
      }
    }

    const paymentRes = await this.request<MolliePaymentResponse>('/v2/payments', {
      method: 'POST',
      body: JSON.stringify({
        amount: { value: params.amount, currency: params.currency },
        description: params.description,
        sequenceType: 'recurring',
        customerId: params.customerId,
        mandateId: params.mandateId,
        webhookUrl: params.webhookUrl,
        metadata: params.metadata,
      }),
    })

    return {
      paymentId: paymentRes.id,
      status: paymentRes.status,
    }
  }

  /**
   * Récupère le statut d'un paiement
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    if (this.isStub) {
      console.log(`[MollieService] STUB: getPaymentStatus("${paymentId}")`)
      return {
        id: paymentId,
        status: 'paid',
        mandateId: `mdt_stub_${Date.now()}`,
        method: 'bancontact',
        paidAt: new Date().toISOString(),
        amount: { value: '49.00', currency: 'EUR' },
      }
    }

    const res = await this.request<MolliePaymentResponse>(`/v2/payments/${paymentId}`, {
      method: 'GET',
    })

    return {
      id: res.id,
      status: res.status as PaymentStatus['status'],
      mandateId: res.mandateId ?? null,
      method: res.method ?? null,
      paidAt: res.paidAt ?? null,
      amount: res.amount,
    }
  }

  /**
   * Calcule le total mensuel des abonnements actifs d'un site
   */
  async calculateMonthlyTotal(
    siteId: string,
    supabaseClient: SupabaseClient,
  ): Promise<MonthlyTotalResult> {
    const { data, error } = await supabaseClient
      .from('site_modules')
      .select('module_id, module_catalog!inner(price_monthly)')
      .eq('site_id', siteId)
      .eq('status', 'active')

    if (error) {
      throw new Error(`Erreur lors du calcul du total mensuel: ${error.message}`)
    }

    const modules = data ?? []
    const totalEur = modules.reduce((sum: number, mod: Record<string, unknown>) => {
      const catalog = mod.module_catalog as { price_monthly: string } | null
      return sum + Number.parseFloat(catalog?.price_monthly ?? '0')
    }, 0)

    return {
      siteId,
      totalEur: Math.round(totalEur * 100) / 100,
      activeModules: modules.length,
    }
  }

  // ── Helpers privés ──

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`https://api.mollie.com${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string>),
      },
    })

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as {
        detail?: string
        title?: string
      }
      throw new Error(
        `Erreur Mollie (${response.status}): ${errorBody.detail ?? errorBody.title ?? 'Erreur inconnue'}`,
      )
    }

    return response.json() as Promise<T>
  }
}

/**
 * Factory -- crée une instance depuis les variables d'environnement
 */
export function createMollieService(): MollieService {
  return new MollieService({
    apiKey: process.env.MOLLIE_API_KEY ?? 'stub',
  })
}
