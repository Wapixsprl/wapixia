// @wapixia/ai — Main site content generator using Claude API

import Anthropic from '@anthropic-ai/sdk'
import type {
  AboutPage,
  ContactPage,
  FAQPage,
  GeneratedSiteContent,
  GenerationResult,
  HomePage,
  LegalPage,
  LocalBusinessSchema,
  Service,
  ServicesPage,
  SiteGenerationResult,
} from '../types/generated-content.js'
import { buildSystemPrompt } from '../prompts/system.js'
import { buildHomePrompt } from '../prompts/home.js'
import { buildServicesPrompt } from '../prompts/services.js'
import { buildAboutPrompt } from '../prompts/about.js'
import { buildContactPrompt } from '../prompts/contact.js'
import { buildFAQPrompt } from '../prompts/faq.js'
import { buildLegalPrompt } from '../prompts/legal.js'

/** Model used for content generation */
const MODEL = 'claude-sonnet-4-6' as const

/** Max tokens for a single page generation */
const MAX_TOKENS = 4096

/** Mapping sector key to Schema.org @type */
const SECTOR_SCHEMA_TYPE: Record<string, string> = {
  btp: 'HomeAndConstructionBusiness',
  beaute: 'BeautySalon',
  horeca: 'Restaurant',
  immobilier: 'RealEstateAgent',
  medical: 'MedicalClinic',
  automobile: 'AutoDealer',
  commerce: 'Store',
  b2b: 'ProfessionalService',
  fitness: 'SportsClub',
  asbl: 'NGO',
}

/** Mapping price_range key to Schema.org priceRange */
const PRICE_RANGE_MAP: Record<string, string> = {
  budget: '\u20AC',
  medium: '\u20AC\u20AC',
  premium: '\u20AC\u20AC\u20AC',
  variable: '\u20AC-\u20AC\u20AC\u20AC',
}

export class SiteGenerator {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  /**
   * Generate all 6 pages of content in parallel for a site.
   * Returns the full GeneratedSiteContent structure + total token usage.
   */
  async generateSiteContent(onboardingData: Record<string, unknown>): Promise<SiteGenerationResult> {
    const systemPrompt = buildSystemPrompt(onboardingData)

    const [homeResult, servicesResult, aboutResult, contactResult, faqResult, legalResult] =
      await Promise.all([
        this.generatePage<HomePage>(systemPrompt, buildHomePrompt(onboardingData)),
        this.generatePage<ServicesPage>(systemPrompt, buildServicesPrompt(onboardingData)),
        this.generatePage<AboutPage>(systemPrompt, buildAboutPrompt(onboardingData)),
        this.generatePage<ContactPage>(systemPrompt, buildContactPrompt(onboardingData)),
        this.generatePage<FAQPage>(systemPrompt, buildFAQPrompt(onboardingData)),
        this.generatePage<LegalPage>(systemPrompt, buildLegalPrompt(onboardingData)),
      ])

    const totalTokensUsed =
      homeResult.tokensUsed +
      servicesResult.tokensUsed +
      aboutResult.tokensUsed +
      contactResult.tokensUsed +
      faqResult.tokensUsed +
      legalResult.tokensUsed

    const content = this.assembleSiteContent(
      onboardingData,
      homeResult.content,
      servicesResult.content,
      aboutResult.content,
      contactResult.content,
      faqResult.content,
      legalResult.content,
    )

    return { content, totalTokensUsed }
  }

  /**
   * Call Claude with a system prompt and user prompt, parse the JSON response.
   * Returns typed content and token usage.
   */
  private async generatePage<T>(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<GenerationResult<T>> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude response did not contain a text block')
    }

    const parsed = this.parseJSON<T>(textBlock.text)

    const tokensUsed =
      (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0)

    return { content: parsed, tokensUsed }
  }

  /**
   * Parse JSON from Claude response text.
   * Handles cases where JSON may be wrapped in markdown code blocks.
   */
  private parseJSON<T>(text: string): T {
    let cleaned = text.trim()

    // Strip markdown code blocks if present
    if (cleaned.startsWith('```')) {
      const firstNewline = cleaned.indexOf('\n')
      if (firstNewline !== -1) {
        cleaned = cleaned.slice(firstNewline + 1)
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3).trim()
      }
    }

    try {
      return JSON.parse(cleaned) as T
    } catch (error) {
      throw new Error(
        `Failed to parse Claude JSON response: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Assemble the top-level GeneratedSiteContent from individual page results
   * and onboarding data.
   */
  private assembleSiteContent(
    onboardingData: Record<string, unknown>,
    home: HomePage,
    services: ServicesPage,
    about: AboutPage,
    contact: ContactPage,
    faq: FAQPage,
    legal: LegalPage,
  ): GeneratedSiteContent {
    const businessName = typeof onboardingData['business_name'] === 'string'
      ? onboardingData['business_name']
      : ''
    const description = typeof onboardingData['description'] === 'string'
      ? onboardingData['description']
      : ''
    const usp = typeof onboardingData['unique_selling_point'] === 'string'
      ? onboardingData['unique_selling_point']
      : ''
    const targetAudience = typeof onboardingData['target_audience'] === 'string'
      ? onboardingData['target_audience']
      : ''
    const sector = typeof onboardingData['sector'] === 'string'
      ? onboardingData['sector']
      : ''
    const priceRange = typeof onboardingData['price_range'] === 'string'
      ? onboardingData['price_range']
      : ''

    const locationData = onboardingData['location'] as Record<string, unknown> | undefined
    const contactData = onboardingData['contact'] as Record<string, unknown> | undefined
    const socialData = onboardingData['social_links'] as Record<string, unknown> | undefined

    const schemaOrg: LocalBusinessSchema = {
      '@context': 'https://schema.org',
      '@type': SECTOR_SCHEMA_TYPE[sector] ?? 'LocalBusiness',
      name: businessName,
      description: description.slice(0, 300),
      url: '',
      telephone: typeof contactData?.['phone'] === 'string' ? contactData['phone'] : '',
      email: typeof contactData?.['email'] === 'string' ? contactData['email'] : '',
      address: {
        '@type': 'PostalAddress',
        streetAddress: typeof locationData?.['address'] === 'string' ? locationData['address'] : '',
        addressLocality: typeof locationData?.['city'] === 'string' ? locationData['city'] : '',
        postalCode: typeof locationData?.['zip'] === 'string' ? locationData['zip'] : '',
        addressCountry: 'BE',
      },
      sameAs: socialData
        ? Object.values(socialData).filter((v): v is string => typeof v === 'string' && v.length > 0)
        : [],
      priceRange: PRICE_RANGE_MAP[priceRange],
    }

    // Build service list from generated services page
    const servicesList: Service[] = services.services.map((s) => ({
      name: s.name,
      h2: s.h2,
      description: s.description,
      details: s.details,
      duration: s.duration,
      priceFrom: s.priceFrom,
      faq: s.faq,
    }))

    // Derive short description from intro (first 50 words)
    const shortDescription = home.intro.split(/\s+/).slice(0, 50).join(' ')

    // Derive keywords from sector + city + business name + service names
    const city = typeof locationData?.['city'] === 'string' ? locationData['city'] : ''
    const keywords = [
      sector,
      city,
      businessName,
      ...servicesList.map((s) => s.name),
    ].filter((k) => k.length > 0)

    return {
      pages: { home, services, about, contact, faq, legal },
      seo: {
        metaTitle: home.seo.metaTitle,
        metaDescription: home.seo.metaDescription,
        h1: home.seo.h1,
        keywords,
        schemaOrg,
      },
      business: {
        name: businessName,
        description,
        shortDescription,
        services: servicesList,
        uniqueSellingPoint: usp,
        targetAudience,
      },
    }
  }
}
