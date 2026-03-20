/**
 * Service Site Migrator — Migration FTP/SFTP vers hébergement client
 * Sprint 6 : stub fonctionnel avec logs détaillés
 *
 * Pipeline de migration :
 *   1. Test connexion FTP/SFTP
 *   2. Export du build Next.js (static export)
 *   3. Upload vers le serveur client
 *   4. Mise à jour de la base de données
 *   5. Cleanup des fichiers temporaires
 *
 * NOTE : En V1, tout est en mode stub (log what would happen).
 * L'implémentation réelle utilisera une lib FTP/SFTP (basic-ftp, ssh2-sftp-client).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TransferProtocol = 'ftp' | 'sftp'

interface FTPConfig {
  protocol: TransferProtocol
  host: string
  port: number
  username: string
  password: string
  remotePath: string
  passive?: boolean
}

interface ConnectionTestResult {
  success: boolean
  protocol: TransferProtocol
  host: string
  detail: string
  durationMs: number
}

interface MigrationStep {
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  detail: string
}

interface MigrationResult {
  success: boolean
  siteId: string
  protocol: TransferProtocol
  host: string
  steps: MigrationStep[]
  error: string | null
  totalDurationMs: number
}

interface SiteForMigration {
  id: string
  slug: string
  name: string
  temp_domain: string | null
  coolify_app_id: string | null
  hosting_type: string
  hosting_config: Record<string, unknown> | null
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SiteMigratorService {
  private stubMode: boolean

  constructor() {
    // Toujours en stub mode pour V1
    this.stubMode = true
  }

  /**
   * Pipeline complet de migration vers l'hébergement client
   */
  async migrateToClientHosting(
    siteId: string,
    config: FTPConfig,
    supabase: SupabaseClient,
  ): Promise<MigrationResult> {
    const totalStart = Date.now()
    const steps: MigrationStep[] = []

    console.log(`[SiteMigrator] Démarrage migration pour site ${siteId} vers ${config.protocol}://${config.host}`)

    if (this.stubMode) {
      console.log('[SiteMigrator] MODE STUB — simulation de la migration')
    }

    // Récupération des données du site
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, slug, name, temp_domain, coolify_app_id, hosting_type, hosting_config')
      .eq('id', siteId)
      .single()

    if (siteError || !site) {
      return {
        success: false,
        siteId,
        protocol: config.protocol,
        host: config.host,
        steps: [],
        error: `Site introuvable: ${siteId}`,
        totalDurationMs: Date.now() - totalStart,
      }
    }

    const siteRecord = site as unknown as SiteForMigration

    try {
      // ── Étape 1 : Test connexion FTP/SFTP ──
      const connectionStep: MigrationStep = {
        name: 'test_connection',
        status: 'in_progress',
        detail: `Test connexion ${config.protocol}://${config.host}:${config.port}...`,
      }
      steps.push(connectionStep)

      const connectionTest = await this.testFTPConnection(config)
      if (!connectionTest.success) {
        connectionStep.status = 'failed'
        connectionStep.detail = connectionTest.detail
        throw new Error(`Connexion échouée: ${connectionTest.detail}`)
      }
      connectionStep.status = 'completed'
      connectionStep.detail = connectionTest.detail

      console.log(`[SiteMigrator] Étape 1/5 — Connexion ${config.protocol} OK`)

      // ── Étape 2 : Export du build ──
      const exportStep: MigrationStep = {
        name: 'export_build',
        status: 'in_progress',
        detail: 'Export du build Next.js...',
      }
      steps.push(exportStep)

      if (this.stubMode) {
        console.log(`[SiteMigrator] STUB: Export build pour ${siteRecord.slug}`)
        exportStep.status = 'completed'
        exportStep.detail = `Build exporté pour ${siteRecord.slug} (simulé)`
      } else {
        // TODO Sprint 7+ : appel réel pour exporter le build
        exportStep.status = 'completed'
        exportStep.detail = 'Build exporté'
      }

      console.log('[SiteMigrator] Étape 2/5 — Build exporté')

      // ── Étape 3 : Upload vers serveur client ──
      const uploadStep: MigrationStep = {
        name: 'upload_files',
        status: 'in_progress',
        detail: `Upload vers ${config.remotePath}...`,
      }
      steps.push(uploadStep)

      if (this.stubMode) {
        console.log(
          `[SiteMigrator] STUB: Upload vers ${config.protocol}://${config.host}:${config.port}${config.remotePath}`,
        )
        uploadStep.status = 'completed'
        uploadStep.detail = `Fichiers uploadés vers ${config.remotePath} (simulé)`
      } else {
        // TODO Sprint 7+ : upload réel via basic-ftp ou ssh2-sftp-client
        uploadStep.status = 'completed'
        uploadStep.detail = `Fichiers uploadés vers ${config.remotePath}`
      }

      console.log('[SiteMigrator] Étape 3/5 — Fichiers uploadés')

      // ── Étape 4 : Mise à jour base de données ──
      const dbStep: MigrationStep = {
        name: 'update_database',
        status: 'in_progress',
        detail: 'Mise à jour de la configuration hébergement...',
      }
      steps.push(dbStep)

      const hostingConfig: Record<string, unknown> = {
        protocol: config.protocol,
        host: config.host,
        port: config.port,
        remote_path: config.remotePath,
        migrated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('sites')
        .update({
          hosting_type: 'client_ftp',
          hosting_config: hostingConfig,
          updated_at: new Date().toISOString(),
        })
        .eq('id', siteId)

      if (updateError) {
        dbStep.status = 'failed'
        dbStep.detail = `Erreur mise à jour: ${updateError.message}`
        throw new Error(`Erreur base de données: ${updateError.message}`)
      }

      dbStep.status = 'completed'
      dbStep.detail = 'Configuration hébergement mise à jour'

      console.log('[SiteMigrator] Étape 4/5 — Base de données mise à jour')

      // ── Étape 5 : Cleanup ──
      const cleanupStep: MigrationStep = {
        name: 'cleanup',
        status: 'in_progress',
        detail: 'Nettoyage des fichiers temporaires...',
      }
      steps.push(cleanupStep)

      if (this.stubMode) {
        console.log('[SiteMigrator] STUB: Cleanup fichiers temporaires')
      }
      // TODO Sprint 7+ : suppression des fichiers build temporaires

      cleanupStep.status = 'completed'
      cleanupStep.detail = 'Fichiers temporaires nettoyés'

      console.log('[SiteMigrator] Étape 5/5 — Cleanup terminé')

      const result: MigrationResult = {
        success: true,
        siteId,
        protocol: config.protocol,
        host: config.host,
        steps,
        error: null,
        totalDurationMs: Date.now() - totalStart,
      }

      console.log(
        `[SiteMigrator] Migration terminée avec succès en ${result.totalDurationMs}ms`,
      )

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error(`[SiteMigrator] Erreur migration: ${errorMessage}`)

      return {
        success: false,
        siteId,
        protocol: config.protocol,
        host: config.host,
        steps,
        error: errorMessage,
        totalDurationMs: Date.now() - totalStart,
      }
    }
  }

  /**
   * Teste la connexion FTP/SFTP avec les credentials fournis
   */
  async testFTPConnection(config: FTPConfig): Promise<ConnectionTestResult> {
    const start = Date.now()

    console.log(
      `[SiteMigrator] Test connexion ${config.protocol}://${config.username}@${config.host}:${config.port}`,
    )

    // Validation basique des paramètres
    if (!config.host || config.host.length < 3) {
      return {
        success: false,
        protocol: config.protocol,
        host: config.host,
        detail: "Hôte invalide ou manquant",
        durationMs: Date.now() - start,
      }
    }

    if (!config.username) {
      return {
        success: false,
        protocol: config.protocol,
        host: config.host,
        detail: "Nom d'utilisateur manquant",
        durationMs: Date.now() - start,
      }
    }

    if (!config.password) {
      return {
        success: false,
        protocol: config.protocol,
        host: config.host,
        detail: 'Mot de passe manquant',
        durationMs: Date.now() - start,
      }
    }

    if (config.port < 1 || config.port > 65535) {
      return {
        success: false,
        protocol: config.protocol,
        host: config.host,
        detail: `Port invalide: ${config.port}`,
        durationMs: Date.now() - start,
      }
    }

    if (this.stubMode) {
      console.log(
        `[SiteMigrator] STUB: Test connexion ${config.protocol}://${config.host}:${config.port} — simulé OK`,
      )
      return {
        success: true,
        protocol: config.protocol,
        host: config.host,
        detail: `Connexion ${config.protocol.toUpperCase()} simulée avec succès (mode stub)`,
        durationMs: Date.now() - start,
      }
    }

    // TODO Sprint 7+ : connexion réelle via basic-ftp (FTP) ou ssh2-sftp-client (SFTP)
    // const client = config.protocol === 'ftp' ? new ftp.Client() : new SFTPClient()
    // await client.connect(...)

    return {
      success: true,
      protocol: config.protocol,
      host: config.host,
      detail: `Connexion ${config.protocol.toUpperCase()} établie`,
      durationMs: Date.now() - start,
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSiteMigratorService(): SiteMigratorService {
  return new SiteMigratorService()
}

// ---------------------------------------------------------------------------
// Re-export types
// ---------------------------------------------------------------------------

export type { FTPConfig, ConnectionTestResult, MigrationStep, MigrationResult, TransferProtocol }
