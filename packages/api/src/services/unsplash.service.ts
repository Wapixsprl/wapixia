/**
 * Service Unsplash — Recherche d'images libres de droits
 * Sprint 3 : stubs fonctionnels avec logs
 * Sprint 7+ : connexion reelle a l'API Unsplash
 */

// ---------- Types ----------

interface UnsplashConfig {
  accessKey: string
  baseUrl: string
}

interface UnsplashImage {
  url: string
  thumbUrl: string
  altText: string
  attribution: string
  photographerUrl: string
}

interface GetImageParams {
  sector: string
  keywords: string[]
  orientation?: 'landscape' | 'portrait' | 'squarish'
}

// ---------- Sector mapping ----------

const SECTOR_QUERY_MAP: Record<string, string> = {
  beaute: 'beauty salon hair skincare',
  coiffure: 'hair salon hairstyle barber',
  btp: 'construction renovation building',
  immobilier: 'real estate house property',
  restaurant: 'restaurant food cuisine dining',
  boulangerie: 'bakery bread pastry',
  garage: 'auto repair mechanic car garage',
  plomberie: 'plumbing plumber repair',
  electricite: 'electrician electrical wiring',
  dentiste: 'dental dentist clinic smile',
  medecin: 'doctor medical health clinic',
  avocat: 'lawyer law office legal',
  comptable: 'accounting finance office',
  architecte: 'architecture design building modern',
  photographe: 'photography camera studio',
  fleuriste: 'florist flowers bouquet shop',
  fitness: 'fitness gym workout training',
  yoga: 'yoga meditation wellness studio',
  veterinaire: 'veterinary pet animal clinic',
  informatique: 'technology computer IT office',
  marketing: 'marketing digital office creative',
  formation: 'training education classroom learning',
}

/**
 * Construit la query Unsplash a partir du secteur et des mots-cles
 */
export function buildUnsplashQuery(sector: string, keywords: string[]): string {
  const sectorTerms = SECTOR_QUERY_MAP[sector.toLowerCase()] ?? sector
  const keywordsStr = keywords.join(' ')
  return `${sectorTerms} ${keywordsStr}`.trim()
}

// ---------- Unsplash API response types ----------

interface UnsplashSearchResponse {
  total: number
  total_pages: number
  results: UnsplashPhoto[]
}

interface UnsplashPhoto {
  id: string
  alt_description: string | null
  description: string | null
  urls: {
    raw: string
    full: string
    regular: string
    small: string
    thumb: string
  }
  user: {
    name: string
    links: {
      html: string
    }
  }
  links: {
    download_location: string
  }
}

// ---------- Service ----------

export class UnsplashService {
  private config: UnsplashConfig

  constructor(config: UnsplashConfig) {
    this.config = config
  }

  private get isStub(): boolean {
    return !this.config.accessKey || this.config.accessKey === 'stub'
  }

  /**
   * Recherche une image adaptee au secteur et aux mots-cles
   * Retourne la premiere image pertinente avec attribution
   */
  async getImageForPost(params: GetImageParams): Promise<UnsplashImage | null> {
    const { sector, keywords, orientation } = params
    const query = buildUnsplashQuery(sector, keywords)

    if (this.isStub) {
      console.log(
        `[UnsplashService] STUB: getImageForPost(sector="${sector}", query="${query}")`,
      )
      return {
        url: `https://images.unsplash.com/photo-stub-${Date.now()}?w=1080`,
        thumbUrl: `https://images.unsplash.com/photo-stub-${Date.now()}?w=400`,
        altText: `Image ${sector} - ${keywords.join(', ')}`,
        attribution: 'Photo by Stub Photographer on Unsplash',
        photographerUrl: 'https://unsplash.com/@stub-photographer',
      }
    }

    // Build search URL
    const searchParams = new URLSearchParams({
      query,
      per_page: '1',
      content_filter: 'high',
    })

    if (orientation) {
      searchParams.set('orientation', orientation)
    }

    const response = await fetch(
      `${this.config.baseUrl}/search/photos?${searchParams.toString()}`,
      {
        headers: {
          Authorization: `Client-ID ${this.config.accessKey}`,
          'Accept-Version': 'v1',
        },
      },
    )

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Unsplash API error (${response.status}): ${errorBody}`)
    }

    const data = (await response.json()) as UnsplashSearchResponse

    if (data.results.length === 0) {
      return null
    }

    const photo = data.results[0]

    // Trigger download (obligation API Unsplash — track downloads)
    await this.triggerDownload(photo.links.download_location)

    return {
      url: photo.urls.regular,
      thumbUrl: photo.urls.small,
      altText: photo.alt_description ?? photo.description ?? `${sector} image`,
      attribution: `Photo by ${photo.user.name} on Unsplash`,
      photographerUrl: photo.user.links.html,
    }
  }

  /**
   * Declenche le tracking de telechargement (obligation Unsplash API Guidelines)
   * https://help.unsplash.com/en/articles/2511258-guideline-triggering-a-download
   */
  private async triggerDownload(downloadLocation: string): Promise<void> {
    try {
      await fetch(downloadLocation, {
        headers: {
          Authorization: `Client-ID ${this.config.accessKey}`,
          'Accept-Version': 'v1',
        },
      })
    } catch {
      // Non-blocking — log but don't fail the main request
      console.warn('[UnsplashService] Failed to trigger download tracking')
    }
  }
}

/**
 * Factory — cree une instance depuis les variables d'environnement
 */
export function createUnsplashService(): UnsplashService {
  return new UnsplashService({
    accessKey: process.env.UNSPLASH_ACCESS_KEY ?? 'stub',
    baseUrl: process.env.UNSPLASH_BASE_URL ?? 'https://api.unsplash.com',
  })
}
