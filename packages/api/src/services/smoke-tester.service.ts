/**
 * Service Smoke Tester — Tests post-déploiement
 * Sprint 6 : vérifications automatiques après chaque déploiement
 *
 * Effectue 7 vérifications sur un site déployé :
 *   1. Homepage retourne 200
 *   2. Certificat SSL valide
 *   3. robots.txt accessible
 *   4. sitemap.xml accessible
 *   5. Contenu SSR (balise h1 présente)
 *   6. Meta tags (title + description)
 *   7. Temps de réponse < 5s
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SmokeCheck {
  name: string
  passed: boolean
  detail: string
  durationMs: number
}

interface SmokeTestResult {
  passed: boolean
  checks: SmokeCheck[]
  seoScore: number
  totalDurationMs: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function timedFetch(
  url: string,
  timeoutMs: number = 10_000,
): Promise<{ response: Response | null; durationMs: number; error: string | null }> {
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    clearTimeout(timer)
    return { response, durationMs: Date.now() - start, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return { response: null, durationMs: Date.now() - start, error: message }
  }
}

function extractTag(html: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i')
  const match = html.match(regex)
  return match?.[1]?.trim() ?? null
}

function extractMetaContent(html: string, name: string): string | null {
  const regex = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
    'i',
  )
  const match = html.match(regex)
  if (match) return match[1]?.trim() ?? null

  // Attributs dans l'autre ordre
  const regexAlt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`,
    'i',
  )
  const matchAlt = html.match(regexAlt)
  return matchAlt?.[1]?.trim() ?? null
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SmokeTesterService {
  /**
   * Lance les 7 vérifications sur le domaine fourni.
   * Utilise uniquement fetch (pas de Puppeteer en V1).
   */
  async smokeTestSite(domain: string): Promise<SmokeTestResult> {
    const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`
    const checks: SmokeCheck[] = []
    const totalStart = Date.now()

    console.log(`[SmokeTester] Démarrage des tests pour ${baseUrl}`)

    // 1 — Homepage 200
    const homepageResult = await this.checkHomepage(baseUrl)
    checks.push(homepageResult.check)
    const homepageHtml = homepageResult.html

    // 2 — SSL valide
    checks.push(await this.checkSSL(baseUrl))

    // 3 — robots.txt
    checks.push(await this.checkRobotsTxt(baseUrl))

    // 4 — sitemap.xml
    checks.push(await this.checkSitemapXml(baseUrl))

    // 5 — SSR content (h1)
    checks.push(this.checkSSRContent(homepageHtml))

    // 6 — Meta tags
    checks.push(this.checkMetaTags(homepageHtml))

    // 7 — Temps de réponse < 5s
    checks.push(this.checkResponseTime(homepageResult.durationMs))

    const passedCount = checks.filter((c) => c.passed).length
    const seoScore = Math.round((passedCount / checks.length) * 100)
    const passed = checks.every((c) => c.passed)

    const result: SmokeTestResult = {
      passed,
      checks,
      seoScore,
      totalDurationMs: Date.now() - totalStart,
    }

    console.log(
      `[SmokeTester] Résultat: ${passedCount}/${checks.length} checks OK — SEO score: ${seoScore} — ${passed ? 'PASS' : 'FAIL'}`,
    )

    return result
  }

  // ── Checks individuels ──

  private async checkHomepage(
    baseUrl: string,
  ): Promise<{ check: SmokeCheck; html: string; durationMs: number }> {
    const { response, durationMs, error } = await timedFetch(baseUrl)

    if (error || !response) {
      return {
        check: {
          name: 'homepage_200',
          passed: false,
          detail: `Erreur: ${error ?? 'Pas de réponse'}`,
          durationMs,
        },
        html: '',
        durationMs,
      }
    }

    const html = await response.text()
    const passed = response.status === 200

    return {
      check: {
        name: 'homepage_200',
        passed,
        detail: passed
          ? `HTTP ${response.status} OK`
          : `HTTP ${response.status} — attendu 200`,
        durationMs,
      },
      html,
      durationMs,
    }
  }

  private async checkSSL(baseUrl: string): Promise<SmokeCheck> {
    const start = Date.now()

    if (!baseUrl.startsWith('https://')) {
      return {
        name: 'ssl_valid',
        passed: false,
        detail: 'URL ne commence pas par https://',
        durationMs: Date.now() - start,
      }
    }

    const { response, durationMs, error } = await timedFetch(baseUrl, 5_000)

    if (error) {
      const isSslError =
        error.includes('certificate') ||
        error.includes('SSL') ||
        error.includes('CERT')
      return {
        name: 'ssl_valid',
        passed: false,
        detail: isSslError ? `Erreur SSL: ${error}` : `Erreur connexion: ${error}`,
        durationMs,
      }
    }

    return {
      name: 'ssl_valid',
      passed: true,
      detail: 'Connexion HTTPS établie avec succès',
      durationMs,
    }
  }

  private async checkRobotsTxt(baseUrl: string): Promise<SmokeCheck> {
    const { response, durationMs, error } = await timedFetch(`${baseUrl}/robots.txt`)

    if (error || !response) {
      return {
        name: 'robots_txt',
        passed: false,
        detail: `Erreur: ${error ?? 'Pas de réponse'}`,
        durationMs,
      }
    }

    const text = await response.text()
    const passed = response.status === 200 && text.toLowerCase().includes('user-agent')

    return {
      name: 'robots_txt',
      passed,
      detail: passed
        ? 'robots.txt trouvé et valide'
        : `HTTP ${response.status} — contenu invalide ou absent`,
      durationMs,
    }
  }

  private async checkSitemapXml(baseUrl: string): Promise<SmokeCheck> {
    const { response, durationMs, error } = await timedFetch(`${baseUrl}/sitemap.xml`)

    if (error || !response) {
      return {
        name: 'sitemap_xml',
        passed: false,
        detail: `Erreur: ${error ?? 'Pas de réponse'}`,
        durationMs,
      }
    }

    const text = await response.text()
    const passed =
      response.status === 200 &&
      (text.includes('<urlset') || text.includes('<sitemapindex'))

    return {
      name: 'sitemap_xml',
      passed,
      detail: passed
        ? 'sitemap.xml trouvé et valide'
        : `HTTP ${response.status} — contenu invalide ou absent`,
      durationMs,
    }
  }

  private checkSSRContent(html: string): SmokeCheck {
    const start = Date.now()
    const h1 = extractTag(html, 'h1')
    const passed = h1 !== null && h1.length > 0

    return {
      name: 'ssr_content',
      passed,
      detail: passed
        ? `Balise h1 trouvée: "${h1.substring(0, 60)}${h1.length > 60 ? '...' : ''}"`
        : 'Aucune balise h1 trouvée dans le HTML',
      durationMs: Date.now() - start,
    }
  }

  private checkMetaTags(html: string): SmokeCheck {
    const start = Date.now()
    const title = extractTag(html, 'title')
    const description = extractMetaContent(html, 'description')

    const hasTitle = title !== null && title.length > 0
    const hasDescription = description !== null && description.length > 0
    const passed = hasTitle && hasDescription

    const details: string[] = []
    if (hasTitle) details.push(`title: "${title.substring(0, 50)}"`)
    else details.push('title manquant')
    if (hasDescription) details.push(`description: "${description.substring(0, 50)}"`)
    else details.push('meta description manquante')

    return {
      name: 'meta_tags',
      passed,
      detail: details.join(' | '),
      durationMs: Date.now() - start,
    }
  }

  private checkResponseTime(durationMs: number): SmokeCheck {
    const maxMs = 5_000
    const passed = durationMs < maxMs

    return {
      name: 'response_time',
      passed,
      detail: passed
        ? `${durationMs}ms (< ${maxMs}ms)`
        : `${durationMs}ms — trop lent (max ${maxMs}ms)`,
      durationMs,
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSmokeTesterService(): SmokeTesterService {
  return new SmokeTesterService()
}

// ---------------------------------------------------------------------------
// Re-export types
// ---------------------------------------------------------------------------

export type { SmokeCheck, SmokeTestResult }
