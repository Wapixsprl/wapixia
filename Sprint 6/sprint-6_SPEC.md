# SPRINT 6 — SPEC.md
# Infrastructure & Déploiement Automatique
> Durée : 1 semaine | Début : Semaine 9
> Objectif : déployer un nouveau site en < 10 minutes, zéro intervention manuelle, zéro surprise en production

---

## Contexte pour Claude Code

Lire en premier (ordre obligatoire) :
1. `docs/ARCHITECTURE.md` — section Infrastructure complète
2. `docs/CONVENTIONS.md`
3. `docs/ENV.md` — sections Cloudflare, Coolify, Redis, monitoring
4. `docs/sprints/sprint-2/SPEC.md` — services Cloudflare et Coolify déjà ébauchés
5. `docs/sprints/sprint-6/SPEC.md` — ce fichier

Sprints 1 à 5 terminés. Le produit fonctionne en staging. Ce sprint industrialise le déploiement — chaque nouveau site doit se déployer en totale autonomie, et chaque incident doit déclencher une alerte en moins de 5 minutes.

---

## 1. Périmètre du sprint

### Dans ce sprint ✅
- Pipeline CI/CD GitHub Actions (test → build → deploy staging → deploy prod)
- Script de provisionnement complet d'un nouveau site (1 commande)
- Gestion des sous-domaines et SSL automatique via Cloudflare + Coolify
- Connexion domaine personnalisé + vérification DNS + SSL
- Monitoring UptimeRobot (tous les services critiques)
- Alertes : email + SMS si service down
- Backups quotidiens PostgreSQL vers Hetzner Object Storage
- Test de restauration automatique mensuel
- Logs centralisés (Pino → Betterstack ou Grafana Loki)
- Health check endpoints sur tous les services
- Migration de site client (déployer vers hébergeur externe FTP/SFTP)
- Environnements : staging isolé + production

### Hors sprint ❌
- Auto-scaling VPS → V2 (Hetzner Cloud API)
- CDN Edge Functions → V2
- Observabilité avancée (traces distribuées) → V2

---

## 2. Structure des environnements

```
┌─────────────────────────────────────────────────────────┐
│                     HETZNER VPS                         │
│                                                         │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │    STAGING       │    │       PRODUCTION            │ │
│  │  Coolify         │    │  Coolify                    │ │
│  │  staging.*       │    │  app.wapixia.com            │ │
│  │  api-staging.*   │    │  api.wapixia.com            │ │
│  │  admin-staging.* │    │  admin.wapixia.com          │ │
│  │  [slug]-staging  │    │  [slug].wapixia.com         │ │
│  └─────────────────┘    └─────────────────────────────┘ │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Services partagés staging + prod                   │ │
│  │  Redis (port 6379)  │  BullMQ Dashboard (port 3333) │ │
│  │  Coolify API (port 8000)                            │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
         │                        │
   Cloudflare Proxy          Cloudflare Proxy
   (WAF + DDoS)              (WAF + DDoS)
```

---

## 3. Pipeline CI/CD GitHub Actions

### Workflow principal

```yaml
# .github/workflows/deploy.yml

name: WapixIA CI/CD

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  # ── 1. TESTS ──────────────────────────────────────────────────
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: wapixia_test
        ports: ['5432:5432']
      redis:
        image: redis:7
        ports: ['6379:6379']

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run db:migrate:test
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/wapixia_test
      - run: npm run test:unit
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/wapixia_test
          REDIS_URL: redis://localhost:6379

  # ── 2. BUILD ──────────────────────────────────────────────────
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run build
      - name: Build Docker images
        run: |
          docker build -t wapixia-api:${{ github.sha }} ./packages/api
          docker build -t wapixia-dashboard:${{ github.sha }} ./apps/dashboard
          docker build -t wapixia-admin:${{ github.sha }} ./apps/admin
      - name: Push to GitHub Container Registry
        run: |
          echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          docker push ghcr.io/wapixia/api:${{ github.sha }}
          docker push ghcr.io/wapixia/dashboard:${{ github.sha }}
          docker push ghcr.io/wapixia/admin:${{ github.sha }}

  # ── 3. DEPLOY STAGING ─────────────────────────────────────────
  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging via Coolify API
        run: |
          curl -X POST ${{ secrets.COOLIFY_URL }}/api/v1/deploy \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"uuid":"${{ secrets.STAGING_APP_UUID }}","force":true}'
      - name: Run migrations on staging
        run: |
          ssh -i ${{ secrets.VPS_SSH_KEY }} deploy@${{ secrets.VPS_HOST }} \
            "cd /staging && npx drizzle-kit migrate"
      - name: Smoke tests staging
        run: |
          sleep 30  # attendre que les services démarrent
          curl -f https://api-staging.wapixia.com/health
          curl -f https://staging.wapixia.com

  # ── 4. DEPLOY PRODUCTION ──────────────────────────────────────
  deploy-production:
    needs: [build, deploy-staging]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production  # nécessite approbation manuelle
    steps:
      - name: Deploy to production via Coolify API
        run: |
          curl -X POST ${{ secrets.COOLIFY_URL }}/api/v1/deploy \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"uuid":"${{ secrets.PROD_APP_UUID }}","force":false}'
      - name: Run migrations on production
        run: |
          ssh -i ${{ secrets.VPS_SSH_KEY }} deploy@${{ secrets.VPS_HOST }} \
            "cd /production && npx drizzle-kit migrate"
      - name: Post-deploy health check
        run: |
          sleep 60
          curl -f https://api.wapixia.com/health
          curl -f https://app.wapixia.com
          curl -f https://admin.wapixia.com
      - name: Notify Slack/email on deploy
        if: always()
        run: |
          # Notifier Salim du déploiement (succès ou échec)
          echo "Deploy ${{ job.status }} for commit ${{ github.sha }}"
```

---

## 4. Script de provisionnement d'un nouveau site

```typescript
// packages/api/src/services/site-provisioner.service.ts

/**
 * Provisionne un nouveau site client de bout en bout
 * Appelé par le worker BullMQ après génération du contenu (Sprint 2)
 *
 * Durée cible : < 10 minutes
 */
export async function provisionSite(siteId: string): Promise<ProvisionResult> {
  const site = await getSiteWithContext(siteId)
  const slug = site.slug

  await updateProvisionStatus(siteId, 'provisioning', 5)

  // ── ÉTAPE 1 : Créer le sous-domaine Cloudflare ──────────────────
  const subdomain = `${slug}.wapixia.com`

  const cfRecord = await cloudflareService.createCNAMERecord({
    name: slug,
    target: 'vps.wapixia.com',
    proxied: true,
    ttl: 1,  // auto avec Cloudflare Proxy
  })

  await db.update(sites)
    .set({ tempDomain: subdomain, cloudflareRecordId: cfRecord.id })
    .where(eq(sites.id, siteId))

  await updateProvisionStatus(siteId, 'subdomain_created', 20)

  // ── ÉTAPE 2 : Créer l'app dans Coolify ─────────────────────────
  const envVars = buildSiteEnvVars(site)

  const coolifyApp = await coolifyService.createApplication({
    name: `site-${slug}`,
    gitRepository: process.env.SITE_TEMPLATE_REPO!,
    gitBranch: 'main',
    domain: subdomain,
    buildPack: 'nixpacks',
    envVars,
  })

  await db.update(sites)
    .set({ coolifyAppId: coolifyApp.appId })
    .where(eq(sites.id, siteId))

  await updateProvisionStatus(siteId, 'app_created', 40)

  // ── ÉTAPE 3 : Déploiement initial ──────────────────────────────
  const { deploymentId } = await coolifyService.triggerDeploy(coolifyApp.appId)
  await updateProvisionStatus(siteId, 'deploying', 55)

  // Poll jusqu'à 8 minutes max
  const deployed = await waitForDeployment(deploymentId, 480_000)
  if (!deployed) {
    await updateProvisionStatus(siteId, 'deploy_failed', 55)
    throw new ProvisionError('Déploiement timeout après 8 minutes', { siteId, deploymentId })
  }

  await updateProvisionStatus(siteId, 'deployed', 70)

  // ── ÉTAPE 4 : Vérification SSL ──────────────────────────────────
  const sslOk = await waitForSSL(subdomain, 120_000)  // 2 min max
  await db.update(sites)
    .set({ sslStatus: sslOk ? 'active' : 'pending' })
    .where(eq(sites.id, siteId))

  await updateProvisionStatus(siteId, 'ssl_verified', 80)

  // ── ÉTAPE 5 : Smoke test du site ────────────────────────────────
  const siteHealthy = await smokeTestSite(subdomain)
  if (!siteHealthy) {
    await alertSuperAdmin({ type: 'site_smoke_test_failed', siteId, subdomain })
  }

  await updateProvisionStatus(siteId, 'smoke_tested', 90)

  // ── ÉTAPE 6 : Audit SEO automatique ────────────────────────────
  const seoScore = await runSEOAudit(subdomain)
  await db.update(sites)
    .set({
      status: 'staging',
      seoScore,
      launchedAt: new Date(),
    })
    .where(eq(sites.id, siteId))

  if (seoScore < 80) {
    await alertSuperAdmin({
      type: 'low_seo_score',
      siteId, subdomain, seoScore,
      message: `Score SEO insuffisant (${seoScore}/100) — vérification manuelle requise`,
    })
  }

  await updateProvisionStatus(siteId, 'done', 100)

  // ── ÉTAPE 7 : Email au client ────────────────────────────────────
  await emailQueue.add('send-email', {
    templateId: process.env.BREVO_TEMPLATE_SITE_READY,
    to: site.ownerEmail,
    params: {
      siteName: site.name,
      siteUrl: `https://${subdomain}`,
      dashboardUrl: 'https://app.wapixia.com/overview',
      seoScore,
    }
  })

  return { subdomain, seoScore, deploymentId, sslStatus: sslOk ? 'active' : 'pending' }
}

/**
 * Variables d'environnement injectées dans chaque site Next.js déployé
 */
function buildSiteEnvVars(site: Site): Record<string, string> {
  return {
    SITE_ID: site.id,
    SITE_SLUG: site.slug,
    SITE_SECTOR: site.sector || 'autre',
    SITE_THEME: site.theme || 'default',
    SITE_PRIMARY_COLOR: site.primaryColor || '#00D4B1',
    NEXT_PUBLIC_SITE_URL: `https://${site.slug}.wapixia.com`,
    PAYLOAD_CMS_URL: process.env.PAYLOAD_URL!,
    PAYLOAD_API_KEY: process.env.PAYLOAD_API_KEY!,
    NEXT_REVALIDATE_TOKEN: process.env.NEXT_REVALIDATE_TOKEN!,
    WAPIXIA_API_URL: process.env.API_BASE_URL!,
  }
}
```

---

## 5. Gestion des domaines personnalisés

```typescript
// packages/api/src/services/domain-manager.service.ts

export class DomainManagerService {

  /**
   * Initier la connexion d'un domaine personnalisé
   * Retourne les instructions DNS à configurer
   */
  async initCustomDomain(siteId: string, domain: string): Promise<DNSInstructions> {
    // Vérifier que le domaine n'est pas déjà pris
    const existing = await db.query.sites.findFirst({
      where: eq(sites.customDomain, domain)
    })
    if (existing) throw new ConflictError('Domaine déjà utilisé')

    // Valider le format du domaine
    if (!isValidDomain(domain)) throw new ValidationError('Domaine invalide')

    // Enregistrer le domaine en attente de vérification
    await db.update(sites)
      .set({ customDomain: domain, domainVerified: false, sslStatus: 'pending' })
      .where(eq(sites.id, siteId))

    // Créer un enregistrement DNS dans Cloudflare pour ce domaine
    await cloudflareService.addCustomHostname(domain, siteId)

    // Démarrer le job de vérification (polling toutes les 5 min)
    await domainVerifyQueue.add(
      'verify-domain',
      { siteId, domain },
      { repeat: { every: 5 * 60 * 1000 }, jobId: `verify-${siteId}` }
    )

    return {
      records: [
        {
          type: 'CNAME',
          name: '@',
          value: 'proxy.wapixia.com',
          ttl: 3600,
          instruction: 'Ajoutez cet enregistrement chez votre registrar (ex: OVH, Gandi, Combell)',
        },
        {
          type: 'CNAME',
          name: 'www',
          value: 'proxy.wapixia.com',
          ttl: 3600,
          instruction: 'Optionnel — pour les visites avec www',
        },
      ],
      verificationNote: 'La propagation DNS peut prendre de 15 minutes à 48h selon votre registrar.',
      verificationTimeout: '72h',
    }
  }

  /**
   * Vérifie si le DNS a propagé
   * Appelé par le job BullMQ toutes les 5 minutes
   */
  async verifyDNSPropagation(siteId: string, domain: string): Promise<boolean> {
    try {
      const cname = await resolveCname(domain)
      const propagated = cname.includes('proxy.wapixia.com')

      if (propagated) {
        await this.activateCustomDomain(siteId, domain)
        // Arrêter le job de vérification
        await domainVerifyQueue.removeRepeatable('verify-domain', { jobId: `verify-${siteId}` })
        return true
      }
      return false
    } catch {
      return false  // DNS pas encore propagé
    }
  }

  /**
   * Active le domaine personnalisé (SSL + mise à jour Coolify)
   */
  async activateCustomDomain(siteId: string, domain: string): Promise<void> {
    const site = await getSiteById(siteId)

    // Mettre à jour Coolify avec le nouveau domaine
    await coolifyService.updateDomain(site.coolifyAppId!, domain)

    // Attendre le provisionnement SSL (Cloudflare le fait automatiquement)
    await this.waitForSSLProvisioning(domain)

    await db.update(sites)
      .set({
        domainVerified: true,
        sslStatus: 'active',
      })
      .where(eq(sites.id, siteId))

    // Notifier le client
    await emailQueue.add('send-email', {
      templateId: process.env.BREVO_TEMPLATE_DOMAIN_CONNECTED,
      to: site.ownerEmail,
      params: { domain, siteUrl: `https://${domain}` },
    })

    // Mettre à jour le sitemap et le canonical
    await triggerSiteRevalidation(site.coolifyAppId!)
  }
}
```

---

## 6. Health Checks

```typescript
// packages/api/src/routes/health.ts

// GET /health — endpoint public pour les monitoring
router.get('/health', async (request, reply) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkBullMQ(),
    checkCloudflareAPI(),
    checkAnthropicAPI(),
  ])

  const results = {
    status: checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || 'unknown',
    services: {
      database: checks[0].status === 'fulfilled' ? 'up' : 'down',
      redis: checks[1].status === 'fulfilled' ? 'up' : 'down',
      bullmq: checks[2].status === 'fulfilled' ? 'up' : 'down',
      cloudflare: checks[3].status === 'fulfilled' ? 'up' : 'down',
      anthropic: checks[4].status === 'fulfilled' ? 'up' : 'down',
    },
  }

  reply
    .code(results.status === 'healthy' ? 200 : 503)
    .send(results)
})

async function checkDatabase(): Promise<void> {
  await db.execute(sql`SELECT 1`)
}

async function checkRedis(): Promise<void> {
  const redis = new Redis(process.env.REDIS_URL!)
  await redis.ping()
  await redis.quit()
}

async function checkBullMQ(): Promise<void> {
  const counts = await contentSocialQueue.getJobCounts('failed')
  // Alerte si > 50 jobs en échec
  if (counts.failed > 50) throw new Error(`Trop de jobs en échec: ${counts.failed}`)
}

async function checkCloudflareAPI(): Promise<void> {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}`, {
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` }
  })
  if (!response.ok) throw new Error(`Cloudflare API: ${response.status}`)
}

async function checkAnthropicAPI(): Promise<void> {
  // Ping léger — pas de génération
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  })
  if (!response.ok) throw new Error(`Anthropic API: ${response.status}`)
}
```

---

## 7. Backups automatiques

```bash
#!/bin/bash
# infra/scripts/backup.sh
# Exécuté chaque nuit à 2h via cron sur le VPS Hetzner

set -e

DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_DIR="/tmp/backups"
S3_BUCKET="wapixia-backups"

mkdir -p $BACKUP_DIR

echo "[$(date)] Début backup..."

# ── 1. PostgreSQL dump ────────────────────────────────────────────
pg_dump $DATABASE_URL \
  --format=custom \
  --compress=9 \
  --file="$BACKUP_DIR/wapixia_$DATE.dump"

# ── 2. Upload vers Hetzner Object Storage (S3-compatible) ─────────
s3cmd put \
  --server-side-encryption \
  "$BACKUP_DIR/wapixia_$DATE.dump" \
  "s3://$S3_BUCKET/postgres/wapixia_$DATE.dump"

# ── 3. Nettoyage : garder seulement les 30 derniers jours ─────────
s3cmd ls "s3://$S3_BUCKET/postgres/" | \
  awk '{print $4}' | \
  sort | head -n -30 | \
  xargs -I {} s3cmd del {}

# ── 4. Vérification intégrité du backup ───────────────────────────
pg_restore --list "$BACKUP_DIR/wapixia_$DATE.dump" > /dev/null
echo "[$(date)] Backup vérifié avec succès"

# ── 5. Notification succès ────────────────────────────────────────
curl -X POST $WAPIX_ALERT_WEBHOOK \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"success\",\"file\":\"wapixia_$DATE.dump\",\"size\":\"$(du -h $BACKUP_DIR/wapixia_$DATE.dump | cut -f1)\"}"

# ── 6. Nettoyage local ────────────────────────────────────────────
rm -f "$BACKUP_DIR/wapixia_$DATE.dump"

echo "[$(date)] Backup terminé"
```

```bash
# infra/scripts/restore-test.sh
# Test de restauration mensuel — vérifier que les backups sont utilisables

#!/bin/bash
set -e

LATEST=$(s3cmd ls s3://wapixia-backups/postgres/ | sort | tail -1 | awk '{print $4}')
RESTORE_DB="wapixia_restore_test"

echo "Test de restauration depuis: $LATEST"

# Créer une BDD de test
createdb $RESTORE_DB

# Restaurer
s3cmd get $LATEST /tmp/restore_test.dump
pg_restore \
  --dbname=$RESTORE_DB \
  --jobs=4 \
  /tmp/restore_test.dump

# Vérifier l'intégrité
SITE_COUNT=$(psql $RESTORE_DB -t -c "SELECT count(*) FROM sites")
USER_COUNT=$(psql $RESTORE_DB -t -c "SELECT count(*) FROM users")

echo "Sites: $SITE_COUNT | Users: $USER_COUNT"

# Nettoyer
dropdb $RESTORE_DB
rm -f /tmp/restore_test.dump

echo "✅ Test de restauration réussi"
```

---

## 8. Monitoring UptimeRobot

```typescript
// infra/scripts/setup-monitoring.ts
// Script à exécuter une seule fois pour configurer UptimeRobot

const MONITORS = [
  // Services WapixIA core
  { name: 'WapixIA API Production', url: 'https://api.wapixia.com/health', interval: 5 },
  { name: 'WapixIA Dashboard', url: 'https://app.wapixia.com', interval: 5 },
  { name: 'WapixIA Admin', url: 'https://admin.wapixia.com', interval: 5 },
  { name: 'WapixIA API Staging', url: 'https://api-staging.wapixia.com/health', interval: 15 },
  // Sites clients (monitoring par lot)
  // Ajoutés automatiquement à chaque nouveau site via provisionSite()
]

const ALERT_CONTACTS = [
  { type: 'email', value: process.env.WAPIX_ALERT_EMAIL! },
  { type: 'sms', value: process.env.WAPIX_ALERT_PHONE! },
]

// Ajouter automatiquement un monitor UptimeRobot pour chaque nouveau site
export async function addSiteMonitor(siteId: string, domain: string): Promise<void> {
  const response = await fetch('https://api.uptimerobot.com/v2/newMonitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      api_key: process.env.UPTIMEROBOT_API_KEY!,
      format: 'json',
      type: '1',                      // HTTP(S)
      url: `https://${domain}`,
      friendly_name: `Site WapixIA — ${domain}`,
      interval: '300',                // toutes les 5 min
      alert_contacts: ALERT_CONTACTS.map(c => `${c.value}_5_1`).join('-'),
    })
  })
  const data = await response.json()

  await db.update(sites)
    .set({ metadata: { uptimerobotMonitorId: data.monitor.id } })
    .where(eq(sites.id, siteId))
}
```

---

## 9. Logs centralisés

```typescript
// packages/api/src/lib/logger.ts
import pino from 'pino'

export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  formatters: {
    level(label) { return { level: label } }
  },
  serializers: {
    // Supprimer les PII des logs
    req(req) {
      return {
        method: req.method,
        url: req.url,
        // Pas de headers, pas de body (PII potentielles)
      }
    },
    err: pino.stdSerializers.err,
  },
  // Transport vers Betterstack (ou Grafana Loki en auto-hébergé)
  transport: process.env.NODE_ENV === 'production' ? {
    target: 'pino-betterstack',
    options: {
      sourceToken: process.env.BETTERSTACK_TOKEN,
    }
  } : undefined,
})

// Structure d'un log métier
export function logBusinessEvent(event: {
  type: string
  siteId?: string
  userId?: string
  metadata?: Record<string, unknown>
}) {
  logger.info({
    event: event.type,
    siteId: event.siteId,
    userId: event.userId,
    ...event.metadata,
  })
}
```

---

## 10. Migration vers hébergeur client (FTP/SFTP)

```typescript
// packages/api/src/services/site-migrator.service.ts

/**
 * Déploie un site WapixIA sur l'hébergeur FTP/SFTP du client
 * Pour les clients Option A (achat 1900€) qui hébergent eux-mêmes
 */
export async function migrateToClientHosting(siteId: string, config: {
  type: 'ftp' | 'sftp'
  host: string
  port: number
  username: string
  password: string         // chiffré en entrée
  remotePath: string       // ex: /public_html
}): Promise<void> {
  // 1. Vérifier que la connexion FTP/SFTP fonctionne
  const connected = await testFTPConnection(config)
  if (!connected) throw new Error('Impossible de se connecter au serveur FTP')

  // 2. Exporter le build statique du site Next.js
  const buildDir = await coolifyService.exportStaticBuild(
    await getSiteCoolifyId(siteId)
  )

  // 3. Uploader via FTP/SFTP
  if (config.type === 'sftp') {
    await uploadViaSFTP(buildDir, config)
  } else {
    await uploadViaFTP(buildDir, config)
  }

  // 4. Mettre à jour le statut du site
  await db.update(sites)
    .set({
      hostingType: 'client_ftp',
      hostingConfig: encryptConfig(config),
    })
    .where(eq(sites.id, siteId))

  // 5. Supprimer de Coolify (plus besoin d'hébergement WapixIA)
  await coolifyService.deleteApplication(await getSiteCoolifyId(siteId))

  // 6. Conserver le sous-domaine temporaire comme redirect vers le domaine client
}
```

---

## 11. Smoke tests automatiques

```typescript
// packages/api/src/services/smoke-tester.service.ts

export async function smokeTestSite(domain: string): Promise<{
  passed: boolean
  checks: SmokeCheck[]
}> {
  const baseUrl = `https://${domain}`
  const checks: SmokeCheck[] = []

  // ── Check 1 : Page d'accueil accessible ──────────────────────────
  checks.push(await checkURL(baseUrl, {
    name: 'Homepage accessible',
    expectedStatus: 200,
    timeout: 10_000,
  }))

  // ── Check 2 : SSL valide ─────────────────────────────────────────
  checks.push(await checkSSL(domain, {
    name: 'SSL certificate valid',
  }))

  // ── Check 3 : robots.txt présent ─────────────────────────────────
  checks.push(await checkURL(`${baseUrl}/robots.txt`, {
    name: 'robots.txt present',
    expectedStatus: 200,
    expectedContent: 'User-agent',
  }))

  // ── Check 4 : sitemap.xml présent ────────────────────────────────
  checks.push(await checkURL(`${baseUrl}/sitemap.xml`, {
    name: 'sitemap.xml present',
    expectedStatus: 200,
    expectedContent: '<urlset',
  }))

  // ── Check 5 : Pas de page blanche (SSR vérifié) ──────────────────
  checks.push(await checkContentRendered(baseUrl, {
    name: 'SSR content rendered',
    expectedSelector: 'h1',     // doit exister dans le HTML
  }))

  // ── Check 6 : Meta tags présents ────────────────────────────────
  checks.push(await checkMetaTags(baseUrl, {
    name: 'Meta tags present',
    required: ['title', 'description', 'og:title'],
  }))

  // ── Check 7 : Pas de console errors ─────────────────────────────
  // (via Puppeteer headless)
  checks.push(await checkNoConsoleErrors(baseUrl, {
    name: 'No critical JS errors',
  }))

  const passed = checks.every(c => c.passed)

  // Calculer score SEO basique
  const seoScore = Math.round(
    (checks.filter(c => c.passed).length / checks.length) * 100
  )

  if (!passed) {
    const failures = checks.filter(c => !c.passed).map(c => c.name)
    logger.warn({ domain, failures }, 'Smoke tests échoués')
  }

  return { passed, checks }
}
```

---

## 12. Variables d'environnement Sprint 6

```env
# CI/CD
VPS_SSH_KEY=[clé SSH privée base64]
VPS_HOST=your-hetzner-vps-ip
DEPLOY_USER=deploy
STAGING_APP_UUID=[UUID app Coolify staging]
PROD_APP_UUID=[UUID app Coolify production]
APP_VERSION=1.0.0

# Backups
BACKUP_S3_BUCKET=wapixia-backups
HETZNER_OBJECT_STORAGE_ENDPOINT=https://fsn1.your-objectstorage.com
HETZNER_OBJECT_STORAGE_ACCESS_KEY=...
HETZNER_OBJECT_STORAGE_SECRET_KEY=...

# Monitoring
UPTIMEROBOT_API_KEY=...
UPTIMEROBOT_MAIN_ALERT_CONTACT=...
WAPIX_ALERT_WEBHOOK=https://api.wapixia.com/internal/alerts

# Logs
BETTERSTACK_TOKEN=...  # OU laisser vide pour logs console uniquement en V1

# Brevo templates infra
BREVO_TEMPLATE_SITE_READY=13
BREVO_TEMPLATE_DOMAIN_CONNECTED=14
```

---

## 13. Instructions pour Claude Code

```
Tu travailles sur le Sprint 6 de WapixIA — Infra & Déploiement Auto.

Lire avant de coder :
1. docs/ARCHITECTURE.md — section complète Infrastructure
2. docs/CONVENTIONS.md
3. docs/ENV.md — sections Cloudflare, Coolify, monitoring
4. docs/sprints/sprint-2/SPEC.md — services Cloudflare et Coolify de base
5. docs/sprints/sprint-6/SPEC.md — ce fichier

Ordre de livraison :
1. feat/sprint6-github-actions       — workflows CI/CD complets
2. feat/sprint6-site-provisioner     — script provisionnement bout en bout
3. feat/sprint6-domain-manager       — gestion domaines personnalisés
4. feat/sprint6-health-checks        — endpoints /health sur tous les services
5. feat/sprint6-backup-scripts       — scripts bash backup + restore test
6. feat/sprint6-monitoring-setup     — configuration UptimeRobot auto
7. feat/sprint6-smoke-tester         — smoke tests automatiques post-déploiement
8. feat/sprint6-logger               — Pino structuré + Betterstack
9. feat/sprint6-site-migrator        — migration FTP/SFTP hébergeur client

Règles spécifiques Sprint 6 :
- Le workflow GitHub Actions doit nécessiter une approbation manuelle avant deploy prod
- Les scripts bash doivent fonctionner sur Ubuntu 24 (VPS Hetzner)
- Les clés SSH et tokens ne doivent JAMAIS être dans le code — secrets GitHub Actions uniquement
- Le smoke test doit bloquer le provisionnement si score < 60 (pas livrer un site cassé)
- Les backups doivent être testés automatiquement — un backup non testé n'est pas fiable
- Ajouter un monitor UptimeRobot à chaque provisionSite() call
```
