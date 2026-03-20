/**
 * Service Site Provisioner — Pipeline complet de provisioning d'un site
 * Sprint 6 : orchestration des 7 étapes de mise en ligne
 *
 * Étapes :
 *   1. Création sous-domaine Cloudflare (slug.wapixia.com)
 *   2. Création application Coolify avec env vars
 *   3. Déploiement + polling (timeout 8min)
 *   4. Vérification SSL (timeout 2min)
 *   5. Smoke test du site
 *   6. Audit SEO basique
 *   7. Envoi email "site prêt"
 */

import { createCloudflareService, type CloudflareService } from './cloudflare.service.js'
import { createCoolifyService, type CoolifyService } from './coolify.service.js'
import { createSmokeTesterService, type SmokeTesterService, type SmokeTestResult } from './smoke-tester.service.js'
import { createBrevoService, type BrevoService } from './brevo.service.js'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProvisionStep =
  | 'cloudflare_dns'
  | 'coolify_create'
  | 'deploy'
  | 'ssl_verify'
  | 'smoke_test'
  | 'seo_audit'
  | 'send_email'

interface ProvisionProgress {
  step: ProvisionStep
  stepNumber: number
  totalSteps: number
  status: 'in_progress' | 'completed' | 'failed'
  detail: string
}

interface ProvisionResult {
  success: boolean
  domain: string
  coolifyAppId: string
  cloudflareRecordId: string
  smokeTest: SmokeTestResult | null
  seoScore: number
  error: string | null
}

interface SiteRecord {
  id: string
  slug: string
  name: string
  organization_id: string
  owner_user_id: string
  sector: string
  primary_color: string
  secondary_color: string
  theme: string
  google_analytics_id: string | null
  google_tag_manager_id: string | null
  onboarding_data: Record<string, unknown> | null
}

interface OwnerRecord {
  email: string
  first_name: string | null
}

interface SiteEnvVars {
  NEXT_PUBLIC_SITE_ID: string
  NEXT_PUBLIC_SITE_NAME: string
  NEXT_PUBLIC_SITE_SLUG: string
  NEXT_PUBLIC_SECTOR: string
  NEXT_PUBLIC_PRIMARY_COLOR: string
  NEXT_PUBLIC_SECONDARY_COLOR: string
  NEXT_PUBLIC_THEME: string
  NEXT_PUBLIC_GA_ID: string
  NEXT_PUBLIC_GTM_ID: string
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SITE_DOMAIN: string
  [key: string]: string
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEPLOY_TIMEOUT_MS = 8 * 60 * 1_000 // 8 minutes
const DEPLOY_POLL_INTERVAL_MS = 10_000 // 10 secondes
const SSL_TIMEOUT_MS = 2 * 60 * 1_000 // 2 minutes
const SSL_POLL_INTERVAL_MS = 5_000 // 5 secondes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SiteProvisionerService {
  private cloudflare: CloudflareService
  private coolify: CoolifyService
  private smokeTester: SmokeTesterService
  private brevo: BrevoService
  private stubMode: boolean

  constructor(deps: {
    cloudflare: CloudflareService
    coolify: CoolifyService
    smokeTester: SmokeTesterService
    brevo: BrevoService
  }) {
    this.cloudflare = deps.cloudflare
    this.coolify = deps.coolify
    this.smokeTester = deps.smokeTester
    this.brevo = deps.brevo
    this.stubMode = !process.env.COOLIFY_API_TOKEN || process.env.COOLIFY_API_TOKEN === 'stub'
  }

  /**
   * Pipeline complet de provisioning — 7 étapes
   */
  async provisionSite(
    siteId: string,
    supabase: SupabaseClient,
  ): Promise<ProvisionResult> {
    console.log(`[SiteProvisioner] Démarrage du provisioning pour le site ${siteId}`)

    if (this.stubMode) {
      console.log('[SiteProvisioner] MODE STUB — simulation du pipeline complet')
      return this.provisionSiteStub(siteId, supabase)
    }

    // Récupération des données du site
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, slug, name, organization_id, owner_user_id, sector, primary_color, secondary_color, theme, google_analytics_id, google_tag_manager_id, onboarding_data')
      .eq('id', siteId)
      .single()

    if (siteError || !site) {
      throw new Error(`Site introuvable: ${siteId}`)
    }

    const siteRecord = site as unknown as SiteRecord

    // Récupération de l'email du propriétaire
    const { data: owner } = await supabase
      .from('users')
      .select('email, first_name')
      .eq('id', siteRecord.owner_user_id)
      .single()

    const ownerRecord = owner as unknown as OwnerRecord | null

    let domain = ''
    let coolifyAppId = ''
    let cloudflareRecordId = ''
    let smokeResult: SmokeTestResult | null = null
    let seoScore = 0

    try {
      // ── Étape 1 : Création sous-domaine Cloudflare ──
      await this.updateProvisionStatus(siteId, 'cloudflare_dns', {
        step: 'cloudflare_dns',
        stepNumber: 1,
        totalSteps: 7,
        status: 'in_progress',
        detail: 'Création du sous-domaine DNS...',
      }, supabase)

      const dnsResult = await this.cloudflare.createSubdomain(siteRecord.slug)
      domain = dnsResult.domain
      cloudflareRecordId = dnsResult.recordId

      await supabase
        .from('sites')
        .update({
          temp_domain: domain,
          cloudflare_record_id: cloudflareRecordId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', siteId)

      console.log(`[SiteProvisioner] Étape 1/7 — DNS créé: ${domain}`)

      // ── Étape 2 : Création application Coolify ──
      await this.updateProvisionStatus(siteId, 'coolify_create', {
        step: 'coolify_create',
        stepNumber: 2,
        totalSteps: 7,
        status: 'in_progress',
        detail: "Création de l'application Coolify...",
      }, supabase)

      const envVars = this.buildSiteEnvVars(siteRecord, domain)
      const appResult = await this.coolify.createApplication({
        name: `wapixia-${siteRecord.slug}`,
        domain,
        envVars,
      })
      coolifyAppId = appResult.appId

      await supabase
        .from('sites')
        .update({
          coolify_app_id: coolifyAppId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', siteId)

      console.log(`[SiteProvisioner] Étape 2/7 — App Coolify créée: ${coolifyAppId}`)

      // ── Étape 3 : Déploiement + polling ──
      await this.updateProvisionStatus(siteId, 'deploy', {
        step: 'deploy',
        stepNumber: 3,
        totalSteps: 7,
        status: 'in_progress',
        detail: 'Déploiement en cours...',
      }, supabase)

      const deployResult = await this.coolify.triggerDeploy(coolifyAppId)
      await this.pollDeployment(deployResult.deploymentId)

      console.log('[SiteProvisioner] Étape 3/7 — Déploiement terminé')

      // ── Étape 4 : Vérification SSL ──
      await this.updateProvisionStatus(siteId, 'ssl_verify', {
        step: 'ssl_verify',
        stepNumber: 4,
        totalSteps: 7,
        status: 'in_progress',
        detail: 'Vérification du certificat SSL...',
      }, supabase)

      await this.waitForSSL(domain)

      await supabase
        .from('sites')
        .update({
          ssl_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', siteId)

      console.log('[SiteProvisioner] Étape 4/7 — SSL vérifié')

      // ── Étape 5 : Smoke test ──
      await this.updateProvisionStatus(siteId, 'smoke_test', {
        step: 'smoke_test',
        stepNumber: 5,
        totalSteps: 7,
        status: 'in_progress',
        detail: 'Tests de vérification du site...',
      }, supabase)

      smokeResult = await this.smokeTester.smokeTestSite(domain)

      console.log(`[SiteProvisioner] Étape 5/7 — Smoke test: ${smokeResult.passed ? 'OK' : 'ECHEC'}`)

      // ── Étape 6 : Audit SEO basique ──
      await this.updateProvisionStatus(siteId, 'seo_audit', {
        step: 'seo_audit',
        stepNumber: 6,
        totalSteps: 7,
        status: 'in_progress',
        detail: 'Audit SEO en cours...',
      }, supabase)

      seoScore = smokeResult.seoScore

      await supabase
        .from('sites')
        .update({
          seo_score: seoScore,
          updated_at: new Date().toISOString(),
        })
        .eq('id', siteId)

      console.log(`[SiteProvisioner] Étape 6/7 — SEO score: ${seoScore}`)

      // ── Étape 7 : Envoi email "site prêt" ──
      await this.updateProvisionStatus(siteId, 'send_email', {
        step: 'send_email',
        stepNumber: 7,
        totalSteps: 7,
        status: 'in_progress',
        detail: "Envoi de l'email de confirmation...",
      }, supabase)

      if (ownerRecord?.email) {
        await this.brevo.sendSiteReady({
          email: ownerRecord.email,
          siteName: siteRecord.name,
          siteUrl: `https://${domain}`,
        })
      }

      console.log('[SiteProvisioner] Étape 7/7 — Email envoyé')

      // ── Finalisation ──
      await supabase
        .from('sites')
        .update({
          status: 'live',
          launched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', siteId)

      console.log(`[SiteProvisioner] Provisioning terminé avec succès pour ${domain}`)

      return {
        success: true,
        domain,
        coolifyAppId,
        cloudflareRecordId,
        smokeTest: smokeResult,
        seoScore,
        error: null,
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error(`[SiteProvisioner] Erreur provisioning: ${errorMessage}`)

      await supabase
        .from('sites')
        .update({
          status: 'setup',
          ssl_status: 'error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', siteId)

      return {
        success: false,
        domain,
        coolifyAppId,
        cloudflareRecordId,
        smokeTest: smokeResult,
        seoScore,
        error: errorMessage,
      }
    }
  }

  /**
   * Met à jour le statut de provisioning dans la base de données
   */
  async updateProvisionStatus(
    siteId: string,
    step: ProvisionStep,
    progress: ProvisionProgress,
    supabase: SupabaseClient,
  ): Promise<void> {
    const { error } = await supabase
      .from('sites')
      .update({
        hosting_config: {
          provision_step: step,
          provision_progress: progress,
          provision_updated_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId)

    if (error) {
      console.warn(`[SiteProvisioner] Erreur mise à jour statut: ${error.message}`)
    }
  }

  /**
   * Construit les variables d'environnement pour le site Next.js
   */
  buildSiteEnvVars(site: SiteRecord, domain: string): SiteEnvVars {
    return {
      NEXT_PUBLIC_SITE_ID: site.id,
      NEXT_PUBLIC_SITE_NAME: site.name,
      NEXT_PUBLIC_SITE_SLUG: site.slug,
      NEXT_PUBLIC_SECTOR: site.sector,
      NEXT_PUBLIC_PRIMARY_COLOR: site.primary_color ?? '#00D4B1',
      NEXT_PUBLIC_SECONDARY_COLOR: site.secondary_color ?? '#050D1A',
      NEXT_PUBLIC_THEME: site.theme ?? 'default',
      NEXT_PUBLIC_GA_ID: site.google_analytics_id ?? '',
      NEXT_PUBLIC_GTM_ID: site.google_tag_manager_id ?? '',
      SUPABASE_URL: process.env.SUPABASE_URL ?? '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? '',
      SITE_DOMAIN: domain,
    }
  }

  // ── Méthodes internes ──

  private async pollDeployment(deploymentId: string): Promise<void> {
    const deadline = Date.now() + DEPLOY_TIMEOUT_MS
    let lastStatus = ''

    while (Date.now() < deadline) {
      const { status, logs } = await this.coolify.getDeploymentStatus(deploymentId)
      lastStatus = status

      if (status === 'finished') {
        return
      }

      if (status === 'failed') {
        throw new Error(`Déploiement échoué: ${logs.substring(0, 500)}`)
      }

      await sleep(DEPLOY_POLL_INTERVAL_MS)
    }

    throw new Error(`Timeout déploiement après 8 minutes (dernier statut: ${lastStatus})`)
  }

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
        // SSL pas encore prêt, on réessaie
      }

      await sleep(SSL_POLL_INTERVAL_MS)
    }

    throw new Error(`Timeout SSL après 2 minutes pour ${domain}`)
  }

  /**
   * Mode stub — simule le pipeline complet avec des logs
   */
  private async provisionSiteStub(
    siteId: string,
    supabase: SupabaseClient,
  ): Promise<ProvisionResult> {
    const { data: site } = await supabase
      .from('sites')
      .select('id, slug, name, organization_id, owner_user_id, sector, primary_color, secondary_color, theme, google_analytics_id, google_tag_manager_id, onboarding_data')
      .eq('id', siteId)
      .single()

    const siteRecord = site as unknown as SiteRecord | null
    const slug = siteRecord?.slug ?? 'demo'
    const domain = `${slug}.wapixia.com`

    const steps: ProvisionStep[] = [
      'cloudflare_dns',
      'coolify_create',
      'deploy',
      'ssl_verify',
      'smoke_test',
      'seo_audit',
      'send_email',
    ]

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      console.log(`[SiteProvisioner] STUB: Étape ${i + 1}/7 — ${step}`)
      await this.updateProvisionStatus(siteId, step, {
        step,
        stepNumber: i + 1,
        totalSteps: 7,
        status: 'completed',
        detail: `Simulation ${step} terminée`,
      }, supabase)
    }

    await supabase
      .from('sites')
      .update({
        temp_domain: domain,
        coolify_app_id: `coolify-stub-${Date.now()}`,
        cloudflare_record_id: `cf-stub-${Date.now()}`,
        ssl_status: 'active',
        seo_score: 85,
        status: 'live',
        launched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId)

    console.log(`[SiteProvisioner] STUB: Provisioning simulé pour ${domain}`)

    return {
      success: true,
      domain,
      coolifyAppId: `coolify-stub-${Date.now()}`,
      cloudflareRecordId: `cf-stub-${Date.now()}`,
      smokeTest: null,
      seoScore: 85,
      error: null,
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSiteProvisionerService(): SiteProvisionerService {
  return new SiteProvisionerService({
    cloudflare: createCloudflareService(),
    coolify: createCoolifyService(),
    smokeTester: createSmokeTesterService(),
    brevo: createBrevoService(),
  })
}

// ---------------------------------------------------------------------------
// Re-export types
// ---------------------------------------------------------------------------

export type { ProvisionStep, ProvisionProgress, ProvisionResult, SiteEnvVars }
