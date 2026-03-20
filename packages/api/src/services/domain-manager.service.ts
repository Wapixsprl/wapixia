/**
 * Service Domain Manager — Gestion des domaines personnalisés
 * Sprint 6 : workflow complet domaine personnalisé
 *
 * Workflow :
 *   1. initCustomDomain    — validation + sauvegarde + instructions CNAME
 *   2. verifyDNSPropagation — vérification résolution CNAME → proxy.wapixia.com
 *   3. activateCustomDomain — mise à jour Coolify + attente SSL + email
 */

import { createCloudflareService, type CloudflareService } from './cloudflare.service.js'
import { createCoolifyService, type CoolifyService } from './coolify.service.js'
import { createBrevoService, type BrevoService } from './brevo.service.js'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DomainInitResult {
  customDomain: string
  status: 'pending_verification'
  dns: {
    type: 'CNAME'
    name: string
    target: string
    instructions: string
  }
}

interface DomainVerifyResult {
  domain: string
  verified: boolean
  cnameFound: boolean
  detail: string
}

interface DomainActivateResult {
  domain: string
  activated: boolean
  sslReady: boolean
  detail: string
}

interface SiteForDomain {
  id: string
  slug: string
  name: string
  temp_domain: string | null
  custom_domain: string | null
  domain_verified: boolean | null
  coolify_app_id: string | null
  owner_user_id: string
}

interface OwnerForEmail {
  email: string
  first_name: string | null
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

const RESERVED_DOMAINS = [
  'wapixia.com',
  'wapixia.be',
  'wapixia.fr',
  'wapixia.eu',
]

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SSL_TIMEOUT_MS = 2 * 60 * 1_000 // 2 minutes
const SSL_POLL_INTERVAL_MS = 5_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class DomainManagerService {
  private cloudflare: CloudflareService
  private coolify: CoolifyService
  private brevo: BrevoService

  constructor(deps: {
    cloudflare: CloudflareService
    coolify: CoolifyService
    brevo: BrevoService
  }) {
    this.cloudflare = deps.cloudflare
    this.coolify = deps.coolify
    this.brevo = deps.brevo
  }

  /**
   * Valide le domaine, le sauvegarde en base, retourne les instructions CNAME
   */
  async initCustomDomain(
    siteId: string,
    domain: string,
    supabase: SupabaseClient,
  ): Promise<DomainInitResult> {
    console.log(`[DomainManager] Initialisation domaine personnalisé: ${domain} pour site ${siteId}`)

    // Validation du format
    if (!this.isValidDomain(domain)) {
      throw new Error(`Nom de domaine invalide: ${domain}`)
    }

    // Vérification domaines réservés
    const isReserved = RESERVED_DOMAINS.some(
      (reserved) => domain === reserved || domain.endsWith(`.${reserved}`),
    )
    if (isReserved) {
      throw new Error(`Domaine réservé: ${domain}`)
    }

    // Vérification unicité en base
    const { data: existing } = await supabase
      .from('sites')
      .select('id')
      .eq('custom_domain', domain)
      .neq('id', siteId)
      .is('deleted_at', null)
      .maybeSingle()

    if (existing) {
      throw new Error(`Ce domaine est déjà utilisé par un autre site`)
    }

    // Récupération du site
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, slug, temp_domain')
      .eq('id', siteId)
      .single()

    if (siteError || !site) {
      throw new Error(`Site introuvable: ${siteId}`)
    }

    const siteRecord = site as unknown as { id: string; slug: string; temp_domain: string | null }
    const cnameTarget = 'proxy.wapixia.com'

    // Sauvegarde en base
    const { error: updateError } = await supabase
      .from('sites')
      .update({
        custom_domain: domain,
        domain_verified: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId)

    if (updateError) {
      throw new Error(`Erreur sauvegarde domaine: ${updateError.message}`)
    }

    const instructions = `Ajoutez un enregistrement CNAME pointant "${domain}" vers "${cnameTarget}" chez votre registrar DNS. La propagation peut prendre jusqu'à 48 heures.`

    console.log(`[DomainManager] Domaine ${domain} initialisé — en attente de vérification DNS`)

    return {
      customDomain: domain,
      status: 'pending_verification',
      dns: {
        type: 'CNAME',
        name: domain,
        target: cnameTarget,
        instructions,
      },
    }
  }

  /**
   * Vérifie si le CNAME du domaine pointe vers proxy.wapixia.com
   */
  async verifyDNSPropagation(
    siteId: string,
    domain: string,
    supabase: SupabaseClient,
  ): Promise<DomainVerifyResult> {
    console.log(`[DomainManager] Vérification DNS pour ${domain}`)

    const { verified, cnameFound } = await this.cloudflare.verifyDNSPropagation(domain)

    if (verified) {
      await supabase
        .from('sites')
        .update({
          domain_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', siteId)

      console.log(`[DomainManager] DNS vérifié pour ${domain} — CNAME trouvé`)
    } else {
      console.log(`[DomainManager] DNS non vérifié pour ${domain} — CNAME: ${cnameFound}`)
    }

    return {
      domain,
      verified,
      cnameFound,
      detail: verified
        ? 'CNAME correctement configuré vers proxy.wapixia.com'
        : 'CNAME non trouvé — vérifiez la configuration DNS chez votre registrar',
    }
  }

  /**
   * Active le domaine personnalisé : mise à jour Coolify, attente SSL, email
   */
  async activateCustomDomain(
    siteId: string,
    domain: string,
    supabase: SupabaseClient,
  ): Promise<DomainActivateResult> {
    console.log(`[DomainManager] Activation du domaine personnalisé: ${domain}`)

    // Récupération du site
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, slug, name, temp_domain, custom_domain, domain_verified, coolify_app_id, owner_user_id')
      .eq('id', siteId)
      .single()

    if (siteError || !site) {
      throw new Error(`Site introuvable: ${siteId}`)
    }

    const siteRecord = site as unknown as SiteForDomain

    if (!siteRecord.domain_verified) {
      throw new Error('Le DNS du domaine doit être vérifié avant activation')
    }

    if (!siteRecord.coolify_app_id) {
      throw new Error("Le site n'a pas encore d'application Coolify associée")
    }

    // Mise à jour du domaine dans Coolify
    await this.coolify.updateDomain(siteRecord.coolify_app_id, domain)
    console.log(`[DomainManager] Domaine mis à jour dans Coolify: ${domain}`)

    // Attente SSL
    let sslReady = false
    try {
      await this.waitForSSL(domain)
      sslReady = true
    } catch {
      console.warn(`[DomainManager] SSL non prêt pour ${domain} — le site reste accessible via HTTP`)
    }

    // Mise à jour en base
    await supabase
      .from('sites')
      .update({
        ssl_status: sslReady ? 'active' : 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId)

    // Envoi email de confirmation
    const { data: owner } = await supabase
      .from('users')
      .select('email, first_name')
      .eq('id', siteRecord.owner_user_id)
      .single()

    const ownerRecord = owner as unknown as OwnerForEmail | null

    if (ownerRecord?.email) {
      await this.brevo.send({
        templateId: 1, // SITE_READY
        to: ownerRecord.email,
        params: {
          site_name: siteRecord.name,
          site_url: `https://${domain}`,
          custom_domain: domain,
        },
      })
      console.log(`[DomainManager] Email de confirmation envoyé à ${ownerRecord.email}`)
    }

    const detail = sslReady
      ? `Domaine ${domain} activé avec SSL`
      : `Domaine ${domain} activé — SSL en cours de provisioning`

    console.log(`[DomainManager] ${detail}`)

    return {
      domain,
      activated: true,
      sslReady,
      detail,
    }
  }

  /**
   * Valide le format d'un nom de domaine
   */
  isValidDomain(domain: string): boolean {
    if (!domain || domain.length < 4 || domain.length > 253) {
      return false
    }
    return DOMAIN_REGEX.test(domain)
  }

  // ── Méthodes internes ──

  private async waitForSSL(domain: string): Promise<void> {
    const deadline = Date.now() + SSL_TIMEOUT_MS
    const url = `https://${domain}`

    while (Date.now() < deadline) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 5_000)
        const response = await fetch(url, { signal: controller.signal })
        clearTimeout(timer)

        if (response.ok || response.status === 301 || response.status === 302) {
          return
        }
      } catch {
        // SSL pas encore prêt
      }

      await sleep(SSL_POLL_INTERVAL_MS)
    }

    throw new Error(`Timeout SSL après 2 minutes pour ${domain}`)
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDomainManagerService(): DomainManagerService {
  return new DomainManagerService({
    cloudflare: createCloudflareService(),
    coolify: createCoolifyService(),
    brevo: createBrevoService(),
  })
}

// ---------------------------------------------------------------------------
// Re-export types
// ---------------------------------------------------------------------------

export type { DomainInitResult, DomainVerifyResult, DomainActivateResult }
