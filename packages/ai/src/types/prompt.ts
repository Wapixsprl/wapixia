// @wapixia/ai — Types for AI prompt templates and site context

export interface PromptTemplate {
  version: string
  model: 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001'
  maxTokens: number
  system: string
  user: (context: SiteContext) => string
}

export interface SiteContext {
  businessName: string
  sector: string
  city: string
  zip: string
  description: string
  services: string[]
  uniqueSellingPoint: string
  targetAudience: string
  tone: 'friendly' | 'professional' | 'expert' | 'dynamic' | 'premium'
  language: 'fr' | 'nl' | 'en'
  priceRange: 'budget' | 'medium' | 'premium' | 'variable'
  openingHours?: Record<string, string>
  phone?: string
  website?: string
  previousContent?: string[]
  currentSeason?: string
  currentMonth?: string
}

// ---------- Module result types ----------

export interface SocialPost {
  platform: 'facebook' | 'instagram' | 'linkedin'
  content: string
  hashtags: string[]
  imageKeywords: string[]
  ctaText: string
}

export interface SocialPostResult {
  posts: SocialPost[]
}

export interface BlogArticleResult {
  title: string
  slug: string
  excerpt: string
  content: string
  faq: { question: string; answer: string }[]
  seo: {
    metaTitle: string
    metaDescription: string
  }
  keywords: string[]
  wordCount: number
}

export interface GMBPostResult {
  summary: string
  callToAction: {
    type: 'LEARN_MORE' | 'BOOK' | 'ORDER' | 'SHOP' | 'SIGN_UP' | 'CALL'
    url: string
  }
  imageKeywords: string[]
}

export interface ReviewData {
  authorName: string
  rating: number
  text: string
  date: string
}

export interface ReviewReplyResult {
  reply: string
  tone: 'grateful' | 'empathetic' | 'constructive' | 'neutral'
  sentiment: 'positive' | 'negative' | 'mixed'
}
