// @wapixia/ai — Types for AI-generated site content

// ---------- Reusable building blocks ----------

export interface Feature {
  icon: string
  title: string
  description: string
}

export interface Testimonial {
  author: string
  role: string
  rating: number
  text: string
}

export interface FAQItem {
  question: string
  answer: string
}

export interface Service {
  name: string
  h2: string
  description: string
  details: string
  duration: string | null
  priceFrom: string | null
  faq: FAQItem[]
}

export interface SEOMeta {
  metaTitle: string
  metaDescription: string
}

export interface LegalSection {
  title: string
  content: string
}

export interface WhyReason {
  title: string
  text: string
}

// ---------- Schema.org ----------

export interface LocalBusinessSchema {
  '@context': 'https://schema.org'
  '@type': string
  name: string
  description: string
  url: string
  telephone: string
  email: string
  address: {
    '@type': 'PostalAddress'
    streetAddress: string
    addressLocality: string
    postalCode: string
    addressCountry: string
  }
  geo?: {
    '@type': 'GeoCoordinates'
    latitude: number
    longitude: number
  }
  openingHoursSpecification?: unknown[]
  aggregateRating?: {
    '@type': 'AggregateRating'
    ratingValue: number
    reviewCount: number
  }
  sameAs: string[]
  priceRange?: string
}

// ---------- Page types ----------

export interface HomePage {
  hero: {
    headline: string
    subheadline: string
    ctaPrimary: string
    ctaSecondary: string
  }
  intro: string
  features: Feature[]
  testimonials: Testimonial[]
  faq: FAQItem[]
  ctaFinal: {
    headline: string
    subtext: string
    cta: string
  }
  seo: SEOMeta & { h1: string }
}

export interface ServicesPage {
  title: string
  intro: string
  services: Service[]
  seo: SEOMeta
}

export interface AboutPage {
  title: string
  story: string
  mission: string
  why: {
    title: string
    reasons: WhyReason[]
  }
  expertise: {
    title: string
    text: string
    certifications: string[]
  }
  seo: SEOMeta
}

export interface ContactPage {
  title: string
  intro: string
  address_section: {
    title: string
    directions: string
  }
  hours_section: {
    title: string
    note: string | null
  }
  form_section: {
    title: string
    subtitle: string
  }
  seo: SEOMeta
}

export interface FAQCategory {
  name: string
  questions: FAQItem[]
}

export interface FAQPage {
  title: string
  intro: string
  categories: FAQCategory[]
}

export interface LegalPage {
  title: string
  sections: LegalSection[]
}

// ---------- Top-level generated content ----------

export interface GeneratedSiteContent {
  pages: {
    home: HomePage
    services: ServicesPage
    about: AboutPage
    contact: ContactPage
    faq: FAQPage
    legal: LegalPage
  }

  seo: {
    metaTitle: string
    metaDescription: string
    h1: string
    keywords: string[]
    schemaOrg: LocalBusinessSchema
  }

  business: {
    name: string
    description: string
    shortDescription: string
    services: Service[]
    uniqueSellingPoint: string
    targetAudience: string
  }
}

// ---------- Generation result ----------

export interface GenerationResult<T> {
  content: T
  tokensUsed: number
}

export interface SiteGenerationResult {
  content: GeneratedSiteContent
  totalTokensUsed: number
}
