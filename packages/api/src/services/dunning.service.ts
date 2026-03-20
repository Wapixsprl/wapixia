/**
 * Service Dunning — Relances de paiement & suspension automatique
 * Sprint 5 : pipeline complet de relances avec escalade progressive
 *
 * Escalade :
 *   J+1  → email de rappel
 *   J+7  → retry paiement + email avertissement
 *   J+14 → suspension des modules IA + email
 *   J+30 → suspension du site complet + email final
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createMollieService, type MollieService } from './mollie.service.js'
import { createBrevoService, BREVO_TEMPLATES, type BrevoService } from './brevo.service.js'

// ── Types ──

interface DunningConfig {
  mollieService: MollieService
  brevoService: BrevoService
}

interface DunningDelayResult {
  delayMs: number | null
  label: string
}

interface SubscriptionRow {
  id: string
  site_id: string
  mollie_customer_id: string
  mollie_mandate_id: string
  amount: string
  currency: string
  last_payment_at: string
  dunning_attempt: number
  status: string
}

interface SiteRow {
  id: string
  name: string
  status: string
  owner_user_id: string
}

interface UserRow {
  email: string
  first_name: string | null
}

interface ProcessDunningResult {
  subscriptionId: string
  action: 'reminder' | 'retry_payment' | 'suspend_modules' | 'suspend_site' | 'none'
  daysPastDue: number
  success: boolean
  error: string | null
}

// ── Constantes ──

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS

// ── Service ──

export class DunningService {
  private mollie: MollieService
  private brevo: BrevoService

  constructor(config: DunningConfig) {
    this.mollie = config.mollieService
    this.brevo = config.brevoService
  }

  /**
   * Retourne le délai avant la prochaine tentative de relance
   * J+1: 24h, J+7: 7 jours, J+30: null (fin du cycle)
   */
  getDunningDelay(attemptNumber: number): DunningDelayResult {
    switch (attemptNumber) {
      case 0:
        return { delayMs: ONE_DAY_MS, label: 'J+1 — rappel initial' }
      case 1:
        return { delayMs: SEVEN_DAYS_MS, label: 'J+7 — avertissement + retry' }
      case 2:
        return { delayMs: SEVEN_DAYS_MS, label: 'J+14 — suspension modules' }
      case 3:
        return { delayMs: 16 * ONE_DAY_MS, label: 'J+30 — suspension site' }
      default:
        return { delayMs: null, label: 'Cycle de relance terminé' }
    }
  }

  /**
   * Pipeline complet de relance pour un abonnement en impayé
   */
  async processDunning(
    subscriptionId: string,
    supabase: SupabaseClient,
  ): Promise<ProcessDunningResult> {
    // Récupérer l'abonnement
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single()

    if (subError || !subscription) {
      return {
        subscriptionId,
        action: 'none',
        daysPastDue: 0,
        success: false,
        error: `Abonnement introuvable: ${subError?.message ?? 'Aucune donnée'}`,
      }
    }

    const sub = subscription as SubscriptionRow
    const lastPayment = new Date(sub.last_payment_at)
    const now = new Date()
    const daysPastDue = Math.floor((now.getTime() - lastPayment.getTime()) / ONE_DAY_MS)

    // Récupérer le site et l'utilisateur pour les emails
    const { data: site } = await supabase
      .from('sites')
      .select('id, name, status, owner_user_id')
      .eq('id', sub.site_id)
      .single()

    const siteRow = site as SiteRow | null
    const ownerEmail = await this.getOwnerEmail(siteRow?.owner_user_id ?? '', supabase)

    try {
      // J+30 : suspension complète du site
      if (daysPastDue >= 30) {
        await this.suspendSite(sub.site_id, supabase)
        await this.sendDunningEmail(ownerEmail, siteRow?.name ?? '', 'site_suspended')
        await this.updateDunningAttempt(subscriptionId, sub.dunning_attempt + 1, supabase)

        return {
          subscriptionId,
          action: 'suspend_site',
          daysPastDue,
          success: true,
          error: null,
        }
      }

      // J+14 : suspension des modules IA
      if (daysPastDue >= 14) {
        await this.suspendModules(sub.site_id, supabase)
        await this.sendDunningEmail(ownerEmail, siteRow?.name ?? '', 'modules_suspended')
        await this.updateDunningAttempt(subscriptionId, sub.dunning_attempt + 1, supabase)

        return {
          subscriptionId,
          action: 'suspend_modules',
          daysPastDue,
          success: true,
          error: null,
        }
      }

      // J+7 : tentative de paiement automatique + email
      if (daysPastDue >= 7) {
        await this.retryPayment(sub)
        await this.sendDunningEmail(ownerEmail, siteRow?.name ?? '', 'payment_retry')
        await this.updateDunningAttempt(subscriptionId, sub.dunning_attempt + 1, supabase)

        return {
          subscriptionId,
          action: 'retry_payment',
          daysPastDue,
          success: true,
          error: null,
        }
      }

      // J+1 : simple rappel par email
      if (daysPastDue >= 1) {
        await this.sendDunningEmail(ownerEmail, siteRow?.name ?? '', 'reminder')
        await this.updateDunningAttempt(subscriptionId, sub.dunning_attempt + 1, supabase)

        return {
          subscriptionId,
          action: 'reminder',
          daysPastDue,
          success: true,
          error: null,
        }
      }

      return {
        subscriptionId,
        action: 'none',
        daysPastDue,
        success: true,
        error: null,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      return {
        subscriptionId,
        action: 'none',
        daysPastDue,
        success: false,
        error: `Erreur lors du traitement de la relance: ${message}`,
      }
    }
  }

  /**
   * Suspend le site complet (status = 'suspended')
   */
  async suspendSite(siteId: string, supabase: SupabaseClient): Promise<void> {
    const { error } = await supabase
      .from('sites')
      .update({ status: 'suspended', updated_at: new Date().toISOString() })
      .eq('id', siteId)

    if (error) {
      throw new Error(`Erreur lors de la suspension du site: ${error.message}`)
    }

    console.log(`[DunningService] Site ${siteId} suspendu`)
  }

  /**
   * Suspend tous les modules IA d'un site (status = 'paused')
   */
  async suspendModules(siteId: string, supabase: SupabaseClient): Promise<void> {
    const { error } = await supabase
      .from('site_modules')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('site_id', siteId)
      .eq('status', 'active')

    if (error) {
      throw new Error(`Erreur lors de la suspension des modules: ${error.message}`)
    }

    console.log(`[DunningService] Modules du site ${siteId} suspendus`)
  }

  /**
   * Réactive le site et ses modules après un paiement réussi
   */
  async reactivateAfterPayment(
    subscriptionId: string,
    supabase: SupabaseClient,
  ): Promise<void> {
    // Récupérer l'abonnement
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('site_id')
      .eq('id', subscriptionId)
      .single()

    if (subError || !subscription) {
      throw new Error(`Abonnement introuvable: ${subError?.message ?? 'Aucune donnée'}`)
    }

    const siteId = (subscription as { site_id: string }).site_id

    // Réactiver le site
    const { error: siteError } = await supabase
      .from('sites')
      .update({ status: 'live', updated_at: new Date().toISOString() })
      .eq('id', siteId)
      .eq('status', 'suspended')

    if (siteError) {
      throw new Error(`Erreur lors de la réactivation du site: ${siteError.message}`)
    }

    // Réactiver les modules
    const { error: modError } = await supabase
      .from('site_modules')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('site_id', siteId)
      .eq('status', 'paused')

    if (modError) {
      throw new Error(`Erreur lors de la réactivation des modules: ${modError.message}`)
    }

    // Remettre le compteur de relances à zéro
    await supabase
      .from('subscriptions')
      .update({
        dunning_attempt: 0,
        last_payment_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)

    console.log(`[DunningService] Abonnement ${subscriptionId} réactivé (site=${siteId})`)
  }

  // ── Méthodes privées ──

  private async retryPayment(sub: SubscriptionRow): Promise<void> {
    await this.mollie.chargeRecurring({
      customerId: sub.mollie_customer_id,
      mandateId: sub.mollie_mandate_id,
      amount: sub.amount,
      currency: sub.currency,
      description: `WapixIA — Relance automatique abonnement`,
      webhookUrl: `${process.env.API_BASE_URL ?? 'https://api.wapixia.com'}/webhooks/mollie`,
      metadata: {
        subscription_id: sub.id,
        site_id: sub.site_id,
        type: 'dunning_retry',
      },
    })
  }

  private async getOwnerEmail(
    userId: string,
    supabase: SupabaseClient,
  ): Promise<string> {
    if (!userId) return ''
    const { data } = await supabase
      .from('users')
      .select('email, first_name')
      .eq('id', userId)
      .single()

    return (data as UserRow | null)?.email ?? ''
  }

  private async sendDunningEmail(
    email: string,
    siteName: string,
    type: 'reminder' | 'payment_retry' | 'modules_suspended' | 'site_suspended',
  ): Promise<void> {
    if (!email) return

    const templateMap: Record<typeof type, number> = {
      reminder: BREVO_TEMPLATES.PAYMENT_FAILED,
      payment_retry: BREVO_TEMPLATES.PAYMENT_FAILED,
      modules_suspended: BREVO_TEMPLATES.PAYMENT_FAILED,
      site_suspended: BREVO_TEMPLATES.PAYMENT_FAILED,
    }

    await this.brevo.send({
      templateId: templateMap[type],
      to: email,
      params: {
        site_name: siteName,
        dunning_type: type,
        action_url: `${process.env.DASHBOARD_URL ?? 'https://app.wapixia.com'}/billing`,
      },
    })
  }

  private async updateDunningAttempt(
    subscriptionId: string,
    attempt: number,
    supabase: SupabaseClient,
  ): Promise<void> {
    await supabase
      .from('subscriptions')
      .update({
        dunning_attempt: attempt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)
  }
}

/**
 * Factory -- crée une instance depuis les services existants
 */
export function createDunningService(): DunningService {
  return new DunningService({
    mollieService: createMollieService(),
    brevoService: createBrevoService(),
  })
}
