/**
 * Service Brevo (ex-Sendinblue) — Emails transactionnels
 * Sprint 2 : stub avec log console
 * Sprint 5 : connexion réelle à l'API Brevo
 */

interface BrevoConfig {
  apiKey: string
}

interface SendEmailParams {
  templateId: number
  to: string
  toName?: string
  params: Record<string, string>
}

// Template IDs — à configurer dans Brevo
export const BREVO_TEMPLATES = {
  SITE_READY: 1,
  INVITATION: 2,
  PASSWORD_RESET: 3,
  PAYMENT_RECEIPT: 4,
  PAYMENT_FAILED: 5,
  MONTHLY_REPORT: 6,
} as const

export class BrevoService {
  private config: BrevoConfig

  constructor(config: BrevoConfig) {
    this.config = config
  }

  /**
   * Envoie un email transactionnel via un template Brevo
   */
  async send(params: SendEmailParams): Promise<{ messageId: string }> {
    if (!this.config.apiKey || this.config.apiKey === 'stub') {
      console.log(
        `[BrevoService] STUB: send(template=${params.templateId}, to="${params.to}", params=${JSON.stringify(params.params)})`,
      )
      return { messageId: `brevo-stub-${Date.now()}` }
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateId: params.templateId,
        to: [{ email: params.to, name: params.toName ?? params.to }],
        params: params.params,
      }),
    })

    const data = (await response.json()) as { messageId: string }
    return { messageId: data.messageId }
  }

  /**
   * Envoie un email "Votre site est prêt"
   */
  async sendSiteReady(params: {
    email: string
    siteName: string
    siteUrl: string
  }): Promise<{ messageId: string }> {
    return this.send({
      templateId: BREVO_TEMPLATES.SITE_READY,
      to: params.email,
      params: {
        site_name: params.siteName,
        site_url: params.siteUrl,
      },
    })
  }
}

/**
 * Factory — crée une instance depuis les variables d'environnement
 */
export function createBrevoService(): BrevoService {
  return new BrevoService({
    apiKey: process.env.BREVO_API_KEY ?? 'stub',
  })
}
