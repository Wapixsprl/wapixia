/**
 * Service Meta (Facebook + Instagram) — Publication et gestion
 * Sprint 3 : stubs fonctionnels avec logs
 * Sprint 7+ : connexion reelle a l'API Graph
 */

// ---------- Constants ----------

const API_VERSION = 'v21.0'
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`

// ---------- Types ----------

interface MetaConfig {
  appId: string
}

interface FacebookPostParams {
  pageId: string
  accessToken: string
  message: string
  imageUrl?: string
  scheduledPublishTime?: number
}

interface FacebookPostResult {
  postId: string
  publishedAt: string
  scheduled: boolean
}

interface InstagramPostParams {
  igUserId: string
  accessToken: string
  imageUrl: string
  caption: string
}

interface InstagramPostResult {
  mediaId: string
  publishedAt: string
}

interface PageTokenValidation {
  valid: boolean
  pageId: string
  pageName: string
  igUserId: string | null
}

interface GraphApiError {
  error: {
    message: string
    type: string
    code: number
    fbtrace_id: string
  }
}

// ---------- Service ----------

export class MetaService {
  private config: MetaConfig

  constructor(config: MetaConfig) {
    this.config = config
  }

  private get isStub(): boolean {
    return !this.config.appId || this.config.appId === 'stub'
  }

  /**
   * Publie un post sur une Page Facebook
   * Supporte texte seul, texte + image, et publication programmee
   */
  async publishFacebookPost(params: FacebookPostParams): Promise<FacebookPostResult> {
    const { pageId, accessToken, message, imageUrl, scheduledPublishTime } = params

    if (this.isStub) {
      console.log(
        `[MetaService] STUB: publishFacebookPost(pageId="${pageId}", msg="${message.slice(0, 50)}...")`,
      )
      return {
        postId: `fb-stub-post-${Date.now()}`,
        publishedAt: new Date().toISOString(),
        scheduled: scheduledPublishTime !== undefined,
      }
    }

    // If an image is provided, use /photos endpoint; otherwise /feed
    const endpoint = imageUrl
      ? `${BASE_URL}/${pageId}/photos`
      : `${BASE_URL}/${pageId}/feed`

    const body: Record<string, string | number | boolean> = {
      access_token: accessToken,
      message,
    }

    if (imageUrl) {
      body.url = imageUrl
    }

    if (scheduledPublishTime !== undefined) {
      body.published = false
      body.scheduled_publish_time = scheduledPublishTime
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = (await response.json()) as GraphApiError
      throw new Error(
        `Facebook API error (${response.status}): ${errorData.error.message}`,
      )
    }

    const result = (await response.json()) as { id: string; post_id?: string }

    return {
      postId: result.post_id ?? result.id,
      publishedAt: new Date().toISOString(),
      scheduled: scheduledPublishTime !== undefined,
    }
  }

  /**
   * Publie un post Instagram (processus en 2 etapes)
   * Etape 1 : creation du container media
   * Etape 2 : publication du container
   */
  async publishInstagramPost(params: InstagramPostParams): Promise<InstagramPostResult> {
    const { igUserId, accessToken, imageUrl, caption } = params

    if (this.isStub) {
      console.log(
        `[MetaService] STUB: publishInstagramPost(igUser="${igUserId}", caption="${caption.slice(0, 50)}...")`,
      )
      return {
        mediaId: `ig-stub-media-${Date.now()}`,
        publishedAt: new Date().toISOString(),
      }
    }

    // Step 1: Create media container
    const containerResponse = await fetch(
      `${BASE_URL}/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption,
          access_token: accessToken,
        }),
      },
    )

    if (!containerResponse.ok) {
      const errorData = (await containerResponse.json()) as GraphApiError
      throw new Error(
        `Instagram container error (${containerResponse.status}): ${errorData.error.message}`,
      )
    }

    const container = (await containerResponse.json()) as { id: string }

    // Step 2: Publish the container
    const publishResponse = await fetch(
      `${BASE_URL}/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: container.id,
          access_token: accessToken,
        }),
      },
    )

    if (!publishResponse.ok) {
      const errorData = (await publishResponse.json()) as GraphApiError
      throw new Error(
        `Instagram publish error (${publishResponse.status}): ${errorData.error.message}`,
      )
    }

    const published = (await publishResponse.json()) as { id: string }

    return {
      mediaId: published.id,
      publishedAt: new Date().toISOString(),
    }
  }

  /**
   * Valide un Page Access Token et retourne les infos de la page
   * + l'Instagram Business Account ID si connecte
   */
  async validatePageToken(pageAccessToken: string): Promise<PageTokenValidation> {
    if (this.isStub) {
      console.log('[MetaService] STUB: validatePageToken()')
      return {
        valid: true,
        pageId: 'stub-page-123',
        pageName: 'Ma Page Stub',
        igUserId: 'stub-ig-456',
      }
    }

    // Validate token and get page info
    const response = await fetch(
      `${BASE_URL}/me?fields=id,name,instagram_business_account&access_token=${pageAccessToken}`,
    )

    if (!response.ok) {
      return {
        valid: false,
        pageId: '',
        pageName: '',
        igUserId: null,
      }
    }

    const data = (await response.json()) as {
      id: string
      name: string
      instagram_business_account?: { id: string }
    }

    return {
      valid: true,
      pageId: data.id,
      pageName: data.name,
      igUserId: data.instagram_business_account?.id ?? null,
    }
  }
}

/**
 * Factory — cree une instance depuis les variables d'environnement
 */
export function createMetaService(): MetaService {
  return new MetaService({
    appId: process.env.META_APP_ID ?? 'stub',
  })
}
