/**
 * Service Google My Business — Avis, Reponses, Posts GMB
 * Sprint 3 : stubs fonctionnels avec logs
 * Sprint 7+ : connexion reelle a l'API Google Business Profile
 */

// ---------- Types ----------

interface GMBConfig {
  apiKey: string
  baseUrl: string
}

interface GMBReview {
  reviewId: string
  reviewer: {
    displayName: string
    profilePhotoUrl: string | null
  }
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE'
  comment: string | null
  createTime: string
  updateTime: string
  reviewReply: {
    comment: string
    updateTime: string
  } | null
}

interface GMBReviewsResponse {
  reviews: GMBReview[]
  averageRating: number
  totalReviewCount: number
  nextPageToken: string | null
}

interface UpsertedReview {
  gmbReviewId: string
  rating: number
  comment: string | null
  reviewerName: string
  createdAt: string
  hasReply: boolean
}

interface SyncReviewsResult {
  upserted: UpsertedReview[]
  totalFetched: number
  averageRating: number
}

interface PublishReplyResult {
  success: boolean
  repliedAt: string
}

interface GMBPostContent {
  summary: string
  callToAction?: {
    actionType: 'LEARN_MORE' | 'BOOK' | 'ORDER' | 'SHOP' | 'SIGN_UP' | 'CALL'
    url: string
  }
  mediaUrl?: string
}

interface GMBPostResult {
  postId: string
  state: 'LIVE' | 'PENDING'
  publishedAt: string
}

// ---------- Helpers ----------

const STAR_RATING_MAP: Record<GMBReview['starRating'], number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
}

function toNumericRating(starRating: GMBReview['starRating']): number {
  return STAR_RATING_MAP[starRating]
}

// ---------- Service ----------

export class GMBService {
  private config: GMBConfig

  constructor(config: GMBConfig) {
    this.config = config
  }

  private get isStub(): boolean {
    return !this.config.apiKey || this.config.apiKey === 'stub'
  }

  /**
   * Synchronise les avis Google depuis l'API GMB
   * et upsert dans la table google_reviews
   */
  async syncReviews(siteId: string): Promise<SyncReviewsResult> {
    if (this.isStub) {
      console.log(`[GMBService] STUB: syncReviews("${siteId}")`)
      const stubReviews: UpsertedReview[] = [
        {
          gmbReviewId: `gmb-stub-review-${Date.now()}-1`,
          rating: 5,
          comment: 'Excellent service, je recommande vivement !',
          reviewerName: 'Marie D.',
          createdAt: new Date().toISOString(),
          hasReply: false,
        },
        {
          gmbReviewId: `gmb-stub-review-${Date.now()}-2`,
          rating: 4,
          comment: 'Tres professionnel, bon rapport qualite-prix.',
          reviewerName: 'Jean-Pierre L.',
          createdAt: new Date(Date.now() - 86_400_000).toISOString(),
          hasReply: true,
        },
      ]
      return {
        upserted: stubReviews,
        totalFetched: stubReviews.length,
        averageRating: 4.5,
      }
    }

    // Fetch reviews from Google Business Profile API
    const response = await fetch(
      `${this.config.baseUrl}/accounts/-/locations/-/reviews?pageSize=50`,
      {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`GMB API error (${response.status}): ${errorBody}`)
    }

    const data = (await response.json()) as GMBReviewsResponse

    const upserted: UpsertedReview[] = (data.reviews ?? []).map((review) => ({
      gmbReviewId: review.reviewId,
      rating: toNumericRating(review.starRating),
      comment: review.comment,
      reviewerName: review.reviewer.displayName,
      createdAt: review.createTime,
      hasReply: review.reviewReply !== null,
    }))

    return {
      upserted,
      totalFetched: data.totalReviewCount,
      averageRating: data.averageRating,
    }
  }

  /**
   * Publie une reponse a un avis sur GMB
   */
  async publishReply(
    siteId: string,
    gmbReviewId: string,
    reply: string,
  ): Promise<PublishReplyResult> {
    if (this.isStub) {
      console.log(
        `[GMBService] STUB: publishReply("${siteId}", "${gmbReviewId}", "${reply.slice(0, 50)}...")`,
      )
      return {
        success: true,
        repliedAt: new Date().toISOString(),
      }
    }

    const response = await fetch(
      `${this.config.baseUrl}/accounts/-/locations/-/reviews/${gmbReviewId}/reply`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment: reply }),
      },
    )

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`GMB reply error (${response.status}): ${errorBody}`)
    }

    return {
      success: true,
      repliedAt: new Date().toISOString(),
    }
  }

  /**
   * Publie un post Google My Business (actualite locale)
   */
  async publishGMBPost(
    siteId: string,
    content: GMBPostContent,
  ): Promise<GMBPostResult> {
    if (this.isStub) {
      console.log(
        `[GMBService] STUB: publishGMBPost("${siteId}", summary="${content.summary.slice(0, 50)}...")`,
      )
      return {
        postId: `gmb-stub-post-${Date.now()}`,
        state: 'LIVE',
        publishedAt: new Date().toISOString(),
      }
    }

    const body: Record<string, unknown> = {
      languageCode: 'fr',
      summary: content.summary,
      topicType: 'STANDARD',
    }

    if (content.callToAction) {
      body.callToAction = content.callToAction
    }

    if (content.mediaUrl) {
      body.media = [
        {
          mediaFormat: 'PHOTO',
          sourceUrl: content.mediaUrl,
        },
      ]
    }

    const response = await fetch(
      `${this.config.baseUrl}/accounts/-/locations/-/localPosts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`GMB post error (${response.status}): ${errorBody}`)
    }

    const result = (await response.json()) as {
      name: string
      state: 'LIVE' | 'PENDING'
      createTime: string
    }

    return {
      postId: result.name,
      state: result.state,
      publishedAt: result.createTime,
    }
  }
}

/**
 * Factory — cree une instance depuis les variables d'environnement
 */
export function createGMBService(): GMBService {
  return new GMBService({
    apiKey: process.env.GOOGLE_API_KEY ?? 'stub',
    baseUrl: process.env.GMB_API_BASE_URL ?? 'https://mybusiness.googleapis.com/v4',
  })
}
