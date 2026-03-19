/**
 * Service Cloudflare — Gestion des sous-domaines et DNS
 * Sprint 2 : stubs fonctionnels avec logs
 * Sprint 6 : connexion réelle à l'API Cloudflare
 */

interface CloudflareConfig {
  apiToken: string
  zoneId: string
  baseDomain: string
  proxyHost: string
}

interface DnsRecord {
  id: string
  name: string
  content: string
  type: string
  proxied: boolean
}

export class CloudflareService {
  private config: CloudflareConfig

  constructor(config: CloudflareConfig) {
    this.config = config
  }

  /**
   * Crée un sous-domaine temporaire : {slug}.wapixia.com
   * Pointe vers le VPS WapixIA via CNAME proxied
   */
  async createSubdomain(slug: string): Promise<{ domain: string; recordId: string }> {
    const domain = `${slug}.${this.config.baseDomain}`

    if (!this.config.apiToken || this.config.apiToken === 'stub') {
      // Mode stub — retourne un domaine fictif pour le développement
      console.log(`[CloudflareService] STUB: createSubdomain("${slug}") → ${domain}`)
      return {
        domain,
        recordId: `cf-stub-${Date.now()}`,
      }
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.config.zoneId}/dns_records`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'CNAME',
          name: slug,
          content: this.config.proxyHost,
          proxied: true,
          ttl: 1, // Auto TTL when proxied
        }),
      },
    )

    const data = (await response.json()) as { success: boolean; result: DnsRecord; errors: { message: string }[] }

    if (!data.success) {
      throw new Error(`Cloudflare DNS error: ${data.errors?.[0]?.message ?? 'Unknown error'}`)
    }

    return {
      domain,
      recordId: data.result.id,
    }
  }

  /**
   * Vérifie la propagation DNS d'un domaine personnalisé
   * Le client doit pointer son CNAME vers proxy.wapixia.com
   */
  async verifyDNSPropagation(domain: string): Promise<{ verified: boolean; cnameFound: boolean }> {
    if (!this.config.apiToken || this.config.apiToken === 'stub') {
      console.log(`[CloudflareService] STUB: verifyDNSPropagation("${domain}")`)
      return { verified: false, cnameFound: false }
    }

    try {
      const response = await fetch(`https://dns.google/resolve?name=${domain}&type=CNAME`)
      const data = (await response.json()) as { Answer?: { data: string }[] }

      const cnameFound = data.Answer?.some(
        (record) => record.data.includes(this.config.proxyHost),
      ) ?? false

      return { verified: cnameFound, cnameFound }
    } catch {
      return { verified: false, cnameFound: false }
    }
  }

  /**
   * Supprime un enregistrement DNS (cleanup)
   */
  async deleteSubdomain(recordId: string): Promise<void> {
    if (!this.config.apiToken || this.config.apiToken === 'stub') {
      console.log(`[CloudflareService] STUB: deleteSubdomain("${recordId}")`)
      return
    }

    await fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.config.zoneId}/dns_records/${recordId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
        },
      },
    )
  }
}

/**
 * Factory — crée une instance depuis les variables d'environnement
 */
export function createCloudflareService(): CloudflareService {
  return new CloudflareService({
    apiToken: process.env.CLOUDFLARE_API_TOKEN ?? 'stub',
    zoneId: process.env.CLOUDFLARE_ZONE_ID ?? '',
    baseDomain: process.env.WAPIXIA_BASE_DOMAIN ?? 'wapixia.com',
    proxyHost: process.env.WAPIXIA_PROXY_HOST ?? 'proxy.wapixia.com',
  })
}
