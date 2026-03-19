/**
 * Service Coolify — Déploiement automatique des sites clients
 * Sprint 2 : stubs fonctionnels avec logs
 * Sprint 6 : connexion réelle à l'API Coolify
 */

interface CoolifyConfig {
  baseUrl: string
  apiToken: string
}

interface CreateApplicationParams {
  name: string
  domain: string
  envVars: Record<string, string>
}

interface DeploymentStatus {
  status: 'running' | 'finished' | 'failed'
  logs: string
}

export class CoolifyService {
  private config: CoolifyConfig

  constructor(config: CoolifyConfig) {
    this.config = config
  }

  /**
   * Crée une nouvelle application Coolify pour un site client
   */
  async createApplication(params: CreateApplicationParams): Promise<{ appId: string }> {
    if (!this.config.apiToken || this.config.apiToken === 'stub') {
      console.log(`[CoolifyService] STUB: createApplication("${params.name}") → domain: ${params.domain}`)
      return { appId: `coolify-stub-${Date.now()}` }
    }

    const response = await fetch(`${this.config.baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: params.name,
        fqdn: `https://${params.domain}`,
        git_repository: process.env.SITE_TEMPLATE_REPO ?? '',
        git_branch: process.env.SITE_TEMPLATE_BRANCH ?? 'main',
        build_pack: 'nixpacks',
        ports_exposes: '3000',
        environment: Object.entries(params.envVars).map(([key, value]) => ({
          key,
          value,
          is_build_time: false,
        })),
      }),
    })

    const data = (await response.json()) as { uuid: string }
    return { appId: data.uuid }
  }

  /**
   * Déclenche le déploiement d'une application
   */
  async triggerDeploy(appId: string): Promise<{ deploymentId: string }> {
    if (!this.config.apiToken || this.config.apiToken === 'stub') {
      console.log(`[CoolifyService] STUB: triggerDeploy("${appId}")`)
      return { deploymentId: `deploy-stub-${Date.now()}` }
    }

    const response = await fetch(`${this.config.baseUrl}/api/v1/applications/${appId}/restart`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
      },
    })

    const data = (await response.json()) as { deployment_uuid: string }
    return { deploymentId: data.deployment_uuid }
  }

  /**
   * Vérifie le statut d'un déploiement
   */
  async getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus> {
    if (!this.config.apiToken || this.config.apiToken === 'stub') {
      console.log(`[CoolifyService] STUB: getDeploymentStatus("${deploymentId}") → finished`)
      return { status: 'finished', logs: 'Stub deployment completed successfully' }
    }

    const response = await fetch(
      `${this.config.baseUrl}/api/v1/deployments/${deploymentId}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
        },
      },
    )

    const data = (await response.json()) as { status: string; logs: string }

    let status: DeploymentStatus['status'] = 'running'
    if (data.status === 'finished') status = 'finished'
    if (data.status === 'failed' || data.status === 'error') status = 'failed'

    return { status, logs: data.logs ?? '' }
  }

  /**
   * Met à jour le domaine d'une application (lors de la connexion d'un domaine personnalisé)
   */
  async updateDomain(appId: string, newDomain: string): Promise<void> {
    if (!this.config.apiToken || this.config.apiToken === 'stub') {
      console.log(`[CoolifyService] STUB: updateDomain("${appId}", "${newDomain}")`)
      return
    }

    await fetch(`${this.config.baseUrl}/api/v1/applications/${appId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fqdn: `https://${newDomain}`,
      }),
    })
  }
}

/**
 * Factory — crée une instance depuis les variables d'environnement
 */
export function createCoolifyService(): CoolifyService {
  return new CoolifyService({
    baseUrl: process.env.COOLIFY_BASE_URL ?? 'http://localhost:8000',
    apiToken: process.env.COOLIFY_API_TOKEN ?? 'stub',
  })
}
